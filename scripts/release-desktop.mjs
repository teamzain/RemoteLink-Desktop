#!/usr/bin/env node
/**
 * Local release script for RemoteLink Desktop (Connect-X).
 *
 * Usage:
 *   node scripts/release-desktop.mjs [options]
 *
 * Options:
 *   --version <ver>       Override version (default: apps/desktop/package.json)
 *   --notes <text>        Release notes (prompts interactively if omitted)
 *   --skip-build          Skip the npm build step (use existing artifacts)
 *   --commit-manifest     Git-commit and push the updated downloads/releases.json
 *   --dry-run             Print what would happen; skip all GitHub and git operations
 *   --yes, -y             Skip the pre-publish confirmation prompt
 */

import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT         = process.cwd();
const DESKTOP_DIR  = path.join(ROOT, 'apps', 'desktop');
const RELEASE_DIR  = path.join(DESKTOP_DIR, 'release');
const DOWNLOADS_DIR = path.join(ROOT, 'docs');
const MANIFEST_PATH = path.join(DOWNLOADS_DIR, 'releases.json');

// ─── Shell helpers ────────────────────────────────────────────────────────────

// On Windows, .cmd files (npm, npx) can't be spawned directly — they need a
// shell. Instead of shell:true (which triggers DEP0190 when args is an array),
// we use cmd.exe as the explicit executable. git and gh are plain .exe files
// and work the same way on both platforms.
function spawnTarget(cmd, args) {
  if (process.platform === 'win32') {
    return { exe: 'cmd.exe', argv: ['/c', cmd, ...args] };
  }
  return { exe: cmd, argv: args };
}

function run(cmd, args, options = {}) {
  const { exe, argv } = spawnTarget(cmd, args);
  console.log(`\n  > ${cmd} ${args.join(' ')}`);
  const result = spawnSync(exe, argv, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    throw new Error(`Command failed (exit ${result.status}): ${cmd} ${args.join(' ')}`);
  }
}

function runRead(cmd, args, options = {}) {
  const { exe, argv } = spawnTarget(cmd, args);
  const result = spawnSync(exe, argv, { encoding: 'utf-8', ...options });
  if (result.status !== 0) {
    throw new Error((result.stderr || '').trim() || `Command failed: ${cmd} ${args.join(' ')}`);
  }
  return (result.stdout || '').trim();
}

function commandExists(cmd) {
  const { exe, argv } = spawnTarget(cmd, ['--version']);
  const result = spawnSync(exe, argv, { stdio: 'ignore' });
  return result.status === 0;
}

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const raw = process.argv.slice(2);
  const out = {
    version: null,
    notes: null,
    skipBuild: false,
    commitManifest: false,
    dryRun: false,
    yes: false,
  };

  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (t === '--dry-run')          out.dryRun = true;
    if (t === '--skip-build')       out.skipBuild = true;
    if (t === '--commit-manifest')  out.commitManifest = true;
    if (t === '--yes' || t === '-y') out.yes = true;
    if (t === '--version' && raw[i + 1]) out.version = raw[++i];
    if (t === '--notes'   && raw[i + 1]) out.notes   = raw[++i];
  }
  return out;
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function askNotes(version) {
  const answer = await prompt(`  Release notes for ${version} (press Enter to use default): `);
  return answer || null;
}

async function confirm(message) {
  const answer = await prompt(`\n${message} [y/N] `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

// ─── Project helpers ──────────────────────────────────────────────────────────

function getDesktopVersion() {
  const pkg = JSON.parse(readFileSync(path.join(DESKTOP_DIR, 'package.json'), 'utf-8'));
  return pkg.version;
}

function getRepoSlug() {
  const remote = runRead('git', ['remote', 'get-url', 'origin']);
  const match = remote.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/i);
  if (!match) throw new Error(`Cannot parse GitHub repo from origin URL: ${remote}`);
  return match[1];
}

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return { generatedAt: null, releases: [] };
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
}

function getReleaseFiles() {
  if (!existsSync(RELEASE_DIR)) {
    throw new Error(`Release directory not found: ${RELEASE_DIR}\nRun without --skip-build to build first.`);
  }

  const wanted = (name) =>
    name.endsWith('.exe') ||
    name.endsWith('.blockmap') ||
    name === 'latest.yml';

  const files = readdirSync(RELEASE_DIR)
    .map((name) => path.join(RELEASE_DIR, name))
    .filter((p) => statSync(p).isFile() && wanted(path.basename(p)));

  if (!files.length) {
    throw new Error('No release artifacts found in apps/desktop/release/');
  }
  return files;
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function buildReleaseEntry({ version, tag, repoSlug, notes, files }) {
  return {
    version,
    tag,
    publishedAt: new Date().toISOString(),
    notes: notes || `Release ${version}`,
    assets: files.map((fullPath) => ({
      name: path.basename(fullPath),
      size: statSync(fullPath).size,
      sha256: sha256(fullPath),
      url: `https://github.com/${repoSlug}/releases/download/${tag}/${path.basename(fullPath)}`,
    })),
  };
}

function updateManifest(newEntry) {
  mkdirSync(DOWNLOADS_DIR, { recursive: true });
  const manifest = readManifest();
  const releases = (manifest.releases || []).filter((r) => r.tag !== newEntry.tag);
  releases.unshift(newEntry);
  writeFileSync(MANIFEST_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), releases }, null, 2)}\n`);
}

function releaseExists(tag) {
  const { exe, argv } = spawnTarget('gh', ['release', 'view', tag]);
  return spawnSync(exe, argv, { encoding: 'utf-8' }).status === 0;
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function step(n, total, label) {
  console.log(`\n[${n}/${total}] ${label}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const version = args.version || getDesktopVersion();
  const tag = version.startsWith('v') ? version : `v${version}`;

  // Pre-flight checks
  for (const cmd of ['git', 'npm', 'gh']) {
    if (!commandExists(cmd)) throw new Error(`Required command not found: ${cmd}. Install it and try again.`);
  }

  const repoSlug = getRepoSlug();

  // Show summary banner before any interactive prompts
  const TOTAL_STEPS = args.skipBuild
    ? (args.commitManifest ? 4 : 3)
    : (args.commitManifest ? 5 : 4);

  console.log('\n──────────────────────────────────────────');
  console.log(`  RemoteLink Desktop — Release ${tag}`);
  console.log(`  Repo    : ${repoSlug}`);
  console.log(`  Dry-run : ${args.dryRun}`);
  console.log('──────────────────────────────────────────\n');

  // Collect release notes (prompt only in an interactive terminal)
  let notes = args.notes;
  if (!notes && !args.dryRun && process.stdin.isTTY) {
    notes = await askNotes(version);
  }
  notes = notes || `Desktop release ${version}`;
  console.log(`  Notes   : ${notes}`);

  if (!args.yes && !args.dryRun) {
    const ok = await confirm('Publish this release to GitHub?');
    if (!ok) {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  let stepN = 0;

  // Step: build
  if (!args.skipBuild) {
    step(++stepN, TOTAL_STEPS, 'Building desktop app');
    run('npm', ['run', 'build', '-w', 'connect-x']);
  } else {
    console.log('\n  Skipping build (--skip-build)');
  }

  // Step: collect artifacts
  step(++stepN, TOTAL_STEPS, 'Collecting release artifacts');
  const files = getReleaseFiles();
  console.log(`  Found: ${files.map((f) => path.basename(f)).join(', ')}`);

  // Step: publish to GitHub
  step(++stepN, TOTAL_STEPS, `Publishing GitHub release ${tag}`);
  if (!args.dryRun) {
    if (releaseExists(tag)) {
      run('gh', ['release', 'upload', tag, ...files, '--clobber']);
      run('gh', ['release', 'edit', tag,
        '--title', `RemoteLink Desktop ${version}`,
        '--notes', notes,
      ]);
    } else {
      run('gh', ['release', 'create', tag, ...files,
        '--title', `RemoteLink Desktop ${version}`,
        '--notes', notes,
      ]);
    }
  } else {
    console.log('  Dry-run: skipping gh release create/upload');
  }

  // Step: update manifest
  step(++stepN, TOTAL_STEPS, 'Updating downloads/releases.json');
  const entry = buildReleaseEntry({ version, tag, repoSlug, notes, files });
  if (!args.dryRun) {
    updateManifest(entry);
    console.log(`  Written: ${MANIFEST_PATH}`);
  } else {
    console.log('  Dry-run: would write:', JSON.stringify(entry, null, 2).split('\n').slice(0, 8).join('\n'));
  }

  // Step: commit manifest (optional)
  if (args.commitManifest) {
    step(++stepN, TOTAL_STEPS, 'Committing manifest to git');
    if (!args.dryRun) {
      run('git', ['add', 'downloads/releases.json']);
      run('git', ['commit', '-m', `chore(release): publish ${tag} manifest`]);
      run('git', ['push']);
    } else {
      console.log('  Dry-run: skipping git commit/push');
    }
  }

  console.log('\n──────────────────────────────────────────');
  console.log(`  Release ${tag} complete.`);
  if (!args.dryRun) {
    console.log(`  GitHub : https://github.com/${repoSlug}/releases/tag/${tag}`);
  }
  console.log('──────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error(`\nRelease failed: ${err.message}`);
  process.exit(1);
});
