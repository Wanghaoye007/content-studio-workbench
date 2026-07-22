import { access, chmod, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const values = parseArguments(process.argv.slice(2));
const kind = values.get('--kind') || 'service';
if (!['service', 'backup'].includes(kind)) throw new Error('LAN_LAUNCH_AGENT_KIND_INVALID');
const label = kind === 'backup' ? 'com.content-studio.lan-backup' : 'com.content-studio.lan';
const envFile = resolve(required(values.get('--env-file'), 'LAN_ENV_FILE_REQUIRED'));
const projectRoot = resolve(required(values.get('--project-root'), 'LAN_PROJECT_ROOT_REQUIRED'));
const outputFile = resolve(values.get('--output')
  || join(homedir(), `Library/LaunchAgents/${label}.plist`));
const logDirectory = resolve(values.get('--log-directory')
  || join(homedir(), '.content-studio/logs'));
const nodeBinary = resolve(values.get('--node-binary') || process.execPath);
const templateFile = join(
  projectRoot,
  kind === 'backup'
    ? 'deploy/com.content-studio.lan-backup.plist.example'
    : 'deploy/com.content-studio.lan.plist.example',
);

await Promise.all([access(envFile), access(templateFile), access(nodeBinary)]);
await assertPrivate(envFile, 'LAN_ENV_FILE');
const template = await readFile(templateFile, 'utf8');
const rendered = template
  .replaceAll('__NODE_BINARY__', escapeXml(nodeBinary))
  .replaceAll('__ENV_FILE__', escapeXml(envFile))
  .replaceAll('__PROJECT_ROOT__', escapeXml(projectRoot))
  .replaceAll('__LOG_DIRECTORY__', escapeXml(logDirectory));

if (!process.argv.includes('--apply')) {
  process.stdout.write(`${JSON.stringify({
    mode: 'dry-run',
    kind,
    envFile,
    projectRoot,
    outputFile,
    logDirectory,
    nodeBinary,
  })}\n`);
} else {
  if (await exists(outputFile)) throw new Error('LAN_LAUNCH_AGENT_EXISTS');
  await Promise.all([
    mkdir(dirname(outputFile), { recursive: true, mode: 0o700 }),
    mkdir(logDirectory, { recursive: true, mode: 0o700 }),
  ]);
  const temporary = `${outputFile}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, rendered, { mode: 0o600, flag: 'wx' });
    await chmod(temporary, 0o600);
    await rename(temporary, outputFile);
  } finally {
    await rm(temporary, { force: true });
  }
  process.stdout.write(`${JSON.stringify({
    mode: 'applied',
    kind,
    envFile,
    projectRoot,
    outputFile,
    logDirectory,
    nodeBinary,
  })}\n`);
}

async function assertPrivate(filePath, label) {
  const fileStats = await stat(filePath);
  if (!fileStats.isFile() || (fileStats.mode & 0o077) !== 0) {
    throw new Error(`${label}_PERMISSIONS_INVALID`);
  }
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

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
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
