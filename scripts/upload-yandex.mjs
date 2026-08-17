// Выгрузка dist/ в Yandex Cloud Object Storage (S3-совместимый API) на официальном AWS SDK (node).
// Данные — из deploy/.env или переменных окружения:
//   S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, YC_BUCKET
// Запуск:
//   node scripts/upload-yandex.mjs buckets          — список бакетов (проверка ключей)
//   node scripts/upload-yandex.mjs sync --delete    — выгрузка dist/ (--delete удалит лишнее)
//   node scripts/upload-yandex.mjs configure        — включить хостинг (index.html) + public-read
import { createReadStream, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  S3Client, ListBucketsCommand, ListObjectsV2Command, PutObjectCommand,
  DeleteObjectCommand, PutBucketWebsiteCommand, PutBucketAclCommand,
} from '@aws-sdk/client-s3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadEnv() {
  try {
    const text = readFileSync(join(ROOT, 'deploy', '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();

const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const bucket = process.env.YC_BUCKET || process.env.AWS_BUCKET;
const endpoint = process.env.S3_ENDPOINT || 'https://storage.yandexcloud.net';

if (!accessKeyId || !secretAccessKey) {
  console.error('Нет S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY (см. deploy/.env.example)');
  process.exit(1);
}

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ru-central1',
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

function cacheControl(key) {
  if (key.startsWith('_astro/')) return 'public, max-age=31536000, immutable';
  if (key.startsWith('data/') || key.startsWith('prototypes/')) return 'public, max-age=3600';
  return 'no-cache';
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

async function listKeys() {
  const keys = [];
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucket, ContinuationToken: token,
    }));
    for (const o of res.Contents || []) keys.push(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function cmdBuckets() {
  const res = await s3.send(new ListBucketsCommand({}));
  console.log('Бакеты (' + res.Buckets.length + '):');
  for (const b of res.Buckets) console.log(' -', b.Name);
}

async function cmdSync(doDelete) {
  const local = walk(DIST).map((f) => relative(DIST, f).replace(/\\/g, '/'));
  console.log('Файлов к выгрузке:', local.length);

  const remote = await listKeys();
  console.log('Файлов в бакете:', remote.length);

  for (const key of local) {
    const p = join(DIST, key);
    await s3.send(new PutObjectCommand({
      Bucket: bucket, Key: key,
      Body: createReadStream(p),
      ContentType: MIME[extname(key).toLowerCase()] || 'application/octet-stream',
      CacheControl: cacheControl(key),
    }));
    await sleep(100);
  }
  console.log('Выгружено файлов:', local.length);

  if (doDelete) {
    const stale = remote.filter((k) => !local.includes(k));
    for (const key of stale) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      await sleep(100);
    }
    console.log('Удалено лишних:', stale.length);
  }
}

async function cmdConfigure() {
  await s3.send(new PutBucketWebsiteCommand({
    Bucket: bucket,
    WebsiteConfiguration: {
      IndexDocument: { Suffix: 'index.html' },
      ErrorDocument: { Key: '404.html' },
    },
  }));
  console.log('Хостинг бакета включён (index.html)');
  await s3.send(new PutBucketAclCommand({ Bucket: bucket, ACL: 'public-read' }));
  console.log('Открыт публичный доступ (public-read)');
}

const cmd = process.argv[2];
try {
  if (cmd === 'buckets') await cmdBuckets();
  else if (cmd === 'sync') await cmdSync(process.argv.includes('--delete'));
  else if (cmd === 'configure') await cmdConfigure();
  else {
    console.log('Использование: buckets | sync [--delete] | configure');
    process.exit(1);
  }
} catch (e) {
  console.error('Ошибка:', e.message);
  process.exit(1);
}