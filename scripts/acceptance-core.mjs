const VALID_SEVERITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const VALID_STATUSES = new Set(['pass', 'partial', 'fail', 'missing', 'not_applicable']);

export function validateManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1) {
    throw new Error('Unsupported or missing acceptance manifest schemaVersion.');
  }

  if (!manifest.project || !Array.isArray(manifest.checks) || !Array.isArray(manifest.automation)) {
    throw new Error('Acceptance manifest requires project, checks, and automation.');
  }

  const ids = new Set();
  for (const item of [...manifest.checks, ...manifest.automation]) {
    if (!item.id || ids.has(item.id)) {
      throw new Error(`Acceptance check id is missing or duplicated: ${item.id ?? '<missing>'}`);
    }
    ids.add(item.id);

    if (!VALID_SEVERITIES.has(item.severity)) {
      throw new Error(`Invalid severity for ${item.id}: ${item.severity}`);
    }
  }

  for (const check of manifest.checks) {
    if (!VALID_STATUSES.has(check.status)) {
      throw new Error(`Invalid status for ${check.id}: ${check.status}`);
    }
    if (!check.summary || !check.evidence) {
      throw new Error(`Acceptance check ${check.id} requires summary and evidence.`);
    }
  }

  return manifest;
}

export function evaluateAcceptance(manifest, commandResults = []) {
  validateManifest(manifest);

  const evidenceResults = manifest.checks.map((check) => ({
    ...check,
    source: 'evidence',
  }));
  const automationResults = commandResults.map((result) => ({
    id: result.id,
    category: 'automation',
    severity: result.severity,
    required: true,
    status: result.ok ? 'pass' : 'fail',
    summary: result.label,
    evidence: result.output || `exit code ${result.exitCode}`,
    source: 'automation',
  }));
  const results = [...evidenceResults, ...automationResults];
  const unresolved = results.filter((item) => (
    item.required !== false
    && item.status !== 'pass'
    && item.status !== 'not_applicable'
  ));

  const hasP0 = unresolved.some((item) => item.severity === 'P0');
  const hasP1 = unresolved.some((item) => item.severity === 'P1');
  const conclusion = hasP0 ? 'red' : (hasP1 || unresolved.length > 0 ? 'yellow' : 'green');
  const counts = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  return {
    project: manifest.project,
    target: manifest.target,
    conclusion,
    label: conclusion === 'red'
      ? '不予验收'
      : conclusion === 'yellow'
        ? '可试用不可正式上线'
        : '验收通过',
    counts,
    unresolved: unresolved.sort(compareSeverity),
    results,
  };
}

function compareSeverity(a, b) {
  return Number(a.severity.slice(1)) - Number(b.severity.slice(1));
}
