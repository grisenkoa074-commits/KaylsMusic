import asyncio
import logging
import os
from typing import Any

import aiohttp
from aiohttp import web
from dotenv import load_dotenv
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
PORT = int(os.getenv("PORT", "10000"))
MAX_RESULTS = 5
REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=12)
DEEZER_SEARCH_URL = "https://api.deezer.com/search"
ITUNES_SEARCH_URL = "https://itunes.apple.com/search"

logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
)
logger = logging.getLogger("kaylsmusic")


def format_duration(seconds: int | float | None) -> str:
    if not seconds:
        return "—"
    total = int(seconds)
    return f"{total // 60}:{total % 60:02d}"


async def fetch_json(
    session: aiohttp.ClientSession, url: str, params: dict[str, Any]
) -> dict[str, Any]:
    async with session.get(url, params=params) as response:
        response.raise_for_status()
        return await response.json(content_type=None)


async def search_deezer(
    session: aiohttp.ClientSession, query: str
) -> list[dict[str, Any]]:
    payload = await fetch_json(session, DEEZER_SEARCH_URL, {"q": query, "limit": MAX_RESULTS})
    tracks = payload.get("data", [])
    results = []
    for track in tracks[:MAX_RESULTS]:
        title = track.get("title")
        artist = (track.get("artist") or {}).get("name")
        link = track.get("link")
        if not title or not artist or not link:
            continue
        results.append(
            {
                "title": title,
                "artist": artist,
                "duration": format_duration(track.get("duration")),
                "url": link,
                "source": "Deezer",
            }
        )
    return results


async def search_itunes(
    session: aiohttp.ClientSession, query: str
) -> list[dict[str, Any]]:
    payload = await fetch_json(
        session,
        ITUNES_SEARCH_URL,
        {"term": query, "entity": "song", "limit": MAX_RESULTS},
    )
    results = []
    for track in payload.get("results", [])[:MAX_RESULTS]:
        title = track.get("trackName")
        artist = track.get("artistName")
        # Use the track's store page, not the short preview audio URL.
        link = track.get("trackViewUrl")
        if not title or not artist or not link:
            continue
        results.append(
            {
                "title": title,
                "artist": artist,
                "duration": format_duration(
                    (track.get("trackTimeMillis") or 0) / 1000
                ),
                "url": link,
                "source": "iTunes",
            }
        )
    return results


async def search_tracks(query: str) -> tuple[list[dict[str, Any]], str | None]:
    async with aiohttp.ClientSession(timeout=REQUEST_TIMEOUT) as session:
        try:
            results = await search_deezer(session, query)
            if results:
                return results, None
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as exc:
            logger.warning("Deezer search failed: %s", exc)

        try:
            results = await search_itunes(session, query)
            if results:
                return results, None
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as exc:
            logger.exception("iTunes fallback failed: %s", exc)
            return [], "Сервисы поиска сейчас недоступны. Попробуйте немного позже."

    return [], None


async def send_search_results(
    update: Update, context: ContextTypes.DEFAULT_TYPE, query: str
) -> None:
    if not update.effective_message:
        return

    query = query.strip()
    if not query:
        await update.effective_message.reply_text(
            "Напишите название песни или исполнителя. Например: Daft Punk One More Time"
        )
        return

    status = await update.effective_message.reply_text("🔎 Ищу музыку…")
    results, error = await search_tracks(query)

    if error:
        await status.edit_text(error)
        return
    if not results:
        await status.edit_text(
            f"По запросу «{query}» ничего не найдено. Попробуйте изменить запрос."
        )
        return

    lines = [f"🎵 <b>Результаты поиска:</b> <i>{escape_html(query)}</i>\n"]
    keyboard = []
    for index, track in enumerate(results, start=1):
        lines.append(
            f"<b>{index}. {escape_html(track['title'])}</b>\n"
            f"👤 {escape_html(track['artist'])}\n"
            f"⏱ {track['duration']} · {track['source']}"
        )
        keyboard.append(
            [InlineKeyboardButton(f"▶ Слушать / открыть #{index}", url=track["url"])]
        )

    await status.edit_text(
        "\n\n".join(lines),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(keyboard),
        disable_web_page_preview=True,
    )


def escape_html(value: str) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.effective_message.reply_text(
        "Привет! Я KaylsMusic 🎧\n"
        "Отправь название трека или имя исполнителя — найду до 5 вариантов.\n\n"
        "Также доступна команда: /search название песни"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.effective_message.reply_text(
        "Как пользоваться KaylsMusic:\n"
        "• Отправь название песни или исполнителя обычным сообщением.\n"
        "• Или используй /search запрос.\n"
        "Я сначала ищу в Deezer, а если он недоступен или нет совпадений — в iTunes."
    )


async def search_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await send_search_results(update, context, " ".join(context.args))


async def text_search(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_message and update.effective_message.text:
        await send_search_results(update, context, update.effective_message.text)


async def health(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok", "service": "KaylsMusic"})


async def run_health_server() -> web.AppRunner:
    app = web.Application()
    app.router.add_get("/", health)
    app.router.add_get("/health", health)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    logger.info("Health server listening on port %s", PORT)
    return runner


async def main() -> None:
    if not TELEGRAM_BOT_TOKEN:
        raise RuntimeError(
            "TELEGRAM_BOT_TOKEN is not set. Add it to .env or environment variables."
        )

    bot_app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    bot_app.add_handler(CommandHandler("start", start))
    bot_app.add_handler(CommandHandler("help", help_command))
    bot_app.add_handler(CommandHandler("search", search_command))
    bot_app.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, text_search)
    )

    runner = None
    try:
        await bot_app.initialize()
        await bot_app.start()
        if bot_app.updater is None:
            raise RuntimeError("Telegram updater is unavailable.")
        await bot_app.updater.start_polling(
            allowed_updates=Update.ALL_TYPES,
            drop_pending_updates=True,
        )
        runner = await run_health_server()
        logger.info("KaylsMusic bot started.")
        await asyncio.Event().wait()
    finally:
        if bot_app.updater and bot_app.updater.running:
            await bot_app.updater.stop()
        if bot_app.running:
            await bot_app.stop()
        await bot_app.shutdown()
        if runner:
            await runner.cleanup()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped.")
