import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const projects = [
  { label: 'backend', cwd: repoRoot },
  { label: 'admin-web', cwd: path.join(repoRoot, 'admin-web') },
  { label: 'MobileApp', cwd: path.join(repoRoot, 'MobileApp') },
];

const run = (cwd, args) => {
  const result = spawnSync(npmCommand, args, {
    cwd,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

for (const project of projects) {
  const lockfilePath = path.join(project.cwd, 'package-lock.json');
  const installArgs = existsSync(lockfilePath)
    ? ['ci', '--no-audit', '--no-fund']
    : ['install', '--no-audit', '--no-fund'];

  console.log(`\n==> Installing dependencies for ${project.label}`);
  run(project.cwd, installArgs);
}

console.log('\nBootstrap complete.');
console.log('Next steps:');
console.log('  1. Copy env templates (.env, .env.test, admin-web/.env.local, MobileApp/.env).');
console.log('  2. Run npm run doctor.');
console.log('  3. Run npm run demo:reset once your local databases exist.');
