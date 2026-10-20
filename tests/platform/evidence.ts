import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type Status = 'pass' | 'fail' | 'blocked' | 'not run';
export interface AssertionRecord {
  name: string;
  status: Status;
  actual?: unknown;
  expected?: unknown;
}

export interface ScenarioResult {
  id: string;
  status: Status;
  checks: AssertionRecord[];
  reason?: string;
  events?: unknown[];
  observations?: unknown;
  diagnostics: { kind: string; message: string; url?: string; expected: boolean }[];
  artifacts?: { screenshot?: string; trace?: string };
}

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function git(...args: string[]): string {
  // Git arguments are fixed by this test harness; resolve the developer's installed Git.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

export async function hashes(paths: string[], root = '.'): Promise<[string, string][]> {
  const sorted = [...paths].sort((a, b) => a.localeCompare(b));

  return Promise.all(sorted.map(async path => [path, sha256(await readFile(join(root, path)))]));
}

export async function inputHashes(): Promise<[string, string][]> {
  const paths = git('ls-files', '-z', '--cached', '--others', '--exclude-standard')
    .split('\0')
    .filter(path => /^(src\/|examples\/|tests\/platform\/|[^/]+\.(?:json|mts)$)/.test(path));

  return hashes(paths);
}

export async function buildHashes(root: string): Promise<[string, string][]> {
  const files = (await readdir(root, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name).slice(root.length + 1));

  return hashes(files, root);
}

export async function captureBuild(): Promise<{
  directory: string;
  frozen: string;
  manifest: {
    sourceCommit: string;
    branch: string;
    dirty: string;
    diffSha256: string;
    inputs: [string, string][];
    inputIdentity: string;
    buildFiles: [string, string][];
    buildIdentity: string;
  };
}> {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-platform-'));
  const frozen = join(directory, 'build');
  await cp('dist/example', frozen, { recursive: true });
  const inputs = await inputHashes();
  const buildFiles = await buildHashes(frozen);
  const manifest = {
    sourceCommit: git('rev-parse', 'HEAD'),
    branch: git('branch', '--show-current'),
    dirty: git('status', '--porcelain=v1'),
    diffSha256: sha256(git('diff', '--binary', 'HEAD')),
    inputs,
    inputIdentity: sha256(JSON.stringify(inputs)),
    buildFiles,
    buildIdentity: sha256(JSON.stringify(buildFiles)),
  };
  await writeJson(join(directory, 'manifest.json'), manifest);

  return { directory, frozen, manifest };
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + '\n');
}
