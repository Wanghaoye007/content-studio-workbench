import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const directories: string[] = [];
const projectRoot = resolve(import.meta.dirname, '..');

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, {
    recursive: true,
    force: true,
  })));
});

describe('LAN deployment artifacts', () => {
  it('documents a loopback upstream, private HTTPS gateway and file-based secrets', async () => {
    const template = await readFile(join(projectRoot, 'deploy/content-studio.lan.env.example'), 'utf8');
    expect(template).toContain('CONTENT_STUDIO_HOST=127.0.0.1');
    expect(template).toContain('CONTENT_STUDIO_LAN_HOST=10.10.2.106');
    expect(template).toContain('CONTENT_STUDIO_LAN_PORT=8443');
    expect(template).toContain('CONTENT_STUDIO_PUBLIC_BASE_URL=https://10.10.2.106:8443');
    expect(template).toContain('CONTENT_STUDIO_LAN_TLS_CERT_FILE=');
    expect(template).toContain('CONTENT_STUDIO_LAN_TLS_KEY_FILE=');
    expect(template).toContain('FAL_KEY_FILE=');
    expect(template).not.toMatch(/FAL_KEY\s*=/);
  });

  it('defines a persistent launch agent without embedding secret values', async () => {
    const template = await readFile(
      join(projectRoot, 'deploy/com.content-studio.lan.plist.example'),
      'utf8',
    );
    expect(template).toContain('__NODE_BINARY__');
    expect(template).toContain('--env-file=__ENV_FILE__');
    expect(template).toContain('__PROJECT_ROOT__/scripts/start-lan.mjs');
    expect(template).toContain('<key>RunAtLoad</key>');
    expect(template).toContain('<key>KeepAlive</key>');
    expect(template).toContain('__LOG_DIRECTORY__/lan-service.log');
    expect(template).not.toContain('FAL_KEY');
    expect(template).not.toContain('password');
  });

  it('renders certificate and LaunchAgent plans without applying changes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-studio-lan-artifacts-'));
    directories.push(directory);
    const envFile = join(directory, 'lan.env');
    await writeFile(envFile, 'NODE_ENV=production\n', { mode: 0o600 });
    const certificate = spawnSync(process.execPath, [
      'scripts/generate-lan-certificate.mjs',
      '--host', '10.10.2.106',
      '--output-dir', join(directory, 'tls'),
    ], { cwd: projectRoot, encoding: 'utf8' });
    expect(certificate.status).toBe(0);
    expect(JSON.parse(certificate.stdout)).toMatchObject({
      mode: 'dry-run',
      host: '10.10.2.106',
    });

    const launchAgent = spawnSync(process.execPath, [
      'scripts/install-lan-launch-agent.mjs',
      '--env-file', envFile,
      '--project-root', projectRoot,
      '--output', join(directory, 'com.content-studio.lan.plist'),
    ], { cwd: projectRoot, encoding: 'utf8' });
    expect(launchAgent.status).toBe(0);
    expect(JSON.parse(launchAgent.stdout)).toMatchObject({
      mode: 'dry-run',
      envFile,
      projectRoot,
    });
  });
});
