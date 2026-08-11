# Серверная функция проверки поста (Yandex Cloud Functions)

## Что это и зачем

Проверяет, что ссылка, которую пользователь вставил в модалку разблокировки на сайте,
реально ведёт на пост в VK или Дзене, содержащий ссылку на наш сайт. Без ИИ — простой
поиск подстроки в HTML. Причины отказа от ИИ здесь обсуждали отдельно: для бинарной
проверки "есть/нет" детерминированный код надёжнее (не "показалось" модели) и не тратит
токены GigaChat, а также не задевает тот самый пункт про запрет пересылки данных
пользователей через бесплатный тариф.

## Честное предупреждение — важно прочитать перед деплоем

**Проверка на VK может работать нестабильно.** Соцсети часто рендерят страницу через JS,
а простой серверный запрос (без браузера) видит только исходный HTML — не то, что достроил
JavaScript после загрузки. У функции ниже есть fallback: если в ответе сервера нет ссылки
на наш домен, пользователь получает понятное сообщение и **вариант "подождать 10 минут"
остаётся доступен всегда** — то есть даже если проверка VK не сработает технически, никто
не окажется в тупике без возможности скачать резюме. Рекомендую после деплоя протестировать
на 2-3 реальных постах (свой VK и свой Дзен) и посмотреть, действительно ли проверка находит
ссылку — если нет, можно ослабить логику или временно вернуться к "честной системе на
доверии", которая была раньше.

## Код функции (Node.js 18, Yandex Cloud Functions)

```javascript
// index.js
// Переменные, которые нужно поменять перед деплоем — см. пометки TODO ниже.

const ALLOWED_DOMAINS = ['vk.com', 'vk.ru', 'dzen.ru', 'zen.yandex.ru'];

// TODO: заменить на реальный домен сайта после переезда с GitHub Pages на прод-хостинг
const OUR_DOMAIN_MARKERS = ['splendor1980.github.io/resume-generator'];

exports.handler = async function (event) {
  // Preflight для CORS — браузер шлёт OPTIONS перед настоящим POST с другого домена
  if (event.httpMethod === 'OPTIONS') {
    return respond(204, {});
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const link = (body.link || '').trim();

    if (!link) {
      return respond(400, { verified: false, reason: 'Ссылка не передана' });
    }

    let url;
    try {
      url = new URL(link);
    } catch (e) {
      return respond(400, { verified: false, reason: 'Похоже, это не похоже на ссылку' });
    }

    const hostname = url.hostname.replace(/^www\./, '');
    const isAllowedDomain = ALLOWED_DOMAINS.some(
      d => hostname === d || hostname.endsWith('.' + d)
    );
    if (!isAllowedDomain) {
      return respond(400, {
        verified: false,
        reason: 'Ссылка должна вести на пост в VK или Дзене'
      });
    }

    // User-Agent важен: некоторые серверы отдают urezannyj ответ ботам без него
    const res = await fetch(link, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ResumeGeneratorVerifyBot/1.0; +https://splendor1980.github.io/resume-generator/)'
      },
      redirect: 'follow'
    });

    if (!res.ok) {
      return respond(200, {
        verified: false,
        reason: `Не удалось открыть страницу поста (код ${res.status}). Убедись, что пост опубликован и доступен без входа в аккаунт.`
      });
    }

    const html = await res.text();
    const lower = html.toLowerCase();
    const found = OUR_DOMAIN_MARKERS.some(marker => lower.includes(marker.toLowerCase()));

    if (found) {
      return respond(200, { verified: true, reason: 'Ссылка на наш сайт найдена в посте' });
    }

    return respond(200, {
      verified: false,
      reason:
        'В открытой странице не нашлась ссылка на наш сайт. Если она точно есть в посте — ' +
        'соцсеть могла отдать нам страницу без неё технически. Можно попробовать ещё раз ' +
        'через пару минут, или просто выбрать "подождать 10 минут" — это тоже сработает.'
    });
  } catch (e) {
    return respond(500, {
      verified: false,
      reason: 'Ошибка проверки, попробуй ещё раз или выбери "подождать 10 минут".'
    });
  }
};

function respond(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      // TODO: перед проде сузить с '*' до реального домена сайта
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(bodyObj)
  };
}
```

## Как задеплоить (пошагово)

1. Зайти в консоль Yandex Cloud → Cloud Functions → «Создать функцию».
2. Среда выполнения — **Node.js 18** (или новее, если предложат).
3. Вставить код выше в `index.js`, точка входа — `index.handler`.
4. В настройках функции включить **публичный (анонимный) доступ по HTTP** — без этого
   браузер не сможет достучаться до функции напрямую.
5. После создания — скопировать **URL вызова функции** (выглядит примерно как
   `https://functions.yandexcloud.net/<id>`).
6. Вставить этот URL в `index.html` сайта — константа `VERIFY_FUNCTION_URL`
   (см. код сайта, помечено `TODO`).
7. Протестировать на реальном посте — вставить ссылку в модалку на сайте, посмотреть,
   что вернула функция (можно смотреть логи прямо в консоли Yandex Cloud Functions).

## Что не сделано (осознанно, для прототипа)

- **Rate limiting** — сейчас функцию можно дёргать сколько угодно раз подряд. Для тестовой
  стадии с малым трафиком это не критично, но перед реальным запуском стоит добавить
  простое ограничение (например, по IP через API Gateway).
- **Более гибкий поиск маркера** — сейчас ищется точное совпадение домена сайта строкой.
  Если домен сайта сменится (при переезде с GitHub Pages) — нужно не забыть обновить
  `OUR_DOMAIN_MARKERS` в этом файле.
