import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { isPrivateLanIpv4 } from './lan-gateway-core.mjs';

const values = parseArguments(process.argv.slice(2));
const host = required(values.get('--host'), 'LAN_CERT_HOST_REQUIRED');
if (!isPrivateLanIpv4(host)) throw new Error('LAN_PRIVATE_HOST_REQUIRED');
const outputDirectory = resolve(required(
  values.get('--output-dir'),
  'LAN_CERT_OUTPUT_DIRECTORY_REQUIRED',
));
const outputs = {
  caCertificateFile: join(outputDirectory, 'ca.crt'),
  caKeyFile: join(outputDirectory, 'ca.key'),
  certificateFile: join(outputDirectory, 'server.crt'),
  keyFile: join(outputDirectory, 'server.key'),
};

if (!process.argv.includes('--apply')) {
  process.stdout.write(`${JSON.stringify({ mode: 'dry-run', host, outputDirectory, ...outputs })}\n`);
} else {
  await generateCertificate(host, outputDirectory, outputs);
  process.stdout.write(`${JSON.stringify({ mode: 'applied', host, outputDirectory, ...outputs })}\n`);
}

async function generateCertificate(lanHost, directory, target) {
  if ((await Promise.all(Object.values(target).map(exists))).some(Boolean)) {
    throw new Error('LAN_CERT_OUTPUT_EXISTS');
  }
  const openssl = spawnSync('openssl', ['version'], { encoding: 'utf8' });
  if (openssl.status !== 0) throw new Error('LAN_OPENSSL_REQUIRED');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryDirectory = await mkdtemp(join(directory, '.generate-'));
  const temporary = {
    caCertificateFile: join(temporaryDirectory, 'ca.crt'),
    caKeyFile: join(temporaryDirectory, 'ca.key'),
    certificateFile: join(temporaryDirectory, 'server.crt'),
    keyFile: join(temporaryDirectory, 'server.key'),
    requestFile: join(temporaryDirectory, 'server.csr'),
    extensionsFile: join(temporaryDirectory, 'server.ext'),
  };
  try {
    runOpenSsl([
      'req', '-x509', '-newkey', 'rsa:3072', '-sha256', '-days', '3650', '-nodes',
      '-keyout', temporary.caKeyFile,
      '-out', temporary.caCertificateFile,
      '-subj', '/CN=Content Studio LAN CA',
    ]);
    runOpenSsl([
      'req', '-new', '-newkey', 'rsa:2048', '-sha256', '-nodes',
      '-keyout', temporary.keyFile,
      '-out', temporary.requestFile,
      '-subj', `/CN=${lanHost}`,
    ]);
    await writeFile(temporary.extensionsFile, [
      'basicConstraints=critical,CA:FALSE',
      'keyUsage=critical,digitalSignature,keyEncipherment',
      'extendedKeyUsage=serverAuth',
      `subjectAltName=IP:${lanHost}`,
      '',
    ].join('\n'), { mode: 0o600 });
    runOpenSsl([
      'x509', '-req', '-sha256', '-days', '365',
      '-in', temporary.requestFile,
      '-CA', temporary.caCertificateFile,
      '-CAkey', temporary.caKeyFile,
      '-CAcreateserial',
      '-out', temporary.certificateFile,
      '-extfile', temporary.extensionsFile,
    ]);
    await Promise.all([
      chmod(temporary.caKeyFile, 0o600),
      chmod(temporary.keyFile, 0o600),
      chmod(temporary.caCertificateFile, 0o644),
      chmod(temporary.certificateFile, 0o644),
    ]);
    await rename(temporary.caCertificateFile, target.caCertificateFile);
    await rename(temporary.caKeyFile, target.caKeyFile);
    await rename(temporary.certificateFile, target.certificateFile);
    await rename(temporary.keyFile, target.keyFile);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

function runOpenSsl(args) {
  const result = spawnSync('openssl', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('LAN_CERT_GENERATION_FAILED');
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
