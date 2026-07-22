import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLanGateway, loadLanGatewayConfig } from './lan-gateway-core.mjs';

const config = loadLanGatewayConfig(process.env);
const serverFile = resolve(
  process.env.CONTENT_STUDIO_RELEASE_SERVER_FILE || 'dist-server/server.mjs',
);
const serverModule = await import(pathToFileURL(serverFile).href);
if (typeof serverModule.createProductionServer !== 'function') {
  throw new Error('LAN_PRODUCTION_SERVER_INVALID');
}

const productionLogger = (message) => {
  process.stdout.write(`${message}\n`);
};
const gatewayLogger = (event, details = {}) => {
  process.stdout.write(`${JSON.stringify({
    at: new Date().toISOString(),
    event,
    ...details,
  })}\n`);
};
const application = await serverModule.createProductionServer({ logger: productionLogger });
const gateway = await createLanGateway({ config, logger: gatewayLogger });

try {
  await application.start();
  const started = await gateway.start();
  gatewayLogger('content_studio_lan_ready', { origin: started.origin });
} catch (error) {
  await gateway.close().catch(() => undefined);
  await application.close().catch(() => undefined);
  throw error;
}

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await gateway.close();
  await application.close();
};
process.once('SIGTERM', () => { void stop(); });
process.once('SIGINT', () => { void stop(); });
