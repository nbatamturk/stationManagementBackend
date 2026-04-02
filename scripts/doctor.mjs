import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedNodeMajor = readFileSync(path.join(repoRoot, '.nvmrc'), 'utf8').trim();

let okCount = 0;
let warnCount = 0;
let failCount = 0;

const log = (label, message) => {
  console.log(`[${label}] ${message}`);
};

const ok = (message) => {
  okCount += 1;
  log('ok', message);
};

const warn = (message) => {
  warnCount += 1;
  log('warn', message);
};

const fail = (message) => {
  failCount += 1;
  log('fail', message);
};

const parseEnvFile = (filePath) => {
  const values = {};
  const fileContents = readFileSync(filePath, 'utf8');

  for (const rawLine of fileContents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalized = line.startsWith('export ') ? line.slice(7) : line;
    const separatorIndex = normalized.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
};

const isValidUrl = (value, protocols) => {
  try {
    const parsed = new URL(value);
    return protocols.includes(parsed.protocol);
  } catch {
    return false;
  }
};

const findFirstEnvFile = (candidates) => candidates.find((candidate) => existsSync(candidate)) ?? null;

const checkCommand = (command, args = ['--version']) => {
  const executable = process.platform === 'win32' ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, {
    stdio: 'pipe',
  });

  return result.status === 0;
};

const checkDependencies = (label, directory) => {
  const nodeModulesPath = path.join(directory, 'node_modules');

  if (existsSync(nodeModulesPath)) {
    ok(`${label} dependencies are installed`);
    return;
  }

  warn(`${label} dependencies are missing. Run npm run bootstrap.`);
};

console.log('Station Management doctor\n');

const nodeMajor = process.versions.node.split('.')[0];
if (nodeMajor === expectedNodeMajor) {
  ok(`Node.js ${process.version} matches .nvmrc`);
} else {
  warn(`Node.js ${process.version} does not match .nvmrc (${expectedNodeMajor}).`);
}

if (checkCommand('npm')) {
  ok('npm is available');
} else {
  fail('npm is not available in PATH.');
}

if (checkCommand('git')) {
  ok('git is available');
} else {
  warn('git is not available in PATH.');
}

if (checkCommand('psql')) {
  ok('psql is available');
} else {
  warn('psql is not available in PATH. PostgreSQL can still work if it is installed another way.');
}

checkDependencies('backend', repoRoot);
checkDependencies('admin-web', path.join(repoRoot, 'admin-web'));
checkDependencies('MobileApp', path.join(repoRoot, 'MobileApp'));

const rootEnvPath = path.join(repoRoot, '.env');
const rootTestEnvPath = path.join(repoRoot, '.env.test');

if (!existsSync(rootEnvPath)) {
  fail('Root .env is missing. Copy .env.example to .env and set DATABASE_URL plus JWT_SECRET.');
} else {
  const rootEnv = parseEnvFile(rootEnvPath);

  if (!rootEnv.DATABASE_URL) {
    fail('Root .env is missing DATABASE_URL.');
  } else if (!isValidUrl(rootEnv.DATABASE_URL, ['postgres:', 'postgresql:'])) {
    fail('Root .env DATABASE_URL is not a valid postgres URL.');
  } else {
    ok('Root .env has a valid DATABASE_URL');
  }

  if (!rootEnv.JWT_SECRET) {
    fail('Root .env is missing JWT_SECRET.');
  } else if (rootEnv.JWT_SECRET.length < 16) {
    fail('Root .env JWT_SECRET must be at least 16 characters long.');
  } else {
    ok('Root .env has a valid JWT_SECRET');
  }
}

if (!existsSync(rootTestEnvPath)) {
  warn('Root .env.test is missing. Copy .env.test.example if you want npm test to work locally.');
} else {
  const testEnv = parseEnvFile(rootTestEnvPath);
  const testDatabaseUrl = testEnv.TEST_DATABASE_URL;

  if (!testDatabaseUrl) {
    fail('Root .env.test is present but TEST_DATABASE_URL is missing.');
  } else if (!isValidUrl(testDatabaseUrl, ['postgres:', 'postgresql:'])) {
    fail('Root .env.test TEST_DATABASE_URL is not a valid postgres URL.');
  } else if (!new URL(testDatabaseUrl).pathname.replace(/^\/+/, '').toLowerCase().includes('test')) {
    fail('Root .env.test TEST_DATABASE_URL must point to a database whose name includes "test".');
  } else {
    ok('Root .env.test has a safe TEST_DATABASE_URL');
  }
}

const adminEnvPath = findFirstEnvFile([
  path.join(repoRoot, 'admin-web', '.env.local'),
  path.join(repoRoot, 'admin-web', '.env'),
]);

if (!adminEnvPath) {
  warn('admin-web env is missing. Copy admin-web/.env.example to admin-web/.env.local.');
} else {
  const adminEnv = parseEnvFile(adminEnvPath);

  if (!adminEnv.NEXT_PUBLIC_API_BASE_URL) {
    fail(`${path.relative(repoRoot, adminEnvPath)} is missing NEXT_PUBLIC_API_BASE_URL.`);
  } else if (!isValidUrl(adminEnv.NEXT_PUBLIC_API_BASE_URL, ['http:', 'https:'])) {
    fail(`${path.relative(repoRoot, adminEnvPath)} NEXT_PUBLIC_API_BASE_URL must be an http(s) URL.`);
  } else {
    ok(`admin-web API base URL is configured in ${path.relative(repoRoot, adminEnvPath)}`);
  }
}

const mobileEnvPath = findFirstEnvFile([path.join(repoRoot, 'MobileApp', '.env')]);

if (!mobileEnvPath) {
  warn('MobileApp env is missing. Copy MobileApp/.env.example to MobileApp/.env.');
} else {
  const mobileEnv = parseEnvFile(mobileEnvPath);

  if (!mobileEnv.EXPO_PUBLIC_API_BASE_URL) {
    fail('MobileApp/.env is missing EXPO_PUBLIC_API_BASE_URL.');
  } else if (!isValidUrl(mobileEnv.EXPO_PUBLIC_API_BASE_URL, ['http:', 'https:'])) {
    fail('MobileApp/.env EXPO_PUBLIC_API_BASE_URL must be an http(s) URL.');
  } else {
    ok('MobileApp API base URL is configured');
  }
}

console.log('\nSummary');
console.log(`  ok:   ${okCount}`);
console.log(`  warn: ${warnCount}`);
console.log(`  fail: ${failCount}`);

if (failCount > 0) {
  process.exit(1);
}
