import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Канонический адрес сайта (без www; редирект www → без www настраивается на DNS/хостинге).
const SITE = 'https://resumegenerator.ru';

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