import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertPrivateFile,
  filterProxyHeaders,
  loadLanGatewayConfig,
} from '../scripts/lan-gateway-core.mjs';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, {
    recursive: true,
    force: true,
  })));
});

function validEnvironment(): Record<string, string> {
  return {
    CONTENT_STUDIO_HOST: '127.0.0.1',
    CONTENT_STUDIO_PORT: '4173',
    CONTENT_STUDIO_PUBLIC_BASE_URL: 'https://10.10.2.106:8443',
    CONTENT_STUDIO_LAN_HOST: '10.10.2.106',
    CONTENT_STUDIO_LAN_PORT: '8443',
    CONTENT_STUDIO_LAN_TLS_CERT_FILE: '/private/cert.pem',
    CONTENT_STUDIO_LAN_TLS_KEY_FILE: '/private/key.pem',
  };
}

describe('LAN gateway boundary', () => {
  it('accepts a concrete RFC 1918 host and matching HTTPS origin', () => {
    expect(loadLanGatewayConfig(validEnvironment())).toEqual({
      host: '10.10.2.106',
      port: 8443,
      origin: 'https://10.10.2.106:8443',
      certificateFile: '/private/cert.pem',
      keyFile: '/private/key.pem',
      upstreamHost: '127.0.0.1',
      upstreamPort: 4173,
    });
  });

  it.each(['0.0.0.0', '127.0.0.1', '8.8.8.8', '169.254.2.8'])('rejects unsafe LAN host %s', (host) => {
    const env = validEnvironment();
    env.CONTENT_STUDIO_LAN_HOST = host;
    env.CONTENT_STUDIO_PUBLIC_BASE_URL = `https://${host}:8443`;
    expect(() => loadLanGatewayConfig(env)).toThrow('LAN_PRIVATE_HOST_REQUIRED');
  });

  it('rejects a public origin that does not match the gateway', () => {
    const env = validEnvironment();
    env.CONTENT_STUDIO_PUBLIC_BASE_URL = 'https://studio.example.com';
    expect(() => loadLanGatewayConfig(env)).toThrow('LAN_PUBLIC_ORIGIN_MISMATCH');
  });

  it('rejects a non-loopback upstream', () => {
    const env = validEnvironment();
    env.CONTENT_STUDIO_HOST = '10.10.2.106';
    expect(() => loadLanGatewayConfig(env)).toThrow('LAN_UPSTREAM_LOOPBACK_REQUIRED');
  });

  it('requires TLS private files to exclude group and world access', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-studio-lan-secret-'));
    directories.push(directory);
    const file = join(directory, 'key.pem');
    await writeFile(file, 'private', { mode: 0o600 });
    await expect(assertPrivateFile(file, 'LAN_TLS_KEY')).resolves.toBeUndefined();
    await chmod(file, 0o644);
    await expect(assertPrivateFile(file, 'LAN_TLS_KEY')).rejects.toThrow('LAN_TLS_KEY_PERMISSIONS_INVALID');
  });

  it('removes hop-by-hop proxy headers and preserves application headers', () => {
    expect(filterProxyHeaders({
      connection: 'keep-alive',
      'keep-alive': 'timeout=5',
      upgrade: 'websocket',
      'proxy-authorization': 'secret',
      cookie: 'session=abc',
      origin: 'https://10.10.2.106:8443',
      'x-content-studio-csrf': 'csrf-token',
    })).toEqual({
      cookie: 'session=abc',
      origin: 'https://10.10.2.106:8443',
      'x-content-studio-csrf': 'csrf-token',
    });
  });
});
