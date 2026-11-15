

export const ACTIONS=Object.freeze(['jump','left','right','down','shoot','bomb']);
export const ACTION_LABELS=Object.freeze({jump:'JUMP',left:'LEFT',right:'RIGHT',down:'DOWN',shoot:'SHOOT',bomb:'BOMB'});

export const BUTTONS=Object.freeze(['CROSS','CIRCLE','SQUARE','TRIANGLE','L1','R1','L2','R2','UP','DOWN','LEFT','RIGHT']);
export const BUTTON_LABELS=Object.freeze({CROSS:'X',CIRCLE:'O',SQUARE:'SQUARE',TRIANGLE:'TRIANGLE',L1:'L1',R1:'R1',L2:'L2',R2:'R2',UP:'UP',DOWN:'DOWN',LEFT:'LEFT',RIGHT:'RIGHT'});
export const OPTIONS_VERSION=1;
export const OPTIONS_FILE='mc0:/GM2LOBBY/options.json';


export const DEFAULT_BINDINGS=Object.freeze({jump:['CROSS','UP'],left:['LEFT'],right:['RIGHT'],down:['DOWN'],shoot:['SQUARE','R1'],bomb:['R2']});

export const defaultBindings=()=>Object.fromEntries(ACTIONS.map(a=>[a,DEFAULT_BINDINGS[a].slice()]));
export function createOptions() {
    return {music:true,sfx:true,binds:[0,1,2,3].map(defaultBindings)};
}

export const bindingText=buttons=>buttons.map(b=>BUTTON_LABELS[b]).join(' / ');


export function ownerOf(options,pad,button) {
    for(const action of ACTIONS)if(options.binds[pad][action].includes(button))return action;
    return null;
}

export function setBinding(options,pad,action,button) {
    if(!BUTTONS.includes(button) || !ACTIONS.includes(action) || !options.binds[pad])return false;
    const owner=ownerOf(options,pad,button);
    if(owner && owner!==action)return false;
    options.binds[pad][action]=[button];
    return true;
}
export function resetBindings(options,pad) {options.binds[pad]=defaultBindings();}

export function snapshotOptions(options) {
    return {version:OPTIONS_VERSION,music:options.music,sfx:options.sfx,binds:options.binds.map(b=>Object.fromEntries(ACTIONS.map(a=>[a,b[a].slice()])))};
}

export function applyOptions(options,data) {
    if(!data || data.version!==OPTIONS_VERSION)return false;
    if(typeof data.music==='boolean')options.music=data.music;
    if(typeof data.sfx==='boolean')options.sfx=data.sfx;
    if(Array.isArray(data.binds)) {
        data.binds.slice(0,4).forEach((saved,pad)=>{
            if(!saved || typeof saved!=='object')return;
            const used=new Set(),next={};
            for(const action of ACTIONS) {
                const list=saved[action];
                if(!Array.isArray(list) || !list.length || list.length>2 || !list.every(b=>BUTTONS.includes(b)))return;
                for(const b of list){if(used.has(b))return;used.add(b);}
                next[action]=list.slice();
            }
            options.binds[pad]=next;
        });
    }
    return true;
}
