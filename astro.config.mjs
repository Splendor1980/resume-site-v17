import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// САЙТ ПУБЛИЧНОГО ДОМЕНА — TODO: поставить реальный домен после покупки (см. README, "Хостинг").
// Пока стоит заглушка: canonical/sitemap/OG-ссылки ведут сюда, после покупки домена правка одной строки.
const SITE = 'https://resume-site.example.ru';

export default defineConfig({
  site: SITE,
  // Всегда добавляем слэш в конце: `trailingSlash: 'ignore'` ниже делает /idei/... и /konstruktor/...
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // sitemap по умолчанию включает все страницы, кроме конструктора и служебных.
      filter: (page) => page !== `${SITE}/konstruktor/`,
    }),
  ],
});