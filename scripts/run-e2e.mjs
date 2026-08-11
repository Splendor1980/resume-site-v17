// E2E-обёртка: сама поднимает astro preview на порту 4321, ждёт готовности,
// прогоняет scripts/test-constructor.mjs и гасит сервер.
// Запуск: npm run test:e2e  (после npm run build)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = 4321;
const BASE = `http://localhost:${PORT}`;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function isUp(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { method: 'HEAD' });
      return true;
    } catch {
      await sleep(500);
    }
  }
  return false;
}

// если сервер уже запущен (npm run dev / preview) — просто прогоняем тест
if (await isUp(BASE, 3000)) {
  const m = await runTest();
  process.exit(m);
}

const server = spawn(
  process.execPath,
  [join(ROOT, 'node_modules', 'astro', 'astro.js'), 'preview', '--port', String(PORT)],
  { cwd: ROOT, stdio: 'inherit' }
);

let serverReady = false;
try {
  serverReady = await isUp(BASE);
} catch {
  serverReady = false;
}
if (!serverReady) {
  console.error('FAIL: astro preview не поднялся на', BASE);
  server.kill();
  process.exit(1);
}

const code = await runTest();
server.kill();
process.exit(code);

async function runTest() {
  const child = spawn(process.execPath, [join(__dirname, 'test-constructor.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, BASE_URL: BASE },
  });
  return new Promise((resolve) => child.on('exit', resolve));
}