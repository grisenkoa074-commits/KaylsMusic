# KaylsMusic

Telegram-бот и Telegram Mini App для поиска музыки сразу в нескольких каталогах. Развёртывание — Cloudflare Workers Free.

## Что уже реализовано в коде

- Telegram Mini App с адаптивным фиолетовым интерфейсом.
- Единый поиск по Audius, Jamendo, Deezer и iTunes.
- Встроенное воспроизведение потоков Audius и доступных превью Deezer/iTunes; Jamendo отдаёт поток по API.
- Скачивание Audius/Jamendo только при положительном разрешении каталога/автора.
- Кнопка «Поделиться» для отправки ссылки на трек.
- Владелец приложения задаётся Telegram ID в `src/index.js` (`8179633402`).
- Проверка подписи Telegram Mini App initData на сервере перед доступом к API админ-панели.
- Админ-панель владельца с состоянием подключённых каталогов.
- Кнопка меню Telegram «KaylsMusic» регистрируется при вызове защищённого `/setup`.

**Ограничение:** Deezer и iTunes предоставляют в этом приложении только доступные превью/ссылки, а не скачивание полных коммерческих записей. Скачивание полных файлов не обходится и не открывается там, где автор/платформа не разрешили загрузку.

## Cloudflare deployment

Cloudflare Workers Free использует HTTPS webhook и может раздавать статические файлы Mini App из папки `public`.

1. В Cloudflare откройте **Workers & Pages → kaylsmusic**.
2. Убедитесь, что GitHub integration подключена к `grisenkoa074-commits/KaylsMusic`, а Worker name — `kaylsmusic`.
3. После push Cloudflare Builds должен автоматически развернуть Worker и файлы Mini App. В `wrangler.toml` указан assets directory `./public`.
4. В **Settings → Variables and Secrets** должны быть секреты:
   - `BOT_TOKEN` — токен Telegram-бота.
   - `WEBHOOK_SECRET` — тот же случайный секрет, который уже используется для webhook.
   - `JAMENDO_CLIENT_ID` — необязательно, но нужно для включения поиска и скачивания Jamendo. Получите Client ID в [Jamendo Developer Portal](https://devportal.jamendo.com/), затем добавьте его как Secret или Variable. Не добавляйте Client ID в публичный HTML/JS.
5. После успешного деплоя повторно вызовите защищённый endpoint `/setup`, чтобы обновить webhook и установить кнопку Mini App в меню Telegram.

### Повторная регистрация /setup (Windows PowerShell)

Используйте тот же WEBHOOK_SECRET, что сохранён в Cloudflare:

```powershell
$worker = "https://kaylsmusic.grisenkoa074.workers.dev"
$secret = Read-Host "Вставь WEBHOOK_SECRET"
Invoke-RestMethod -Method Post -Uri "$worker/setup" -Headers @{ Authorization = "Bearer $secret" }
```

Ожидаемый ответ содержит `ok: true` и `mini_app_menu_set: true`. Не отправляйте токен или секрет в чат и не сохраняйте их в GitHub.

## Проверка

- Откройте `https://kaylsmusic.grisenkoa074.workers.dev/health` — должен вернуться JSON со статусом `ok`.
- В Telegram откройте чат с ботом и нажмите кнопку меню **KaylsMusic** или отправьте `/start), затем нажмите кнопку открытия приложения.
- В Mini App выполните поиск, например `Daft Punk` или `Chill`.
- Если добавлен Jamendo Client ID, Jamendo появится среди источников.
- Только владелец с Telegram ID `8179633402` увидит вход в панель владельца.

## Источники API и разрешения

- [Audius API](https://docs.audius.co/api/) — поиск, потоковое воспроизведение; загрузка проверяется по полю доступности загрузки.
- [Jamendo Tracks API](https://developer.jamendo.com/v3.0/tracks) — поле `audiodownload_allowed` обязательно учитывается.
- [Deezer API](https://developers.deezer.com/api) — поиск и preview URL.
- [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/) — поиск и preview URL.
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps) — запуск приложения внутри Telegram и проверка initData.

## Безопасность

- Не помещайте `BOT_TOKEN`, `WEBHOOK_SECRET` или Jamendo credentials в файлы фронтенда или GitHub.
- Доступ к админ-API ограничен Telegram ID владельца и валидной подписью initData.
- Если Telegram bot token утёк, отзовите его через @BotFather и обновите Cloudflare Secret.
