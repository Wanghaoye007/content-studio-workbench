# 局域网部署

本文用于在一台常开 Mac 上部署完整 Content Studio，并通过可信局域网提供 HTTPS 访问。生产服务仍只监听回环地址，浏览器通过自带 HTTPS 网关访问。

## 前置条件

- Node.js 24。
- Mac 与运营设备位于同一可信局域网。
- 路由器为服务 Mac 保留固定 DHCP 地址。
- 不配置公网端口映射。
- 本文示例使用 `10.10.2.106:8443`，地址变化后必须重新签发证书并修改环境文件。

## 1. 创建私有目录

```bash
mkdir -p "$HOME/.content-studio"/{auth,data/assets,tls,secrets,backups,logs}
chmod 700 "$HOME/.content-studio" "$HOME/.content-studio"/*
```

## 2. 初始化账号

```bash
npm run lan:auth -- \
  --auth-file "$HOME/.content-studio/auth/auth.json" \
  --credentials-file "$HOME/.content-studio/auth/initial-credentials.txt" \
  --tenant tenant-internal \
  --project project-default \
  --owner-email owner@content-studio.local \
  --creator-email operator@content-studio.local \
  --apply
```

脚本不会在终端打印密码。初始密码和 Owner TOTP URI 只写入 `initial-credentials.txt`；完成首次登录和验证器登记后删除该文件。Owner 强制 MFA，Creator 默认不启用 MFA。

创建默认项目、Creator 成员和项目成员关系：

```bash
node scripts/bootstrap-lan-database.mjs \
  --auth-file "$HOME/.content-studio/auth/auth.json" \
  --database "$HOME/.content-studio/data/content-studio.sqlite" \
  --project project-default \
  --project-name 运营工作台
```

## 3. 生成局域网证书

```bash
npm run lan:cert -- \
  --host 10.10.2.106 \
  --output-dir "$HOME/.content-studio/tls" \
  --apply
```

将 `~/.content-studio/tls/ca.crt` 复制给运营设备并安装到系统受信任根证书中。不得分发 `ca.key` 或 `server.key`。

macOS 可在“钥匙串访问”中导入 `ca.crt`，打开证书的“信任”，将“使用此证书时”设为“始终信任”。每台运营设备只需执行一次。

## 4. 配置环境

复制 [`deploy/content-studio.lan.env.example`](../../deploy/content-studio.lan.env.example) 为 `~/.content-studio/lan.env`，替换示例用户名、仓库绝对路径和 LAN IP，然后执行：

```bash
chmod 600 "$HOME/.content-studio/lan.env"
chmod 600 "$HOME/.content-studio/auth/auth.json"
chmod 600 "$HOME/.content-studio/tls/server.key"
chmod 600 "$HOME/.content-studio/secrets/fal-inference.key"
```

Fal Key 必须复制到 `FAL_KEY_FILE` 指向的文件；不要在环境文件里填写 `FAL_KEY=`。

## 5. 构建和手动启动

```bash
npm ci
npm run build
node --env-file="$HOME/.content-studio/lan.env" scripts/start-lan.mjs
```

启动后浏览器访问：

```text
https://10.10.2.106:8443
```

## 6. 安装开机服务

```bash
npm run lan:install -- \
  --env-file "$HOME/.content-studio/lan.env" \
  --project-root "$PWD" \
  --apply

launchctl bootstrap "gui/$(id -u)" \
  "$HOME/Library/LaunchAgents/com.content-studio.lan.plist"
```

更新构建后执行：

```bash
launchctl kickstart -k "gui/$(id -u)/com.content-studio.lan"
```

卸载服务：

```bash
launchctl bootout "gui/$(id -u)/com.content-studio.lan"
```

## 7. 备份

手动备份：

```bash
node --env-file="$HOME/.content-studio/lan.env" scripts/backup-lan.mjs
```

备份会生成 SQLite 文件及 SHA-256 清单，写入 `CONTENT_STUDIO_BACKUP_DIR`。`deploy/com.content-studio.lan-backup.plist.example` 提供每天 02:30 的 LaunchAgent 模板；上线前至少完成一次备份、dry-run restore 和实际回滚演练。

安装每日备份任务：

```bash
npm run lan:install -- \
  --kind backup \
  --env-file "$HOME/.content-studio/lan.env" \
  --project-root "$PWD" \
  --apply

launchctl bootstrap "gui/$(id -u)" \
  "$HOME/Library/LaunchAgents/com.content-studio.lan-backup.plist"
```

## 8. 防火墙

- 仅允许公司局域网网段访问 TCP `8443`。
- 不开放内部端口 `4173`。
- 不在路由器配置端口转发或 DMZ。
- 运营离开公司网络后无法访问；如需远程访问，应使用企业 VPN/Tailscale ACL，而不是开放公网端口。

## 9. 验收

```bash
curl --cacert "$HOME/.content-studio/tls/ca.crt" \
  "https://10.10.2.106:8443/api/health/live"

curl --cacert "$HOME/.content-studio/tls/ca.crt" \
  "https://10.10.2.106:8443/api/health/ready"
```

必须确认：

1. 两个健康接口均返回 200。
2. 未登录访问 `/api/studio/state` 返回 401。
3. Owner 登录后要求 TOTP；Creator 登录后不能进入成员管理操作。
4. 创建节点并刷新浏览器后状态仍存在。
5. Fal 生成成功，浏览器响应和 HTML 中不包含 Fal Key。
6. 第二台运营设备可以通过同一 HTTPS 地址登录。

## 故障排查

- `LAN_PRIVATE_HOST_REQUIRED`：LAN Host 不是具体 RFC 1918 私网 IPv4。
- `LAN_PUBLIC_ORIGIN_MISMATCH`：`CONTENT_STUDIO_PUBLIC_BASE_URL` 与 LAN Host/Port 不一致。
- `LAN_TLS_KEY_PERMISSIONS_INVALID`：TLS 私钥权限不是 `0600`。
- `AUTH_CONFIG_REQUIRED`：身份配置路径缺失或文件不可读取。
- `CONTENT_STUDIO_NOT_READY`：检查 SQLite、构建目录、素材目录和身份配置。
- 浏览器提示证书不受信任：运营设备尚未安装并信任 `ca.crt`。
