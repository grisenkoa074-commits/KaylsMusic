const ADMIN_ID = "8179633402";
const TELEGRAM_API = "https://api.telegram.org";
const AUDIUS_API = "https://discoveryprovider.audius.co/v1";
const APP_NAME = "KaylsMusic";
const MAX_RESULTS = 8;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function duration(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
async function telegram(env, method, payload) {
  const r = await fetch(`${TELEGRAM_API}/bot${env.BOT_TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const data = await r.json();
  if (!r.ok || !data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}
async function validateInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  if (!hash || !authDate || Math.abs(Date.now() / 1000 - authDate) > 86400) return null;
  params.delete("hash");
  params.delete("signature");
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const secret = await crypto.subtle.sign("HMAC", key, enc.encode(botToken));
  const hmacKey = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", hmacKey, enc.encode(check));
  const actual = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  if (actual !== hash) return null;
  try { return JSON.parse(params.get("user") || "null"); } catch { return null; }
}
async function requireUser(request, env) {
  return validateInitData(request.headers.get("x-telegram-init-data") || "", env.BOT_TOKEN);
}
async function audiusSearch(query) {
  const u = new URL(`${AUDIUS_API}/tracks/search`);
  u.searchParams.set("query", query);
  u.searchParams.set("limit", "8");
  u.searchParams.set("app_name", APP_NAME);
  const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error("Audius unavailable");
  const d = await r.json();
  return (d.data || []).map(t => ({
    id: String(t.id), source: "Audius", title: t.title, artist: t.user?.name || "Unknown artist",
    duration: duration(t.duration), artwork: t.artwork?.["480x480"] || t.artwork?.["150x150"] || "",
    stream: `/api/audio?source=audius&id=${encodeURIComponent(t.id)}`,
    downloadable: Boolean(t.is_downloadable ?? t.downloadable), download: Boolean(t.is_downloadable ?? t.downloadable),
    permalink: t.permalink ? `https://audius.co${t.permalink}` : "https://audius.co"
  }));
}
async function jamendoSearch(query, env) {
  if (!env.JAMENDO_CLIENT_ID) return [];
  const u = new URL("https://api.jamendo.com/v3.0/tracks/");
  Object.entries({ client_id: env.JAMENDO_CLIENT_ID, format: "json", limit: "8", search: query, include: "licenses", audioformat: "mp32", audiodlformat: "mp32" }).forEach(([k,v]) => u.searchParams.set(k,v));
  const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error("Jamendo unavailable");
  const d = await r.json();
  return (d.results || []).map(t => ({
    id: String(t.id), source: "Jamendo", title: t.name, artist: t.artist_name || "Unknown artist",
    duration: duration(t.duration), artwork: t.image || t.album_image || "",
    stream: t.audio || "", downloadable: Boolean(t.audiodownload_allowed && t.audiodownload),
    download: Boolean(t.audiodownload_allowed && t.audiodownload), downloadUrl: t.audiodownload || "",
    permalink: t.shareurl || "https://jamendo.com", license: t.license_ccurl || ""
  }));
}
async function deezerSearch(query) {
  const u = new URL("https://api.deezer.com/search");
  u.searchParams.set("q", query); u.searchParams.set("limit", "8");
  const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error("Deezer unavailable");
  const d = await r.json();
  return (d.data || []).map(t => ({
    id: String(t.id), source: "Deezer", title: t.title, artist: t.artist?.name || "Unknown artist",
    duration: duration(t.duration), artwork: t.album?.cover_medium || "",
    stream: t.preview || "", downloadable: false, download: false, permalink: t.link || "https://deezer.com"
  }));
}
async function itunesSearch(query) {
  const u = new URL("https://itunes.apple.com/search");
  u.searchParams.set("term", query); u.searchParams.set("entity", "song"); u.searchParams.set("limit", "8");
  const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error("iTunes unavailable");
  const d = await r.json();
  return (d.results || []).map(t => ({
    id: String(t.trackId), source: "iTunes", title: t.trackName, artist: t.artistName,
    duration: duration((t.trackTimeMillis || 0) / 1000), artwork: t.artworkUrl100 || "",
    stream: t.previewUrl || "", downloadable: false, download: false, permalink: t.trackViewUrl || "https://music.apple.com"
  }));
}
async function searchAll(query, env) {
  const jobs = [
    ["Audius", () => audiusSearch(query)],
    ["Jamendo", () => jamendoSearch(query, env)],
    ["Deezer", () => deezerSearch(query)],
    ["iTunes", () => itunesSearch(query)]
  ];
  const settled = await Promise.allSettled(jobs.map(([, fn]) => fn()));
  const tracks = [];
  const sources = {};
  settled.forEach((item, i) => {
    sources[jobs[i][0]] = item.status === "fulfilled" ? "ok" : "unavailable";
    if (item.status === "fulfilled") tracks.push(...item.value);
  });
  const seen = new Set();
  const unique = tracks.filter(t => {
    const key = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
  return { tracks: unique.slice(0, 28), sources };
}
async function verifyDownload(source, id, env) {
  if (source === "audius") {
    const u = `${AUDIUS_API}/tracks/${encodeURIComponent(id)}?app_name=${APP_NAME}`;
    const r = await fetch(u);
    if (!r.ok) return null;
    const d = await r.json(); const t = d.data;
    if (!t || !(t.is_downloadable ?? t.downloadable) || t.is_download_gated) return null;
    return `${AUDIUS_API}/tracks/${encodeURIComponent(id)}/download?app_name=${APP_NAME}`;
  }
  if (source === "jamendo" && env.JAMENDO_CLIENT_ID) {
    const u = new URL("https://api.jamendo.com/v3.0/tracks/");
    u.searchParams.set("client_id", env.JAMENDO_CLIENT_ID); u.searchParams.set("format", "json"); u.searchParams.set("id", id);
    const r = await fetch(u); if (!r.ok) return null;
    const d = await r.json(); const t = d.results?.[0];
    return t?.audiodownload_allowed && t?.audiodownload ? t.audiodownload : null;
  }
  return null;
}
async function handleApi(request, env, url) {
  if (request.method === "GET" && url.pathname === "/api/search") {
    const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
    if (q.length < 2) return json({ tracks: [], sources: {} });
    try { return json(await searchAll(q, env)); }
    catch (e) { console.error("Search error", e); return json({ error: "Search services temporarily unavailable" }, 502); }
  }
  if (request.method === "GET" && url.pathname === "/api/audio") {
    const source = url.searchParams.get("source"); const id = url.searchParams.get("id");
    if (source === "audius" && id) {
      const upstream = await fetch(`${AUDIUS_API}/tracks/${encodeURIComponent(id)}/stream?app_name=${APP_NAME}`);
      if (!upstream.ok) return json({ error: "Audio unavailable" }, 404);
      return new Response(upstream.body, { headers: { "content-type": upstream.headers.get("content-type") || "audio/mpeg", "cache-control": "private, max-age=300" } });
    }
    return json({ error: "Use the provider preview stream URL" }, 400);
  }
  if (request.method === "GET" && url.pathname === "/api/download") {
    const source = url.searchParams.get("source"); const id = url.searchParams.get("id");
    if (!id || !["audius", "jamendo"].includes(source)) return json({ error: "Invalid download request" }, 400);
    const target = await verifyDownload(source, id, env);
    if (!target) return json({ error: "Этот трек нельзя скачать: автор не разрешил загрузку." }, 403);
    return Response.redirect(target, 302);
  }
  if (request.method === "GET" && url.pathname === "/api/admin") {
    const user = await requireUser(request, env);
    if (!user) return json({ error: "Откройте приложение через Telegram" }, 401);
    if (String(user.id) !== ADMIN_ID) return json({ error: "Forbidden" }, 403);
    return json({ ok: true, admin: { id: ADMIN_ID, audius: "enabled", jamendo: env.JAMENDO_CLIENT_ID ? "configured" : "needs_client_id", deezer: "enabled", itunes: "enabled" } });
  }
  return null;
}
async function replyToMessage(env, message, origin) {
  const chatId = message.chat?.id; const text = (message.text || "").trim();
  if (!chatId) return;
  const keyboard = { inline_keyboard: [[{ text: "🎧 Открыть KaylsMusic", web_app: { url: origin } }]] };
  if (/^\/(start|help)(?:@\w+)?/i.test(text)) {
    await telegram(env, "sendMessage", { chat_id: chatId, text: "Добро пожаловать в KaylsMusic! Ищи музыку сразу в нескольких каталогах, слушай и скачивай треки, доступные для загрузки.", reply_markup: keyboard });
  } else if (text && !text.startsWith("/")) {
    await telegram(env, "sendMessage", { chat_id: chatId, text: "Открой KaylsMusic, чтобы увидеть результаты из нескольких каталогов и слушать музыку прямо в приложении.", reply_markup: keyboard });
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health")) {
      return json({ status: "ok", service: APP_NAME, miniApp: true });
    }
    if (request.method === "POST" && url.pathname === "/setup") {
      if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET) return json({ ok: false, error: "Missing Worker secrets" }, 500);
      if (request.headers.get("authorization") !== `Bearer ${env.WEBHOOK_SECRET}`) return json({ ok: false, error: "Unauthorized" }, 401);
      const webhook = await telegram(env, "setWebhook", { url: `${url.origin}/webhook`, secret_token: env.WEBHOOK_SECRET, allowed_updates: ["message"] });
      await telegram(env, "setChatMenuButton", { menu_button: { type: "web_app", text: "KaylsMusic", web_app: { url: url.origin } } });
      return json({ ok: true, webhook_set: Boolean(webhook), mini_app_menu_set: true, jamendo_configured: Boolean(env.JAMENDO_CLIENT_ID) });
    }
    if (request.method === "POST" && url.pathname === "/webhook") {
      if (request.headers.get("x-telegram-bot-api-secret-token") !== env.WEBHOOK_SECRET) return json({ ok: false }, 401);
      try { const update = await request.json(); if (update.message) await replyToMessage(env, update.message, url.origin); return json({ ok: true }); }
      catch (e) { console.error("Webhook error", e); return json({ ok: false }, 500); }
    }
    if (url.pathname.startsWith("/api/")) {
      const response = await handleApi(request, env, url);
      if (response) return response;
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: "Not found" }, 404);
  }
};
