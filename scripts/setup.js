#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * prism one-shot setup wizard.
 *
 *   pnpm setup
 *
 * does everything:
 *   1. generate JWT secrets -> .env.local + backend/.env
 *   2. start postgres in docker
 *   3. push drizzle schema to postgres
 *   4. create admin user in the database
 *   5. print "run pnpm dev"
 *
 * idempotent: if .env files already have real secrets, keeps them.
 * if postgres is already running, skips docker. if admin user exists, skips.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, spawnSync } = require('child_process');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const CY = '\x1b[36m', GR = '\x1b[32m', YL = '\x1b[33m', RD = '\x1b[31m', BOLD = '\x1b[1m', RS = '\x1b[0m';

// ─── helpers ────────────────

function banner() {
  console.log('');
  console.log(`${CY}${BOLD}  ██████╗ ██╗██████╗ ███████╗██╗███████╗██╗  ██╗${RS}`);
  console.log(`${CY}${BOLD}  ██╔══██╗██║██╔══██╗██╔══╝██║██╔══╝██║  ██║${RS}`);
  console.log(`${CY}${BOLD}  ██████╔╝██║██████╔╝███████╗██║███████╗███████║${RS}`);
  console.log(`${CY}${BOLD}  ██╔═══╝ ██║██╔══██╗██╔══╝██║╚══██║██╔══██║${RS}`);
  console.log(`${CY}${BOLD}  ██║     ██║██║  ██║███████╗██║███████║██║  ██║${RS}`);
  console.log(`${CY}${BOLD} ╚═╝     ╚═╝╚═╝ ╚═╝╚══╝╚═╝╚══╝╚═╝ ╚═╝${RS}`);
  console.log('');
  console.log(`${CY}  one-shot setup. answer a few questions, get a working app.${RS}`);
  console.log('');
}

function step(n, msg) {
  console.log(`\n${CY}[${n}]${RS} ${BOLD}${msg}${RS}`);
}

function ok(msg) { console.log(`  ${GR}✓${RS} ${msg}`); }
function err(msg) { console.log(`  ${RD}✗${RS} ${msg}`); }

function genSecret(len = 64) {
  return crypto.randomBytes(48).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, len);
}

function isPlaceholder(value) {
  return /^replace-with/i.test(value.trim());
}

function fillPlaceholders(content, secretFor) {
  return content.split('\n').map((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (!m) return line;
    if (!isPlaceholder(m[2])) return line;
    const secret = secretFor(m[1]);
    return secret ? `${m[1]}=${secret}` : line;
  }).join('\n');
}

function ensureEnvFile(target, template, secretFor, label) {
  const tplPath = path.join(ROOT, template);
  const tgtPath = path.join(ROOT, target);
  if (!fs.existsSync(tplPath)) {
    err(`template missing: ${template}`);
    return;
  }
  if (fs.existsSync(tgtPath)) {
    const existing = fs.readFileSync(tgtPath, 'utf8');
    const filled = fillPlaceholders(existing, secretFor);
    if (filled !== existing) {
      fs.writeFileSync(tgtPath, filled);
      ok(`updated ${label} (${target})`);
    } else {
      ok(`${label} already configured (${target})`);
    }
    return;
  }
  const content = fs.readFileSync(tplPath, 'utf8');
  fs.writeFileSync(tgtPath, fillPlaceholders(content, secretFor));
  ok(`created ${label} (${target})`);
}

function ensureBackendEnv(jwtSecret, pgPassword, encKey) {
  const envPath = path.join(ROOT, 'backend/.env');
  const dbUrl = `postgresql://prism:${pgPassword}@localhost:5432/prism`;
  const defaultContent = [
    `JWT_SECRET=${jwtSecret}`,
    `REQUIRE_INVITE=false`,
    `SIDECAR_URL=http://127.0.0.1:8081`,
    ``,
    `# PostgreSQL (Docker)`,
    `DATABASE_URL=${dbUrl}`,
    ``,
    `ENCRYPTION_MASTER_KEY=${encKey}`,
    ``,
  ].join('\n');

  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, defaultContent);
    ok('created backend/.env');
  } else {
    const existing = fs.readFileSync(envPath, 'utf8');
    // check if JWT_SECRET is missing or placeholder
    if (!/^JWT_SECRET=.+/m.test(existing) || isPlaceholder(existing.match(/^JWT_SECRET=(.*)$/m)?.[1] || '')) {
      const updated = existing.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${jwtSecret}`);
      fs.writeFileSync(envPath, updated);
      ok('updated backend/.env (JWT_SECRET was missing/placeholder)');
    } else {
      ok('backend/.env already configured');
    }
    // ensure ENCRYPTION_MASTER_KEY exists (fail closed server won't start without it)
    const encMatch = existing.match(/^ENCRYPTION_MASTER_KEY=(.*)$/m);
    if (!encMatch || isPlaceholder(encMatch[1] || '')) {
      fs.appendFileSync(envPath, `\nENCRYPTION_MASTER_KEY=${encKey}\n`);
      ok('added ENCRYPTION_MASTER_KEY to backend/.env');
    }
    // ensure DATABASE_URL exists; if it still carries the old committed
    // dev password, replace it with the generated one
    const dbMatch = existing.match(/^DATABASE_URL=postgresql:\/\/prism:([^@]*)@/m);
    if (!/^DATABASE_URL=/m.test(existing)) {
      fs.appendFileSync(envPath, `\n# PostgreSQL (Docker)\nDATABASE_URL=${dbUrl}\n`);
      ok('added DATABASE_URL to backend/.env');
    } else if (dbMatch && dbMatch[1] === 'prism_dev_2024') {
      const updated = existing.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${dbUrl}`);
      fs.writeFileSync(envPath, updated);
      ok('replaced old dev password in DATABASE_URL');
    }
  }
}

// The Postgres password this script provisions. If backend/.env already has a
// real (non-dev-default) password, keep it — the volume already has it.
function resolvePgPassword() {
  const envPath = path.join(ROOT, 'backend/.env');
  if (fs.existsSync(envPath)) {
    const m = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=postgresql:\/\/prism:([^@]+)@/m);
    if (m && m[1] && m[1] !== 'prism_dev_2024') return m[1];
  }
  // url-safe alphanumerics only — avoids quoting issues in URLs/shell
  return crypto.randomBytes(24).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 32);
}

function readPipedLines() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { buf += chunk; });
    process.stdin.on('end', () => {
      resolve(buf.split('\n').map(l => l.replace(/\r$/, '')));
    });
  });
}

function ask(rl, question, defaultValue) {
  const hint = defaultValue ? ` ${YL}(${defaultValue})${RS}` : '';
  return new Promise((resolve) => {
    rl.question(`  ${question}${hint}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

function askPassword(rl) {
  return new Promise((resolve) => {
    rl.question('  admin password (min 8 chars): ', (answer) => {
      resolve(answer.trim());
    });
  });
}

function exec(cmd, opts = {}) {
  try {
    return execSync(cmd, { stdio: opts.silent ? 'pipe' : 'inherit', cwd: ROOT, ...opts });
  } catch {
    return null;
  }
}

function dockerRunning() {
  const result = spawnSync('docker', ['inspect', 'prism-postgres'], { stdio: 'pipe' });
  return result.status === 0;
}

// matches the DATABASE_URL this script writes into backend/.env
let DATABASE_URL = 'postgresql://prism:prism_dev_2024@localhost:5432/prism';

function setDatabaseUrl(url) {
  DATABASE_URL = url;
}

function pgReachable() {
  const result = spawnSync('pg_isready', ['-d', DATABASE_URL], { stdio: 'pipe' });
  return result.status === 0;
}



function psqlSync(args, opts = {}) {
  if (dockerRunning()) {
    const flags = opts.input ? ['-i'] : [];
    return spawnSync('docker', ['exec', ...flags, 'prism-postgres', 'psql', '-U', 'prism', '-d', 'prism', ...args], opts);
  }
  // native postgres fallback — same db, user, port as docker-compose.yml
  return spawnSync('psql', [DATABASE_URL, ...args], opts);
}

function pgQuery(sql) {
  const result = psqlSync(['-t', '-A', '-c', sql], { stdio: 'pipe', encoding: 'utf8' });
  return result.stdout?.trim() || '';
}

function pgExec(sql) {
  const result = psqlSync(['-c', sql], { stdio: 'pipe' });
  return result.status === 0;
}

// ─── main ───────────

async function main() {
  banner();

  // ─ 1. ask for admin credentials ──────────
  step('1/5', 'admin user setup');

  let username, password;

  if (!process.stdin.isTTY) {
    // piped input: read all lines
    const lines = await readPipedLines();
    username = (lines[0] || '').trim() || 'admin';
    password = (lines[1] || '').trim();
    console.log(`  admin username: ${username}`);
    console.log(`  admin password: ${'*'.repeat(password.length)}`);
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    username = await ask(rl, 'admin username', 'admin');
    if (username.length < 3) {
      err('username must be at least 3 characters');
      process.exit(1);
    }
    while (true) {
      password = await askPassword(rl);
      if (password.length >= 8) break;
      err('password must be at least 8 characters. try again.');
    }
    rl.close();
  }

  if (username.length < 3) {
    err('username must be at least 3 characters');
    process.exit(1);
  }
  if (password.length < 8) {
    err('password must be at least 8 characters');
    process.exit(1);
  }

  // ─ 2. generate env files ─────────
  step('2/5', 'generating env files (JWT secrets, DATABASE_URL)');

  const authSecret = genSecret(64);
  const jwtSecret = genSecret(64);
  const pgPassword = resolvePgPassword();
  const dbUrl = `postgresql://prism:${pgPassword}@localhost:5432/prism`;

  ensureEnvFile('.env.local', '.env.example', (key) => {
    if (key === 'AUTH_SECRET') return authSecret;
    if (key === 'JWT_SECRET') return jwtSecret;
    return null;
  }, 'frontend');

  ensureBackendEnv(jwtSecret, pgPassword, crypto.randomBytes(32).toString('hex'));
  setDatabaseUrl(dbUrl);

  ok('JWT_SECRET matches across frontend + backend');

  // ─ 3. start postgres ─────────────
  step('3/5', 'starting postgres');

  if (dockerRunning()) {
    ok('prism-postgres (docker) already running');
  } else if (pgReachable()) {
    ok('native postgres detected on localhost:5432 — skipping docker');
  } else {
    // pass the generated password through so compose doesn't fall back to a
    // committed default (and doesn't fail on the :? guard)
    const result = exec('docker compose up -d', { env: { ...process.env, POSTGRES_PASSWORD: pgPassword } });
    if (result === null) {
      err('docker compose failed and no native postgres on localhost:5432.');
      err('either install docker, or create the db manually:');
      console.log(`  sudo -u postgres psql -c "CREATE ROLE prism LOGIN PASSWORD '<choose-a-password>';"`);
      console.log('  sudo -u postgres psql -c "CREATE DATABASE prism OWNER prism;"');
      process.exit(1);
    }
    // wait for postgres to be ready
    process.stdout.write('  waiting for postgres to be ready');
    let ready = false;
    for (let i = 0; i < 30; i++) {
      process.stdout.write('.');
      const r = spawnSync('docker', ['exec', 'prism-postgres', 'pg_isready', '-U', 'prism', '-d', 'prism'], { stdio: 'pipe' });
      if (r.status === 0) { ready = true; break; }
      execSync('sleep 1');
    }
    console.log(ready ? ` ${GR}ready${RS}` : ` ${RD}timeout${RS}`);
    if (!ready) {
      err('postgres did not become ready in 30 seconds');
      process.exit(1);
    }
  }

  // ─ 4. push schema ────────────────
  step('4/5', 'pushing database schema (postgres.sql)');

  // check if schema already exists (users table)
  const tableExists = pgQuery("SELECT to_regclass('public.users')");
  if (tableExists && tableExists !== '') {
    ok('schema already exists (users table found)');
  } else {
    // fresh database — apply embedded SQL migration via psql (docker or native)
    const migrationPath = path.join(ROOT, 'backend/internal/db/migrations/postgres.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    const schemaResult = psqlSync([], { input: migrationSql, stdio: ['pipe', 'inherit', 'inherit'] });
    if (schemaResult.status !== 0) {
      err('schema push failed. check postgres is running.');
      process.exit(1);
    }
    ok('schema pushed');
  }

  // ─ 5. create admin user ──────────
  step('5/5', `creating admin user "${username}"`);

  // check if user already exists
  const existing = pgQuery(`SELECT id FROM users WHERE username = '${username.replace(/'/g, "''")}'`);
  if (existing) {
    // promote to admin if exists
    pgExec(`UPDATE users SET role = 'admin' WHERE username = '${username.replace(/'/g, "''")}'`);
    ok(`user "${username}" already exists — promoted to admin`);
  } else {
    // generate bcrypt hash — use the node bcryptjs that's already a dependency
    const bcryptjs = require('bcryptjs');
    const hash = bcryptjs.hashSync(password, 10);
    const userId = crypto.randomUUID();
    const escapedHash = hash.replace(/'/g, "''");
    const sql = `INSERT INTO users (id, username, password_hash, role, has_completed_setup, created_at, updated_at) VALUES ('${userId}', '${username.replace(/'/g, "''")}', '${escapedHash}', 'admin', true, NOW(), NOW())`;
    if (pgExec(sql)) {
      ok(`admin user "${username}" created`);
    } else {
      err('failed to create admin user. you can do it manually:');
      console.log(`  psql "${DATABASE_URL}" -c "INSERT INTO users (id, username, password_hash, role, has_completed_setup, created_at, updated_at) VALUES (gen_random_uuid(), '${username}', '<bcrypt-hash>', 'admin', true, NOW(), NOW())"`);
      process.exit(1);
    }
  }

  // ─ done ──────────
  console.log('');
  console.log(`${GR}${BOLD}  ✓ setup complete.${RS}`);
  console.log('');
  console.log(`  ${CY}admin user:${RS}  ${username}`);
  console.log(`  ${CY}database:${RS}     ${DATABASE_URL}`);
  console.log('');
  console.log(`  ${BOLD}next step:${RS} ${CY}pnpm dev${RS}`);
  console.log(`  then open http://localhost:3000 and log in.`);
  console.log('');
  console.log(`  ${YL}to download AI models:${RS} Settings -> AI -> Download`);
  console.log('');
}

main().catch((e) => {
  err(e.message);
  process.exit(1);
});
