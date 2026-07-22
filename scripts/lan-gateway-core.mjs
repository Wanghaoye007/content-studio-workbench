import { request as httpRequest } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFile, stat } from 'node:fs/promises';

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export function loadLanGatewayConfig(env = process.env) {
  const host = required(env.CONTENT_STUDIO_LAN_HOST, 'LAN_HOST_REQUIRED');
  if (!isPrivateLanIpv4(host)) throw new Error('LAN_PRIVATE_HOST_REQUIRED');
  const port = parsePort(env.CONTENT_STUDIO_LAN_PORT, 8_443, 'LAN_PORT_INVALID');
  const upstreamHost = env.CONTENT_STUDIO_HOST?.trim() || '127.0.0.1';
  if (!['127.0.0.1', '::1'].includes(upstreamHost)) {
    throw new Error('LAN_UPSTREAM_LOOPBACK_REQUIRED');
  }
  const upstreamPort = parsePort(env.CONTENT_STUDIO_PORT, 4_173, 'LAN_UPSTREAM_PORT_INVALID');
  const origin = normalizeHttpsOrigin(env.CONTENT_STUDIO_PUBLIC_BASE_URL);
  const expectedOrigin = `https://${host}${port === 443 ? '' : `:${port}`}`;
  if (origin !== expectedOrigin) throw new Error('LAN_PUBLIC_ORIGIN_MISMATCH');
  return {
    host,
    port,
    origin,
    certificateFile: required(env.CONTENT_STUDIO_LAN_TLS_CERT_FILE, 'LAN_TLS_CERT_REQUIRED'),
    keyFile: required(env.CONTENT_STUDIO_LAN_TLS_KEY_FILE, 'LAN_TLS_KEY_REQUIRED'),
    upstreamHost,
    upstreamPort,
  };
}

export async function assertPrivateFile(filePath, label) {
  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch {
    throw new Error(`${label}_MISSING`);
  }
  if (!fileStats.isFile()) throw new Error(`${label}_INVALID`);
  if ((fileStats.mode & 0o077) !== 0) throw new Error(`${label}_PERMISSIONS_INVALID`);
}

export function filterProxyHeaders(headers) {
  const blocked = new Set(hopByHopHeaders);
  const connection = headers.connection;
  const connectionValue = Array.isArray(connection) ? connection.join(',') : String(connection ?? '');
  for (const token of connectionValue.split(',')) {
    const normalized = token.trim().toLowerCase();
    if (normalized) blocked.add(normalized);
  }
  return Object.fromEntries(Object.entries(headers).flatMap(([name, value]) => {
    const normalized = name.toLowerCase();
    return value === undefined || blocked.has(normalized) ? [] : [[normalized, value]];
  }));
}

export async function createLanGateway({ config, logger = () => undefined }) {
  await assertPrivateFile(config.keyFile, 'LAN_TLS_KEY');
  const [certificate, key] = await Promise.all([
    readFile(config.certificateFile),
    readFile(config.keyFile),
  ]);
  const server = createHttpsServer({
    cert: certificate,
    key,
    minVersion: 'TLSv1.2',
    requestTimeout: 60_000,
    headersTimeout: 15_000,
    keepAliveTimeout: 5_000,
    maxHeaderSize: 16 * 1024,
  }, (request, response) => {
    const headers = filterProxyHeaders(request.headers);
    headers.host = `${formatHost(config.upstreamHost)}:${config.upstreamPort}`;
    headers['x-forwarded-proto'] = 'https';
    headers['x-forwarded-host'] = request.headers.host ?? `${config.host}:${config.port}`;
    headers['x-forwarded-for'] = request.socket.remoteAddress ?? '';
    const upstream = httpRequest({
      host: config.upstreamHost,
      port: config.upstreamPort,
      method: request.method,
      path: request.url,
      headers,
    }, (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        filterProxyHeaders(upstreamResponse.headers),
      );
      upstreamResponse.pipe(response);
    });
    upstream.once('error', () => {
      if (response.writableEnded) return;
      response.statusCode = 502;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.setHeader('cache-control', 'no-store');
      response.end(JSON.stringify({
        error: {
          code: 'LAN_GATEWAY_UPSTREAM_UNAVAILABLE',
          message: '工作台服务暂不可用',
        },
      }));
    });
    request.once('aborted', () => upstream.destroy());
    request.pipe(upstream);
  });
  server.maxHeadersCount = 100;
  server.maxRequestsPerSocket = 1_000;
  let started = false;

  return {
    async start() {
      if (!started) {
        await listen(server, config.host, config.port);
        started = true;
        logger('content_studio_lan_gateway_started', {
          host: config.host,
          port: config.port,
          upstreamHost: config.upstreamHost,
          upstreamPort: config.upstreamPort,
        });
      }
      return { origin: config.origin };
    },
    async close() {
      if (!started) return;
      await close(server);
      started = false;
    },
  };
}

export function isPrivateLanIpv4(value) {
  const parts = value.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const bytes = parts.map(Number);
  if (bytes.some((part) => part < 0 || part > 255)) return false;
  return bytes[0] === 10
    || (bytes[0] === 172 && bytes[1] >= 16 && bytes[1] <= 31)
    || (bytes[0] === 192 && bytes[1] === 168);
}

function normalizeHttpsOrigin(value) {
  const input = required(value, 'LAN_PUBLIC_ORIGIN_REQUIRED');
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('invalid origin');
    }
    return url.origin;
  } catch {
    throw new Error('LAN_PUBLIC_ORIGIN_INVALID');
  }
}

function parsePort(value, fallback, code) {
  const port = value?.trim() ? Number(value) : fallback;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error(code);
  return port;
}

function required(value, code) {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}

function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function formatHost(host) {
  return host.includes(':') ? `[${host}]` : host;
}
