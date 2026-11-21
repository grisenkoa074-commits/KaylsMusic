const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand(); tg?.setHeaderColor?.("#10091f"); tg?.setBackgroundColor?.("#10091f");
const initData = tg?.initData || "";
const $ = id => document.getElementById(id);
const form=$("searchForm"), query=$("query"), results=$("results"), status=$("status"), count=$("count");
const audio=$("audio"), player=$("player");
let currentTrack=null, lastTracks=[];
function apiHeaders(){return {"x-telegram-init-data":initData};}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function empty(title,sub){results.innerHTML=`<div class="empty"><div class="empty-note">♫</div><b>${esc(title)}</b><span>${esc(sub)}</span></div>`;}
function renderTracks(tracks){
 lastTracks=tracks;count.textContent=tracks.length?`${tracks.length} треков`:"";
 if(!tracks.length){empty("Ничего не найдено","Попробуй другое название или исполнителя");return;}
 results.innerHTML=tracks.map((t,i)=>`<article class="track"><img class="cover" src="${esc(t.artwork||"")}" alt="" onerror="this.style.display='none'"><div class="track-info"><b>${esc(t.title)}</b><span>${esc(t.artist)} · ${esc(t.duration)}</span><span class="source">${esc(t.source)}</span></div><div class="track-actions"><button class="action primary" data-play="${i}" title="Слушать">▶</button><button class="action" data-share="${i}" title="Поделиться">↗</button><button class="action" data-download="${i}" title="Скачать" ${t.downloadable?"":"disabled"}>↓</button></div></article>`).join("");
 results.querySelectorAll("[data-play]").forEach(b=>b.onclick=()=>playTrack(tracks[Number(b.dataset.play)]));
 results.querySelectorAll("[data-share]").forEach(b=>b.onclick=()=>shareTrack(tracks[Number(b.dataset.share)]));
 results.querySelectorAll("[data-download]").forEach(b=>b.onclick=()=>downloadTrack(tracks[Number(b.dataset.download)]));
}
async function search(q){
 status.textContent="Ищем в музыкальных каталогах…";count.textContent="";results.innerHTML='<div class="empty"><b>Ищем музыку…</b><span>Audius · Jamendo · Deezer · iTunes</span></div>';
 try{const r=await fetch("/api/search?q="+encodeURIComponent(q));const d=await r.json();if(!r.ok)throw new Error(d.error||"Search failed");renderTracks(d.tracks||[]);const ok=Object.entries(d.sources||{}).filter(([,v])=>v==="ok").map(([k])=>k);status.textContent=ok.length?"Источники: "+ok.join(" · "):"Каталоги временно недоступны";}
 catch(e){empty("Не удалось выполнить поиск","Попробуй ещё раз чуть позже");status.textContent=e.message;}
}
form.addEventListener("submit",e=>{e.preventDefault();const q=query.value.trim();if(q.length>=2)search(q);});
async function playTrack(t){
 if(!t.stream){tg?.showAlert?.("У этого каталога нет доступного предпрослушивания.");return;}
 currentTrack=t;$("playerTitle").textContent=t.title;$("playerArtist").textContent=t.artist;$("playerArt").src=t.artwork||"";player.hidden=false;
 audio.src=t.source==="Audius"?t.stream:t.stream;
 try{await audio.play();$("playPause").textContent="Ⅱ";}catch{$("playPause").textContent="▶";tg?.showAlert?.("Нажми ▶ для начала прослушивания.");}
}
$("playPause").onclick=async()=>{if(audio.paused){try{await audio.play();$("playPause").textContent="Ⅱ";}catch{}}else{audio.pause();$("playPause").textContent="▶";}};
audio.addEventListener("ended",()=>{$("playPause").textContent="▶";});
function shareTrack(t){
 const text=`🎵 ${t.title} — ${t.artist}\nKaylsMusic · ${t.permalink}`;
 if(tg?.switchInlineQuery){tg.switchInlineQuery(text,["users","groups","channels"]);}
 else if(navigator.share){navigator.share({title:t.title,text}).catch(()=>{});}
 else if(navigator.clipboard){navigator.clipboard.writeText(text);tg?.showAlert?.("Ссылка скопирована.");}
}
function downloadTrack(t){
 if(!t.downloadable){tg?.showAlert?.("Скачивание для этого трека не разрешено автором.");return;}
 if(t.source==="Audius"||t.source==="Jamendo"){location.href="/api/download?source="+t.source.toLowerCase()+"&id="+encodeURIComponent(t.id);}
}
$("adminOpen").onclick=async()=>{const panel=$("adminPanel");panel.hidden=false;try{const r=await fetch("/api/admin",{headers:apiHeaders()});const d=await r.json();if(!r.ok)throw new Error(d.error||"Нет доступа");$("adminData").innerHTML=Object.entries(d.admin).map(([k,v])=>`<div class="admin-card"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join("");}catch(e){$("adminData").innerHTML=`<div class="admin-card"><b>Доступ закрыт</b><span>${esc(e.message)}</span></div>`;}};
$("adminClose").onclick=()=>{$("adminPanel").hidden=true;};
if(initData){fetch("/api/admin",{headers:apiHeaders()}).then(r=>{if(r.ok)$("adminOpen").hidden=false;}).catch(()=>{});}
