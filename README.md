# KaylsMusic Telegram Bot

Telegram-бот для поиска музыки по названию трека или исполнителю.

## Возможности

- Поиск до 5 совпадений через Deezer.
- Резервный поиск через iTunes, если Deezer недоступен или не вернул результатов.
- Показывает название, исполнителя, длительность и ссылку на страницу трека.
- Обрабатывает пустые запросы, таймауты и ошибки API.
- Работает через Telegram long polling.
- HTTP endpoint `/health` для проверки состояния при размещении на Render.

## Требования

- Python 3.10+
- Telegram Bot Token от [@BotFather](https://t.me/BotFather)

## Локальный запуск

1. Склонируйте репозиторий:
   ```bash
   git clone https://github.com/grisenkoa074-commits/KaylsMusic.git
   cd KaylsMusic
   ```
2. Создайте виртуальное окружение и установите зависимости:
   ```bash
   python -m venv .venv
   # Windows: .venv\\Scripts\\activate
   # macOS/Linux:
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. Скопируйте `.env.example` в `.env` и укажите токен:
   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   PORT=10000
   ```
4. Запустите:
   ```bash
   python bot.py
   ```

## Создание бота в Telegram

1. Откройте [@BotFather](https://t.me/BotFather).
2. Отправьте команду `/newbot`.
3. Задайте имя и username бота.
4. Скопируйте выданный токен в локальный `.env` или в переменные окружения хостинга.

**Не публикуйте токен и не добавляйте его в Git.**

## Бесплатный деплой на Render

В репозитории есть `render.yaml`, поэтому можно развернуть сервис как Blueprint:

1. Войдите в [Render](https://render.com/) и нажмите **New → Blueprint**.
2. Подключите GitHub и выберите репозиторий `KaylsMusic`.
3. Render прочитает `render.yaml` и создаст Web Service.
4. В настройках созданного сервиса откройте **Environment** и добавьте `TELEGRAM_BOT_TOKEN` — токен от BotFather.
5. Сохраните переменную и дождитесь успешного деплоя. Проверка состояния доступна по адресу сервиса + `/health`.

Сервис запускает Telegram long polling и HTTP health endpoint в одном процессе. На бесплатном Web Service Render может усыплять приложение после периода отсутствия входящих HTTP-запросов. Для уменьшения простоев можно настроить внешний мониторинг (например, UptimeRobot) на URL `/health`, но это не гарантирует постоянную доступность: условия бесплатного тарифа Render могут меняться. Для надёжной круглосуточной работы нужен тариф без автоматического сна.

## Структура проекта

- `bot.py` — Telegram-бот и интеграции поиска.
- `requirements.txt` — зависимости Python.
- `.env.example` — пример переменных окружения.
- `.gitignore` — исключения Git.

## Источники поиска

- [Deezer API](https://developers.deezer.com/api)
- [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/)

iTunes используется как резервный источник. Для iTunes кнопка ведёт на страницу трека (`trackViewUrl`), а не на preview-аудио.
