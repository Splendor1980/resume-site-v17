// Копирует общие данные из корня проекта в public/ — то, что должно попасть в сборку
// как есть (runtime-файлы, на которые ссылается конструктор).
// Источник истины — data/ideas.json; в public лежит рабочая копия для клиентского fetch().
import { copyFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = new URL('../', import.meta.url);       // корень проекта (URL)
const pub = new URL('./public/', base);             // public/ (URL)

mkdirSync(new URL('./data/', pub), { recursive: true });
copyFileSync(new URL('./data/ideas.json', base), new URL('./data/ideas.json', pub));
copyFileSync(new URL('./data/about-snippets.json', base), new URL('./data/about-snippets.json', pub));

if (existsSync(fileURLToPath(new URL('./prototypes/', base)))) {
  cpSync(new URL('./prototypes/', base), new URL('./prototypes/', pub), { recursive: true });
}
if (existsSync(fileURLToPath(new URL('./README.md', base)))) {
  copyFileSync(new URL('./README.md', base), new URL('./README.md', pub));
}

console.log('sync:data — данные скопированы в public/ (ideas.json, about-snippets.json, prototypes/, README.md)');