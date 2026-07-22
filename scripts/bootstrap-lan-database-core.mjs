import { readFile, stat } from 'node:fs/promises';
import { openDatabase } from './sqlite-common.mjs';

export async function bootstrapLanDatabase(options) {
  await assertPrivateAuthFile(options.authFile);
  const document = JSON.parse(await readFile(options.authFile, 'utf8'));
  if (document?.schemaVersion !== 1 || !Array.isArray(document.users)) {
    throw new Error('LAN_DATABASE_AUTH_CONFIG_INVALID');
  }
  const owner = document.users.find((user) => user?.role === 'owner');
  const creator = document.users.find((user) => user?.role === 'creator');
  if (!validBootstrapUser(owner) || !validBootstrapUser(creator)) {
    throw new Error('LAN_DATABASE_BOOTSTRAP_USERS_REQUIRED');
  }
  if (owner.tenantId !== creator.tenantId) throw new Error('LAN_DATABASE_TENANT_MISMATCH');
  if (!owner.projectIds.includes(options.projectId) || !creator.projectIds.includes(options.projectId)) {
    throw new Error('LAN_DATABASE_PROJECT_SCOPE_MISMATCH');
  }
  const at = options.at ?? new Date().toISOString();
  const database = openDatabase(options.databaseFile);
  let created = false;
  try {
    database.exec('BEGIN IMMEDIATE');
    const existingProject = database.prepare(`
      SELECT name, owner_user_id FROM organization_projects
      WHERE tenant_id = ? AND project_id = ?
    `).get(owner.tenantId, options.projectId);
    if (existingProject) {
      if (existingProject.name !== options.projectName || existingProject.owner_user_id !== owner.id) {
        throw new Error('LAN_DATABASE_PROJECT_CONFLICT');
      }
    } else {
      database.prepare(`
        INSERT INTO organization_projects (
          tenant_id, project_id, name, default_brand, default_sku,
          owner_user_id, review_required, status, created_at, updated_at
        ) VALUES (?, ?, ?, NULL, NULL, ?, 1, 'active', ?, ?)
      `).run(owner.tenantId, options.projectId, options.projectName, owner.id, at, at);
      created = true;
    }
    upsertCreator(database, creator, at);
    const insertMember = database.prepare(`
      INSERT OR IGNORE INTO organization_project_members (
        tenant_id, project_id, user_id, created_at
      ) VALUES (?, ?, ?, ?)
    `);
    insertMember.run(owner.tenantId, options.projectId, owner.id, at);
    insertMember.run(owner.tenantId, options.projectId, creator.id, at);
    database.prepare(`
      INSERT OR IGNORE INTO organization_audit_events (
        event_id, tenant_id, event_type, actor_user_id, target_id, details_json, created_at
      ) VALUES (?, ?, 'project.bootstrap_created', ?, ?, ?, ?)
    `).run(
      `org-event-lan-bootstrap-${owner.tenantId}-${options.projectId}`,
      owner.tenantId,
      owner.id,
      options.projectId,
      JSON.stringify({ source: 'lan-bootstrap' }),
      at,
    );
    database.exec('COMMIT');
  } catch (error) {
    try {
      database.exec('ROLLBACK');
    } catch {
      // Preserve the original bootstrap failure.
    }
    throw error;
  } finally {
    database.close();
  }
  return {
    created,
    tenantId: owner.tenantId,
    projectId: options.projectId,
    ownerUserId: owner.id,
    creatorUserId: creator.id,
  };
}

function upsertCreator(database, creator, at) {
  const existing = database.prepare(`
    SELECT tenant_id, email, display_name, password_hash, role, status,
           mfa_enabled, mfa_secret
    FROM organization_users WHERE user_id = ?
  `).get(creator.id);
  const expected = {
    tenant_id: creator.tenantId,
    email: creator.email,
    display_name: creator.displayName,
    password_hash: creator.passwordHash,
    role: 'creator',
    status: 'active',
    mfa_enabled: 0,
    mfa_secret: null,
  };
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(expected)) {
      throw new Error('LAN_DATABASE_CREATOR_CONFLICT');
    }
    return;
  }
  database.prepare(`
    INSERT INTO organization_users (
      user_id, tenant_id, email, display_name, password_hash, role, status,
      mfa_enabled, mfa_secret, created_at, updated_at, first_login_at
    ) VALUES (?, ?, ?, ?, ?, 'creator', 'active', 0, NULL, ?, ?, NULL)
  `).run(
    creator.id,
    creator.tenantId,
    creator.email,
    creator.displayName,
    creator.passwordHash,
    at,
    at,
  );
}

async function assertPrivateAuthFile(filePath) {
  const fileStats = await stat(filePath);
  if (!fileStats.isFile() || (fileStats.mode & 0o077) !== 0) {
    throw new Error('LAN_DATABASE_AUTH_PERMISSIONS_INVALID');
  }
}

function validBootstrapUser(user) {
  return user
    && typeof user.id === 'string'
    && typeof user.tenantId === 'string'
    && typeof user.email === 'string'
    && typeof user.displayName === 'string'
    && typeof user.passwordHash === 'string'
    && Array.isArray(user.projectIds);
}
