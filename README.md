# KaylsMusic Telegram Bot

Telegram-бот для поиска музыки по названию трека или исполнителю. Развёртывание — Cloudflare Workers Free, без VPS и без банковской карты.

## Возможности

- Поиск до 5 совпадений через Deezer.
- Автоматический переход на iTunes, если Deezer недоступен или не нашёл совпадений.
- Название, исполнитель, длительность и кнопка-ссылка на страницу трека.
- Команды `/start`, `/help`, `/search запрос`.
- Telegram Webhook с секретной проверкой запроса.
- HTTPS и health check по `/health`.

## Бесплатный хостинг

Используется [Cloudflare Workers Free](https://www.cloudflare.com/developer-platform/workers/). Для работы бота не нужна постоянно запущенная виртуальная машина: Telegram отправляет обновления на Worker через HTTPS webhook.

Бесплатный тариф на момент подготовки README включает до 100 000 запросов в сутки и 10 мс CPU на одно выполнение. Для обычного музыкального Telegram-бота этого достаточно с большим запасом. Лимиты и условия могут изменяться: [официальные лимиты](https://developers.cloudflare.com/workers/platform/limits/).

## Развёртывание — пошагово

### 1. Создайте Cloudflare аккаунт

1. Откройте [Cloudflare Sign Up](https://dash.cloudflare.com/sign-up).
2. Зарегистрируйтесь на бесплатном тарифе. Для Workers Free банковская карта не требуется.
3. Подтвердите email и войдите в панель Cloudflare.

### 2. Подключите GitHub

1. Откройте Cloudflare Dashboard → **Workers & Pages**.
2. Нажмите **Create application**.
3. Выберите **GitHub** и разрешите Cloudflare доступ к репозиторию.
4. Выберите `grisenkoa074-commits/KaylsMusic`.
5. В качестве имени Worker укажите строго `kaylsmusic` (оно должно совпадать с `name` в `wrangler.toml`). В настройках сборки оставьте корневую папку репозитория. Файл `wrangler.toml` уже содержит настройки Worker.
6. Нажмите **Save and Deploy**.

Cloudflare создаст Worker и выдаст адрес примерно такого вида:

`https://kaylsmusic.<your-subdomain>.workers.dev`

Официальная инструкция: [Connect a Git repository](https://developers.cloudflare.com/workers/ci-cd/builds/).

### 3. Добавьте два секрета

Откройте созданный Worker → **Settings → Variables and Secrets** (название раздела может немного отличаться) и добавьте два значения типа **Secret**:

- `BOT_TOKEN` — токен от [@BotFather](https://t.me/BotFather).
- `WEBHOOK_SECRET` — случайная строка из латинских букв, цифр, дефисов или подчёркиваний, длиной 32–64 символа. Например, можно сгенерировать её любым надёжным генератором паролей.

Не используйте пример из документации как реальный секрет. Сохраните значение `WEBHOOK_SECRET`: оно понадобится один раз для подключения Telegram webhook.

После добавления секретов выполните **Deploy** / **Save and deploy**, если панель попросит применить изменения.

### 4. Подключите Telegram к Worker

Откройте PowerShell на Windows или терминал на Mac/Linux и выполните запрос, заменив адрес Worker и значение секрета:

**PowerShell (Windows):**

```powershell
$worker = "https://kaylsmusic.YOUR-SUBDOMAIN.workers.dev"
$secret = "PASTE_THE_SAME_WEBHOOK_SECRET"
Invoke-RestMethod -Method Post -Uri "$worker/setup" -Headers @{ Authorization = "Bearer $secret" }
```

**macOS / Linux:**

```bash
WORKER="https://kaylsmusic.YOUR-SUBDOMAIN.workers.dev"
SECRET="PASTE_THE_SAME_WEBHOOK_SECRET"
curl -X POST "$WORKER/setup" -H "Authorization: Bearer $SECRET"
```

В ответе должно быть `"ok": true`. Этот защищённый запрос регистрирует webhook в Telegram. Не публикуйте секрет и не отправляйте его в чат.

### 5. Проверьте бота

1. Откройте адрес Worker + `/health` в браузере. Должен появиться ответ `{"status":"ok","service":"KaylsMusic"}`.
2. Откройте своего бота в Telegram.
3. Отправьте `/start`.
4. Попробуйте поиск: `Daft Punk One More Time`.

## Обновление кода

После подключения GitHub Cloudflare автоматически собирает и публикует изменения при каждом push в основную ветку. Секреты остаются в настройках Cloudflare и в GitHub не попадают.

## Локальный Python-вариант

Файл `bot.py` и `requirements.txt` сохранены для локального запуска через long polling:

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Укажите TELEGRAM_BOT_TOKEN в .env
python bot.py
```

Cloudflare Worker использует реализацию из `src/index.js`; Python-версия не нужна для Cloudflare-деплоя.

## Безопасность

- Никогда не добавляйте Telegram-токен или `WEBHOOK_SECRET` в GitHub.
- Не публикуйте URL или команды настройки, если в них присутствует секрет.
- Если токен Telegram утёк, отзовите его через BotFather и обновите Secret `BOT_TOKEN` в Cloudflare.
