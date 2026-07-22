import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const databaseFile = resolve(required(
  process.env.CONTENT_STUDIO_DATABASE_FILE,
  'LAN_BACKUP_DATABASE_REQUIRED',
));
const backupDirectory = resolve(required(
  process.env.CONTENT_STUDIO_BACKUP_DIR,
  'LAN_BACKUP_DIRECTORY_REQUIRED',
));
await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputFile = join(backupDirectory, `content-studio-${timestamp}.sqlite`);
const command = spawnSync(process.execPath, [
  resolve('scripts/content-studio-database.mjs'),
  'backup',
  '--database', databaseFile,
  '--output', outputFile,
], { stdio: 'inherit' });
if (command.status !== 0) process.exitCode = command.status || 1;

function required(value, code) {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}
