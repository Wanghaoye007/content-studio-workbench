import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createLanAuthBundle,
  writeLanAuthBundle,
} from '../scripts/bootstrap-lan-auth-core.mjs';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, {
    recursive: true,
    force: true,
  })));
});

describe('LAN auth bootstrap', () => {
  it('separates plaintext credentials from the authentication document', () => {
    const bundle = createLanAuthBundle({
      tenantId: 'tenant-internal',
      projectId: 'project-default',
      ownerEmail: 'owner@content-studio.local',
      creatorEmail: 'operator@content-studio.local',
      ownerPassword: 'Owner-Initial-2026!Strong',
      creatorPassword: 'Creator-Initial-2026!Strong',
      ownerTotpSecret: 'JBSWY3DPEHPK3PXP',
      ownerId: 'user-owner-fixed',
      creatorId: 'user-creator-fixed',
    });

    const serialized = JSON.stringify(bundle.authDocument);
    expect(serialized).not.toContain('Owner-Initial-2026!Strong');
    expect(serialized).not.toContain('Creator-Initial-2026!Strong');
    expect(bundle.authDocument).toMatchObject({ schemaVersion: 1 });
    expect(bundle.authDocument.users).toHaveLength(2);
    expect(bundle.authDocument.users[0]).toMatchObject({
      role: 'owner',
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP',
      projectIds: ['project-default'],
    });
    expect(bundle.authDocument.users[1]).toMatchObject({
      role: 'creator',
      mfaEnabled: false,
      projectIds: ['project-default'],
    });
    expect(bundle.authDocument.users.every((user) => (
      /^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(user.passwordHash)
    ))).toBe(true);
    expect(bundle.credentialsText).toContain('Owner-Initial-2026!Strong');
    expect(bundle.credentialsText).toContain('Creator-Initial-2026!Strong');
    expect(bundle.credentialsText).toContain('otpauth://totp/');
  });

  it('writes both outputs atomically with private permissions and refuses overwrite', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-studio-lan-auth-'));
    directories.push(directory);
    const authFile = join(directory, 'auth.json');
    const credentialsFile = join(directory, 'initial-credentials.txt');
    const bundle = createLanAuthBundle({
      tenantId: 'tenant-internal',
      projectId: 'project-default',
      ownerEmail: 'owner@content-studio.local',
      creatorEmail: 'operator@content-studio.local',
      ownerPassword: 'Owner-Initial-2026!Strong',
      creatorPassword: 'Creator-Initial-2026!Strong',
      ownerTotpSecret: 'JBSWY3DPEHPK3PXP',
      ownerId: 'user-owner-fixed',
      creatorId: 'user-creator-fixed',
    });

    await writeLanAuthBundle({ authFile, credentialsFile, bundle });

    expect(JSON.parse(await readFile(authFile, 'utf8'))).toEqual(bundle.authDocument);
    expect(await readFile(credentialsFile, 'utf8')).toBe(bundle.credentialsText);
    expect((await stat(authFile)).mode & 0o777).toBe(0o600);
    expect((await stat(credentialsFile)).mode & 0o777).toBe(0o600);
    await expect(writeLanAuthBundle({ authFile, credentialsFile, bundle }))
      .rejects.toThrow('LAN_AUTH_OUTPUT_EXISTS');
  });
});
