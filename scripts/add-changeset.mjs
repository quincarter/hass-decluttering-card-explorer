#!/usr/bin/env node
// Non-interactive equivalent of `changeset add`. The real `changeset add` command is
// a TUI (arrow-key prompts) and can't be driven from a script or an agent, so this
// wraps @changesets/write's programmatic API directly with plain --flags instead.
import { writeChangeset } from '@changesets/write';
import { getPackages } from '@manypkg/get-packages';

function parseArgs(argv) {
  const args = { bump: 'patch', summary: '' };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--bump' || arg === '-b') {
      args.bump = argv[++i];
    } else if (arg === '--summary' || arg === '-s') {
      args.summary = argv[++i];
    } else {
      rest.push(arg);
    }
  }
  if (!args.summary && rest.length > 0) args.summary = rest.join(' ');
  return args;
}

const VALID_BUMPS = ['patch', 'minor', 'major'];

async function main() {
  const { bump, summary } = parseArgs(process.argv.slice(2));

  if (!summary.trim()) {
    console.error(
      'Usage: node scripts/add-changeset.mjs --summary "<description>" [--bump patch|minor|major]'
    );
    process.exitCode = 1;
    return;
  }
  if (!VALID_BUMPS.includes(bump)) {
    console.error(`Invalid --bump "${bump}" — must be one of: ${VALID_BUMPS.join(', ')}.`);
    process.exitCode = 1;
    return;
  }

  const cwd = process.cwd();
  const { packages, rootDir } = await getPackages(cwd);
  const [pkg] = packages;
  if (!pkg) {
    console.error('No package found via @manypkg/get-packages.');
    process.exitCode = 1;
    return;
  }

  const id = await writeChangeset(
    { summary: summary.trim(), releases: [{ name: pkg.packageJson.name, type: bump }] },
    rootDir
  );

  console.log(`Wrote .changeset/${id}.md (${bump})`);
}

main();
