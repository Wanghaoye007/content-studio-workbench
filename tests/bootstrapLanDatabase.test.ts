import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLanAuthBundle } from '../scripts/bootstrap-lan-auth-core.mjs';
import { bootstrapLanDatabase } from '../scripts/bootstrap-lan-database-core.mjs';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, {
    recursive: true,
    force: true,
  })));
});

describe('LAN database bootstrap', () => {
  it('creates the default project and Creator membership without storing plaintext credentials', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-studio-lan-db-'));
    directories.push(directory);
    const authFile = join(directory, 'auth.json');
    const databaseFile = join(directory, 'studio.sqlite');
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
    await writeFile(authFile, JSON.stringify(bundle.authDocument), { mode: 0o600 });

    const first = await bootstrapLanDatabase({
      authFile,
      databaseFile,
      projectId: 'project-default',
      projectName: '运营工作台',
      at: '2026-07-22T08:00:00.000Z',
    });
    const second = await bootstrapLanDatabase({
      authFile,
      databaseFile,
      projectId: 'project-default',
      projectName: '运营工作台',
      at: '2026-07-22T08:00:00.000Z',
    });

    expect(first).toMatchObject({ created: true, tenantId: 'tenant-internal' });
    expect(second).toMatchObject({ created: false, tenantId: 'tenant-internal' });
    const database = new DatabaseSync(databaseFile, { readOnly: true });
    expect(database.prepare('SELECT project_id, name FROM organization_projects').all()).toEqual([
      { project_id: 'project-default', name: '运营工作台' },
    ]);
    expect(database.prepare('SELECT user_id, role FROM organization_users').all()).toEqual([
      { user_id: 'user-creator-fixed', role: 'creator' },
    ]);
    expect(database.prepare(`
      SELECT user_id FROM organization_project_members ORDER BY user_id
    `).all()).toEqual([
      { user_id: 'user-creator-fixed' },
      { user_id: 'user-owner-fixed' },
    ]);
    database.close();
    expect(await readFile(databaseFile)).not.toContain(Buffer.from('Creator-Initial-2026!Strong'));
  });
});
