import type { IncomingHttpHeaders, OutgoingHttpHeaders } from 'node:http';

export type LanGatewayConfig = {
  host: string;
  port: number;
  origin: string;
  certificateFile: string;
  keyFile: string;
  upstreamHost: string;
  upstreamPort: number;
};

export function loadLanGatewayConfig(
  env?: Record<string, string | undefined>,
): LanGatewayConfig;

export function isPrivateLanIpv4(value: string): boolean;

export function assertPrivateFile(filePath: string, label: string): Promise<void>;

export function filterProxyHeaders(
  headers: IncomingHttpHeaders | OutgoingHttpHeaders | Record<string, string | string[] | undefined>,
): Record<string, string | string[] | number>;

export function createLanGateway(options: {
  config: LanGatewayConfig;
  logger?: (event: string, details: Record<string, unknown>) => void;
}): Promise<{
  start(): Promise<{ origin: string }>;
  close(): Promise<void>;
}>;
