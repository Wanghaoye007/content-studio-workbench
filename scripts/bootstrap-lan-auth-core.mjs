import { randomBytes, randomInt, randomUUID, scryptSync } from 'node:crypto';
import { link, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const passwordCharacters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
const base32Characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function createLanAuthBundle(options) {
  const tenantId = validId(options.tenantId, 'LAN_AUTH_TENANT_INVALID');
  const projectId = validId(options.projectId, 'LAN_AUTH_PROJECT_INVALID');
  const ownerEmail = validEmail(options.ownerEmail, 'LAN_AUTH_OWNER_EMAIL_INVALID');
  const creatorEmail = validEmail(options.creatorEmail, 'LAN_AUTH_CREATOR_EMAIL_INVALID');
  if (ownerEmail === creatorEmail) throw new Error('LAN_AUTH_EMAILS_DUPLICATE');
  const ownerPassword = options.ownerPassword ?? generatePassword();
  const creatorPassword = options.creatorPassword ?? generatePassword();
  const ownerTotpSecret = options.ownerTotpSecret ?? generateBase32Secret();
  const ownerId = options.ownerId ?? `user-${randomUUID()}`;
  const creatorId = options.creatorId ?? `user-${randomUUID()}`;
  const authDocument = {
    schemaVersion: 1,
    users: [
      {
        id: ownerId,
        tenantId,
        email: ownerEmail,
        displayName: '工作台管理员',
        passwordHash: hashPassword(ownerPassword),
        role: 'owner',
        status: 'active',
        projectIds: [projectId],
        mfaEnabled: true,
        mfaSecret: ownerTotpSecret,
      },
      {
        id: creatorId,
        tenantId,
        email: creatorEmail,
        displayName: '运营账号',
        passwordHash: hashPassword(creatorPassword),
        role: 'creator',
        status: 'active',
        projectIds: [projectId],
        mfaEnabled: false,
      },
    ],
  };
  const totpUri = `otpauth://totp/${encodeURIComponent(`Content Studio:${ownerEmail}`)}`
    + `?secret=${ownerTotpSecret}&issuer=${encodeURIComponent('Content Studio')}`
    + '&algorithm=SHA1&digits=6&period=30';
  const credentialsText = [
    'Content Studio 初始凭据',
    '',
    `Owner: ${ownerEmail}`,
    `Owner password: ${ownerPassword}`,
    `Owner TOTP secret: ${ownerTotpSecret}`,
    `Owner TOTP URI: ${totpUri}`,
    '',
    `Creator: ${creatorEmail}`,
    `Creator password: ${creatorPassword}`,
    '',
    '完成首次登录和凭据登记后，请删除此文件。',
    '',
  ].join('\n');
  return { authDocument, credentialsText };
}

export async function writeLanAuthBundle({ authFile, credentialsFile, bundle }) {
  if (await exists(authFile) || await exists(credentialsFile)) {
    throw new Error('LAN_AUTH_OUTPUT_EXISTS');
  }
  await Promise.all([
    mkdir(dirname(authFile), { recursive: true, mode: 0o700 }),
    mkdir(dirname(credentialsFile), { recursive: true, mode: 0o700 }),
  ]);
  const authTemporary = `${authFile}.${process.pid}.${randomUUID()}.tmp`;
  const credentialsTemporary = `${credentialsFile}.${process.pid}.${randomUUID()}.tmp`;
  let authLinked = false;
  try {
    await writeFile(authTemporary, `${JSON.stringify(bundle.authDocument, null, 2)}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    await writeFile(credentialsTemporary, bundle.credentialsText, { mode: 0o600, flag: 'wx' });
    await link(authTemporary, authFile);
    authLinked = true;
    await link(credentialsTemporary, credentialsFile);
  } catch (error) {
    if (authLinked) await rm(authFile, { force: true }).catch(() => undefined);
    if (error?.code === 'EEXIST') throw new Error('LAN_AUTH_OUTPUT_EXISTS', { cause: error });
    throw error;
  } finally {
    await Promise.all([
      rm(authTemporary, { force: true }),
      rm(credentialsTemporary, { force: true }),
    ]);
  }
}

function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('LAN_AUTH_PASSWORD_POLICY_FAILED');
  }
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function generatePassword(length = 24) {
  const required = ['A', 'a', '2', '!'];
  const values = [...required];
  while (values.length < length) values.push(passwordCharacters[randomInt(passwordCharacters.length)]);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values.join('');
}

function generateBase32Secret(length = 32) {
  return Array.from({ length }, () => base32Characters[randomInt(base32Characters.length)]).join('');
}

function validId(value, code) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value)) {
    throw new Error(code);
  }
  return value;
}

function validEmail(value, code) {
  if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(value)) throw new Error(code);
  return value.toLowerCase();
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}
