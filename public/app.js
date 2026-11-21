const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();tg?.setHeaderColor?.("#111114");tg?.setBackgroundColor?.("#111114");
const $=id=>document.getElementById(id),initData=tg?.initData||"",audio=$("audio");
const K="kaylsmusic.collection.v1",H="kaylsmusic.history.v1";
function read(k){try{return JSON.parse(localStorage.getItem(k)||"[]")}catch{return []}}
let saved=read(K),history=read(H),results=[],queue=[],qi=-1,activeSource="all",current=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key=t=>t.source+"|"+t.id,has=t=>saved.some(x=>key(x)===key(t));
function persist(){localStorage.setItem(K,JSON.stringify(saved));localStorage.setItem(H,JSON.stringify(history.slice(0,50)));$("savedCount").textContent=saved.length;$("historyCount").textContent=history.length;}
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
async function search(q,target){
 if(!q||q.trim().length<2)return;
 target.innerHTML='<div class="hint">Ищем музыку…</div>';
 try{const r=await fetch("/api/search?q="+encodeURIComponent(q.trim())),d=await r.json();if(!r.ok)throw Error(d.error||"Ошибка поиска");results=d.tracks||[];render(target,results)}
 catch(e){target.innerHTML='<div class="hint">'+esc(e.message)+'</div>'}
}
$("openSearch").onclick=()=>{$("searchPanel").hidden=false;$("query").focus();$("searchPanel").scrollIntoView({behavior:"smooth",block:"start"})};
$("closeSearch").onclick=()=>{$("searchPanel").hidden=true;$("query").value="";$("homeResults").innerHTML='<div class="hint">Введи название трека или исполнителя.</div>'};
$("query").oninput=e=>{if(e.target.value.trim().length>=2)search(e.target.value,$("homeResults"))};
$("query").onkeydown=e=>{if(e.key==="Enter")search(e.target.value,$("homeResults"))};
async function play(t,list){if(!t.stream){tg?.showAlert?.("Для этого трека нет доступного предпрослушивания.");return}queue=list||queue;qi=queue.findIndex(x=>key(x)===key(t));current=t;$("playerTitle").textContent=t.title;$("playerArtist").textContent=t.artist;$("playerArt").src=t.artwork||"";$("playerHeart").textContent=has(t)?"♥":"♡";$("player").hidden=false;audio.src=t.stream;try{await audio.play();$("playPause").textContent="Ⅱ"}catch{$("playPause").textContent="▶"}history=[t,...history.filter(x=>key(x)!==key(t))].slice(0,50);persist();renderRecent()}
$("playPause").onclick=async()=>{if(audio.paused){try{await audio.play();$("playPause").textContent="Ⅱ"}catch{}}else{audio.pause();$("playPause").textContent="▶"}};
function next(){if(qi+1<queue.length)play(queue[++qi],queue);else $("playPause").textContent="▶"}function prev(){if(audio.currentTime>3){audio.currentTime=0;return}if(qi>0)play(queue[--qi],queue)}
$("nextTrack").onclick=next;$("prevTrack").onclick=prev;audio.onended=next;$("playerHeart").onclick=()=>current&&toggleSaved(current);
audio.ontimeupdate=()=>{if(audio.duration)$("progressBar").style.width=(audio.currentTime/audio.duration*100)+"%"};
function share(t){const u=new URL("/",location.origin);u.searchParams.set("track",JSON.stringify({id:t.id,source:t.source,title:t.title,artist:t.artist,artwork:t.artwork,stream:t.stream}));const url="https://t.me/share/url?url="+encodeURIComponent(u.href)+"&text="+encodeURIComponent(t.title+" — "+t.artist);if(tg?.openTelegramLink)tg.openTelegramLink(url);else if(navigator.share)navigator.share({title:t.title,url:u.href}).catch(()=>{});else navigator.clipboard?.writeText(u.href)}
let waveTracks=[],waveLoading=false;
async function makeWave(){
  const target=$("waveResults"),seeds=[...saved,...history].filter((t,i,arr)=>arr.findIndex(x=>key(x)===key(t))===i).slice(0,12);
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
persist();renderRecent();loadDiscover();shared();