const MAX_RESULTS = 5;
const TELEGRAM_API = "https://api.telegram.org";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function duration(seconds) {
  if (!seconds) return "—";
  const total = Math.floor(Number(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

async function telegram(env, method, payload) {
  const response = await fetch(`${TELEGRAM_API}/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram API ${method} failed: ${data.description || response.status}`);
  }
  return data.result;
}

async function searchDeezer(query) {
  const url = new URL("https://api.deezer.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(MAX_RESULTS));
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Deezer HTTP ${response.status}`);
  const payload = await response.json();
  return (payload.data || []).slice(0, MAX_RESULTS)
    .filter(track => track.title && track.artist?.name && track.link)
    .map(track => ({
      title: track.title,
      artist: track.artist.name,
      duration: duration(track.duration),
      url: track.link,
      source: "Deezer",
    }));
}

async function searchITunes(query) {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", String(MAX_RESULTS));
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`iTunes HTTP ${response.status}`);
  const payload = await response.json();
  return (payload.results || []).slice(0, MAX_RESULTS)
    .filter(track => track.trackName && track.artistName && track.trackViewUrl)
    .map(track => ({
      title: track.trackName,
      artist: track.artistName,
      duration: duration((track.trackTimeMillis || 0) / 1000),
      url: track.trackViewUrl,
      source: "iTunes",
    }));
}

async function findTracks(query) {
  try {
    const deezer = await searchDeezer(query);
    if (deezer.length) return { tracks: deezer };
  } catch (error) {
    console.error("Deezer search failed:", error);
  }

  try {
    const itunes = await searchITunes(query);
    if (itunes.length) return { tracks: itunes };
    return { tracks: [] };
  } catch (error) {
    console.error("iTunes fallback failed:", error);
    return { tracks: [], error: true };
  }
}

async function replyToMessage(env, message) {
  const text = message.text || "";
  const chatId = message.chat?.id;
  if (!chatId || !text) return;

  const command = text.match(/^\/(start|help)(?:@\w+)?(?:\s|$)/i);
  if (command) {
    const welcome = command[1].toLowerCase() === "start"
      ? "Привет! Я KaylsMusic 🎧\nОтправь название трека или имя исполнителя — найду до 5 вариантов.\n\nТакже доступна команда: /search название песни"
      : "Как пользоваться KaylsMusic:\n• Отправь название песни или исполнителя обычным сообщением.\n• Или используй /search запрос.\nЯ сначала ищу в Deezer, а если он недоступен или нет совпадений — в iTunes.";
    await telegram(env, "sendMessage", { chat_id: chatId, text: welcome });
    return;
  }

  let query = text.trim();
  const searchCommand = text.match(/^\/search(?:@\w+)?(?:\s+([\s\S]+))?$/i);
  if (text.startsWith("/") && !searchCommand) return;
  if (searchCommand) query = (searchCommand[1] || "").trim();

  if (!query) {
    await telegram(env, "sendMessage", {
      chat_id: chatId,
      text: "Напишите название песни или исполнителя. Например: Daft Punk One More Time",
    });
    return;
  }

  const result = await findTracks(query);
  if (result.error) {
    await telegram(env, "sendMessage", {
      chat_id: chatId,
      text: "Сервисы поиска сейчас недоступны. Попробуйте немного позже.",
    });
    return;
  }
  if (!result.tracks.length) {
    await telegram(env, "sendMessage", {
      chat_id: chatId,
      text: `По запросу «${query.slice(0, 300)}» ничего не найдено. Попробуйте изменить запрос.`,
    });
    return;
  }

  const lines = [`🎵 <b>Результаты поиска:</b> <i>${escapeHtml(query)}</i>\n`];
  const keyboard = [];
  result.tracks.forEach((track, index) => {
    lines.push(
      `<b>${index + 1}. ${escapeHtml(track.title)}</b>\n` +
      `👤 ${escapeHtml(track.artist)}\n` +
      `⏱ ${track.duration} · ${track.source}`
    );
    keyboard.push([{
      text: `▶ Слушать / открыть #${index + 1}`,
      url: track.url,
    }]);
  });

  await telegram(env, "sendMessage", {
    chat_id: chatId,
    text: lines.join("\n\n"),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: keyboard },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json({ status: "ok", service: "KaylsMusic" });
    }

    if (request.method === "POST" && url.pathname === "/setup") {
      if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET) {
        return json({ ok: false, error: "Set BOT_TOKEN and WEBHOOK_SECRET Worker secrets first." }, 500);
      }
      if (request.headers.get("authorization") !== `Bearer ${env.WEBHOOK_SECRET}`) {
        return json({ ok: false, error: "Unauthorized" }, 401);
      }
      const result = await telegram(env, "setWebhook", {
        url: `${url.origin}/webhook`,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ["message"],
        drop_pending_updates: true,
      });
      return json({ ok: true, webhook_set: result });
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET) {
        return json({ ok: false, error: "Worker secrets are not configured." }, 500);
      }
      if (request.headers.get("x-telegram-bot-api-secret-token") !== env.WEBHOOK_SECRET) {
        return json({ ok: false, error: "Unauthorized" }, 401);
      }
      let update;
      try {
        update = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON" }, 400);
      }
      try {
        if (update.message) await replyToMessage(env, update.message);
        return json({ ok: true });
      } catch (error) {
        console.error("Update processing failed:", error);
        return json({ ok: false, error: "Update processing failed" }, 500);
      }
    }

    return json({ ok: false, error: "Not found" }, 404);
  },
};
