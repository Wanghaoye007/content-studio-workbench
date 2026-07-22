import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { evaluateAcceptance, validateManifest } from './acceptance-core.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const manifestPath = resolve(rootDir, 'acceptance/manifest.json');
const reportOnly = process.argv.includes('--report-only');
const manifest = validateManifest(JSON.parse(await readFile(manifestPath, 'utf8')));

const commandResults = manifest.automation.map((check) => {
  process.stdout.write(`\n[${check.id}] ${check.label}\n`);
  const execution = spawnSync(check.command, check.args, {
    cwd: rootDir,
    encoding: 'utf8',
    env: { ...process.env, ...check.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = [execution.stdout, execution.stderr].filter(Boolean).join('\n').trim();
  const compactOutput = output.split('\n').slice(-12).join('\n');
  const ok = execution.status === 0 && !execution.error;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}${compactOutput ? `\n${compactOutput}\n` : '\n'}`);

  return {
    id: check.id,
    label: check.label,
    severity: check.severity,
    ok,
    exitCode: execution.status,
    output: compactOutput || execution.error?.message || '',
  };
});

const report = evaluateAcceptance(manifest, commandResults);
const color = report.conclusion === 'red' ? '红色' : report.conclusion === 'yellow' ? '黄色' : '绿色';

process.stdout.write(`\n=== AI 业务工具验收结论 ===\n`);
process.stdout.write(`项目: ${report.project}\n`);
process.stdout.write(`目标: ${report.target}\n`);
process.stdout.write(`结论: ${color} / ${report.label}\n`);
process.stdout.write(`检查统计: ${JSON.stringify(report.counts)}\n`);

if (report.unresolved.length > 0) {
  process.stdout.write('\n未通过项:\n');
  for (const item of report.unresolved) {
    process.stdout.write(`- [${item.severity}] ${item.id} (${item.status}): ${item.summary}\n`);
  }
} else {
  process.stdout.write('\n所有必选项均已通过。\n');
}

if (!reportOnly && report.conclusion !== 'green') {
  process.exitCode = 1;
}
