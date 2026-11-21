const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();tg?.setHeaderColor?.("#111114");tg?.setBackgroundColor?.("#111114");
const $=id=>document.getElementById(id),initData=tg?.initData||"",audio=$("audio");
const K="kaylsmusic.collection.v1",H="kaylsmusic.history.v1",V="kaylsmusic.volume.v1";
const initialVolume=Number(localStorage.getItem(V));audio.volume=Number.isFinite(initialVolume)&&localStorage.getItem(V)!==null?Math.max(0,Math.min(1,initialVolume)):.8;
function read(k){try{return JSON.parse(localStorage.getItem(k)||"[]")}catch{return []}}
let saved=read(K),history=read(H),disliked=[],results=[],queue=[],qi=-1,activeSource="all",current=null,repeatOne=false,cloudReady=false,cloudTimer=null,sleepTimer=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key=t=>t.source+"|"+t.id,has=t=>saved.some(x=>key(x)===key(t));
function persist(sync=true){localStorage.setItem(K,JSON.stringify(saved));localStorage.setItem(H,JSON.stringify(history.slice(0,100)));$("savedCount").textContent=saved.length;$("historyCount").textContent=history.length;if(sync&&cloudReady)scheduleCloudSave();}
function scheduleCloudSave(){clearTimeout(cloudTimer);cloudTimer=setTimeout(async()=>{try{const r=await fetch("/api/me",{method:"PUT",headers:{"content-type":"application/json","x-telegram-init-data":initData},body:JSON.stringify({saved,history:history.slice(0,100),disliked})});if(!r.ok)throw Error();setAccountStatus("Синхронизация включена · Telegram");}catch{setAccountStatus("Не удалось синхронизировать. Проверь подключение.");}},500);}
function setAccountStatus(value){const el=$("accountStatus");if(el)el.textContent=value;}
async function loadAccount(){if(!initData){setAccountStatus("Открой приложение через Telegram для синхронизации.");return;}try{const r=await fetch("/api/me",{headers:{"x-telegram-init-data":initData}}),d=await r.json();if(!r.ok){setAccountStatus(r.status===503?"Нужно подключить Cloudflare KV для синхронизации.":"Не удалось подтвердить аккаунт Telegram.");return;}const localSaved=saved,localHistory=history;saved=Array.isArray(d.data?.saved)?d.data.saved:[];saved=[...saved,...localSaved.filter(t=>!saved.some(x=>key(x)===key(t)))];history=Array.isArray(d.data?.history)?d.data.history:[];history=[...history,...localHistory.filter(t=>!history.some(x=>key(x)===key(t)))].slice(0,100);disliked=Array.isArray(d.data?.disliked)?d.data.disliked:[];cloudReady=true;persist(false);scheduleCloudSave();renderRecent();if(!$("libraryView").hidden)render($("libraryResults"),saved);setAccountStatus("Синхронизация включена · "+(d.user?.first_name||"Telegram"));}catch{setAccountStatus("Нет связи с сервером синхронизации.");}}

function switchView(id){
 const views=[...document.querySelectorAll(".view")];views.forEach(v=>{v.hidden=v.id!==id;v.classList.remove("view-enter")});
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===id));$("adminPanel").hidden=true;
 const active=$(id);if(active){void active.offsetWidth;active.classList.add("view-enter")}
 if(id==="libraryView")render($("libraryResults"),saved);if(id==="waveView")makeWave();if(id==="homeView")renderRecent();
}
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>switchView(b.dataset.goto));$("waveShortcut").onclick=()=>switchView("waveView");
function render(target,tracks){if(!tracks.length){target.innerHTML='<div class="hint">Здесь пока пусто. Найди музыку и нажми ♡, чтобы сохранить.</div>';return}
target.innerHTML=tracks.map((t,i)=>'<article class="track-row"><button class="cover-play" data-play="'+i+'"><img src="'+esc(t.artwork||"")+'" onerror="this.style.opacity=0" alt=""><span>▶</span></button><div class="track-meta"><b>'+esc(t.title)+'</b><small>'+esc(t.artist)+' · '+esc(t.source)+'</small></div><button class="heart '+(has(t)?"liked":"")+'" data-heart="'+i+'">'+(has(t)?"♥":"♡")+'</button><button class="more" data-share="'+i+'">⋯</button></article>').join("");
target.querySelectorAll("[data-play]").forEach(b=>b.onclick=()=>play(tracks[+b.dataset.play],tracks));
target.querySelectorAll("[data-heart]").forEach(b=>b.onclick=()=>toggleSaved(tracks[+b.dataset.heart]));
target.querySelectorAll("[data-share]").forEach(b=>b.onclick=()=>share(tracks[+b.dataset.share]));
}
function toggleSaved(t){saved=has(t)?saved.filter(x=>key(x)!==key(t)):[t,...saved];persist();refreshVisible();tg?.HapticFeedback?.impactOccurred?.("light")}
function refreshVisible(){if(!$("libraryView").hidden)render($("libraryResults"),saved);if(current)$("playerHeart").textContent=has(current)?"♥":"♡"}
function renderRecent(){render($("recentList"),history.slice(0,5))}
function filtered(){return activeSource==="all"?results:results.filter(t=>t.source===activeSource)}
let searchController=null;
async function search(q,target){
 if(!q||q.trim().length<2)return;
 const seq=++searchSequence;
 if(target)target.innerHTML='<div class="hint">Ищем полные версии треков…</div>';
 try{
  const r=await fetch("/api/search?q="+encodeURIComponent(q.trim()));
  const d=await r.json();
  if(!r.ok)throw Error(d.error||"Не удалось выполнить поиск");
  if(seq!==searchSequence)return;
  results=(d.tracks||[]).filter(t=>t.stream&&["Audius","Jamendo"].includes(t.source));
  activeSource="all";
  document.querySelectorAll(".source").forEach(b=>b.classList.toggle("active",b.dataset.source==="all"));
  if(target){
   if(results.length)render(target,filtered());
   else target.innerHTML='<div class="hint">Полные версии пока не найдены. Попробуй другое название или имя исполнителя.</div>';
  }
  $("searchStatus").textContent=results.length?results.length+" полных версий":"";
 }catch(e){if(target)target.innerHTML='<div class="hint">'+esc(e.message)+'</div>'}
}
$("openSearch").onclick=()=>{$("searchPanel").hidden=false;$("query").focus();$("searchPanel").scrollIntoView({behavior:"smooth",block:"start"})};
$("closeSearch").onclick=()=>{$("searchPanel").hidden=true;$("query").value="";$("homeResults").innerHTML='<div class="hint">Введи название трека или исполнителя.</div>'};
let searchDebounce=null,searchSequence=0;
function liveSearch(value,target){
 clearTimeout(searchDebounce);searchSequence++;
 const q=value.trim();
 target.innerHTML=q.length<2?'<div class="hint">Введи хотя бы 2 символа для поиска.</div>':'<div class="hint">Нажми Enter или кнопку поиска, чтобы найти полные версии.</div>';
}
$("query").oninput=e=>liveSearch(e.target.value,$("homeResults"));
$("query").onkeydown=e=>{if(e.key==="Enter"){clearTimeout(searchDebounce);searchSequence++;search(e.target.value,$("homeResults"));}};
const query2=$("query2");
if(query2){query2.oninput=e=>liveSearch(e.target.value,$("searchResults"));query2.onkeydown=e=>{if(e.key==="Enter"){clearTimeout(searchDebounce);searchSequence++;search(e.target.value,$("searchResults"));}};}
$("searchButton2").onclick=()=>{clearTimeout(searchDebounce);searchSequence++;search(query2?.value||"",$("searchResults"));};
function updateMediaSession(){if(!("mediaSession" in navigator)||!current)return;try{navigator.mediaSession.metadata=new MediaMetadata({title:current.title||"Kayl`s Music",artist:current.artist||"",album:"Kayl`s Music",artwork:current.artwork?[{src:current.artwork,sizes:"512x512",type:"image/jpeg"}]:[]});navigator.mediaSession.playbackState=audio.paused?"paused":"playing"}catch{}}
function setupMediaSession(){if(!("mediaSession" in navigator))return;const actions={play:()=>audio.play().catch(()=>{}),pause:()=>audio.pause(),previoustrack:prev,nexttrack:next,seekbackward:d=>{audio.currentTime=Math.max(0,audio.currentTime-(d.seekOffset||10))},seekforward:d=>{audio.currentTime=Math.min(audio.duration||Infinity,audio.currentTime+(d.seekOffset||10))},seekto:d=>{if(Number.isFinite(audio.duration)&&Number.isFinite(d.seekTime))audio.currentTime=d.seekTime}};for(const [name,fn] of Object.entries(actions)){try{navigator.mediaSession.setActionHandler(name,fn)}catch{}}}
async function play(t,list){if(!t.stream){tg?.showAlert?.("Для этого трека нет доступной полной версии.");return}queue=list||queue;qi=queue.findIndex(x=>key(x)===key(t));current=t;$("playerTitle").textContent=t.title;$("playerArtist").textContent=t.artist;$("playerArt").src=t.artwork||"";$("fpArt").src=t.artwork||"";$("fpTitle").textContent=t.title;$("fpArtist").textContent=t.artist;$("fpContext").textContent="Твоя музыка";$("playerHeart").textContent=has(t)?"♥":"♡";$("fpLike").textContent=has(t)?"♥":"♡";$("player").hidden=false;audio.src=t.stream;setupMediaSession();updateMediaSession();try{await audio.play();setPlaying(true);updateMediaSession()}catch{setPlaying(false);updateMediaSession()}history=[t,...history.filter(x=>key(x)!==key(t))].slice(0,100);persist();renderRecent();renderQueue()}
function setPlaying(on){$("playPause").textContent=on?"Ⅱ":"▶";$("fpPlay").textContent=on?"Ⅱ":"▶"}
function openFullPlayer(){$("fullPlayer").hidden=false;document.body.classList.add("player-open");$("fpLike").textContent=current&&has(current)?"♥":"♡";renderQueue()}
function closeFullPlayer(){$("fullPlayer").hidden=true;document.body.classList.remove("player-open");$("queuePanel").hidden=true}
function fmtTime(sec){if(!Number.isFinite(sec))return "0:00";return Math.floor(sec/60)+":"+String(Math.floor(sec%60)).padStart(2,"0")}
function renderQueue(){const el=$("queueItems");if(!el)return;el.innerHTML=queue.length?queue.map((t,i)=>'<button class="queue-item" data-q="'+i+'"><img src="'+esc(t.artwork||"")+'"><span><b>'+esc(t.title)+'</b><small>'+esc(t.artist)+'</small></span>'+(i===qi?"●":"")+'</button>').join(""):'<div class="hint">Очередь пока пуста</div>';el.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>play(queue[+b.dataset.q],queue))}
function dislikeCurrent(){if(!current)return;const rejected=current;disliked=[rejected,...disliked.filter(t=>key(t)!==key(rejected))].slice(0,300);saved=saved.filter(t=>key(t)!==key(rejected));waveTracks=waveTracks.filter(t=>key(t)!==key(rejected));queue=queue.filter(t=>key(t)!==key(rejected));persist();renderQueue();if(!$("waveView").hidden)render($("waveResults"),waveTracks);next();tg?.HapticFeedback?.notificationOccurred?.("success")}
$("playPause").onclick=async()=>{if(audio.paused){try{await audio.play();setPlaying(true)}catch{}}else{audio.pause();setPlaying(false)}};
$("miniOpen").onclick=openFullPlayer;$("collapsePlayer").onclick=closeFullPlayer;
$("fpPlay").onclick=()=>$("playPause").click();$("fpNext").onclick=next;$("fpPrev").onclick=prev;
$("queueButton").onclick=()=>{$("queuePanel").hidden=!$("queuePanel").hidden;renderQueue()};
$("closeQueue").onclick=()=>$("queuePanel").hidden=true;
$("castButton").onclick=()=>tg?.showAlert?.("Трансляция на устройства пока не поддерживается этим источником аудио.");
$("fpLike").onclick=()=>$("playerHeart").click();$("dislikeTrack").onclick=dislikeCurrent;
$("fpShare").onclick=()=>current&&share(current);$("fpMore").onclick=()=>current&&share(current);
$("fpArtistAvatar").onclick=()=>{if(!current)return;closeFullPlayer();switchView("homeView");$("searchPanel").hidden=false;$("query").value=current.artist;search(current.artist,$("homeResults"))};
$("repeatButton").onclick=()=>{repeatOne=!repeatOne;$("repeatButton").classList.toggle("selected",repeatOne)};
$("lyricsButton").onclick=()=>tg?.showAlert?.("Текст песни пока недоступен для этого трека.");
$("timerButton").onclick=()=>{const mins=Number(prompt("Остановить музыку через сколько минут? (15, 30 или 60)","30"));if(![15,30,60].includes(mins))return;clearTimeout(sleepTimer);sleepTimer=setTimeout(()=>{audio.pause();setPlaying(false)},mins*60000);tg?.showAlert?.("Таймер установлен на "+mins+" мин.")};
$("downloadButton").onclick=async()=>{if(!current)return;if(!current.downloadable||!["Audius","Jamendo"].includes(current.source)){tg?.showAlert?.("Этот источник не разрешает скачивание полной версии.");return}if(!initData){tg?.showAlert?.("Открой Kayl`s Music из Telegram, чтобы отправить MP3 в чат.");return}const btn=$("downloadButton");btn.disabled=true;try{const r=await fetch("/api/send-audio",{method:"POST",headers:{"content-type":"application/json","x-telegram-init-data":initData},body:JSON.stringify({source:current.source.toLowerCase(),id:current.id,title:current.title,artist:current.artist})});const d=await r.json();if(!r.ok)throw Error(d.error||"Не удалось отправить аудио");tg?.showAlert?.("Аудиофайл отправлен в чат бота.")}catch(e){tg?.showAlert?.(e.message)}finally{btn.disabled=false}};
$("startWave").onclick=()=>{if(current){saved=[current,...saved.filter(t=>key(t)!==key(current))];persist()}closeFullPlayer();switchView("waveView")};
$("seekBar").oninput=e=>{if(Number.isFinite(audio.duration))audio.currentTime=audio.duration*(Number(e.target.value)/1000)};
$("volumeControl").value=Math.round(audio.volume*100);$("volumeValue").textContent=Math.round(audio.volume*100)+"%";$("volumeControl").oninput=e=>{const v=Math.max(0,Math.min(1,Number(e.target.value)/100));audio.volume=v;localStorage.setItem(V,String(v));$("volumeValue").textContent=Math.round(v*100)+"%";$("volumeIcon").textContent=v===0?"🔇":v<.5?"🔉":"🔊"};
function next(){if(repeatOne&&current){play(current,queue);return}if(qi+1<queue.length)play(queue[++qi],queue);else setPlaying(false)}function prev(){if(audio.currentTime>3){audio.currentTime=0;return}if(qi>0)play(queue[--qi],queue)}
$("nextTrack").onclick=next;audio.onended=next;$("playerHeart").onclick=()=>current&&toggleSaved(current);
audio.ontimeupdate=()=>{if(audio.duration){const p=audio.currentTime/audio.duration*100;$("progressBar").style.width=p+"%";$("seekBar").value=Math.round(p*10);$("elapsedTime").textContent=fmtTime(audio.currentTime);$("totalTime").textContent="-"+fmtTime(audio.duration-audio.currentTime)}};audio.onplay=()=>{setPlaying(true);updateMediaSession()};audio.onpause=()=>{setPlaying(false);updateMediaSession()};
function share(t){const u=new URL("/",location.origin);u.searchParams.set("track",JSON.stringify({id:t.id,source:t.source,title:t.title,artist:t.artist,artwork:t.artwork,stream:t.stream}));const url="https://t.me/share/url?url="+encodeURIComponent(u.href)+"&text="+encodeURIComponent(t.title+" — "+t.artist);if(tg?.openTelegramLink)tg.openTelegramLink(url);else if(navigator.share)navigator.share({title:t.title,url:u.href}).catch(()=>{});else navigator.clipboard?.writeText(u.href)}
let waveTracks=[],waveLoading=false;
async function makeWave(){
  const target=$("waveResults"),seeds=[...saved,...history].filter(t=>!disliked.some(x=>key(x)===key(t))).filter((t,i,arr)=>arr.findIndex(x=>key(x)===key(t))===i).slice(0,12);
  if(!seeds.length){target.innerHTML='<div class="hint">Сначала сохрани ❤️ или послушай несколько треков. По ним KaylsMusic соберёт твою волну.</div>';return}
  if(waveLoading)return;
  waveLoading=true;target.innerHTML='<div class="hint">Подбираем похожих исполнителей и музыку по твоим вкусам…</div>';
  try{
    const params=new URLSearchParams();
    params.set("seeds",JSON.stringify(seeds.map(t=>({artist:t.artist,title:t.title,source:t.source,id:t.id,genres:t.genres||[],tags:t.tags||[],mood:t.mood||""}))));
    const r=await fetch("/api/wave?"+params.toString());const d=await r.json();
    if(!r.ok)throw Error(d.error||"Не удалось собрать волну");
    waveTracks=d.tracks||[];
    if(!waveTracks.length){target.innerHTML='<div class="hint">Пока мало похожих треков. Сохрани ещё несколько песен разных исполнителей и обнови волну.</div>';return}
    render(target,waveTracks);
    $("searchStatus").textContent=waveTracks.length+" треков в твоей волне";
  }catch(e){target.innerHTML='<div class="hint">'+esc(e.message)+'</div>'}
  finally{waveLoading=false}
}
$("refreshWave").onclick=makeWave;$("playSaved").onclick=()=>saved.length&&play(saved[0],saved);
async function loadDiscover(){
 const artistsEl=$("popularArtists"),tracksEl=$("popularTracks");
 try{
  const r=await fetch("/api/discover"),d=await r.json();if(!r.ok)throw Error(d.error||"Не удалось загрузить подборку");
  const artists=d.artists||[];
  artistsEl.innerHTML=artists.length?artists.map((a,i)=>'<button class="artist-card" data-artist="'+i+'"><img src="'+esc(a.picture||"")+'" alt="" onerror="this.style.opacity=.25"><b>'+esc(a.name)+'</b></button>').join(""):'<div class="hint">Популярные исполнители пока недоступны.</div>';
  artistsEl.querySelectorAll("[data-artist]").forEach(b=>b.onclick=()=>{$("searchPanel").hidden=false;$("query").value=artists[+b.dataset.artist].name;search($("query").value,$("homeResults"));$("searchPanel").scrollIntoView({behavior:"smooth",block:"start"})});
  const tracks=d.tracks||[];if(tracks.length)render(tracksEl,tracks);else tracksEl.innerHTML='<div class="hint">Популярные треки пока недоступны.</div>';
 }catch(e){artistsEl.innerHTML='<div class="hint">Не удалось загрузить популярных исполнителей.</div>';tracksEl.innerHTML='<div class="hint">'+esc(e.message)+'</div>'}
}
function shared(){const raw=new URL(location.href).searchParams.get("track");if(!raw)return;try{const t=JSON.parse(raw);if(t.title&&t.stream){switchView("homeView");render($("homeResults"),[t]);}}catch{}}
$("adminOpen").onclick=async()=>{try{const r=await fetch("/api/admin",{headers:{"x-telegram-init-data":initData}}),d=await r.json();if(!r.ok)throw Error();$("adminPanel").hidden=false;$("adminData").textContent=JSON.stringify(d.admin||d,null,2)}catch{tg?.showAlert?.("Доступ закрыт")}};$("adminClose").onclick=()=>$("adminPanel").hidden=true;
if(initData)fetch("/api/admin",{headers:{"x-telegram-init-data":initData}}).then(r=>{if(r.ok)$("adminOpen").hidden=false}).catch(()=>{});
persist(false);renderRecent();loadAccount();loadDiscover();shared();
const botAvatar=$("botAvatar");if(botAvatar){botAvatar.addEventListener("error",()=>$("logoFallback").hidden=false);let avatarVersion=Date.now();const refreshBotAvatar=()=>{botAvatar.src="/api/bot-avatar?v="+(++avatarVersion);botAvatar.hidden=false;$("logoFallback").hidden=true};refreshBotAvatar();setInterval(refreshBotAvatar,604800000)}