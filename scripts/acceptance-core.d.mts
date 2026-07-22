export type AcceptanceSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export type AcceptanceStatus = 'pass' | 'partial' | 'fail' | 'missing' | 'not_applicable';

export type AcceptanceCheck = {
  id: string;
  category: string;
  severity: AcceptanceSeverity;
  required: boolean;
  status: AcceptanceStatus;
  summary: string;
  evidence: string;
  source?: 'evidence' | 'automation';
};

export type AutomationCheck = {
  id: string;
  label: string;
  severity: AcceptanceSeverity;
  command: string;
  args: string[];
  env?: Record<string, string>;
};

export type AcceptanceManifest = {
  schemaVersion: 1;
  project: string;
  target: string;
  requirementsSource?: string;
  checks: AcceptanceCheck[];
  automation: AutomationCheck[];
};

export type AcceptanceCommandResult = {
  id: string;
  label: string;
  severity: AcceptanceSeverity;
  ok: boolean;
  exitCode: number | null;
  output: string;
};

export type AcceptanceReport = {
  project: string;
  target: string;
  conclusion: 'red' | 'yellow' | 'green';
  label: '不予验收' | '可试用不可正式上线' | '验收通过';
  counts: Record<string, number>;
  unresolved: AcceptanceCheck[];
  results: AcceptanceCheck[];
};

export function validateManifest(manifest: unknown): AcceptanceManifest;
export function evaluateAcceptance(
  manifest: AcceptanceManifest,
  commandResults?: AcceptanceCommandResult[],
): AcceptanceReport;
