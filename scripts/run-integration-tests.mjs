import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { config as loadEnvFile } from 'dotenv';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tsxCommand = process.platform === 'win32'
  ? path.join(repoRoot, 'node_modules', '.bin', 'tsx.cmd')
  : path.join(repoRoot, 'node_modules', '.bin', 'tsx');

const collectTestFiles = (directory) => {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTestFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      files.push(path.relative(repoRoot, absolutePath));
    }
  }

  return files.sort();
};

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const isValidPostgresUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
  } catch {
    return false;
  }
};

const loadFileIfPresent = (relativePath, override = false) => {
  const absolutePath = path.join(repoRoot, relativePath);

  if (!existsSync(absolutePath)) {
    return false;
  }

  const result = loadEnvFile({
    path: absolutePath,
    override,
  });

  if (result.error) {
    fail(`Could not load ${relativePath}: ${result.error.message}`);
  }

  return true;
};

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const loadedFiles = [];

if (loadFileIfPresent('.env')) {
  loadedFiles.push('.env');
}

if (loadFileIfPresent('.env.test', true)) {
  loadedFiles.push('.env.test');
}

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

if (!process.env.TEST_DATABASE_URL) {
  fail([
    'TEST_DATABASE_URL is required for integration tests.',
    'Add it to root .env or create root .env.test from .env.test.example.',
    'The test database name should include "test" to protect development data.',
  ].join('\n'));
}

if (!isValidPostgresUrl(process.env.TEST_DATABASE_URL)) {
  fail('TEST_DATABASE_URL must be a valid postgres:// or postgresql:// URL.');
}

if (!new URL(process.env.TEST_DATABASE_URL).pathname.replace(/^\/+/, '').toLowerCase().includes('test')) {
  fail('TEST_DATABASE_URL must point to a database whose name includes "test".');
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  fail('JWT_SECRET must be set before running integration tests. Root .env is usually the easiest place.');
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

if (!existsSync(tsxCommand)) {
  fail('Local tsx binary is missing. Run npm run bootstrap or npm ci in the repo root.');
}

const testFiles = collectTestFiles(path.join(repoRoot, 'test'));

if (testFiles.length === 0) {
  fail('No integration test files were found under test/.');
}

console.log(`Loaded env files: ${loadedFiles.length > 0 ? loadedFiles.join(', ') : '(environment only)'}`);
console.log(`Using integration database: ${process.env.TEST_DATABASE_URL}`);

run(npmCommand, ['run', 'db:migrate']);
run(tsxCommand, ['--test', ...testFiles]);
