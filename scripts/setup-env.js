/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CY = '\x1b[36m', GR = '\x1b[32m', YL = '\x1b[33m', RD = '\x1b[31m', RS = '\x1b[0m';

function banner() {
  console.log(`${CY}=============================================${RS}`);
  console.log(`${CY}          PRISM ENV SETUP HELPER             ${RS}`);
  console.log(`${CY}=============================================${RS}`);
  console.log('');
}

// base64, strip non-alphanumeric, truncate — matches the .env.example guidance
// ("openssl rand -base64 48 | tr -d '\n/=+' | head -c 64")
function genSecret(len = 64) {
  const raw = crypto.randomBytes(48).toString('base64').replace(/[^A-Za-z0-9]/g, '');
  return raw.slice(0, len);
}

function isPlaceholder(value) {
  return /^replace-with/i.test(value.trim());
}

// Replace KEY=<placeholder> lines with KEY=<secret>; leave real values + comments alone.
function fillPlaceholders(content, secretFor) {
  return content
    .split('\n')
    .map((line) => {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (!m) return line;
      const key = m[1];
      const val = m[2];
      if (!isPlaceholder(val)) return line;
      const secret = secretFor(key);
      return secret ? `${key}=${secret}` : line;
    })
    .join('\n');
}

function ensureFile(target, template, secretFor, label) {
  const tplPath = path.join(ROOT, template);
  const tgtPath = path.join(ROOT, target);
  if (!fs.existsSync(tplPath)) {
    console.log(`${RD}[!] template missing: ${template}${RS}`);
    return;
  }
  if (fs.existsSync(tgtPath)) {
    const existing = fs.readFileSync(tgtPath, 'utf8');
    const filled = fillPlaceholders(existing, secretFor);
    if (filled !== existing) {
      fs.writeFileSync(tgtPath, filled);
      console.log(`${GR}[✓]${RS} filled placeholders in ${label} (${target})`);
    } else {
      console.log(`${GR}[✓]${RS} ${label} already configured (${target})`);
    }
    return;
  }
  const content = fs.readFileSync(tplPath, 'utf8');
  const filled = fillPlaceholders(content, secretFor);
  fs.writeFileSync(tgtPath, filled);
  console.log(`${GR}[✓]${RS} created ${label} from template (${target})`);
}

function main() {
  banner();
  const authSecret = genSecret(64);
  const jwtSecret = genSecret(64); // shared: frontend verifies Go JWTs, so it must match backend

  console.log(`${YL}[!]${RS} generating AUTH_SECRET + shared JWT_SECRET (64 chars each)`);
  console.log('');

  ensureFile('.env.local', '.env.example', (key) => {
    if (key === 'AUTH_SECRET') return authSecret;
    if (key === 'JWT_SECRET') return jwtSecret;
    return null; // DATABASE_URL + commented optionals stay as-is
  }, 'frontend');

  ensureFile('backend/.env', 'backend/.env.example', (key) => {
    if (key === 'JWT_SECRET') return jwtSecret; // same value as frontend
    return null; // PORT + paths stay as template defaults
  }, 'backend');

  console.log('');
  console.log(`${GR}[✓]${RS} env setup done. JWT_SECRET matches across frontend + backend.`);
  console.log(`${YL}    .env.local and backend/.env are gitignored — never committed.${RS}`);
  console.log(`${YL}    Re-run anytime; existing real secrets are preserved.${RS}`);
}

main();
