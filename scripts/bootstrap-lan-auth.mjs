import { resolve } from 'node:path';
import { createLanAuthBundle, writeLanAuthBundle } from './bootstrap-lan-auth-core.mjs';

const values = parseArguments(process.argv.slice(2));
const authFile = resolve(required(values.get('--auth-file'), 'LAN_AUTH_FILE_REQUIRED'));
const credentialsFile = resolve(required(
  values.get('--credentials-file'),
  'LAN_CREDENTIALS_FILE_REQUIRED',
));
const options = {
  tenantId: values.get('--tenant') || 'tenant-internal',
  projectId: values.get('--project') || 'project-default',
  ownerEmail: values.get('--owner-email') || 'owner@content-studio.local',
  creatorEmail: values.get('--creator-email') || 'operator@content-studio.local',
};

if (!process.argv.includes('--apply')) {
  process.stdout.write(`${JSON.stringify({
    mode: 'dry-run',
    authFile,
    credentialsFile,
    ...options,
    secretsPrinted: false,
  })}\n`);
} else {
  const bundle = createLanAuthBundle(options);
  await writeLanAuthBundle({ authFile, credentialsFile, bundle });
  process.stdout.write(`${JSON.stringify({
    mode: 'applied',
    authFile,
    credentialsFile,
    ownerEmail: options.ownerEmail,
    creatorEmail: options.creatorEmail,
    secretsPrinted: false,
  })}\n`);
}

function parseArguments(args) {
  const parsed = new Map();
  for (let index = 0; index < args.length; index += 1) {
    if (!args[index].startsWith('--') || args[index] === '--apply') continue;
    parsed.set(args[index], args[index + 1] ?? '');
    index += 1;
  }
  return parsed;
}

function required(value, code) {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}
