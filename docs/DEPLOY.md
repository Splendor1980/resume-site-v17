# Деплой и запуск: памятка

Сайт — статическая сборка Astro (`npm run build` → `dist/`). Для продакшена нужна только
раздача `dist/` любым статическим хостингом/CDN/`nginx`. Node.js на сервере НЕ требуется.

---

## 0. Сборка и локальная проверка

```
npm install
npm run dev        # http://localhost:4321/ — разработка
npm run build      # вся сборка в dist/ (автоматически копирует data→public, см. scripts/sync-data.mjs)
npm run preview    # проверить собранное из dist/
npm run test:e2e   # headless-проверка (Playwright): 103 карточки, режимы, SEO-страницы
```

Перед выкатом обязательно выполнить `npm run build` — без новых `dist` деплоить нечего.

---

## 1. Куда выкладывать

### Вариант A (рекомендуемый) — Yandex Cloud Object Storage

«Полностью статический» хостинг: бакет с включённым веб-хостингом + свой домен.

1. Создать аккаунт/платёжный аккаунт в облаке: https://console.cloud.yandex.ru
2. Установить Yandex Cloud CLI: https://cloud.yandex.ru/docs/cli/quickstart
   (`powershell -ExecutionPolicy Bypass -Command "irm https://storage.yandexcloud.net/yandexcloud-yc/install.ps1 | iex"`)
   выполнить `yc init` (залогиниться, выбрать каталог).
3. Создать бакет с публичным доступом и включить на нём «Веб-хостинг» (index document = `index.html`,
   error document = `index.html`):
   ```
   yc storage bucket create <имя-бакета> --public-read
   yc storage bucket update <имя-бакета> --website-settings "{index: 'index.html', error: '404.html'}"
   ```
4. Выгрузить сборку (скрипт [deploy/deploy-yandex.sh](../deploy/deploy-yandex.sh), настройки —
   из `deploy/.env.example`): потребуются статический ключ доступа сервисного аккаунта
   (роль `storage.editor`) и установленный AWS CLI v2 / s3cmd.
   ```
   cd deploy
   set -a; source .env; set +a       # вписать ключи в .env заранее
   bash deploy-yandex.sh
   ```
5. Публичный адрес бакета вида `https://<бакет>.storage.yandexcloud.net/` — временный.
6. **Домен** (обязателен для SEO/HTTPS): купить `.ru`, в DNS добавить CNAME на адрес бакета,
   в консоли заказать TLS-сертификат на домен. После покупки домена вписать его в
   `astro.config.mjs` (`site`) и в `public/robots.txt` (Sitemap), пересобрать и выгрузить заново.

### Вариант B — RU-VPS (Timeweb Cloud / Selectel / Beget) с nginx

Статику раздаёт nginx напрямую из каталога (без Node в рантайме).

1. Арендовать VPS (Ubuntu), зайти по SSH.
2. Скопировать на сервер `dist/` (`rsync -avz --delete dist/ user@host:/var/www/resume-site/`).
3. Установить конфиг: `cp deploy/nginx.conf.sample /etc/nginx/sites-available/resume-site`,
   поправить `server_name` на свой домен, `root` на каталог с сайтом; симлинк в
   `sites-enabled`, `nginx -t`, `systemctl reload nginx`.
4. HTTPS: `apt install certbot python3-certbot-nginx && certbot --nginx -d вашдомен.ру`.

Для Docker-запуска на VPS готов [deploy/Dockerfile](../deploy/Dockerfile)
(многоступенчатая сборка Node→nginx, запуск `docker compose up -d`).

### Вариант C — GitHub Pages (только тест/предпросмотр, НЕ продакшен)

Быстро, бесплатно, но: нет серверных функций (нужны для вебхука оплаты) и чужие
`*.github.io` — не для `.ru`-аудитории. Подходит, чтобы показать черновик ссылкой.
Выгрузка: CI-воркфлоу в репозитории или ручной git subtree из `dist/`.

---

## 2. Перед продакшеном: чек-лист (TODO в коде/README)

- [ ] Вписать реальный домен в `astro.config.mjs` (`site`) — сейчас заглушка `https://resume-site.example.ru`
- [ ] Обновить `public/robots.txt` (Sitemap-адрес) — пересобрать
- [ ] Вставить реальный `YM_COUNTER_ID` в `src/components/Metrika.astro` и (после ручной вставки
      в index-рендер) noscript-пиксель — Вебвизор не включаем (решение в README)
- [ ] Прогнать `npm run test:e2e` против собранной версии
- [ ] Проверить с 2-3 устройств (десктоп/мобайл) доступ к `/`, `/konstruktor/`, нескольким `/idei/`
- [ ] Проверить печать PDF: >2 идей → кнопка «Скачать PDF» → модалка → «Сохранить как PDF»

---

## 3. KPI — что смотреть в Яндекс.Метрике (шаг 4 роадмапа)

Пока сайт живёт без платных механик, отслеживаем сигналы спроса:

| Метрика | Где смотреть | Что означает |
|---|---|---|
| Сессии, уникальные посетители | Обзор | Базовый рост |
| Доходимость до `/konstruktor/` | Отчёты → Вебвизор(выкл)/Воронки | Интерес к продукту, а не только к статьям |
| Переходы на `/idei/<...>` из поиска | Источники → Поисковые системы + список страниц | Какие SEO-страницы цепляются органикой |
| Глубина: `/idei/` → `/konstruktor/` | Воронки/цели | Конверсия «статья → конструктор» |
| Режим 3 («Помощник-подсказчик») | Событие/цель на переключение режима | **Главный сигнал к подключению живого ИИ** (триггер в README) |
| Разблокировка PDF (модалка, таймер) | Цель на показ модалки | Готовность реально скачать/поделиться |

Решения «включать ЮKassa / живой ИИ» принимаем ТОЛЬКО по этим данным (см. README
«Согласованный порядок следующих шагов», шаг 5), не заранее.

---

## 4. Обновление сайта

После правок: `npm run build` → выложить `dist/` тем же способом, что выбран выше.
Код и версии — git (см. правило версионирования папок в README).