// Наблюдатель переключения DNS resumegenerator.ru на DNS Яндекса (делегация с reg.ru → yandexcloud).
// Ждёт, пока публичный резолвер (dns.google) перестанет возвращать старую запись reg.ru
// и начнёт возвращать адрес Яндекса 213.180.193.247, и тогда выходит с кодом 0.
// Запуск: node scripts/wait-dns.mjs [--timeout 3600]
import { setTimeout as sleep } from 'node:timers/promises';

const HOST = 'resumegenerator.ru';
const OLD = '31.31.197.48';
const NEW = '213.180.193.247';
const timeoutArg = process.argv.indexOf('--timeout');
const TIMEOUT = timeoutArg >= 0 ? Number(process.argv[timeoutArg + 1] || 3600) : 3600;

const api = 'https://dns.google/resolve?name=' + encodeURIComponent(HOST);
let elapsed = 0;
let last = '';

while (elapsed < TIMEOUT) {
  try {
    const a = (await (await fetch(api + '&type=A')).json()).Answer || [];
    const ns = (await (await fetch(api + '&type=NS')).json()).Answer || [];
    const ips = a.map((x) => x.data).filter((d) => typeof d === 'string');
    const nss = ns.map((x) => x.data);
    const delegation = nss.join(', ') || '(нет NS)';
    const text = `[${Math.round(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}] A=${ips.join(', ') || '—'} | NS=${delegation}`;
    if (text !== last) {
      console.log(text);
      last = text;
    }
    if (ips.includes(NEW)) {
      console.log('ГОТОВО: DNS переключился на адрес Яндекса — сайт доступен по https://' + HOST + '/');
      process.exit(0);
    }
    if (!ips.includes(OLD)) {
      console.log('Замечен новый адрес без старого: ' + ips.join(', '));
    }
  } catch {}
  await sleep(15000);
  elapsed += 15;
}
console.log('Таймаут ' + TIMEOUT + 's — делегация ещё не переключилась. Запусти скрипт ещё раз позже.');
process.exit(2);