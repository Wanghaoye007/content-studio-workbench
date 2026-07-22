import { resolve } from 'node:path';
import { bootstrapLanDatabase } from './bootstrap-lan-database-core.mjs';

const values = parseArguments(process.argv.slice(2));
const result = await bootstrapLanDatabase({
  authFile: resolve(values.get('--auth-file')
    || required(process.env.CONTENT_STUDIO_AUTH_CONFIG_FILE, 'LAN_AUTH_FILE_REQUIRED')),
  databaseFile: resolve(values.get('--database')
    || required(process.env.CONTENT_STUDIO_DATABASE_FILE, 'LAN_DATABASE_FILE_REQUIRED')),
  projectId: values.get('--project') || 'project-default',
  projectName: values.get('--project-name') || '运营工作台',
});
process.stdout.write(`${JSON.stringify(result)}\n`);

function parseArguments(args) {
  const parsed = new Map();
  for (let index = 0; index < args.length; index += 1) {
    if (!args[index].startsWith('--')) continue;
    parsed.set(args[index], args[index + 1] ?? '');
    index += 1;
  }
  return parsed;
}

function required(value, code) {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}
