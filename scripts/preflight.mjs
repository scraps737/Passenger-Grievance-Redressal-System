#!/usr/bin/env node
/**
 * GrievanceAI preflight.
 *
 * Makes `npm run dev` (and `npm start`) a single command that just works:
 *   1. verifies the Node version
 *   2. creates server/.env from the example, generating a real JWT secret
 *   3. ensures MongoDB is reachable, starting it if necessary
 *   4. seeds demo data when the database is empty
 *
 * Flags: --no-seed --force-seed --no-db-start --quiet
 */
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_DIR = path.join(ROOT, 'server');
const ENV_PATH = path.join(SERVER_DIR, '.env');
const ENV_EXAMPLE = path.join(SERVER_DIR, '.env.example');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const QUIET = flag('quiet');

const c = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
};

let step = 0;
const say = (msg) => !QUIET && console.log(msg);
const heading = (msg) => {
  step += 1;
  say(`${c.dim}[${step}${' '.repeat(0)}]${c.reset} ${msg}`);
};
const ok = (msg) => say(`    ${c.green}✓${c.reset} ${msg}`);
const info = (msg) => say(`    ${c.dim}·${c.reset} ${msg}`);
const warn = (msg) => say(`    ${c.yellow}!${c.reset} ${msg}`);

function fail(message, hint) {
  console.error(`\n${c.red}✗ ${message}${c.reset}`);
  if (hint) console.error(`\n${hint}\n`);
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* 1. Node version                                                            */
/* -------------------------------------------------------------------------- */

heading('Checking environment');
const major = Number(process.versions.node.split('.')[0]);
if (major < 18) fail(`Node.js 18 or newer is required (found ${process.versions.node}).`);
ok(`Node.js ${process.versions.node}`);

if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
  fail('Dependencies are not installed.', `Run:\n  npm install\n`);
}
ok('Dependencies installed');

/* -------------------------------------------------------------------------- */
/* 2. server/.env                                                             */
/* -------------------------------------------------------------------------- */

heading('Preparing configuration');
if (fs.existsSync(ENV_PATH)) {
  ok('server/.env already present');
} else {
  if (!fs.existsSync(ENV_EXAMPLE)) fail('server/.env.example is missing — cannot bootstrap configuration.');
  const secret = crypto.randomBytes(48).toString('hex');
  const contents = fs
    .readFileSync(ENV_EXAMPLE, 'utf8')
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
  fs.writeFileSync(ENV_PATH, contents, { mode: 0o600 });
  ok('Created server/.env with a freshly generated JWT_SECRET');
}

const env = {};
for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (match && !line.trim().startsWith('#')) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
}

// Shell/platform variables win over .env, matching how the server itself loads them.
const scalar = (key, fallback) => process.env[key] || env[key] || fallback;
const mongoUri = scalar('MONGODB_URI', 'mongodb://127.0.0.1:27017/grievanceai');
const apiPort = Number(scalar('PORT', 5050));
const webPort = 5173;

let mongoHost = '127.0.0.1';
let mongoPort = 27017;
try {
  const parsed = new URL(mongoUri);
  mongoHost = parsed.hostname || mongoHost;
  mongoPort = Number(parsed.port || 27017);
} catch {
  warn(`Could not parse MONGODB_URI; assuming ${mongoHost}:${mongoPort}`);
}
info(`API :${apiPort} · web :${webPort} · database ${mongoHost}:${mongoPort}`);

/* -------------------------------------------------------------------------- */
/* 3. MongoDB                                                                 */
/* -------------------------------------------------------------------------- */

function canConnect(host, port, timeout = 1200) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findMongodBinary() {
  const probe = spawnSync('which', ['mongod'], { encoding: 'utf8' });
  if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  for (const candidate of ['/opt/homebrew/bin/mongod', '/usr/local/bin/mongod', '/usr/bin/mongod']) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function pickDataDir() {
  const candidates = [
    '/opt/homebrew/var/mongodb',
    '/usr/local/var/mongodb',
    path.join(os.homedir(), '.grievanceai', 'mongodb-data'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  const fallback = candidates[candidates.length - 1];
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

async function ensureMongo() {
  heading('Connecting to MongoDB');

  if (await canConnect(mongoHost, mongoPort)) {
    ok(`Already running on ${mongoHost}:${mongoPort}`);
    return;
  }

  if (flag('no-db-start')) {
    fail(
      `No MongoDB server is listening on ${mongoHost}:${mongoPort}.`,
      'Start it yourself, or drop --no-db-start to let this script try.'
    );
  }

  const binary = findMongodBinary();
  if (!binary) {
    fail(
      `No MongoDB server is listening on ${mongoHost}:${mongoPort} and no mongod binary was found.`,
      'Install MongoDB (https://www.mongodb.com/docs/manual/installation/) or point MONGODB_URI at an existing instance.'
    );
  }

  const dataDir = pickDataDir();
  const logFile = path.join(dataDir, 'grievanceai-mongod.log');
  info(`Not running — starting: ${binary}`);
  info(`data: ${dataDir}`);

  const child = spawn(
    binary,
    ['--dbpath', dataDir, '--bind_ip', mongoHost, '--port', String(mongoPort), '--logpath', logFile, '--logappend'],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();

  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    await sleep(400);
    if (await canConnect(mongoHost, mongoPort)) {
      ok(`Started mongod (pid ${child.pid}) on ${mongoHost}:${mongoPort}`);
      info(`Stop it later with: kill ${child.pid}`);
      return;
    }
    if (child.exitCode !== null) break;
  }

  fail(
    `mongod did not become ready within 25s.`,
    `Check the log:\n  tail -40 "${logFile}"\n`
  );
}

await ensureMongo();

/* -------------------------------------------------------------------------- */
/* 4. Seed when empty                                                         */
/* -------------------------------------------------------------------------- */

heading('Preparing database');

async function collectionCounts() {
  const conn = await mongoose
    .createConnection(mongoUri, { serverSelectionTimeoutMS: 5000 })
    .asPromise();
  try {
    const [users, grievances, departments] = await Promise.all([
      conn.db.collection('users').countDocuments(),
      conn.db.collection('grievances').countDocuments(),
      conn.db.collection('departments').countDocuments(),
    ]);
    return { users, grievances, departments };
  } finally {
    await conn.close();
  }
}

let counts;
try {
  counts = await collectionCounts();
} catch (err) {
  fail(`Could not read the database at ${mongoHost}:${mongoPort}: ${err.message}`);
}

const isEmpty = counts.users === 0 && counts.departments === 0;
const shouldSeed = flag('force-seed') || (isEmpty && !flag('no-seed'));

if (shouldSeed) {
  info(isEmpty ? 'Database is empty — loading demo dataset…' : 'Force-seeding demo dataset…');
  const result = spawnSync('npm', ['--workspace', 'server', 'run', 'seed'], {
    cwd: ROOT,
    stdio: QUIET ? 'ignore' : 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' },
  });
  if (result.status !== 0) fail('Seeding failed — see the output above.');
  ok('Demo dataset loaded');
} else if (flag('no-seed') && isEmpty) {
  warn('Database is empty and seeding was skipped (--no-seed).');
} else {
  ok(`Existing data kept (${counts.users} accounts · ${counts.grievances} grievances)`);
}

for (const [label, port] of [
  ['API', apiPort],
  ['web', webPort],
]) {
  if (await canConnect('127.0.0.1', port)) {
    warn(`Port ${port} (${label}) is already in use — the ${label} server may fail to start.`);
  }
}

/* -------------------------------------------------------------------------- */
/* 5. Summary                                                                 */
/* -------------------------------------------------------------------------- */

if (!QUIET) {
  console.log(`
${c.bold}GrievanceAI is ready.${c.reset}

  ${c.cyan}Web app${c.reset}      http://localhost:${webPort}
  ${c.cyan}API${c.reset}          http://localhost:${apiPort}/api/health

  ${c.dim}Demo accounts (from the seed):${c.reset}
    admin      ${env.SEED_ADMIN_EMAIL || 'admin@grievanceai.gov'} / ${env.SEED_ADMIN_PASSWORD || 'Admin@12345'}
    officer    r.murthy@grievanceai.gov / Officer@12345
    passenger  priya.sharma@example.com / Passenger@123
`);
}
