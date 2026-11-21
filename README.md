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

1. Создайте на Render новый **Background Worker** из этого GitHub-репозитория.
2. Выберите runtime **Python**.
3. Build Command: `pip install -r requirements.txt`.
4. Start Command: `python bot.py`.
5. В Environment добавьте `TELEGRAM_BOT_TOKEN` со значением токена от BotFather.
6. Запустите деплой и проверьте логи.

Бесплатные тарифы и доступность Background Worker могут меняться; проверьте текущие условия Render. Для long polling нужен постоянно работающий процесс. Если доступен только Web Service, приложение можно запускать с HTTP health endpoint, но режим сна бесплатного тарифа может прерывать работу бота.

## Структура проекта

- `bot.py` — Telegram-бот и интеграции поиска.
- `requirements.txt` — зависимости Python.
- `.env.example` — пример переменных окружения.
- `.gitignore` — исключения Git.

## Источники поиска

- [Deezer API](https://developers.deezer.com/api)
- [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/)

iTunes используется как резервный источник. Для iTunes кнопка ведёт на страницу трека (`trackViewUrl`), а не на preview-аудио.
