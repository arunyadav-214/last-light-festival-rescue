(() => {
  "use strict";
  const DATA = window.LAST_LIGHT_DATA;
  const MAX_PLAYERS = 6;
  const ROOM_RE = /^[A-Z0-9]{6}$/;
  const $ = (id) => document.getElementById(id);
  const views = ["landingView", "lobbyView", "gameView", "endView"];
  let peer = null, hostConnection = null, mode = null, roomCode = "", myPlayerId = "", state = null;
  let guestConnections = new Map(), myPrivateClues = [], timerHandle = null, reconnectHandle = null, soundEnabled = true;
  let mySessionId = localStorage.getItem("lastLightSessionId") || crypto.randomUUID();
  localStorage.setItem("lastLightSessionId", mySessionId);

  const initialState = () => ({version:1,status:"lobby",roomCode,hostPlayerId:myPlayerId,players:[],currentDistrict:0,completed:[],notes:[],startedAt:null,endsAt:null,finishedAt:null,result:null});
  const sanitizeName = v => v.trim().replace(/\s+/g," ").slice(0,18);
  const normalizeRoom = v => v.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);
  const playerIdFromSession = s => `p_${s.replace(/-/g,"").slice(0,12)}`;
  const hostPeerId = c => `last-light-festival-${c.toLowerCase()}`;
  const escapeHtml = s => String(s).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  function randomRoom(){const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let o="";for(let i=0;i<6;i++)o+=a[Math.floor(Math.random()*a.length)];return o}
  function showView(id){views.forEach(v=>$(v).classList.toggle("active",v===id));window.scrollTo({top:0,behavior:"smooth"})}
  function setConnection(text,online){$("connectionPill").textContent=text;$("connectionPill").className=`pill ${online?"online":"muted"}`}
  function toast(message){const e=$("toast");e.textContent=message;e.classList.add("show");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("show"),1800)}
  function beep(freq=600,duration=.06){if(!soundEnabled)return;try{const C=window.AudioContext||window.webkitAudioContext,c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=freq;g.gain.setValueAtTime(.04,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+duration)}catch(_){}}
  function send(conn,payload){if(conn?.open)conn.send(payload)}
  function publicState(){return JSON.parse(JSON.stringify(state))}
  function saveHostState(){if(mode==="host"&&roomCode&&state)localStorage.setItem(`lastLightHostState:${roomCode}`,JSON.stringify(state))}
  function loadHostState(code){try{const r=localStorage.getItem(`lastLightHostState:${code}`);return r?JSON.parse(r):null}catch(_){return null}}
  function makePlayer(name,id=playerIdFromSession(mySessionId),isHost=false){return{id,name,ready:isHost,connected:true,isHost,joinedAt:Date.now()}}
  function clueFor(playerId,districtIndex){if(!state)return"";const i=Math.max(0,state.players.findIndex(p=>p.id===playerId)),clues=DATA.districts[districtIndex]?.clues||[];return clues[i%clues.length]||"Share what you observe with the crew."}
  function cluesForPlayer(playerId){return DATA.districts.map((_,i)=>clueFor(playerId,i))}
  function sendPrivateClues(playerId){const c=guestConnections.get(playerId);if(c)send(c,{type:"privateClues",clues:cluesForPlayer(playerId)});if(playerId===myPlayerId)myPrivateClues=cluesForPlayer(playerId)}
  function syncAllClues(){state.players.forEach(p=>sendPrivateClues(p.id))}
  function broadcastState(){if(mode!=="host")return;saveHostState();const s=publicState();for(const c of guestConnections.values())send(c,{type:"state",state:s});renderFromState()}

  function createRoom(name,requestedCode){
    cleanupNetwork();mode="host";roomCode=normalizeRoom(requestedCode)||randomRoom();myPlayerId=playerIdFromSession(mySessionId);$("entryError").hidden=true;setConnection("Connecting",false);
    const restored=loadHostState(roomCode);state=restored&&restored.roomCode===roomCode?restored:initialState();state.roomCode=roomCode;state.hostPlayerId=myPlayerId;
    let me=state.players.find(p=>p.id===myPlayerId);if(!me)state.players.unshift(makePlayer(name,myPlayerId,true));else{me.name=name;me.connected=true;me.isHost=true;me.ready=true}
    peer=new Peer(hostPeerId(roomCode));
    peer.on("open",()=>{setConnection("Host online",true);myPrivateClues=cluesForPlayer(myPlayerId);showView(state.status==="lobby"?"lobbyView":state.status==="playing"?"gameView":"endView");renderFromState();toast(`Room ${roomCode} is live`)});
    peer.on("connection",handleIncomingConnection);
    peer.on("error",err=>{console.error(err);if(err.type==="unavailable-id"){showEntryError("That room code is already active. Try another code.");cleanupNetwork();showView("landingView")}else showEntryError(`Connection error: ${err.type||"unknown"}`)});
    peer.on("disconnected",()=>setConnection("Reconnecting",false));
  }

  function handleIncomingConnection(conn){
    let linkedPlayerId=null;
    conn.on("data",msg=>{
      if(!msg||typeof msg!=="object")return;
      if(msg.type==="hello"){
        const name=sanitizeName(msg.name||"Player"),id=playerIdFromSession(msg.sessionId||crypto.randomUUID());linkedPlayerId=id;let player=state.players.find(p=>p.id===id);
        if(!player){
          if(state.players.length>=MAX_PLAYERS){send(conn,{type:"reject",reason:"This room already has six players."});setTimeout(()=>conn.close(),200);return}
          if(state.status!=="lobby"){send(conn,{type:"reject",reason:"The expedition has already started. Rejoin with the same browser you used before."});setTimeout(()=>conn.close(),200);return}
          player=makePlayer(name,id,false);state.players.push(player)
        }else{player.connected=true;player.name=name||player.name}
        guestConnections.set(id,conn);send(conn,{type:"welcome",playerId:id,state:publicState(),clues:cluesForPlayer(id)});broadcastState();syncAllClues();beep(720)
      }else if(linkedPlayerId)handleGuestAction(linkedPlayerId,msg)
    });
    conn.on("close",()=>{if(!linkedPlayerId||!state)return;guestConnections.delete(linkedPlayerId);const p=state.players.find(x=>x.id===linkedPlayerId);if(p)p.connected=false;broadcastState()})
  }

  function handleGuestAction(playerId,msg){
    const p=state.players.find(x=>x.id===playerId);if(!p)return;
    if(msg.type==="ready"&&state.status==="lobby"){p.ready=!!msg.ready;broadcastState()}
    else if(msg.type==="note"&&state.status==="playing")addNote(p,msg.text);
    else if(msg.type==="solve"&&state.status==="playing")attemptSolve(p,msg.answer);
    else if(msg.type==="requestReplay"&&state.status==="ended")send(guestConnections.get(playerId),{type:"info",message:"Only the host can restart the expedition."})
  }

  function joinRoom(name,code){
    cleanupNetwork();mode="guest";roomCode=normalizeRoom(code);if(!ROOM_RE.test(roomCode))return showEntryError("Enter a valid six-character room code.");setConnection("Connecting",false);
    peer=new Peer();peer.on("open",()=>connectToHost(name));peer.on("error",err=>{console.error(err);if(["peer-unavailable","network"].includes(err.type))showEntryError("Room not found yet. Check the code and make sure the host is online.");setConnection("Offline",false)});peer.on("disconnected",()=>{setConnection("Reconnecting",false);scheduleReconnect(name)})
  }
  function connectToHost(name){if(!peer||peer.destroyed)return;hostConnection=peer.connect(hostPeerId(roomCode),{reliable:true});hostConnection.on("open",()=>{send(hostConnection,{type:"hello",name,sessionId:mySessionId});setConnection("Connected",true);clearTimeout(reconnectHandle)});hostConnection.on("data",handleHostMessage);hostConnection.on("close",()=>{setConnection("Reconnecting",false);scheduleReconnect(name)});hostConnection.on("error",()=>scheduleReconnect(name))}
  function scheduleReconnect(name){clearTimeout(reconnectHandle);reconnectHandle=setTimeout(()=>{if(!peer||peer.destroyed)return;if(peer.disconnected){try{peer.reconnect()}catch(_){}}else connectToHost(name)},1800)}
  function handleHostMessage(msg){
    if(!msg||typeof msg!=="object")return;
    if(msg.type==="welcome"){myPlayerId=msg.playerId;state=msg.state;myPrivateClues=msg.clues||[];$("entryError").hidden=true;showView(state.status==="lobby"?"lobbyView":state.status==="playing"?"gameView":"endView");renderFromState();toast(`Joined room ${roomCode}`);beep(720)}
    else if(msg.type==="state"){state=msg.state;renderFromState()}
    else if(msg.type==="privateClues"){myPrivateClues=msg.clues||[];renderPrivateClue()}
    else if(msg.type==="reject"){showEntryError(msg.reason||"Unable to join room.");showView("landingView");cleanupNetwork()}
    else if(msg.type==="feedback")showFeedback(msg.ok,msg.message);else if(msg.type==="info")toast(msg.message)
  }

  function startGame(){
    if(mode!=="host"||!state||state.status!=="lobby")return;const active=state.players.filter(p=>p.connected||p.isHost);
    if(active.length<2)return toast("At least two players are required.");if(active.some(p=>!p.ready))return toast("Everyone must be ready.");
    state.status="playing";state.currentDistrict=0;state.completed=[];state.notes=[];state.startedAt=Date.now();state.endsAt=Date.now()+DATA.durationMs;state.finishedAt=null;state.result=null;syncAllClues();broadcastState();showView("gameView");startTimerLoop();beep(880,.1)
  }
  function addNote(player,text){text=String(text||"").trim().slice(0,120);if(!text)return;state.notes.push({id:crypto.randomUUID(),playerId:player.id,playerName:player.name,text,at:Date.now()});state.notes=state.notes.slice(-40);broadcastState()}
  function attemptSolve(player,answer){
    if(Date.now()>=state.endsAt)return endGame(false);const d=DATA.districts[state.currentDistrict],normalized=String(answer||"").trim().toUpperCase().replace(/\s+/g," "),ok=d.answer.some(a=>a.toUpperCase()===normalized);
    if(!ok){const m="That does not unlock the district. Compare clues and try again.";if(player.id===myPlayerId)showFeedback(false,m);else send(guestConnections.get(player.id),{type:"feedback",ok:false,message:m});return}
    state.completed.push(state.currentDistrict);const m=d.success;
    if(state.currentDistrict>=DATA.districts.length-1){if(player.id===myPlayerId)showFeedback(true,m);endGame(true);return}
    state.currentDistrict+=1;syncAllClues();broadcastState();for(const c of guestConnections.values())send(c,{type:"feedback",ok:true,message:m});showFeedback(true,m);beep(980,.09)
  }
  function endGame(won){if(mode!=="host"||!state||state.status==="ended")return;state.status="ended";state.result=won?"won":"lost";state.finishedAt=Date.now();if(!won&&state.endsAt<state.finishedAt)state.endsAt=state.finishedAt;broadcastState();showView("endView");renderEnd();beep(won?1040:180,.18)}
  function replayGame(){if(mode!=="host"){send(hostConnection,{type:"requestReplay"});return}state.status="lobby";state.currentDistrict=0;state.completed=[];state.notes=[];state.startedAt=null;state.endsAt=null;state.finishedAt=null;state.result=null;state.players.forEach(p=>p.ready=!!p.isHost);broadcastState();showView("lobbyView")}

  function renderFromState(){if(!state)return;if(state.status==="lobby"){showView("lobbyView");renderLobby()}else if(state.status==="playing"){showView("gameView");renderGame();startTimerLoop()}else{showView("endView");renderEnd()}}
  function renderLobby(){
    $("roomCodeBtn").textContent=state.roomCode;$("playerCount").textContent=`${state.players.length} / ${MAX_PLAYERS}`;const list=$("playerList");list.innerHTML="";
    state.players.forEach(p=>{const r=document.createElement("div");r.className="player-row";r.innerHTML=`<div class="avatar">${escapeHtml(p.name.charAt(0).toUpperCase())}</div><div class="name"><strong>${escapeHtml(p.name)}</strong><br><small>${p.isHost?"Expedition host":p.connected?"Connected":"Reconnecting…"}</small></div><span class="ready-dot ${p.ready?"yes":""}" title="${p.ready?"Ready":"Not ready"}"></span>`;list.appendChild(r)});
    $("hostControls").hidden=mode!=="host";$("guestControls").hidden=mode!=="guest";
    if(mode==="host"){const active=state.players.filter(p=>p.connected||p.isHost),can=active.length>=2&&active.every(p=>p.ready);$("startGameBtn").disabled=!can;$("startHint").textContent=active.length<2?"At least two players are required.":can?"Everyone is ready.":"Waiting for everyone to be ready."}
    else{const me=state.players.find(p=>p.id===myPlayerId);$("readyBtn").textContent=me?.ready?"Ready ✓":"I’m ready"}
  }
  function renderGame(){const d=DATA.districts[state.currentDistrict];$("gameRoomCode").textContent=state.roomCode;$("districtTitle").textContent=d.name;$("districtNumber").textContent=`DISTRICT ${String(state.currentDistrict+1).padStart(2,"0")}`;$("challengeTitle").textContent=d.title;$("challengeStory").textContent=d.story;$("challengePrompt").textContent=d.prompt;renderPrivateClue();renderNotes();renderProgress();renderCrewMini();$("answerInput").value=""}
  function renderPrivateClue(){if(state?.status==="playing")$("privateClue").textContent=myPrivateClues[state.currentDistrict]||"Your clue is being synchronized…"}
  function renderNotes(){const n=$("notesList");n.innerHTML="";state.notes.forEach(x=>{const e=document.createElement("div");e.className="note";e.innerHTML=`<strong>${escapeHtml(x.playerName)}</strong> · ${escapeHtml(x.text)}`;n.appendChild(e)});$("noteCount").textContent=`${state.notes.length} note${state.notes.length===1?"":"s"}`;n.scrollTop=n.scrollHeight}
  function renderProgress(){const t=$("progressTrack");t.innerHTML="";DATA.districts.forEach((_,i)=>{const e=document.createElement("div");e.className=`progress-step ${state.completed.includes(i)?"done":i===state.currentDistrict?"current":""}`;t.appendChild(e)})}
  function renderCrewMini(){const w=$("crewMini");w.innerHTML="";state.players.forEach(p=>{const e=document.createElement("div");e.className="avatar";e.title=p.name;e.textContent=p.name.charAt(0).toUpperCase();w.appendChild(e)})}
  function startTimerLoop(){clearInterval(timerHandle);updateTimer();timerHandle=setInterval(updateTimer,500)}
  function updateTimer(){if(!state||state.status!=="playing"||!state.endsAt)return;const r=Math.max(0,state.endsAt-Date.now());$("timer").textContent=formatMs(r);$("timer").classList.toggle("urgent",r<=60000);if(r<=0&&mode==="host")endGame(false)}
  function renderEnd(){clearInterval(timerHandle);const won=state.result==="won";$("endingIcon").textContent=won?"✦":"◌";$("endingEyebrow").textContent=won?"FESTIVAL RESTORED":"THE LAST LIGHT FADED";$("endingTitle").textContent=won?"The last light is shining again.":"The city went dark before the rescue was complete.";$("endingText").textContent=won?"You restored all five districts before midnight.":"Regroup, share clues faster, and try the expedition again.";const r=Math.max(0,(state.endsAt||0)-(state.finishedAt||Date.now()));$("finalTime").textContent=formatMs(r);$("finalPlayers").textContent=state.players.length;$("finalNotes").textContent=state.notes.length;$("replayBtn").textContent=mode==="host"?"Play again":"Ask host to replay"}
  function showFeedback(ok,message){const b=$("answerFeedback");b.hidden=false;b.className=`feedback ${ok?"good":"bad"}`;b.textContent=message;setTimeout(()=>b.hidden=true,4200)}
  function showEntryError(message){const b=$("entryError");b.textContent=message;b.hidden=false}
  function formatMs(ms){const t=Math.ceil(ms/1000),m=Math.floor(t/60),s=t%60;return`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}
  function cleanupNetwork(){clearInterval(timerHandle);clearTimeout(reconnectHandle);if(hostConnection){try{hostConnection.close()}catch(_){}hostConnection=null}for(const c of guestConnections.values())try{c.close()}catch(_){}guestConnections.clear();if(peer){try{peer.destroy()}catch(_){}peer=null}setConnection("Offline",false)}
  function returnHome(){cleanupNetwork();mode=null;roomCode="";myPlayerId="";myPrivateClues=[];state=null;showView("landingView")}

  $("hostTab").addEventListener("click",()=>{$("hostTab").classList.add("active");$("joinTab").classList.remove("active");$("hostForm").classList.add("active");$("joinForm").classList.remove("active")});
  $("joinTab").addEventListener("click",()=>{$("joinTab").classList.add("active");$("hostTab").classList.remove("active");$("joinForm").classList.add("active");$("hostForm").classList.remove("active")});
  $("hostRoom").addEventListener("input",e=>e.target.value=normalizeRoom(e.target.value));$("joinRoom").addEventListener("input",e=>e.target.value=normalizeRoom(e.target.value));
  $("hostForm").addEventListener("submit",e=>{e.preventDefault();const n=sanitizeName($("hostName").value);if(n)createRoom(n,$("hostRoom").value)});
  $("joinForm").addEventListener("submit",e=>{e.preventDefault();const n=sanitizeName($("joinName").value);if(n)joinRoom(n,$("joinRoom").value)});
  $("readyBtn").addEventListener("click",()=>{const me=state?.players.find(p=>p.id===myPlayerId);if(me)send(hostConnection,{type:"ready",ready:!me.ready})});
  $("startGameBtn").addEventListener("click",startGame);
  $("noteForm").addEventListener("submit",e=>{e.preventDefault();const text=$("noteInput").value.trim();if(!text)return;if(mode==="host")addNote(state.players.find(p=>p.id===myPlayerId),text);else send(hostConnection,{type:"note",text});$("noteInput").value=""});
  $("answerForm").addEventListener("submit",e=>{e.preventDefault();const a=$("answerInput").value.trim();if(!a)return;if(mode==="host")attemptSolve(state.players.find(p=>p.id===myPlayerId),a);else send(hostConnection,{type:"solve",answer:a})});
  $("roomCodeBtn").addEventListener("click",async()=>{await navigator.clipboard.writeText(state.roomCode);toast("Room code copied")});
  $("copyInviteBtn").addEventListener("click",async()=>{const u=new URL(location.href);u.searchParams.set("room",state.roomCode);await navigator.clipboard.writeText(u.toString());toast("Invite link copied")});
  $("leaveBtn").addEventListener("click",returnHome);$("homeBtn").addEventListener("click",returnHome);$("replayBtn").addEventListener("click",replayGame);
  $("soundBtn").addEventListener("click",()=>{soundEnabled=!soundEnabled;$("soundBtn").textContent=soundEnabled?"♪":"×";toast(soundEnabled?"Sound on":"Sound off")});window.addEventListener("beforeunload",saveHostState);
  const invite=normalizeRoom(new URLSearchParams(location.search).get("room")||"");if(ROOM_RE.test(invite)){$("joinRoom").value=invite;$("joinTab").click()}
})();
