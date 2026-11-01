(()=>{
const $=s=>document.querySelector(s),views=['home','lobby','race','finish'];
const canvas=$('#canvas'),ctx=canvas.getContext('2d'),TOTAL=3;
const outer={x:70,y:55,w:860,h:540},inner={x:260,y:190,w:480,h:270};
let peer=null,conn=null,isHost=false,myName='',room='',myId='',world=null,ready=false;
let hostLoop=null,raf=null,finished=false;
let input={up:false,down:false,left:false,right:false},guestInput={up:false,down:false,left:false,right:false};
const show=id=>views.forEach(v=>$('#'+v).classList.toggle('active',v===id));
const status=t=>$('#status').textContent=t;
const code=s=>(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
const rand=()=>{let s='',c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';for(let i=0;i<6;i++)s+=c[Math.floor(Math.random()*c.length)];return s};
const peerId=c=>'midnight-circuit-'+c.toLowerCase();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function error(t=''){const e=$('#error');e.hidden=!t;e.textContent=t}
function send(o){if(conn&&conn.open)conn.send(o)}
function player(name,x,y){return{name,ready:false,connected:true,x,y,a:Math.PI,v:0,lap:0,cp:0,done:false,finish:0}}
function newWorld(host){return{phase:'lobby',p1:player(host,565,520),p2:player('Waiting for friend…',565,555),winner:null}}
function cleanup(){clearInterval(hostLoop);hostLoop=null;cancelAnimationFrame(raf);raf=null;try{conn&&conn.close()}catch{}try{peer&&peer.destroy()}catch{}peer=conn=null;world=null;ready=false;finished=false;input={up:false,down:false,left:false,right:false};guestInput={up:false,down:false,left:false,right:false}}
function home(){cleanup();isHost=false;myName=room=myId='';status('Ready');error();show('home')}

$('#hostTab').onclick=()=>{$('#hostTab').classList.add('active');$('#joinTab').classList.remove('active');$('#hostForm').classList.add('active');$('#joinForm').classList.remove('active')};
$('#joinTab').onclick=()=>{$('#joinTab').classList.add('active');$('#hostTab').classList.remove('active');$('#joinForm').classList.add('active');$('#hostForm').classList.remove('active')};
['hostCode','joinCode'].forEach(id=>$('#'+id).oninput=e=>e.target.value=code(e.target.value));
$('#hostForm').onsubmit=e=>{e.preventDefault();let n=$('#hostName').value.trim();if(n)host(n,code($('#hostCode').value)||rand())};
$('#joinForm').onsubmit=e=>{e.preventDefault();let n=$('#joinName').value.trim(),c=code($('#joinCode').value);if(!n||c.length<4)return error('Enter your name and the room code from your friend.');join(n,c)};

function host(name,c){cleanup();error();if(typeof Peer==='undefined')return error('Multiplayer could not load. Check your internet connection.');isHost=true;myName=name;room=c;myId='p1';world=newWorld(name);status('Creating room…');peer=new Peer(peerId(c));peer.on('open',()=>{status('Room open');openLobby();peer.on('connection',x=>{if(conn&&conn.open){x.close();return}conn=x;wireHost(x)})});peer.on('error',e=>{status('Connection error');error(e.type==='unavailable-id'?'That room code is already in use. Try another.':'Could not create the room. Try again.')})}
function wireHost(c){c.on('open',()=>{world.p2.connected=true;status('Friend connected');send({type:'hello',host:myName});syncLobby()});c.on('data',d=>{if(!d||typeof d!=='object')return;if(d.type==='join'){world.p2.name=String(d.name||'Friend').slice(0,18);world.p2.connected=true;syncLobby()}if(d.type==='ready'){world.p2.ready=!!d.value;syncLobby()}if(d.type==='input')guestInput={...guestInput,...d.value};if(d.type==='rematch'){world.p2.ready=true;syncLobby()}});c.on('close',()=>{status('Friend disconnected');world.p2.connected=false;world.p2.ready=false;updateLobby()})}
function join(name,c){cleanup();error();if(typeof Peer==='undefined')return error('Multiplayer could not load. Check your internet connection.');isHost=false;myName=name;room=c;myId='p2';world=newWorld('Host');world.p2.name=name;status('Connecting…');peer=new Peer();peer.on('open',()=>{conn=peer.connect(peerId(c),{reliable:true});wireGuest(conn)});peer.on('error',()=>{status('Connection error');error('Could not connect. Check the room code and try again.')})}
function wireGuest(c){let t=setTimeout(()=>{if(!c.open)error('Room not found. Ask your friend to keep the host page open.')},7000);c.on('open',()=>{clearTimeout(t);status('Connected');openLobby();send({type:'join',name:myName})});c.on('data',d=>{if(!d||typeof d!=='object')return;if(d.type==='hello')status('Connected to '+d.host);if(d.type==='lobby'){world=d.world;updateLobby()}if(d.type==='count'){show('race');startRender();count(d.value)}if(d.type==='world'){world=d.world;show('race');startRender();updateHud()}if(d.type==='finish'){world=d.world;finish(d.winner)}if(d.type==='back'){world=d.world;finished=false;show('lobby');updateLobby()}});c.on('close',()=>status('Host disconnected'))}

function openLobby(){$('#roomCode').textContent=room;$('#raceCode').textContent=room;show('lobby');updateLobby()}
function row(p,host){return`<div class="player"><span>${esc(p.name)}${host?' <small>(host)</small>':''}</span><span class="${p.ready?'ok':'wait'}">${p.ready?'Ready':'Not ready'}</span></div>`}
function updateLobby(){if(!world)return;$('#players').innerHTML=row(world.p1,true)+row(world.p2,false);$('#ready').textContent=ready?'Ready ✓':"I'm ready";$('#start').hidden=!isHost;if(isHost)$('#start').disabled=!(world.p1.ready&&world.p2.ready&&conn&&conn.open);let me=myId==='p1'?world.p1:world.p2,other=myId==='p1'?world.p2:world.p1;$('#youName').textContent=me.name||myName;$('#friendName').textContent=other.name||'Friend'}
function syncLobby(){updateLobby();send({type:'lobby',world})}
$('#ready').onclick=()=>{ready=!ready;if(isHost){world.p1.ready=ready;syncLobby()}else{world.p2.ready=ready;updateLobby();send({type:'ready',value:ready})}};
$('#start').onclick=()=>{if(isHost&&world.p1.ready&&world.p2.ready&&conn&&conn.open)startRace()};
$('#leave').onclick=home;$('#exitRace').onclick=home;$('#homeBtn').onclick=home;

function resetCars(){Object.assign(world.p1,player(world.p1.name,565,520));Object.assign(world.p2,player(world.p2.name,565,555));world.p1.ready=world.p2.ready=true;world.phase='count';world.winner=null;finished=false}
function startRace(){resetCars();show('race');startRender();let n=3;send({type:'count',value:n});count(n);let timer=setInterval(()=>{n--;if(n){send({type:'count',value:n});count(n)}else{clearInterval(timer);send({type:'count',value:'GO!'});count('GO!');world.phase='race';runHost()}},900)}
function count(v){let e=$('#countdown');e.textContent=v;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),700)}
function runHost(){clearInterval(hostLoop);let last=performance.now(),push=0;hostLoop=setInterval(()=>{if(!world||world.phase!=='race'||finished)return;let now=performance.now(),dt=Math.min(.04,(now-last)/1000);last=now;drive(world.p1,input,dt);drive(world.p2,guestInput,dt);lapCheck(world.p1);lapCheck(world.p2);winnerCheck();push+=dt;if(push>.05){push=0;send({type:'world',world})}updateHud()},16)}
function onRoad(x,y){let o=x>outer.x&&x<outer.x+outer.w&&y>outer.y&&y<outer.y+outer.h,i=x>inner.x&&x<inner.x+inner.w&&y>inner.y&&y<inner.y+inner.h;return o&&!i}
function drive(c,k,dt){if(c.done)return;let ac=k.up?250:k.down?-160:0;c.v+=ac*dt;c.v*=Math.pow(.985,dt*60);c.v=Math.max(-90,Math.min(300,c.v));if(Math.abs(c.v)<1)c.v=0;let turn=(k.left?-1:0)+(k.right?1:0),f=Math.min(1,Math.abs(c.v)/70);c.a+=turn*2.25*f*dt*(c.v>=0?1:-1);let x=c.x,y=c.y;c.x+=Math.cos(c.a)*c.v*dt;c.y+=Math.sin(c.a)*c.v*dt;if(!onRoad(c.x,c.y)){c.x=x;c.y=y;c.v*=-.22}}
function lapCheck(c){if(c.done)return;let z=[c.x<180&&c.y>420,c.x<180&&c.y<170,c.x>820&&c.y<170,c.x>820&&c.y>420];if(c.cp<4&&z[c.cp])c.cp++;if(c.cp===4&&c.x>480&&c.x<620&&c.y>480){c.lap++;c.cp=0;if(c.lap>=TOTAL){c.done=true;c.finish=Date.now()}}}
function progress(c){return c.lap*4+c.cp}
function winnerCheck(){if(!(world.p1.done||world.p2.done))return;finished=true;world.phase='finish';let w=world.p1.done&&world.p2.done?(world.p1.finish<=world.p2.finish?'p1':'p2'):(world.p1.done?'p1':'p2');world.winner=w;send({type:'finish',winner:w,world});finish(w)}

function startRender(){if(raf)return;const loop=()=>{draw();raf=requestAnimationFrame(loop)};loop()}
function stopRender(){cancelAnimationFrame(raf);raf=null}
function draw(){ctx.fillStyle='#10161e';ctx.fillRect(0,0,1000,650);ctx.fillStyle='#303740';ctx.fillRect(outer.x,outer.y,outer.w,outer.h);ctx.fillStyle='#183620';ctx.fillRect(inner.x,inner.y,inner.w,inner.h);ctx.strokeStyle='#808895';ctx.lineWidth=5;ctx.strokeRect(outer.x,outer.y,outer.w,outer.h);ctx.strokeRect(inner.x,inner.y,inner.w,inner.h);ctx.setLineDash([24,20]);ctx.strokeStyle='#5f6876';ctx.lineWidth=3;ctx.strokeRect(165,145,670,360);ctx.setLineDash([]);for(let y=480,n=0;y<590;y+=22,n++){ctx.fillStyle=n%2?'#111':'#fff';ctx.fillRect(500,y,18,22);ctx.fillStyle=n%2?'#fff':'#111';ctx.fillRect(518,y,18,22)}ctx.fillStyle='#fff';ctx.font='700 22px system-ui';ctx.fillText('START / FINISH',440,625);ctx.fillStyle='#d5dae1';ctx.font='700 22px system-ui';ctx.fillText('MIDNIGHT CIRCUIT',392,332);ctx.fillStyle='#9aa4b2';ctx.font='14px system-ui';ctx.fillText('3 LAPS · FIRST TO FINISH WINS',390,358);if(world){car(world.p1,'#ffd23f',myId==='p1');car(world.p2,'#52d3ff',myId==='p2')}}
function car(c,color,me){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.a);ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(-17,-9,40,22);ctx.fillStyle=color;ctx.fillRect(-20,-11,40,22);ctx.fillStyle='#10151c';ctx.fillRect(2,-8,11,16);ctx.fillStyle='#f5f7fb';ctx.fillRect(14,-6,5,12);if(me){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.strokeRect(-24,-15,48,30)}ctx.restore()}
function updateHud(){if(!world)return;let me=myId==='p1'?world.p1:world.p2,op=myId==='p1'?world.p2:world.p1;$('#lap').textContent=Math.min(me.lap,TOTAL)+' / '+TOTAL;$('#speed').textContent=Math.round(Math.abs(me.v)*.62);$('#position').textContent=(progress(me)>=progress(op)?'1':'2')+' / 2';$('#youName').textContent=me.name;$('#friendName').textContent=op.name}
function finish(w){clearInterval(hostLoop);hostLoop=null;stopRender();finished=true;show('finish');let win=w===myId;$('#finishTitle').textContent=win?'You won! 🏁':'Your friend won!';$('#finishText').textContent=win?'You completed all three laps first.':'Close race. Try a rematch and take the lead.'}
$('#rematch').onclick=()=>{if(isHost){ready=true;world.phase='lobby';world.p1.ready=true;world.p2.ready=false;send({type:'back',world});show('lobby');updateLobby();syncLobby()}else{ready=true;send({type:'rematch'});show('lobby');updateLobby()}};

const keys={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'};
function inputSend(){if(!isHost)send({type:'input',value:input})}
addEventListener('keydown',e=>{let k=keys[e.key];if(!k||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;e.preventDefault();input[k]=true;inputSend()});
addEventListener('keyup',e=>{let k=keys[e.key];if(!k)return;e.preventDefault();input[k]=false;inputSend()});
document.querySelectorAll('[data-key]').forEach(b=>{let k=b.dataset.key,on=e=>{e.preventDefault();input[k]=true;inputSend()},off=e=>{e.preventDefault();input[k]=false;inputSend()};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off)});
draw();
})();