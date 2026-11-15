import {WEAPONS} from './weapons.js';
import {unlocksOf,LEVEL_COUNT} from './campaign.js';

export const CLASSES=Object.freeze([
    {id:'smg',title:'SMGs'},{id:'sniper',title:'SNIPERS'},{id:'shotgun',title:'SHOTGUNS'},{id:'rifle',title:'RIFLES / LMGs'},
    {id:'special',title:'SPECIAL'},{id:'hand',title:'HANDGUNS'}]);
export const STAT_LABELS=Object.freeze(['Damage','Rate of Fire','Ammo Capacity','Weight','Recoil']);
export const TILE=44,PITCH=50;

export function classOf(weapon) {
    if(weapon.id===8 || weapon.id===9)return null;
    if(weapon.id<10)return 'hand';
    if(weapon.id===55)return 'special';
    if(/SMG/.test(weapon.name))return 'smg';
    if(/SNIPER/.test(weapon.name))return 'sniper';
    if(weapon.pellets>1)return 'shotgun';
    return 'rifle';
}

export function buildLayout() {
    const byClass={};
    for(const w of Object.values(WEAPONS)) {
        const c=classOf(w);
        if(c)(byClass[c]??=[]).push(w.id);
    }
    const tiles=[],titles=[];
    const place=(ids,x0,y0,cls)=>ids.sort((a,b)=>a-b).forEach((id,k)=>tiles.push({id,cls,x:x0+(k%3)*PITCH,y:y0+((k/3)|0)*PITCH}));
    ['smg','sniper','shotgun','rifle'].forEach((c,i)=>{
        const x=28+158*i;
        titles.push({text:CLASSES.find(q=>q.id===c).title,x,y:104});
        place(byClass[c],x,135,c);
    });
    titles.push({text:'SPECIAL',x:28,y:386});
    place(byClass.special,28,414,'special');
    titles.push({text:'HANDGUNS',x:200,y:386});
    byClass.hand.sort((a,b)=>a-b).forEach((id,k)=>tiles.push({id,cls:'hand',x:200+k*PITCH,y:414}));
    return {tiles,titles,button:{x:670,y:446,w:210,h:56}};
}

const centre=(layout,i)=>i<layout.tiles.length?{x:layout.tiles[i].x+TILE/2,y:layout.tiles[i].y+TILE/2}
    :{x:layout.button.x+layout.button.w/2,y:layout.button.y+layout.button.h/2};
export function moveCursor(layout,index,dir) {
    const from=centre(layout,index),n=layout.tiles.length+1;
    let best=index,bestScore=Infinity;
    for(let i=0;i<n;i++) {
        if(i===index)continue;
        const c=centre(layout,i),dx=c.x-from.x,dy=c.y-from.y;
        const along=dir==='left'?-dx:dir==='right'?dx:dir==='up'?-dy:dy;
        const across=dir==='left' || dir==='right'?Math.abs(dy):Math.abs(dx);
        if(along<=1 || across>along*2+30)continue;
        const score=along+3*across;
        if(score<bestScore){bestScore=score;best=i;}
    }
    return best;
}

export function unlockLevelOf(id) {
    for(let n=1;n<=LEVEL_COUNT;n++)if(unlocksOf(n).includes(id))return n;
    return 0;
}
export function statBars(stats,id) {
    const bars=stats.bars[String(id)];
    return bars && bars.length?bars.map(v=>Math.max(0,Math.min(1,v/stats.max))):null;
}
