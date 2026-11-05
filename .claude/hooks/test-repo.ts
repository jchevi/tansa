// Test helpers for the review-loop hooks: temporary git repos and a way to run a hook the
// way Claude Code does, with `node` and JSON on stdin [TAN-34].
import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const hooksDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(hooksDir, '..', '..')
const scratch = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'tansa-hooks-')))
const emptyConfig = path.join(scratch, 'empty.gitconfig')
writeFileSync(emptyConfig, '')

// Git and the hooks ignore the developer's global and system git config, so signing,
// a hooks path or a global excludes file cannot change a result.
export const env = { ...process.env, GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_NOSYSTEM: '1' }

export function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=TANSA Test', '-c', 'user.email=test@example.test', ...args],
    { cwd, env, encoding: 'utf8' },
  ).trim()
}

export function writeFile(repo: string, relative: string, text: string): void {
  const file = path.join(repo, relative)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}

// One committed repo on branch TAN-20-example, with the project's real .gitignore.
export function buildTemplate(): string {
  const dir = mkdtempSync(path.join(scratch, 'template-'))
  git(dir, 'init', '-q', '-b', 'main')
  writeFile(dir, '.gitignore', readFileSync(path.join(projectRoot, '.gitignore'), 'utf8'))
  writeFile(dir, 'README.md', '# Example\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'init')
  git(dir, 'checkout', '-q', '-b', 'TAN-20-example')
  return dir
}

// Copying the template is much faster than running git init for every test on Windows.
export function copyRepo(template: string): string {
  const dir = mkdtempSync(path.join(scratch, 'repo-'))
  cpSync(template, dir, { recursive: true })
  return dir
}

export function removeScratch(): void {
  rmSync(scratch, { recursive: true, force: true })
}

export type HookResult = { status: number | null; stdout: string; stderr: string }

export function runHook(name: string, input: unknown): HookResult {
  const result = spawnSync(process.execPath, [path.join(hooksDir, `${name}.ts`)], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env,
    encoding: 'utf8',
  })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

// A script the main agent runs with Bash (not a hook): arguments, no stdin [TAN-36].
export function runScript(name: string, args: string[], cwd: string): HookResult {
  const result = spawnSync(process.execPath, [path.join(hooksDir, `${name}.ts`), ...args], {
    cwd,
    env,
    encoding: 'utf8',
  })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}
