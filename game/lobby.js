export const SLOT_TYPES=Object.freeze(['human','cpu','off']);
const APPEARANCE_FIELDS=Object.freeze(['color','shirt','hat','weapon','perk']);

function integer(value,label,min,max) {
    if(!Number.isInteger(value) || value<min || value>max)
        throw new RangeError(label+' must be an integer in '+min+'..'+max);
    return value;
}

function slotAt(lobby,index) {
    integer(index,'controller index',0,lobby.slots.length-1);
    return lobby.slots[index];
}

function invalidate(lobby) {
    for(const slot of lobby.slots)slot.ready=slot.type==='cpu';
}

function wrap(value,count) {return ((value%count)+count)%count;}

export function createLobby(options={}) {
    const colorCount=integer(options.colorCount===undefined?6:options.colorCount,'color count',1,256);
    const shirtCount=integer(options.shirtCount===undefined?1:options.shirtCount,'shirt count',1,256);
    const hatCount=integer(options.hatCount===undefined?1:options.hatCount,'hat count',1,256);
    const arenaCount=integer(options.arenaCount===undefined?2:options.arenaCount,'arena count',1,256);
    const weaponIds=(options.weaponIds || [1,2,10,54]).slice();
    if(!weaponIds.length || weaponIds.some(id=>!Number.isInteger(id) || id<1))
        throw new RangeError('weaponIds must contain positive integer weapon IDs');
    const lobby={screen:'lobby',focus:0,arenaIndex:0,lives:5,crates:true,pickups:true,
        choices:{color:colorCount,shirt:shirtCount,hat:hatCount,weapon:weaponIds.length,perk:9,
            arena:arenaCount,weaponIds},slots:[]};
    for(let i=0;i<4;i++)lobby.slots.push({controllerIndex:i,name:'PLAYER '+(i+1),
        type:i<2?'human':'off',joined:i===0,ready:false,
        color:i%colorCount,shirt:0,hat:0,weapon:0,perk:0,team:i%2});
    return lobby;
}

export function joinPlayer(lobby,index) {
    const slot=slotAt(lobby,index);
    if(slot.type==='human' && slot.joined)return false;
    slot.type='human';slot.joined=true;slot.ready=false;
    return true;
}

export function leavePlayer(lobby,index) {
    return setSlotType(lobby,index,'off');
}

export function disconnectPlayer(lobby,index) {
    const slot=slotAt(lobby,index);
    if(slot.type!=='human')return false;
    const changed=slot.joined || slot.ready;
    slot.joined=false;slot.ready=false;
    return changed;
}

export function setSlotType(lobby,index,type) {
    if(!SLOT_TYPES.includes(type))throw new TypeError('Unknown slot type '+type);
    const slot=slotAt(lobby,index);
    if(slot.type===type)return false;
    slot.type=type;
    slot.joined=type==='cpu';slot.ready=type==='cpu';
    invalidate(lobby);
    return true;
}

export function setReady(lobby,index,ready=true) {
    const slot=slotAt(lobby,index);
    if(slot.type==='off')return false;
    const value=slot.type==='cpu'?true:slot.joined && !!ready;
    if(slot.ready===value)return false;
    slot.ready=value;
    return true;
}

export function startBlockers(lobby,options={}) {
    const blockers=[];
    const active=lobby.slots.filter(slot=>slot.type!=='off');
    if(active.length<(options.solo?1:2))blockers.push({reason:'minimum-players',player:null});
    for(const slot of active) {
        if(slot.type!=='human')continue;
        if(!slot.joined)blockers.push({reason:'join-required',player:slot.controllerIndex});
        else if(!slot.ready)blockers.push({reason:'ready-required',player:slot.controllerIndex});
    }
    if(options.teams && active.length>=2 && active.every(slot=>slot.team===active[0].team))blockers.push({reason:'one-team',player:null});
    return blockers;
}

export function canStart(lobby,options) {return startBlockers(lobby,options).length===0;}

export function toggleTeam(lobby,index) {
    const slot=slotAt(lobby,index);
    if(slot.type==='off')return false;
    slot.team=1-slot.team;slot.ready=slot.type==='cpu';
    return true;
}

export function setSetting(lobby,field,value) {
    if(field==='arenaIndex')integer(value,'arena index',0,lobby.choices.arena-1);
    else if(field==='lives')integer(value,'lives',1,99);
    else if(field==='crates' || field==='pickups') {
        if(typeof value!=='boolean')throw new TypeError(field+' must be boolean');
    } else throw new TypeError('Unknown match setting '+field);
    if(lobby[field]===value)return false;
    lobby[field]=value;invalidate(lobby);
    return true;
}

export function cycleAppearance(lobby,index,field,delta,count) {
    if(!APPEARANCE_FIELDS.includes(field))throw new TypeError('Unknown selection '+field);
    integer(delta,'selection delta',-256,256);
    const slot=slotAt(lobby,index);
    if(slot.type==='off')return false;
    count=count===undefined?lobby.choices[field]:count;
    integer(count,'choice count',1,256);
    const value=wrap(slot[field]+delta,count);
    if(value===slot[field])return false;
    slot[field]=value;
    slot.ready=slot.type==='cpu';
    return true;
}

export function matchOptions(lobby) {
    const players=lobby.slots.filter(slot=>slot.type!=='off').map(slot=>({
        controllerIndex:slot.controllerIndex,type:slot.type,name:slot.name,
        color:slot.color,shirt:slot.shirt,hat:slot.hat,perk:slot.perk,
        weaponId:lobby.choices.weaponIds[slot.weapon],team:slot.team
    }));
    return {arenaIndex:lobby.arenaIndex,playerCount:players.length,lives:lobby.lives,
        crates:lobby.crates,pickups:lobby.pickups,players};
}
