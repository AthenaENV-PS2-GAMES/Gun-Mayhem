import {ARENAS} from './arenas.js';
import {WEAPONS,PICKUP_WEAPONS} from './weapons.js';
import {aiInput,createAiState} from './ai.js';
import {GRENADE,createGrenades,throwGrenade,updateGrenades} from './grenades.js';
export const RULES = Object.freeze({hz:35, gravity:0.88, friction:0.93,
    acceleration:0.7, jump:13.5, fireDelay:10, magazine:9, reload:50,
    bulletSpeed:25, recoil:1});

export const ARENA=ARENAS[0];

export const GAME_MODE=Object.freeze({lms:1,oneHit:2,team:3,gunGame:4,survival:5});
export const GUN_GAME_GUNS=Object.freeze([2,2,29,19,46,13,51,50,11,38,33,58,62,66,65,44]);
export const GUN_GAME_FINAL=16;
const ONE_HIT_GUN=9,ONE_HIT_FALLBACK=8,GUN_GAME_LIVES=99999;
const noGrenades=match=>match.mode===GAME_MODE.oneHit || match.mode===GAME_MODE.gunGame;
const noWeaponBoxes=match=>noGrenades(match) || match.mode===GAME_MODE.survival;
const startGrenades=(match,p)=>noGrenades(match)?0:GRENADE.ammo+(p.perk===PERK.nades?2:0);

export function createMatch(seed=12345,arenaIndex=0,startingWeapon=1,settings={}) {
    const count=settings.players?settings.players.length:(settings.playerCount||2);
    const mode=settings.mode===undefined?GAME_MODE.lms:settings.mode;
    if(count<(mode===GAME_MODE.survival?1:2) || count>4)throw new RangeError('A local match needs two to four players (one to four in Duck Survival)');
    if(!Object.values(GAME_MODE).includes(mode))throw new RangeError('Unknown game mode');
    const lives=mode===GAME_MODE.survival?10:(settings.lives===undefined?5:settings.lives);
    if(!Number.isInteger(lives) || lives<1 || lives>(settings.demo?GUN_GAME_LIVES:20))throw new RangeError('Invalid life count');
    const match = {mode,tick:0,seed:seed>>>0,arenaIndex,totalLives:lives,arena:ARENAS[arenaIndex],players:[],
        gravity:ARENAS[arenaIndex].gravity===undefined?RULES.gravity:ARENAS[arenaIndex].gravity,
        bullets:[],bulletTop:0,thrown:[],grenades:createGrenades(),crates:[],
        boxes:(ARENAS[arenaIndex].boxes||[]).map(b=>({x:b.x,y:b.y,weapon:b.weapon,active:settings.crates!==false && !noWeaponBoxes({mode}),alpha:0,timer:0})),
        crateTime:200,events:[],winner:-1,survival:mode===GAME_MODE.survival?{wave:1,killed:5,goal:5,total:0,time:0,announce:true}:null,chest:mode===GAME_MODE.survival && ARENAS[arenaIndex].chest?newChest(ARENAS[arenaIndex].chest):null,
        cratesEnabled:settings.crates!==false,
        campaign:settings.campaign||0,dynamiteEvery:settings.dynamiteEvery||0,dynamiteTime:0,decoyRule:!!settings.decoyRule,aiNoCrates:!!settings.aiNoCrates,
        lockedGuns:settings.lockedGuns&&settings.lockedGuns.length?new Set(settings.lockedGuns):null,
        powerupsEnabled:settings.pickups!==false,powerups:[],powerTime:0,

        stats:{shots:0,hits:0,deaths:0,jumps:0,landings:0,reloads:0,
            grenades:0,explosions:0,grenadeHits:0,grenadeBounces:0,crates:0,pickups:0,powerups:0,
            weaponShots:{1:0,2:0,10:0,54:0}}};
    for(let i=0;i<96;i++) match.bullets.push({active:false,x:0,y:0,px:0,py:0,vx:0,vy:0,
        dir:1,owner:0,power:20,age:0,ttl:0,kind:'normal',delay:0});
    for(let i=0;i<3;i++)match.powerups.push({active:false,x:0,y:0,kind:0,frame:1,picked:false,pickedFrame:0});
    for(let i=0;i<8;i++)match.crates.push({active:false,x:0,y:0,py:0,vy:10,falling:true,frame:1,playing:false});
    for(let i=0;i<count;i++) {
        const config=settings.players?settings.players[i]:{};
        const weapon=config.weaponId||startingWeapon;
        const x=count===2?250+i*400:match.arena.spawnLeft+match.arena.spawnWidth*(i+1)/(count+1);
        const p={id:i,controllerIndex:config.controllerIndex===undefined?i:config.controllerIndex,
            name:config.name||'P'+(i+1),type:config.type||'human',ownerId:i,isDouble:false,team:mode===GAME_MODE.survival?0:(config.team===undefined?i:config.team),dummy:!!config.dummy,unarmed:!!config.unarmed,
            aiType:config.aiType||'standard',ghost:config.aiType==='ghost',jetRecharge:config.aiType==='jetpack',boss:config.aiType==='boss',fakeDouble:-80,
            ammoMul:config.aiType==='boss'?4:(mode===GAME_MODE.survival?2:1),
            speedMul:1,isZombie:false,weightOne:config.aiType==='boss',
            firepower:config.firepower===undefined?1:config.firepower,damage:config.damage===undefined?1:config.damage,
            color:config.color===undefined?(i===0?0:i===1?4:i):config.color,
            shirt:config.shirt||0,hat:config.hat||0,perk:config.perk||0,
            stats:{shots:0,hits:0,kos:0,deaths:0,crates:0,points:0,powerups:0},spawnPending:true,cheapTimer:config.cheapTimer||0,triple:false,greedy:false,
            x,y:-1000,px:x,py:-1000,vx:0,vy:0,
            jumps:1,ground:-1,drop:0,instagib:0,hitnumber:0,hittimer:0,facing:i%2===0?1:-1,lives:mode===GAME_MODE.gunGame?GUN_GAME_LIVES:lives,level:1,ammo:9,
            wait:-10,reload:0,flash:0,hit:0,walk:0,legRot:0,bodyDy:0,headFrame:2+(i*17)%50,idleTime:40,idleMix:0,
            throwIn:0,shield:0,shieldAlpha:0,shieldFrame:1,invisible:0,alpha:100,jetfuel:0,jetOn:false,jumpKey:false,speedTime:0,miniTime:-1,miniMul:1,scale:80,lastHit:-1,active:true,
            weaponId:1,defaultWeapon:config.aiType==='boss'?55:(WEAPONS[weapon].finite?1:weapon),
            grenades:0,grenadeCharge:0};
        p.grenades=startGrenades(match,p);
        if(mode===GAME_MODE.oneHit)p.defaultWeapon=ONE_HIT_FALLBACK;
        if(p.jetRecharge){p.jetfuel=100;p.jetOn=true;}
        equipWeapon(match,p,(mode===GAME_MODE.lms || mode===GAME_MODE.team) && config.perk!==PERK.spawn?weapon:spawnWeapon(match,p),false);
        match.players.push(p);
    }
    return match;
}

export function animateIdle(p) {
    p.headFrame=p.headFrame>=59?2:p.headFrame+1;
    if(p.idleTime<40)p.idleTime++;
    const idle=p.idleTime>=40 && p.weaponId!==55 && p.reload===0;
    p.idleMix+=((idle?1:0)-p.idleMix)/3;
}

export function animateJump(p) {
    const f=p.facing;
    if(p.vy<=-2){p.legRot+=(80*f-p.legRot)/3;p.bodyDy+=(-10-p.bodyDy)/5;}
    else if(p.vy>=2){p.legRot+=(-10*f-p.legRot)/3;p.bodyDy+=(5-p.bodyDy)/5;}
    else{p.legRot+=(-p.legRot)/1.5;p.bodyDy+=(0-p.bodyDy)/2;}
}

function random(match) {
    match.seed=(Math.imul(match.seed,1664525)+1013904223)>>>0;
    return match.seed/4294967296;
}

function emit(match,type,p) { match.events.push({type,player:p.id,x:p.x,y:p.y,facing:p.facing}); }

export const PERK=Object.freeze({speed:1,jump:2,minigun:3,recoil:4,blast:5,ammo:6,nades:7,spawn:8});
const MINIGUN=55;
export const magazineOf=(p,weapon)=>{const base=weapon.magazine*(p.ammoMul||1);return p.perk===PERK.ammo?base+Math.ceil(base*0.333):base;};

export function equipWeapon(match,p,id,notify=true) {
    const weapon=WEAPONS[id];
    if(!weapon)throw new Error('Unknown weapon '+id);
    p.weaponId=id;p.ammo=magazineOf(p,weapon);p.reload=0;p.throwIn=0;
    if(id>=9)p.greedy=true;
    p.wait=id<10?-10:weapon.rof-2;
    if(notify){emit(match,'pickup',p);match.events[match.events.length-1].weapon=id;}
}

function spawnWeapon(match,p) {
    if(match.mode===GAME_MODE.oneHit)return ONE_HIT_GUN;
    if(match.mode===GAME_MODE.gunGame)return GUN_GAME_GUNS[p.level];
    if(p.perk===PERK.spawn)return PICKUP_WEAPONS[Math.floor(random(match)*PICKUP_WEAPONS.length)];
    return p.defaultWeapon;
}
function emptyWeapon(match,p) {
    if(match.mode===GAME_MODE.gunGame){p.level=Math.max(0,p.level-1);return GUN_GAME_GUNS[p.level];}
    return p.defaultWeapon;
}
function upgrade(match,p) {
    p.level++;
    match.events.push({type:'upgrade',player:p.id,level:p.level,x:p.x,y:p.y});
    if(p.level>=GUN_GAME_FINAL) {
        for(const q of match.players)if(q!==p && q.active && !q.isDouble){q.lives=0;q.active=false;}
        return true;
    }
    equipWeapon(match,p,GUN_GAME_GUNS[p.level],false);
    return false;
}

function die(match,p) {
    if(p.isDouble){endDouble(match,p,true);return;}
    if(p.isZombie){zombieGone(match,p);return;}
    p.instagib=0;
    if(match.mode!==GAME_MODE.gunGame)p.lives=Math.max(0,p.lives-1);
    match.stats.deaths++;
    p.stats.deaths++;
    if(match.decoyRule && p.type==='human')for(const d of match.players)if(d.isDouble && d.active)endDouble(match,d,false);
    const killer=(p.lastHit>=0 && p.lastHit!==p.id)?p.lastHit:-1;
    const kind=p.cheapTimer<120?'cheapshot':(p.greedy?'greedy':(p.hitByGrenade?'nade':'kill'));
    const points={cheapshot:200,greedy:300,nade:50,kill:100}[kind];
    if(killer>=0){match.players[killer].stats.kos++;match.players[killer].stats.points+=points;}
    match.events.push({type:'death',player:p.id,x:p.x,y:p.y,
        killer,grenade:!!p.hitByGrenade,kind,points:killer>=0?points:0});
    p.hitByGrenade=false;p.cheapTimer=0;p.greedy=false;
    if(match.mode===GAME_MODE.gunGame && killer>=0 && upgrade(match,match.players[killer])) {p.active=false;return;}
    if(!p.lives) {
        p.active=false;
        return;
    }
    p.x=match.arena.spawnLeft+Math.floor(random(match)*match.arena.spawnWidth);
    p.y=-1000;p.px=p.x;p.py=p.y;p.vx=0;p.vy=0;p.jumps=1;p.ground=-1;p.spawnPending=true;p.legRot=0;p.bodyDy=0;
    p.invisible=0;p.shield=0;p.shieldAlpha=0;p.shieldFrame=1;p.jetfuel=p.jetRecharge?100:0;p.jetOn=!!p.jetRecharge;p.speedTime=0;p.miniTime=-1;p.miniMul=1;p.scale=80;p.alpha=100;
    p.drop=0;p.instagib=0;p.lastHit=-1;p.grenades=startGrenades(match,p);p.grenadeCharge=0;
    if(match.mode===GAME_MODE.survival)p.shield=140;
    const spawnGun=spawnWeapon(match,p);
    equipWeapon(match,p,spawnGun,p.perk===PERK.spawn && (match.mode===GAME_MODE.lms || match.mode===GAME_MODE.team));
}

function throwMagazine(match,p) {
    const weapon=WEAPONS[p.weaponId];
    let t=match.thrown.find(q=>!q.active);
    if(!t){t={};match.thrown.push(t);}
    t.active=true;t.x=t.px=p.x+(weapon.shootX+30)*p.facing;t.y=t.py=p.y-55;t.vx=20*p.facing;t.vy=-6;
    t.rot=0;t.vrot=15*p.facing;t.facing=p.facing;t.owner=p.ownerId;t.hit=false;
    match.events.push({type:'throwMag',player:p.id,x:t.x,y:t.y,facing:p.facing});
}
function updateThrown(match) {
    for(const t of match.thrown) {
        if(!t.active)continue;
        t.px=t.x;t.py=t.y;
        t.x+=t.vx;t.y+=t.vy;t.rot+=t.vrot;t.vy+=match.gravity*1.3;
        if(!t.hit) {
            for(const target of match.players) {
                const k=target.scale/80;
                if(!target.active || Math.abs(t.x-target.x)>20*k || t.y<target.y-56*k || t.y>target.y)continue;
                target.vx+=20*t.facing;target.hitnumber++;target.hittimer=0;
                target.lastHit=t.owner;target.hitByGrenade=false;target.hit=8;
                match.stats.hits++;match.players[t.owner].stats.hits++;
                match.events.push({type:'magHit',player:target.id,x:t.x,y:t.y,vx:t.vx,combo:-6});
                t.vx*=-0.5;t.x+=t.vx;t.hit=true;
                break;
            }
        }
        if(t.y>=900)t.active=false;
    }
}

function shoot(match,p) {
    const weapon=WEAPONS[p.weaponId];
    p.idleTime=0;
    let freeSlots=0;
    for(const b of match.bullets)if(!b.active)freeSlots++;
    if(freeSlots<weapon.pellets)return;
    const fires=weapon.power*p.firepower>3;
    for(let k=0;fires && k<weapon.pellets;k++) {
        let slotIndex=-1;
        for(let q=0;q<match.bullets.length;q++)if(!match.bullets[q].active){slotIndex=q;break;}
        if(slotIndex<0)break;
        const b=match.bullets[slotIndex];
        if(slotIndex+1>match.bulletTop)match.bulletTop=slotIndex+1;
        b.active=true;b.x=p.x+23*p.facing*p.miniMul;b.px=b.x;
        b.y=p.y+(weapon.bulletY===undefined?-38:weapon.bulletY)*p.miniMul;b.dir=p.facing;b.owner=p.ownerId;b.age=0;b.ttl=0;
        b.kind=weapon.projectile||'normal';b.delay=weapon.instaDelay||0;
        b.knock=weapon.id===55?0.3:0.33;
        b.dodge=b.kind==='instagib'?10:(weapon.pellets>1 || weapon.id===55?0:40);
        if(weapon.pellets>1) {
            const angle=((p.facing>0?0:180)+weapon.spreadStart+k*weapon.spread)*Math.PI/180;
            const speed=weapon.pelletSpeedMin+Math.floor(random(match)*(weapon.pelletSpeedMax-weapon.pelletSpeedMin+1));
            b.vx=Math.cos(angle)*speed;b.vy=Math.sin(angle)*speed;
            b.power=weapon.power;b.ttl=weapon.pelletLife;
        } else {
            const jitter=weapon.bulletJitter||6;
            b.y+=random(match)*jitter-jitter/2;b.vx=RULES.bulletSpeed*p.facing;b.vy=0;
            b.power=weapon.power+Math.floor(random(match)*8)-4;
        }
        b.power*=p.firepower;
        b.py=b.y;
    }
    if(p.perk!==PERK.recoil)p.vx-=weapon.recoil*p.facing;p.wait=0;p.ammo--;p.flash=3;
    match.stats.shots++;
    match.players[p.ownerId].stats.shots++;
    match.stats.weaponShots[p.weaponId]=(match.stats.weaponShots[p.weaponId]||0)+1;
    match.events.push({type:'shot',player:p.id,x:p.x,y:p.y,weapon:p.weaponId,facing:p.facing});
    if(!p.ammo) {
        if(weapon.finite) {
            match.events.push({type:'dropgun',player:p.id,x:p.x+20*p.facing,y:p.y-40,facing:p.facing,weapon:p.weaponId});
            equipWeapon(match,p,emptyWeapon(match,p),false);
        }
        else {p.reload=weapon.reloadTicks;emit(match,'reload',p);if(weapon.reloadThrow)p.throwIn=weapon.reloadThrow;}
    }
}

export function spawnCrate(match,x) {
    const crate=match.crates.find(c=>!c.active);
    if(!crate)return null;
    crate.active=true;crate.x=x===undefined?(match.arena.crateLeft+
        random(match)*match.arena.crateWidth):x;
    crate.y=-300;crate.py=-300;crate.vy=10;crate.falling=true;crate.frame=1;crate.playing=false;
    match.stats.crates++;
    return crate;
}

export const BOX={left:-26.45,right:26.55,top:-26.15,bottom:51.85,respawn:400};
function updateBoxes(match) {
    if(!match.cratesEnabled || noWeaponBoxes(match))return;
    for(const box of match.boxes) {
        if(!box.active) {
            if(++box.timer>=BOX.respawn){box.active=true;box.timer=0;box.alpha=0;}
            continue;
        }
        if(box.alpha<100)box.alpha=Math.min(100,box.alpha+5);
        for(const p of match.players) {
            const k=p.scale/80;
            if(p.active && p.x+20*k>box.x+BOX.left && p.x-20*k<box.x+BOX.right &&
                p.y>box.y+BOX.top && p.y-56*k<box.y+BOX.bottom) {
                match.events.push({type:'boxTaken',player:p.id,x:box.x,y:box.y});
                equipWeapon(match,p,box.weapon);
                match.stats.pickups++;match.stats.boxes=(match.stats.boxes||0)+1;match.players[p.ownerId].stats.crates++;
                box.active=false;box.timer=0;
                break;
            }
        }
    }
}

function updateCrates(match) {
    if(!match.cratesEnabled)return;
    if(++match.crateTime>=400){spawnCrate(match);match.crateTime=0;}
    for(const c of match.crates) {
        if(!c.active)continue;
        c.py=c.y;
        if(c.falling) {
            c.vy=Math.min(18,c.vy+1);c.y+=c.vy;
            for(const floor of match.arena.platforms) {
                if(c.x>=floor.x && c.x<=floor.x+floor.w && c.py<=floor.y && c.y>=floor.y) {
                    c.y=floor.y;c.falling=false;break;
                }
            }
            if(c.y>1000){c.active=false;continue;}
        }
        if(!c.falling){if(c.playing)c.frame=c.frame===55?15:c.frame+1;else c.playing=true;}
        for(const p of match.players) {
            if(match.aiNoCrates && p.type==='cpu')continue;
            if(p.isZombie)continue;
            const k=p.scale/80;
            if(p.active && p.x+20*k>c.x-25 && p.x-20*k<c.x+29 && p.y>c.y-37 && p.y-56*k<c.y+5) {
                match.events.push({type:'crateTaken',player:p.id,x:c.x,y:c.y});
                let id;
                do id=PICKUP_WEAPONS[Math.floor(random(match)*PICKUP_WEAPONS.length)];
                while(match.lockedGuns && match.lockedGuns.has(id));
                if(p.perk===PERK.minigun && random(match)*3<1)id=MINIGUN;
                if(match.mode===GAME_MODE.oneHit)id=ONE_HIT_GUN;
                if(id===26 && p.type==='cpu')id=MINIGUN;
                equipWeapon(match,p,id);
                match.stats.pickups++;match.players[p.ownerId].stats.crates++;c.active=false;break;
            }
        }
    }
}

export const POWER=Object.freeze({life:0,invisible:1,shield:2,jetpack:3,double:4,speed:5,mini:6});
export const POWER_NAMES=Object.freeze(['LIFE UP','INVISIBILITY','SHIELD','JET PACK','DOUBLE TEAM','SPEED BOOST','MINIMIZE']);

export function spawnPowerup(match,kind) {
    let o=match.powerups.find(q=>!q.active);
    if(!o){o={};match.powerups.push(o);}
    const floors=match.arena.platforms;
    const f=floors[Math.floor(random(match)*floors.length)];
    o.active=true;o.x=f.x+20+random(match)*Math.max(1,f.w-40);o.y=f.y-40;
    o.kind=kind===undefined?Math.floor(random(match)*7):kind;
    if(o.kind===POWER.double && (match.campaign || match.players.some(p=>p.isDouble && p.active)))o.kind=POWER.shield;
    o.frame=1;o.picked=false;o.pickedFrame=0;
    return o;
}

function takePowerup(match,o,p) {
    o.picked=true;o.pickedFrame=0;
    match.events.push({type:'powerup',kind:o.kind,x:o.x,y:o.y,player:p.id});
    match.stats.powerups++;p.stats.powerups++;
    switch(o.kind) {
        case POWER.life:p.lives++;match.events.push({type:'lifeup',player:p.id,x:p.x,y:p.y});break;
        case POWER.invisible:p.invisible=200;break;
        case POWER.shield:p.shield=300;break;
        case POWER.jetpack:p.jetfuel=100;p.jetOn=true;break;
        case POWER.double:spawnDouble(match,p);break;
        case POWER.speed:p.speedTime=300;break;
        case POWER.mini:p.miniTime=400;break;
    }
}

function updatePowerups(match) {
    if(!match.powerupsEnabled)return;
    if(++match.powerTime>=600){spawnPowerup(match);match.powerTime=0;}
    for(const o of match.powerups) {
        if(!o.active)continue;
        if(o.picked){if(++o.pickedFrame>=41)o.active=false;continue;}
        o.frame=o.frame>=98?20:o.frame+1;
        if(o.frame<20)continue;
        for(const p of match.players) {
            if(!p.active || p.spawnPending || p.isDouble)continue;
            const k=p.scale/80;
            if(Math.abs(p.x-o.x)<=20*k+16 && p.y>o.y-16 && p.y-56*k<o.y+16){takePowerup(match,o,p);break;}
        }
    }
}

function animatePower(match,p) {
    if(match.decoyRule) {
        if(p.isDouble){
            if(p.lastHit>=0){endDouble(match,p,false);return;}
            p.alpha=20+Math.floor(random(match)*30);
        }
        else if(p.aiType==='decoy' && p.active && !match.players.some(q=>q.isDouble && q.active) && ++p.fakeDouble>=35){p.fakeDouble=-120;spawnDouble(match,p);}
    } else if(p.isDouble && --p.doubleTime<=30){endDouble(match,p,false);return;}
    if(p.ghost)p.invisible=p.lastHit<0?10:0;
    if(p.isDouble && match.decoyRule){}
    else if(p.invisible>0){p.invisible--;p.alpha=Math.max(0,p.alpha-10);}
    else if(p.alpha<100)p.alpha=Math.min(100,p.alpha+10);
    if(p.shield>0){p.shield--;p.shieldAlpha=100;p.shieldFrame=p.shieldFrame>=30?22:p.shieldFrame+1;}
    else {p.shieldAlpha=Math.max(0,p.shieldAlpha-10);if(!p.shieldAlpha)p.shieldFrame=1;}
    if(p.speedTime>0){p.speedTime--;if(p.speedTime%2===0)emit(match,'speedTrail',p);}
    if(p.jetRecharge){if(p.jetfuel<100)p.jetfuel+=0.15;}
    else if(p.jetfuel>0){p.jetfuel-=0.12;}
    if(!p.jetRecharge && p.jetOn && p.jetfuel<=0){p.jetOn=false;p.jetfuel=0;emit(match,'droppack',p);}
    if(p.miniTime>=0) {
        p.miniTime--;
        if(p.miniTime>260){p.miniMul+=(.6-p.miniMul)/6;p.scale+=(50-p.scale)/3;}
        if(p.miniTime===260){p.miniMul=.6;p.scale=50;}
        if(p.miniTime<=40){p.miniMul+=(1-p.miniMul)/6;p.scale+=(80-p.scale)/3;}
    } else {p.miniMul=1;p.scale=80;}
}

function endDouble(match,p,killed) {
    p.active=false;
    match.events.push({type:'doubleEnd',player:p.id,x:p.x,y:p.y,killed});
}

function spawnDouble(match,owner) {
    let d=match.players.find(p=>p.isDouble);
    const id=d?d.id:match.players.length;
    if(!d){d={};match.players.push(d);}
    Object.assign(d,owner);
    d.id=id;d.ownerId=owner.id;d.team=owner.team;d.dummy=false;d.unarmed=false;d.firepower=1;d.damage=1;d.ai=null;d.aiType='standard';d.ghost=false;d.jetRecharge=false;d.boss=false;d.ammoMul=1;d.weightOne=false;d.fakeDouble=-80;d.isDouble=true;d.type='cpu';d.name='x2';d.lives=1;d.perk=0;
    d.stats={shots:0,hits:0,kos:0,deaths:0,crates:0,points:0,powerups:0};
    d.botInput=null;d.px=d.x;d.py=d.y;d.vx=0;d.vy=0;d.lastHit=-1;d.hit=0;d.instagib=0;d.reload=0;d.doubleTime=600;d.active=true;
    d.grenades=startGrenades(match,d);d.grenadeCharge=0;d.jumpKey=false;d.spawnPending=false;
    d.invisible=0;d.shield=0;d.shieldAlpha=0;d.shieldFrame=1;d.jetfuel=0;d.jetOn=false;d.speedTime=0;d.miniTime=-1;d.miniMul=1;d.scale=80;d.alpha=100;
    d.facing=owner.facing;d.headFrame=2+(d.id*17)%50;
    equipWeapon(match,d,owner.defaultWeapon,false);
    match.events.push({type:'doubleSpawn',player:d.id,x:d.x,y:d.y});
}

function zombieLevelUp(match) {
    const s=match.survival;
    s.wave++;s.killed=s.goal=s.wave*5;
    match.events.push({type:'waveUp',wave:s.wave});
}
function spawnZombie(match) {
    const s=match.survival;
    let z=match.players.find(q=>q.isZombie && !q.active);
    if(!z){z={};match.players.push(z);}
    const id=z.id!==undefined?z.id:match.players.length-1;
    Object.assign(z,match.players[0]);
    z.id=id;z.ownerId=id;z.name='zombie';z.type='cpu';z.isZombie=true;z.isDouble=false;z.team=1;z.aiType='zombie';z.unarmed=true;z.dummy=false;
    z.lives=1;z.perk=0;z.firepower=1;z.damage=Math.max(0.05,2-s.wave*0.05);z.speedMul=0.3+s.wave*0.066;z.weightOne=true;z.ammoMul=1;
    z.ghost=false;z.jetRecharge=false;z.boss=false;z.ai=null;z.botInput=null;
    z.stats={shots:0,hits:0,kos:0,deaths:0,crates:0,points:0,powerups:0};
    z.x=z.px=match.arena.crateLeft+Math.floor(random(match)*match.arena.crateWidth);z.y=z.py=-300;z.vx=z.vy=0;
    z.jumps=1;z.ground=-1;z.drop=0;z.instagib=0;z.lastHit=-1;z.hit=0;z.spawnPending=false;z.facing=1;
    z.shield=0;z.shieldAlpha=0;z.shieldFrame=1;z.invisible=0;z.alpha=100;z.jetfuel=0;z.jetOn=false;z.speedTime=0;z.miniTime=-1;z.miniMul=1;z.scale=80;
    z.grenades=0;z.grenadeCharge=0;z.reload=0;z.throwIn=0;z.legRot=0;z.bodyDy=0;z.triple=false;z.hitByGrenade=false;z.greedy=false;z.cheapTimer=0;
    z.active=true;
    equipWeapon(match,z,1,false);
    match.events.push({type:'duckSpawn',player:z.id,x:z.x,y:z.y});
    return z;
}
function zombieGone(match,z) {
    z.active=false;z.instagib=0;
    match.survival.killed--;match.survival.total++;
}
function updateSurvival(match) {
    const s=match.survival;
    if(s.announce){s.announce=false;match.events.push({type:'waveUp',wave:s.wave});}
    s.time++;
    const gap=60-s.wave*2;
    if(s.time>=gap && s.goal>0) {
        let alive=0;
        for(const q of match.players)if(q.active)alive++;
        if(alive<5+s.wave){s.goal--;spawnZombie(match);}
        s.time=0;
    } else if(s.time>=gap && s.killed<=0)zombieLevelUp(match);
    for(const z of match.players) {
        if(!z.isZombie || !z.active)continue;
        for(const h of match.players) {
            if(h.isZombie || !h.active || h.isDouble)continue;
            const k=h.scale/80,py=z.y-15;
            if(Math.abs(z.x-h.x)>20*k || py<h.y-56*k || py>h.y)continue;
            if(h.shield<=0) {
                const dx=h.x-z.x,dy=h.y-30-z.y,d=Math.round(Math.sqrt(dx*dx+dy*dy)),a=Math.atan2(dy,dx);
                h.vx+=Math.cos(a)*(350-d)/10;h.vy+=Math.sin(a)*(350-d)/20;
                h.lives--;
                match.events.push({type:'duckBite',player:h.id,x:z.x,y:z.y});
                if(h.lives<=0){h.lives=1;h.lastHit=-1;die(match,h);}
            }
            match.events.push({type:'duckBoom',player:z.id,x:z.x,y:z.y});
            zombieGone(match,z);
            break;
        }
    }
}

function newChest(c) {
    return {x:c.x,y:c.y,frame:2,swapTime:0,swapTotal:0,display:0,randgun:-1,slot:false,taker:-1};
}
export const CHEST={halfWidth:77,top:-60,bottom:11,takeFrom:73,closeAt:160,last:186};
function overChest(match,p) {
    const c=match.chest;
    return !!c && !p.isZombie && Math.abs(p.x-c.x)<=CHEST.halfWidth && p.y-15>=c.y+CHEST.top && p.y-15<=c.y+CHEST.bottom;
}
function updateChest(match,inputs) {
    const c=match.chest;
    if(!c)return;
    let holder=null;
    for(let i=0;i<match.players.length;i++) {
        const p=match.players[i],input=inputs[i]||NO_INPUT;
        if(p.active && p.type==='human' && !p.isZombie && input.downHeld && overChest(match,p)){holder=p;break;}
    }
    if(holder) {
        if(c.frame===2){c.frame=3;c.taker=holder.id;match.events.push({type:'chestOpen',x:c.x,y:c.y});}
        if(c.randgun>0 && c.frame>CHEST.takeFrom && c.frame<CHEST.closeAt) {
            equipWeapon(match,holder,c.randgun);
            match.events.push({type:'chestTake',player:holder.id,x:c.x,y:c.y});
            c.randgun=-1;c.slot=false;c.frame=CHEST.closeAt;
        }
    }
    if(c.frame===2)return;
    if(c.frame===12){c.slot=true;c.swapTime=0;c.swapTotal=2;c.randgun=-1;}
    if(c.slot) {
        c.swapTime++;
        if(c.swapTime>=c.swapTotal) {
            if(c.swapTotal>=10){c.randgun=c.display;c.slot=false;}
            else{c.display=PICKUP_WEAPONS[Math.floor(random(match)*PICKUP_WEAPONS.length)];c.randgun=-c.display;}
            c.swapTime=0;c.swapTotal*=1.25;
        }
    }
    if(++c.frame>CHEST.last){c.frame=2;c.randgun=-1;c.slot=false;c.display=0;}
}

const NO_INPUT=Object.freeze({});

export function stepMatch(match,inputs) {
    match.events.length=0;
    if(match.winner!==-1) return;
    match.tick++;
    const mark=match.mark;
    const players=match.players,platforms=match.arena.platforms;
    for(let i=0;i<players.length;i++) {
        const p=players[i], input=inputs[i]||NO_INPUT;
        if(!p.active) continue;
        if(p.instagib>0 && --p.instagib===0) {emit(match,'instaDeath',p);die(match,p);continue;}
        p.px=p.x;p.py=p.y;
        p.x+=p.vx;p.y+=p.vy;
        if(p.y>=-80)p.spawnPending=false;
        if(p.hittimer<=40)p.hittimer++;
        if(p.hittimer>40)p.hitnumber=0;
        if(p.flash>0)p.flash--;
        if(p.hit>0)p.hit--;
        if(p.cheapTimer<120)p.cheapTimer++;
        if(p.drop>0)p.drop--;
        const oldGround=p.ground;
        p.ground=-1;
        if(!p.drop && p.vy>=0) {
            for(let j=0;j<platforms.length;j++) {
                const floor=platforms[j];
                if(p.x>=floor.x && p.x<=floor.x+floor.w && p.py<=floor.y+0.1 && p.y>=floor.y) {
                    const impact=Math.abs(p.vy);
                    p.y=floor.y;p.vy=0;p.jumps=2;p.ground=j;p.triple=p.perk===PERK.jump;
                    if(Math.abs(p.vx)<3){p.greedy=false;p.lastHit=-1;p.hitByGrenade=false;}
                    if(oldGround<0){match.stats.landings++;emit(match,'land',p);match.events[match.events.length-1].impact=impact;}
                    break;
                }
            }
        }
        if(p.ground<0 && p.jumps===2)p.jumps=1;
        if(p.y>1000 || p.x< -600 || p.x>1500) {die(match,p);continue;}
        if(input.ai)aiInput(match,p,input);
        if(input.down && p.ground>=0 && !platforms[p.ground].bottom && !overChest(match,p)) {
            p.drop=7;p.vy+=1;p.y+=5;p.jumps=1;p.ground=-1;
        }
        if(input.jump && p.jumps>0) {
            const fromGround=oldGround>=0 || p.ground>=0;
            p.jumps--;p.jumpKey=true;
            if(p.jumps===10) {
                p.jumps=0;p.vy=p.vy<-4?p.vy-RULES.jump*0.2:-RULES.jump*0.55;
            } else {
                p.vy=-RULES.jump*(p.jumps===1?1:0.83);
                if(p.jumps===0 && p.triple){p.jumps=11;p.triple=false;}
            }
            p.y-=1;p.ground=-1;
            match.stats.jumps++;emit(match,'jump',p);match.events[match.events.length-1].fromGround=fromGround;
        }
        if(!input.jumpHeld)p.jumpKey=false;
        if(input.jumpHeld && p.jumps<=0 && p.jetfuel>0 && !p.jumpKey) {
            p.vy+=(-15-p.vy)/4;p.jetfuel-=p.jetRecharge?8:1.5;emit(match,'jet',p);
        }
        const weapon=WEAPONS[p.weaponId];
        if(input.move) {
            const facing=input.move>0?1:-1;
            if(facing!==p.facing)p.legRot=-p.legRot;
            p.facing=facing;
            p.vx+=input.move*RULES.acceleration*(p.speedMul||1)*(p.speedTime>0?2:1)*(p.perk===PERK.speed || p.weightOne?1:weapon.weight)/(p.jumps===2?1:1.1);
        }
        if(input.grenade && p.grenades>0) {
            if(!p.grenadeCharge)p.grenadeCharge=GRENADE.minCharge;
            p.grenadeCharge=Math.min(GRENADE.maxCharge,p.grenadeCharge+GRENADE.chargeStep);
        } else if(p.grenadeCharge>0) {
            throwGrenade(match,p,p.grenadeCharge);p.grenadeCharge=0;
        }
        if(p.wait<weapon.rof)p.wait++;
        if(p.throwIn>0 && --p.throwIn===0 && p.reload>0)throwMagazine(match,p);
        if(p.reload>0 && --p.reload===0) {
            p.ammo=magazineOf(p,weapon);match.stats.reloads++;emit(match,'loaded',p);
        }
        if(input.fire && !p.unarmed && p.wait>=weapon.rof && p.reload===0 && p.ammo>0)shoot(match,p);
        p.vx*=RULES.friction;
        p.vy=Math.max(-30,Math.min(30,p.vy));
        if(p.vy<24)p.vy+=match.gravity;
        if(Math.abs(p.vx)<=0.1)p.vx=0;
        p.walk+=Math.abs(p.vx)*0.04;
        animateJump(p);
        animateIdle(p);
        animatePower(match,p);
    }
    if(match.survival){updateSurvival(match);updateChest(match,inputs);}
    if(mark)mark('sim.players');
    const bullets=match.bullets;
    let top=0;
    for(let i=0;i<match.bulletTop;i++) {
        const b=bullets[i];
        if(!b.active)continue;
        top=i+1;
        b.px=b.x;b.py=b.y;b.x+=b.vx;b.y+=b.vy;b.age++;
        const bx=b.x,by=b.y;
        if(bx< -600 || bx>1500){b.active=false;continue;}
        for(let t=0;t<players.length;t++) {
            const target=players[t],dx=bx-target.x,k=target.scale/80;
            if(dx<=20*k && dx>=-20*k && target.ownerId!==b.owner && target.team!==players[b.owner].team && target.active && by>=target.y-56*k && by<=target.y) {
                target.vx+=b.power*b.dir*(target.shield>0 && b.kind!=='instagib'?b.knock:target.damage);target.hit=8;target.lastHit=b.owner;b.active=false;
                if(target.shield>0 && b.kind!=='instagib')target.shieldFrame=23;
                if(b.kind==='instagib' && !target.instagib){target.instagib=b.delay;emit(match,'instagib',target);}
                target.hitnumber++;target.hittimer=0;target.hitByGrenade=false;
                match.stats.hits++;players[b.owner].stats.hits++;
                match.events.push({type:'hit',player:target.id,x:target.x,y:target.y,bx:bx,by:by,dir:b.dir,
                    combo:b.power>=40?-1:target.hitnumber});
                break;
            }
        }
        if(b.active && b.dodge) {
            const ex=[bx+b.vx*4,bx+b.vx*6];
            for(let t=0;t<players.length;t++) {
                const target=players[t],k=target.scale/80;
                if(target.type!=='cpu' || !target.active || target.ownerId===b.owner || target.team===players[b.owner].team)continue;
                if(by<target.y-56*k || by>target.y)continue;
                if(Math.abs(ex[0]-target.x)>20*k && Math.abs(ex[1]-target.x)>20*k)continue;
                const st=target.ai||(target.ai=createAiState());
                if(target.jumps===2)st.forceUp=true;
                if(b.power>=b.dodge && target.vy>-8 && target.jumps===1)st.forceUp=true;
            }
        }
        if(b.ttl && b.age>b.ttl)b.active=false;
    }
    match.bulletTop=top;
    updateThrown(match);
    if(mark)mark('sim.bullets');
    updateCrates(match);
    updateBoxes(match);
    updatePowerups(match);
    if(mark)mark('sim.crates');
    if(match.dynamiteEvery && ++match.dynamiteTime>=match.dynamiteEvery) {
        match.dynamiteTime=0;
        const g=match.grenades.find(item=>!item.active && item.explosion===0);
        if(g) {
            g.active=true;g.explosion=0;g.x=g.px=match.arena.crateLeft+random(match)*match.arena.crateWidth;g.y=g.py=-200;
            g.vx=0;g.vy=0;g.rotation=0;g.spin=(5+random(match)*10)*(random(match)<.5?-1:1);g.age=0;g.owner=-1;g.hitground=false;
            match.events.push({type:'throw',player:-1,x:g.x,y:g.y});
        }
    }
    updateGrenades(match);
    if(mark)mark('sim.grenades');
    if(match.mode===GAME_MODE.survival) {
        if(!players.some(q=>q.active && !q.isZombie))match.winner=-2;
        return;
    }
    let alive=0,last=null,sameTeam=true;
    for(let i=0;i<players.length;i++)if(players[i].active && (!players[i].isDouble || match.decoyRule)){
        if(last && last.team!==players[i].team)sameTeam=false;
        alive++;last=players[i];}
    if(alive>0 && sameTeam)match.winner=last.id;
    else if(alive===0)match.winner=-2;
}

const IDLE_BOT=Object.freeze({move:0,jump:false,down:false,fire:false,grenade:false});
export function botInput(match,id) {
    const p=match.players[id];
    const out=p.botInput||(p.botInput={ai:true,move:0,jump:false,jumpHeld:false,down:false,fire:false,grenade:false,forceGrenade:false});
    out.move=0;out.jump=false;out.jumpHeld=false;out.down=false;out.fire=false;out.grenade=false;
    return out;
}
