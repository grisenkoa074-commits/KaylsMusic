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

## Размещение на Oracle Cloud Always Free (Ubuntu)

Для Telegram long polling нужен постоянно работающий процесс. На Oracle Cloud можно запустить бота на виртуальной машине и управлять им через systemd.

### 1. Создайте виртуальную машину

1. Зарегистрируйтесь в [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/).
2. В консоли откройте **Compute → Instances → Create instance**.
3. Выберите Ubuntu 22.04 или 24.04, образ для **aarch64 (ARM)** если создаёте Ampere A1.
4. Для бесплатной конфигурации Ampere A1 используйте суммарно не более **2 OCPU и 12 GB RAM**. Также можно выбрать Always Free AMD Micro, если он доступен в вашем регионе.
5. В разделе Networking выберите публичную подсеть и назначьте публичный IPv4.
6. Добавьте свой SSH public key и сохраните private key в безопасном месте.
7. Создайте экземпляр и дождитесь состояния **Running**. Если видите *Out of host capacity*, попробуйте позже или другой Availability Domain в домашнем регионе.

Always Free вычислительные ресурсы доступны в домашнем регионе аккаунта. Бесплатная квота Ampere A1 — 1 500 OCPU-часов и 9 000 GB-часов в месяц (эквивалент 2 OCPU и 12 GB RAM). Oracle может признать Always Free VM простаивающей и отозвать её, если за 7 дней CPU, сеть и (для A1) память остаются ниже установленных порогов. Условия и доступность проверяйте на официальной странице.

### 2. Подключитесь по SSH

На своём компьютере откройте терминал и выполните команду, заменив путь к ключу и публичный IP:

```bash
ssh -i ~/.ssh/oci_key ubuntu@YOUR_PUBLIC_IP
```

На Windows можно использовать PowerShell с OpenSSH. Если SSH не подключается, проверьте, что в Security List/Network Security Group разрешён входящий TCP порт 22 только с вашего IP-адреса.

### 3. Скачайте проект и установите сервис

На виртуальной машине выполните:

```bash
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/grisenkoa074-commits/KaylsMusic.git
cd KaylsMusic
sudo bash deploy/oracle_setup.sh
```

Скрипт установит Python и зависимости, создаст системного пользователя `kaylsmusic`, подготовит виртуальное окружение и установит службу systemd. Он не запускает бота до добавления токена.

### 4. Добавьте токен Telegram и запустите бота

```bash
sudo nano /opt/kaylsmusic/.env
```

Укажите свой токен:

```env
TELEGRAM_BOT_TOKEN=ВСТАВЬТЕ_ТОКЕН_ОТ_BOTFATHER
PORT=10000
LOG_LEVEL=INFO
```

Сохраните файл (в nano: Ctrl+O, Enter, Ctrl+X), затем выполните:

```bash
sudo chown kaylsmusic:kaylsmusic /opt/kaylsmusic/.env
sudo chmod 600 /opt/kaylsmusic/.env
sudo systemctl start kaylsmusic
sudo systemctl status kaylsmusic
```

Проверить логи:

```bash
sudo journalctl -u kaylsmusic -f
```

Полезные команды:

```bash
sudo systemctl restart kaylsmusic
sudo systemctl stop kaylsmusic
sudo systemctl enable kaylsmusic
``

Служба автоматически запускается после перезагрузки VM и перезапускается при сбое. Входящий порт для Telegram-бота открывать не нужно: бот сам подключается к Telegram через исходящие соединения. HTTP health endpoint на порту `PORT` оставлен в приложении для локальной проверки, но для обычной работы бота его не требуется публиковать в интернет.

**Безопасность:** никогда не коммитьте `.env`, Telegram-токен или приватный SSH-ключ в GitHub. Не открывайте SSH (порт 22) для всего интернета без необходимости.
## Структура проекта

- `bot.py` — Telegram-бот и интеграции поиска.
- `requirements.txt` — зависимости Python.
- `.env.example` — пример переменных окружения.
- `.gitignore` — исключения Git.

## Источники поиска

- [Deezer API](https://developers.deezer.com/api)
- [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/)

iTunes используется как резервный источник. Для iTunes кнопка ведёт на страницу трека (`trackViewUrl`), а не на preview-аудио.
