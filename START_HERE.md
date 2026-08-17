# START HERE — входная точка проекта

Этот файл — первое, что нужно прочитать, если начинаешь работать с проектом «с нуля»
(новое устройство, новый инженер, новая сессия). Всё подробное — в README.md и docs/DEPLOY.md.

## Что это

Сайт-генератор резюме для тех, у кого нет опыта работы: человек отмечает свои хобби/интересы,
сайт превращает их в готовые формулировки для резюме. Две плоскости:

1. **Статические SEO-страницы** (Astro, SSG): лендинг `/`, 103 страницы `/idei/<id>/`,
   список идей `/idei/`.
2. **Интерактивный конструктор** на `/konstruktor/` — «остров», логика на ванильном JS
   (не React/Vue, сознательно), отлажен Playwright-тестом.

## Как запустить (нужны Node.js LTS + Git)

```
git clone https://github.com/Splendor1980/resume-site-v17
cd resume-site-v17
npm ci                    # установка зависимостей (однократно)
npm run dev               # http://localhost:4321/ — режим разработки
npm run build             # статическая сборка в dist/
npm run test:e2e          # headless-проверка конструктора и SEO-страниц (Playwright)
```

`npm run build` сам копирует `data/ideas.json` и `prototypes/` в `public/` — руками не трогаем
(скрипт `scripts/sync-data.mjs`). Источник истины данных — только `data/ideas.json`.

## Карта проекта (коротко)

- `data/ideas.json` — база 103 связок «интерес → навыки → роли» (v4). Отсюда генерируются
  и SEO-страницы, и карточки конструктора.
- `src/pages/` — `index.astro` (лендинг), `idei/[slug].astro` (103 SEO-страницы),
  `idei/index.astro` (список), `konstruktor.astro` (обёртка конструктора).
- `src/components/Constructor.astro` — сам конструктор («остров», порт `index.html`).
- `src/components/Metrika.astro`, `src/layouts/BaseLayout.astro` (SEO-голова + JSON-LD).
- `scripts/` — `sync-data.mjs` (копия данных), `run-e2e.mjs` + `test-constructor.mjs` (E2E).
- `deploy/` — деплой-слой: `Dockerfile`, `nginx.conf.sample`, `deploy-yandex.sh`,
  `.env.example` (для Yandex Object Storage).
- `docs/DEPLOY.md` — как разворачивать (Yandex Cloud / RU VPS / GitHub Pages-тест), чек-лист, KPI.
- `index.html` + `prototypes/` — старый прототип, сохранён как история решений, идёт на
  «шестерёнку» из конструктора и в `public/` для просмотра.

## Текущая точка останова (на что смотреть дальше)

Сделано и зафиксировано:
- Astro-версия собрана: лендинг + 103 `/idei/` + конструктор-остров. E2E — PASS.
- Репозиторий живёт на GitHub: branch `main`, источник для синхронизации между устройствами.
- Деплой-слой готов (`deploy/` + `docs/DEPLOY.md`), ждёт выбора хостинга и домена.

Не сделано / «TODO» по коду:
- Домен **вписан**: `astro.config.mjs` + `public/robots.txt` = `https://resumegenerator.ru`
  (куплен на reg.ru; canonical без `www`, редирект `www` зададим на DNS/хостинге). Осталось
  связать с хостингом.
- `src/components/Metrika.astro` — `YM_COUNTER_ID = null` (вписать реальный после регистрации
  счётчика; Вебвизор не включаем).
- `src/components/Constructor.astro` — `VERIFY_FUNCTION_URL = ''` (URL Cloud Function проверки
  поста, код есть в `prototypes/07-verify-post-function.md`).

Следующий шаг по плану (см. «Дорожная карта» в README): **шаг 3 — домен + хостинг**.
До появления реального трафика ничего платного и никакого ИИ не подключаем (так решили).

## Как продолжить с новой сессией (скопируй это ассистенту)

```
Открой START_HERE.md и README.md в репозитории resume-site-v17
(https://github.com/Splendor1980/resume-site-v17), затем docs/DEPLOY.md.
Мы остановились на готовой Astro-версии + подготовленном деплой-слое.
Следующий шаг — пункт 3 дорожной карты: домен и хостинг.
Начни с описания текущего состояния и что делаем дальше.
```

Полная история решений и роадмап — в README.md (разделы «Ключевые решения»,
«Согласованный порядок следующих шагов», «Дорожная карта»).