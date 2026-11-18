import * as std from 'std';

import {
    RULES,
    createMatch,
    stepMatch,
    botInput,
    spawnPowerup,
    POWER,
    POWER_NAMES,
    animateIdle,
    animateJump
} from './simulation.js';

import {ARENAS} from './arenas.js';
import {WEAPONS, WEAPON_SOUNDS, LOADOUT_IDS} from './weapons.js';
import {GRENADE} from './grenades.js';
import {COLORS, SHIRTS, HATS} from './cosmetics.js';
import {createCamera, resetCamera, updateCamera} from './camera.js';

import {
    createLobby,
    joinPlayer,
    leavePlayer,
    disconnectPlayer,
    setReady,
    setSlotType,
    canStart,
    startBlockers,
    toggleTeam,
    setSetting,
    cycleAppearance,
    matchOptions
} from './lobby.js';

import {loadCharacterKit} from './characters.js';
import {loadPowerupKit} from './powerups.js';
import {snapshotLobby, applySnapshot, createSaveStore, CAMPAIGN_FILE} from './save.js';

import {
    LEVELS,
    LEVEL_COUNT,
    IMPLEMENTED,
    unlockedPerkIndexes,
    PERK_UNLOCK,
    LOCKED,
    DONE,
    createProgress,
    applyProgress,
    snapshotProgress,
    completeLevel,
    isPlayable,
    unlocksOf,
    levelOf,
    enemyPlayer,
    lockedGuns,
    doneCount,
    crateUnlocked
} from './campaign.js';

import {buildLayout, moveCursor, unlockLevelOf, statBars, STAT_LABELS, TILE} from './library.js';
import {CRATE_SCALE} from './idle.js';
import {createIntro, stepIntro, introItems, dueSounds, armorPagesAhead, INTRO_SOUND_IDS} from './intro.js';

import {
    ACTIONS,
    ACTION_LABELS,
    BUTTONS,
    BUTTON_LABELS,
    OPTIONS_FILE,
    createOptions,
    setBinding,
    ownerOf,
    resetBindings,
    snapshotOptions,
    applyOptions,
    bindingText
} from './options.js';

import {ITEMS as MAIN_ITEMS, CREDITS, createMainMenu, moveMain, advanceBar} from './mainmenu.js';

import {
    setUnlockedPerks,
    MODES,
    PAGES,
    SETUP_ROWS,
    createMenu,
    mapRows,
    arenaOfRow,
    resolveArena,
    moveRow,
    canContinue,
    nextPage,
    previousPage,
    stepSlide,
    cardPanel,
    stepCard,
    EDIT_ROWS,
    createCardState,
    moveEditRow,
    choiceCount,
    PERKS,
    perkLocked,
    fieldOf
} from './menu.js';

import {
    createEffects,
    resetEffects,
    spawnFlash,
    spawnShell,
    spawnBlood,
    spawnStain,
    spawnDust,
    spawnCombo,
    queueShell,
    queueDrop,
    updateEffects,
    flushPending,
    COMBO_STYLES,
    KIND,
    ATLAS,
    spawnGrow,
    spawnPuff,
    spawnDebris,
    spawnSpark,
    spawnDropGun,
    spawnCrateName,
    spawnBling,
    spawnTrail,
    queueShells
} from './effects.js';

const COLOR_NAMES = ['CYAN', 'BLUE', 'VIOLET', 'PINK', 'CORAL', 'YELLOW'];
const LOADOUTS = LOADOUT_IDS;
const SHIRT_CHOICES = SHIRTS.filter(s => !s.hidden).length;
const SLOT_FIELDS = ['color', 'shirt', 'hat', 'weapon'];
const MAX_LIVES = 20;

const STAGE_SCALE = 640 / 900,
    VIEW_Y = 10;

const CAMERA_OPTIONS = {minZoom: 1, maxZoom: 1.2, clampStage: true};
const VICTORY_CAMERA = {minZoom: 1, maxZoom: 2, clampStage: true, focus: null};

const VALIDATION_ROUNDS = [
    {arena: 0, weapon: 1, players: [{color: 0}, {color: 4, shirt: 1, hat: 1}]},
    {
        arena: 1,
        weapon: 2,
        players: [
            {color: 1, hat: 2},
            {color: 5, shirt: 3, hat: 4}
        ]
    },
    {
        arena: 0,
        weapon: 10,
        players: [
            {color: 0, perk: 7},
            {color: 4, hat: 6},
            {color: 2, shirt: 2},
            {color: 5, hat: 3, perk: 6}
        ]
    },
    {
        arena: 1,
        weapon: 54,
        players: [
            {color: 3, hat: 5, perk: 1},
            {color: 1, shirt: 5, perk: 3},
            {color: 4, shirt: 6, hat: 2, perk: 4},
            {color: 2, hat: 6}
        ]
    }
];

{
    const ids = LOADOUT_IDS.filter(id => ![1, 2, 10, 54].includes(id));

    for (let i = 0; i < ids.length; i += 4) {
        VALIDATION_ROUNDS.push({
            arena: (i / 4) % ARENAS.length,
            weapon: ids[i],
            ticks: 95,
            weaponSweep: true,
            players: [0, 1, 2, 3]
                .map(k => ids[(i + k) % ids.length])
                .map((id, k) => ({
                    color: (i / 4 + k) % 6,
                    hat: ((i / 4) * 4 + k) % HATS.length,
                    shirt: ((i / 4) * 4 + k) % SHIRT_CHOICES,
                    weapon: id
                }))
        });
    }
}

for (let arena = 2; arena < ARENAS.length; arena++) {
    VALIDATION_ROUNDS.push({
        arena,
        weapon: 1,
        ticks: 100,
        sweep: true,
        players: [{color: arena % 6}, {color: (arena + 3) % 6, hat: arena % 7}]
    });
}

for (let powerKind = 0; powerKind < 7; powerKind++) {
    VALIDATION_ROUNDS.push({
        arena: 0,
        weapon: 1,
        ticks: 110,
        powerKind,
        players:
            powerKind === POWER.double
                ? [{color: 0, hat: 1}, {color: 4}, {color: 2}, {color: 5}]
                : [{color: 0, hat: 1}, {color: 4}]
    });
}

export function startGame(options = {}) {
    const validation = !!options.validation;
    const skip = new Set(options.skip || []);
    const rounds = options.only ? options.only.map(i => VALIDATION_ROUNDS[i]) : VALIDATION_ROUNDS;
    const mode = Screen.getMode();

    mode.mode = Screen.NTSC;
    mode.width = 640;
    mode.height = 448;
    mode.psm = Screen.CT24;
    mode.zbuffering = false;
    mode.double_buffering = true;
    Screen.setMode(mode);
    Screen.setVSync(true);

    const white = Color.new(255, 255, 255),
        ink = Color.new(15, 20, 26),
        muted = Color.new(167, 178, 188);

    const yellow = Color.new(255, 221, 98),
        green = Color.new(96, 224, 128),
        dim = Color.new(70, 80, 92);

    const panel = Color.new(28, 36, 46),
        panelHot = Color.new(40, 52, 66),
        shade = Color.new(12, 18, 25, 150);

    const accents = COLORS.map(c => Color.new(c.color[0], c.color[1], c.color[2]));
    const neutral = Color.new(128, 128, 128);

    try {
        Gamepad.configure({multitap: true});
    } catch (error) {
        console.log('GM2_PAD_DRIVER_ERROR ' + error);
    }

    const pads = [0, 1, 2, 3].map(i => Gamepad.player(i));
    const pending = pads.map(() => ({move: 0, jump: false, jumpHeld: false, down: false, fire: false, grenade: false}));
    const idleInput = {move: 0, jump: false, jumpHeld: false, down: false, fire: false, grenade: false};
    const powerKit = loadPowerupKit();

    const lobby = createLobby({
        colorCount: COLORS.length,
        shirtCount: SHIRT_CHOICES,
        hatCount: HATS.length,
        weaponIds: LOADOUTS,
        arenaCount: ARENAS.length
    });

    [1, 4, 7, 9].forEach((c, i) => {
        lobby.slots[i].color = c;
    });

    setSlotType(lobby, 1, 'cpu');

    function readIcon() {
        const file = std.open('assets/save/icon.ico', 'rb');

        if (!file) {
            return null;
        }

        file.seek(0, std.SEEK_END);

        const size = file.tell();

        file.seek(0, std.SEEK_SET);

        const bytes = new ArrayBuffer(size);

        file.read(bytes, 0, size);
        file.close();
        return bytes;
    }

    const saveStore = createSaveStore(validation ? null : globalThis.MemoryCard, 0, readIcon);

    {
        const saved = saveStore.load();
        const restored = saved ? applySnapshot(lobby, saved) : 0;

        console.log('GM2_SAVE_LOADED ' + restored);
    }

    const campaignStore = createSaveStore(validation ? null : globalThis.MemoryCard, 0, readIcon, CAMPAIGN_FILE);
    const optionsStore = createSaveStore(validation ? null : globalThis.MemoryCard, 0, readIcon, OPTIONS_FILE);
    const prefs = createOptions();

    console.log('GM2_OPTIONS_LOADED ' + (applyOptions(prefs, optionsStore.load()) ? 'yes' : 'none'));

    const saveOptions = () => {
        if (optionsStore.save(snapshotOptions(prefs))) {
            console.log('GM2_OPTIONS_SAVE_STARTED');
        }
    };

    const progress = createProgress();

    {
        const saved = campaignStore.load();

        console.log('GM2_CAMPAIGN_LOADED ' + (saved && applyProgress(progress, saved) ? doneCount(progress) : 'none'));
        setUnlockedPerks(unlockedPerkIndexes(progress));

        const lobbySaved = saveStore.load();

        if (lobbySaved) {
            applySnapshot(lobby, lobbySaved);
        }
    }

    const camp = {
        cursor: 0,
        phase: 1,
        scroll: 0,
        coop: false,
        unlocks: [],
        unlockLevel: 0,
        notice: '',
        endTimer: 0,
        finished: false
    };

    let winTimer = 0;
    const winPose = {lean: 0, hand: 0, acc: 0};
    const rows = [0, 0, 0, 0];
    const menu = createMenu(ARENAS.filter(a => !a.hidden).length);
    const cards = [0, 1, 2, 3].map(createCardState);
    let focus = 0;

    const waveBanner = {t: -1, wave: 1};
    const mainMenu = createMainMenu();
    let mainNotice = '';

    let screen = 'lobby',
        match = createMatch(),
        matchOptionsUsed = null;

    let paused = false,
        pauser = 0,
        pauseIndex = 0,
        resultIndex = 0,
        notice = '';

    let reportSent = false,
        sceneFrames = 0,
        visualHold = 0;

    let explosionLogged = false,
        explosionCountdown = -1;

    let validationRound = 0;
    const validationStats = [];
    const cameraStats = {min: 9, max: 0, indicators: 0, samples: 0};
    const vram = {frames: 0, sum: 0, max: 0};
    const clock = validation ? Timer.new() : null;
    const prof = {t: {}, m: {}, c: {}, updates: 0, frames: 0, t0: 0, w0: 0};
    let lapAt = 0;

    const lapBegin = validation
        ? () => {
              lapAt = Timer.getTime(clock);
          }
        : () => {};

    const lap = validation
        ? name => {
              const now = Timer.getTime(clock),
                  d = now - lapAt;

              prof.t[name] = (prof.t[name] || 0) + d;

              if (d > (prof.m[name] || 0)) {
                  prof.m[name] = d;
              }

              lapAt = now;
          }
        : () => {};

    const profReset = () => {
        prof.t = {};
        prof.m = {};
        prof.c = {};
        prof.updates = 0;
        prof.frames = 0;
        prof.t0 = validation ? Timer.getTime(clock) : 0;
        prof.w0 = Date.now();
    };

    function profReport() {
        const perMs = (Timer.getTime(clock) - prof.t0) / Math.max(1, Date.now() - prof.w0);
        const ms = {};

        for (const name of Object.keys(prof.t)) {
            const per = ['bots', 'events'].includes(name) || name.startsWith('sim.') ? prof.updates : prof.frames;

            ms[name] = Math.round((prof.t[name] / perMs / Math.max(1, per)) * 100) / 100;
        }

        const peak = {};

        for (const name of Object.keys(prof.m)) {
            peak[name] = Math.round((prof.m[name] / perMs) * 10) / 10;
        }

        const wall = Math.max(1, Date.now() - prof.w0);
        const counts = {};

        for (const name of Object.keys(prof.c)) {
            counts[name] = Math.round((prof.c[name] / Math.max(1, prof.frames)) * 10) / 10;
        }

        return {
            counts,
            frames: prof.frames,
            updates: prof.updates,
            ticksPerMs: Math.round(perMs),
            avgFps: Math.round((prof.frames * 10000) / wall) / 10,
            ms,
            peak
        };
    }

    const vramNow = () => ({
        size: Screen.getMemoryStats(Screen.VRAM_SIZE),
        static: Screen.getMemoryStats(Screen.VRAM_USED_STATIC),
        dynamic: Screen.getMemoryStats(Screen.VRAM_USED_DYNAMIC),
        free: Screen.getFreeVRAM()
    });

    let arenaLoaded = -1,
        background = null;

    let hudCount = 0,
        portraitCount = 0,
        hudKey = -1;

    const hudRecords = new Float32Array(16 * 64),
        hudWords = new Uint32Array(hudRecords.buffer);

    const portraitRecords = new Float32Array(16 * 16),
        portraitWords = new Uint32Array(portraitRecords.buffer);

    const cardKeys = [-1, -1, -1, -1];
    let hudState = [];
    let drawBlend = 1;
    const fxs = createEffects();
    let wallImage = null;

    function loadBackground(index) {
        if (index === arenaLoaded) {
            return;
        }

        if (background) {
            background.free();
        }

        background = new Image(ARENAS[index].background);
        background.optimize();

        if (!background.ready()) {
            throw new Error('Arena texture could not be loaded');
        }

        arenaLoaded = index;

        if (wallImage) {
            wallImage.free();
            wallImage = null;
        }

        if (ARENAS[index].effect === 'mapfx_wall') {
            wallImage = new Image('assets/mapfx/wall.png');

            if (!wallImage.ready()) {
                throw new Error('Map effect texture could not be loaded');
            }
        }
    }

    loadBackground(0);

    const kit = loadCharacterKit();
    const crateImage = new Image('assets/crate/crate.png');
    const cratePart = JSON.parse(std.loadFile('assets/crate/crate.json'));
    const crateOptions = {width: 0, height: 0};
    const grenadeAtlas = new Image('assets/grenades/atlas.png');
    const grenadeParts = JSON.parse(std.loadFile('assets/grenades/atlas.json')).parts;

    if (!crateImage.ready() || !grenadeAtlas.ready()) {
        throw new Error('Game textures could not be loaded');
    }

    const fx = JSON.parse(std.loadFile('assets/mapfx/meta.json'));
    const pickupImage = new Image('assets/mapfx/pickup.png');
    const snow = JSON.parse(std.loadFile('assets/mapfx/snow.json'));

    if (!pickupImage.ready()) {
        throw new Error('Map effect textures could not be loaded');
    }

    const inputBuffer = [];
    let shakeX = 0;
    const killFeed = [];

    const stageOptions = {width: 900, height: 600},
        pickupOptions = {color: 0};

    const cyan = Color.new(120, 255, 255),
        beam = Color.new(70, 200, 255);

    const camera = Camera2D.main;

    camera.x = 450;
    camera.y = 300;
    camera.zoomX = STAGE_SCALE;
    camera.zoomY = STAGE_SCALE;
    camera.viewport = {x: 0, y: VIEW_Y, w: 640, h: 427};
    camera.pixelSnap = false;

    const framing = createCamera();

    const sounds = {};

    const VARIANTS = {
        death: ['death', 'die2', 'die3', 'die4'],
        hit: ['hit', 'hit2'],
        explosion: ['explosion', 'explosion2', 'explosion3', 'explosion4'],
        land: ['drop1', 'drop2', 'drop3']
    };

    for (const name of [
        'hit',
        'hit2',
        'death',
        'die2',
        'die3',
        'die4',
        'explosion2',
        'explosion3',
        'explosion4',
        'drop1',
        'drop2',
        'drop3',
        'pickup',
        'menu'
    ]) {
        sounds[name] = new Sound.Sfx('assets/audio/' + name + '.adp');
        sounds[name].volume = 65;
    }

    const GUN_SFX = new Set();

    for (const w of Object.values(WEAPONS)) {
        for (const e of w.reloadSounds.concat(w.cycleSounds)) {
            GUN_SFX.add(e.s);
        }
    }

    for (const name of GUN_SFX) {
        sounds[name] = new Sound.Sfx('assets/weapons/audio/' + name + '.adp');
        sounds[name].volume = 55;
    }

    const sfxQueue = [];

    for (const name of WEAPON_SOUNDS) {
        sounds['gun_' + name] = new Sound.Sfx('assets/weapons/audio/' + name + '.adp');
        sounds['gun_' + name].volume = 55;
    }

    sounds.explosion = new Sound.Sfx('assets/grenades/explosion.adp');
    sounds.explosion.volume = 65;

    for (const name of ['powerup', 'jet']) {
        sounds[name] = new Sound.Sfx('assets/powerups/' + name + '.adp');
        sounds[name].volume = 55;
    }

    const menuMusic = new Sound.Stream('assets/audio/arena.wav');

    menuMusic.loop = true;

    const MENU_VOLUME = 70,
        MATCH_VOLUME = 40;

    Sound.setVolume(MENU_VOLUME);

    const subMusic = new Sound.Stream('assets/audio/menu2.wav');

    subMusic.loop = true;

    let music = menuMusic,
        gameMusic = null;

    function playMenuMusic(sub = false) {
        const want = sub ? subMusic : menuMusic;

        if (music === want && (want.playing() || !prefs.music)) {
            return;
        }

        if (music !== want && music.playing()) {
            music.pause();
        }

        Sound.setVolume(MENU_VOLUME);
        music = want;

        if (prefs.music) {
            music.play();
        }
    }

    function playGameMusic() {
        if (validation) {
            return;
        }

        if (music.playing()) {
            music.pause();
        }

        Sound.setVolume(MATCH_VOLUME);

        if (gameMusic) {
            gameMusic.free();
        }

        gameMusic = new Sound.Stream('assets/audio/game' + (1 + Math.floor(Math.random() * 3)) + '.wav');
        gameMusic.loop = true;
        music = gameMusic;

        if (prefs.music) {
            music.play();
        }
    }

    if (validation) {
        music.play();
    }

    console.log(
        'GM2_BOOT ' + JSON.stringify({mode: 'NTSC', simHz: RULES.hz, arena: ARENAS[0].name, revision: 3, validation})
    );

    try {
        console.log('GM2_PAD_DRIVERS ' + JSON.stringify(Gamepad.drivers()));
    } catch (error) {}

    const label = p => (p.type === 'cpu' ? 'CPU' : 'P') + (p.controllerIndex + 1);
    const slotLabel = slot => (slot.type === 'cpu' ? 'CPU' : 'P') + (slot.controllerIndex + 1);
    const SHORT = {};

    for (const id of Object.keys(WEAPONS)) {
        SHORT[id] = WEAPONS[id].part.toUpperCase();
    }

    const weaponShort = id => SHORT[id];
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    function lobbyLog() {
        if (!validation) {
            return;
        }

        console.log(
            'GM2_LOBBY_STATE ' +
                JSON.stringify({
                    options: matchOptions(lobby),
                    ready: lobby.slots.map(s => s.ready),
                    canStart: canStart(lobby)
                })
        );
    }

    function humanPads() {
        return match.players.filter(p => p.type === 'human').map(p => p.controllerIndex);
    }

    function enterLobby(toSetup) {
        screen = 'lobby';
        paused = false;
        playMenuMusic(true);

        if (toSetup) {
            menu.page = 2;
            menu.target = 2;
            menu.slide = 2;
        }

        loadBackground(lobby.arenaIndex);

        for (const slot of lobby.slots) {
            setReady(lobby, slot.controllerIndex, false);
        }

        for (const input of pending) {
            input.jump = false;
            input.down = false;
        }

        console.log('GM2_MENU_READY');
        lobbyLog();
    }

    const seedClock = Timer.new();
    let seedCount = 0;

    function freshSeed() {
        const mix = (h, v) => {
            h ^= v | 0;
            h ^= h << 13;
            h ^= h >>> 17;
            h ^= h << 5;
            return h | 0;
        };

        let h = 0x2545f491 | 0;

        for (const v of [
            Date.now() >>> 0,
            Math.floor(Date.now() / 1000) | 0,
            Math.floor(Timer.getTime(seedClock)) | 0,
            ++seedCount,
            (Math.random() * 65536) | 0,
            (Math.random() * 65536) | 0
        ]) {
            h = mix(h, v);
        }

        for (let k = 0; k < 4; k++) {
            h = mix(h, 0x9e3779b9 | 0);
        }

        return h || 1;
    }

    function startMatch(opts, seed) {
        matchOptionsUsed = opts;
        loadBackground(opts.arenaIndex);

        match = createMatch(seed, opts.arenaIndex, opts.players[0].weaponId, {
            players: opts.players,
            lives: opts.lives,
            mode: opts.mode,
            demo: opts.demo || opts.test,
            crates: opts.crates,
            pickups: opts.pickups,
            lockedGuns: opts.lockedGuns,
            campaign: opts.campaign,
            dynamiteEvery: opts.dynamiteEvery,
            decoyRule: opts.decoyRule,
            aiNoCrates: opts.aiNoCrates
        });

        sfxQueue.length = 0;
        waveBanner.t = -1;
        camp.endTimer = 0;
        camp.finished = false;
        winTimer = 0;
        winPose.lean = winPose.hand = winPose.acc = 0;
        resetCamera(framing);
        killFeed.length = 0;
        shakeX = 0;
        hudState = [];
        hudKey = -1;
        clearHud();
        resetEffects(fxs);
        powerKit.reset();
        vram.frames = 0;
        vram.sum = 0;
        vram.max = 0;
        profReset();
        screen = 'match';
        paused = false;
        pauseIndex = 0;
        resultIndex = 0;
        notice = '';

        if (!opts.demo) {
            playGameMusic();
        }

        for (const input of pending) {
            input.jump = false;
            input.down = false;
        }

        console.log(
            'GM2_MATCH_START ' +
                JSON.stringify({
                    seed: match.seed,
                    arena: opts.arenaIndex,
                    lives: opts.lives,
                    crates: opts.crates,
                    pickups: opts.pickups,
                    weapon: opts.players[0].weaponId,
                    players: opts.players.map(p => ({
                        controller: p.controllerIndex,
                        type: p.type,
                        color: p.color,
                        shirt: p.shirt,
                        hat: p.hat,
                        weaponId: p.weaponId
                    }))
                })
        );
    }

    function startFromLobby() {
        if (saveStore.save(snapshotLobby(lobby))) {
            console.log('GM2_SAVE_STARTED');
        }

        const opts = matchOptions(lobby);

        opts.mode = MODES[menu.mode].gameMode;

        if (opts.mode !== 3) {
            for (const q of opts.players) {
                delete q.team;
            }
        }

        if (opts.mode === 5) {
            opts.players = opts.players.filter(q => q.type === 'human');
            opts.playerCount = opts.players.length;
            opts.lives = 10;
            opts.crates = true;
            opts.pickups = false;
        }

        startMatch(opts, validation ? 12345 : freshSeed());
    }

    function startValidationRound(index) {
        const round = rounds[index];

        const l = createLobby({
            colorCount: COLORS.length,
            shirtCount: SHIRT_CHOICES,
            hatCount: HATS.length,
            weaponIds: LOADOUTS,
            arenaCount: ARENAS.length
        });

        for (let i = 0; i < 4; i++) {
            setSlotType(l, i, i < round.players.length ? 'cpu' : 'off');
        }

        round.players.forEach((cfg, i) =>
            Object.assign(l.slots[i], {
                color: cfg.color || 0,
                shirt: cfg.shirt || 0,
                hat: cfg.hat || 0,
                perk: cfg.perk || 0,
                weapon: LOADOUTS.indexOf(cfg.weapon || round.weapon)
            })
        );

        l.arenaIndex = round.arena;
        l.lives = 3;
        startMatch(matchOptions(l), 12345);

        if (round.powerKind !== undefined) {
            const floor = match.arena.platforms[0];

            for (let i = 0; i < match.players.length; i++) {
                const p = match.players[i];

                p.x = p.px = floor.x + floor.w * [0.3, 0.8, 0.6, 0.95][i];
                p.y = p.py = floor.y;
                p.vx = 0;
                p.vy = 0.88;
                p.jumps = 2;
                p.ground = 0;
                p.spawnPending = false;
            }

            const p = match.players[0],
                orb = spawnPowerup(match, round.powerKind);

            orb.x = p.x + 110;
            orb.y = p.y - 40;
            orb.frame = 1;
        }
    }

    const rand = n => Math.floor((validation ? 0.5 : Math.random()) * n);

    function enterMain() {
        const pool = [];

        ARENAS.forEach((a, i) => {
            if (!a.hidden) {
                pool.push(i);
            }
        });

        const c1 = rand(COLORS.length);
        let c2 = rand(COLORS.length);

        if (c2 === c1) {
            c2 = (c1 + 1) % COLORS.length;
        }

        const bot = (i, color) => ({
            controllerIndex: i,
            type: 'cpu',
            name: 'Bot ' + (i + 1),
            color,
            shirt: rand(SHIRT_CHOICES),
            hat: rand(HATS.length),
            perk: 0,
            weaponId: LOADOUTS[rand(5)]
        });

        startMatch(
            {
                arenaIndex: pool[rand(pool.length)],
                playerCount: 2,
                lives: 99999,
                crates: true,
                pickups: false,
                demo: true,
                players: [bot(0, c1), bot(1, c2)]
            },
            validation ? 12345 : freshSeed()
        );

        screen = 'main';
        mainNotice = '';
        playMenuMusic();
        console.log('GM2_MAIN_MENU ' + JSON.stringify({cursor: mainMenu.cursor}));
    }

    function enterCredits() {
        screen = 'credits';
        playMenuMusic(true);
        console.log('GM2_CREDITS');
    }

    const libLayout = buildLayout(),
        lib = {index: 0, weapon: libLayout.tiles[0].id};

    const libStats = JSON.parse(std.loadFile('assets/ui/gunstats.json'));

    function enterLibrary() {
        screen = 'library';
        playMenuMusic(true);
        console.log('GM2_LIBRARY');
    }

    function startTestWeapon(id) {
        const counts = {
            color: COLORS.length,
            shirt: SHIRT_CHOICES,
            shirtIds: SHIRTS.map(x => x.id),
            hat: HATS.length,
            weaponIds: LOADOUTS
        };

        const slot = lobby.slots[0],
            level = LEVELS[0];

        const human = {
            controllerIndex: 0,
            type: 'human',
            name: 'P1',
            color: slot.color,
            shirt: slot.shirt,
            hat: slot.hat,
            perk: 0,
            weaponId: id,
            team: 0
        };

        const dummy = enemyPlayer(level.enemies[0], counts, 1, level);

        while (dummy.color === human.color) {
            dummy.color = (dummy.color + 1) % COLORS.length;
        }

        startMatch(
            {
                arenaIndex: ARENAS.findIndex(a => a.originalMap === 13),
                playerCount: 2,
                lives: 99999,
                crates: false,
                pickups: false,
                test: true,
                players: [human, dummy]
            },
            validation ? 12345 : freshSeed()
        );

        console.log('GM2_TEST_WEAPON ' + JSON.stringify({weapon: id}));
    }

    const opt = {col: 0, row: 0, capture: null, notice: ''};

    function enterOptions() {
        screen = 'options';
        playMenuMusic(true);
        opt.capture = null;
        opt.notice = '';
        console.log('GM2_OPTIONS_MENU');
    }

    let intro = null,
        introImage = null,
        introMeta = null,
        introSfx = null,
        introLoader = null,
        introPages = {},
        introShown = [],
        introStalls = 0,
        introStallFrames = [],
        introStarted = false,
        introWait = 0;

    function enterIntro() {
        introMeta = JSON.parse(std.loadFile('assets/intro/intro.json'));
        introImage = new Image(introMeta.atlas.image);
        intro = createIntro(introMeta);
        introLoader = new ImageList();
        introPages = {};
        introShown = [];
        introStarted = false;
        introWait = 0;
        queueIntroPages();
        screen = 'intro';
        paused = false;
        introSfx = {};

        for (const id of INTRO_SOUND_IDS) {
            introSfx[id] = new Sound.Sfx('assets/audio/intro' + id + '.adp');
            introSfx[id].volume = 65;
        }

        console.log('GM2_INTRO');
    }

    function leaveIntro() {
        if (introImage) {
            introImage.free();
            introImage = null;
        }

        for (const id of Object.keys(introPages)) {
            introPages[id].free();
        }

        introPages = {};
        introLoader = null;
        introShown = [];
        console.log('GM2_INTRO_STALLS ' + introStalls + ' at ' + introStallFrames.join(','));
        introStalls = 0;
        introStallFrames = [];

        if (introSfx) {
            for (const id of INTRO_SOUND_IDS) {
                introSfx[id].stop();
                introSfx[id].free();
            }

            introSfx = null;
        }

        intro = null;
        enterMain();
    }

    function queueIntroPages() {
        for (const id of armorPagesAhead(intro, 14)) {
            if (!introPages[id]) {
                introPages[id] = introLoader.load(introMeta.pages[id].file);
            }
        }

        const keepFrom = introShown.length ? Math.min(...introShown.map(t => t.tile.page)) : 0;

        for (const id of Object.keys(introPages)) {
            if (Number(id) < keepFrom) {
                introPages[id].free();
                delete introPages[id];
            }
        }
    }

    function playIntroSounds() {
        if (!introSfx) {
            return;
        }

        for (const id of dueSounds(intro)) {
            if (prefs.sfx) {
                introSfx[id].play();
            }
        }
    }

    function introInput(dt) {
        if (pads.some(p => p.connected && (p.justPressed(Gamepad.START) || p.justPressed(Gamepad.CROSS)))) {
            console.log('GM2_INTRO_SKIP');
            leaveIntro();
            return;
        }

        queueIntroPages();
        introLoader.process(1);

        if (!introStarted) {
            introStarted = armorPagesAhead(intro, 2).every(id => introPages[id] && introPages[id].ready());

            if (!introStarted) {
                introWait += dt;

                if (introWait > 5) {
                    console.log('GM2_INTRO_SKIP no pictures');
                    leaveIntro();
                }

                return;
            }
        }

        stepIntro(intro, dt);
        playIntroSounds();

        if (intro.done) {
            console.log('GM2_INTRO_DONE');
            leaveIntro();
        }
    }

    const introOptions = {width: 0, height: 0};

    function introDraw() {
        Draw.rect(0, 0, 640, 480, Color.new(0, 0, 0));

        if (!intro) {
            return;
        }

        const white = Color.new(128, 128, 128, 128),
            items = introItems(intro),
            armor = items.filter(it => it.kind === 'frame');

        if (armor.length) {
            const ready = armor.every(it => {
                const page = introPages[introMeta.tiles[it.tile].page];

                return page && page.ready();
            });

            if (ready) {
                introShown = armor.map(it => ({tile: introMeta.tiles[it.tile], img: introPages[introMeta.tiles[it.tile].page]}));
            } else {
                introStalls++;

                if (introStallFrames.length < 12) {
                    introStallFrames.push(Math.floor(intro.frame));
                }
            }

            for (const t of introShown) {
                introOptions.width = t.tile.w;
                introOptions.height = t.tile.h;
                introOptions.startx = t.tile.sx;
                introOptions.starty = t.tile.sy;
                introOptions.endx = t.tile.sx + t.tile.w;
                introOptions.endy = t.tile.sy + t.tile.h;
                introOptions.angle = 0;
                introOptions.color = white;
                t.img.draw(Math.round(X(introMeta.origin[0]) + t.tile.x), Math.round(Y(introMeta.origin[1]) + t.tile.y), introOptions);
            }
        }

        for (const it of items) {
            if (it.kind === 'frame') {
                continue;
            }

            const a = Math.max(0, Math.min(128, Math.round(it.alpha * 128)));

            if (a <= 0) {
                continue;
            }

            if (it.kind === 'rect') {
                const x0 = Math.round(X(it.x0)),
                    y0 = Math.max(0, Math.round(Y(it.y0))),
                    x1 = Math.round(X(it.x1)),
                    y1 = Math.min(480, Math.round(Y(it.y1)));

                if (y1 > y0 && x1 > x0) {
                    Draw.rect(x0, y0, x1 - x0, y1 - y0, Color.new(255, 255, 255, a));
                }

                continue;
            }

            const q = introMeta.parts[it.name],
                o = introOptions;

            const w = q.w * it.sx,
                h = q.h * it.sy,
                ox = q.ox * it.sx,
                oy = q.oy * it.sy;

            o.width = w;
            o.height = h;
            o.startx = q.x;
            o.starty = q.y;
            o.endx = q.x + q.w;
            o.endy = q.y + q.h;
            o.color = a === 128 ? white : Color.new(128, 128, 128, a);

            if (it.angle) {
                o.angle = it.angle;
                o.originX = ox;
                o.originY = oy;
            } else {
                o.angle = 0;
            }

            introImage.draw(X(it.x) - ox, Y(it.y) - oy, o);
        }
    }

    if (validation) {
        startValidationRound(0);
    } else {
        enterIntro();
    }

    const levelReady = n => IMPLEMENTED.includes(n);

    function enterCampaign() {
        screen = 'campaign';
        paused = false;
        camp.notice = '';
        camp.unlocks = [];
        camp.phase = 1;
        playMenuMusic(true);

        for (const input of pending) {
            input.jump = false;
            input.down = false;
        }

        console.log('GM2_CAMPAIGN_MENU ' + JSON.stringify({levels: progress.levels, cursor: camp.cursor}));
    }

    function startCampaignLevel(n) {
        const level = levelOf(n);

        const counts = {
            color: COLORS.length,
            shirt: SHIRT_CHOICES,
            shirtIds: SHIRTS.map(x => x.id),
            hat: HATS.length,
            weaponIds: LOADOUTS
        };

        const players = [];

        for (let i = 0; i < (camp.coop ? 2 : 1); i++) {
            const slot = lobby.slots[i];

            players.push({
                controllerIndex: i,
                type: 'human',
                name: 'P' + (i + 1),
                color: slot.color,
                shirt: slot.shirt,
                hat: slot.hat,
                perk: slot.perk,
                weaponId: LOADOUTS[slot.weapon],
                team: 0
            });
        }

        level.enemies.forEach((enemy, index) => {
            const foe = enemyPlayer(enemy, counts, players.length, level);

            foe.hudSlot = 4 - level.enemies.length + index;

            while (players.some(q => q.type === 'human' && q.color === foe.color)) {
                foe.color = (foe.color + 1) % COLORS.length;
            }

            players.push(foe);
        });

        const arenaIndex = ARENAS.findIndex(a => a.originalMap === level.map);

        saveStore.save(snapshotLobby(lobby));

        console.log(
            'GM2_CAMPAIGN_START ' + JSON.stringify({level: n, title: level.title, arena: arenaIndex, coop: camp.coop})
        );

        startMatch(
            {
                arenaIndex,
                playerCount: players.length,
                lives: level.lives,
                mode: level.mode,
                crates: level.crates,
                pickups: level.powerups,
                players,
                campaign: n,
                lockedGuns: lockedGuns(progress),
                dynamiteEvery: level.dynamiteEvery,
                decoyRule: !!level.killDouble,
                aiNoCrates: !!level.aiIgnoresCrates
            },
            validation ? 12345 : freshSeed()
        );
    }

    const niceName = name =>
        name
            .split(/([ -])/)
            .map(w => (w === 'SMG' || w.length < 2 ? w : w[0] + w.slice(1).toLowerCase()))
            .join('');

    const unlockLines = n =>
        unlocksOf(n)
            .map(id => ({kind: 'gun', id, name: WEAPONS[id] ? niceName(WEAPONS[id].name) : 'Weapon ' + id}))
            .concat(PERK_UNLOCK[n] ? [{kind: 'perk', index: PERK_UNLOCK[n].index, name: PERK_UNLOCK[n].text}] : []);

    function finishCampaignMatch() {
        const n = matchOptionsUsed.campaign;
        const winner = match.winner >= 0 ? match.players[match.winner] : null;
        const won = !!winner && winner.type === 'human';

        camp.finished = true;
        camp.notice = '';

        if (won) {
            completeLevel(progress, n);

            if (campaignStore.save(snapshotProgress(progress))) {
                console.log('GM2_CAMPAIGN_SAVE_STARTED');
            }

            setUnlockedPerks(unlockedPerkIndexes(progress));
            camp.unlocks = unlockLines(n);
            camp.unlockLevel = n;
            camp.cursor = Math.min(LEVEL_COUNT - 1, n);
        }

        console.log('GM2_CAMPAIGN_RESULT ' + JSON.stringify({level: n, won, levels: progress.levels}));
        enterCampaign();

        if (won) {
            camp.unlocks = unlockLines(n);
        }
    }

    function campaignMatchInput() {
        camp.endTimer += 1 / 60;

        const skip = pads.some(p => p.connected && (p.justPressed(Gamepad.CROSS) || p.justPressed(Gamepad.START)));

        if (camp.endTimer >= 100 / RULES.hz || (skip && camp.endTimer > 1)) {
            finishCampaignMatch();
        }
    }

    const campCards = [createCardState(), createCardState()];
    const SLIDER_MIN = -857;

    function stepCampSlider(dt) {
        const target = Math.max(SLIDER_MIN, Math.min(0, 267 - 347 * (camp.cursor % 5)));

        camp.scroll += (target - camp.scroll) * (1 - Math.pow(0.75, dt * RULES.hz));

        if (Math.abs(target - camp.scroll) < 0.5) {
            camp.scroll = target;
        }
    }

    function campEdit(pad, k) {
        if (!pad.connected) {
            return;
        }

        const card = campCards[k],
            slot = lobby.slots[k];

        const dy = (pad.justPressed(Gamepad.DOWN) ? 1 : 0) - (pad.justPressed(Gamepad.UP) ? 1 : 0);

        if (dy) {
            card.row = 1 + ((card.row - 1 + dy + EDIT_ROWS.length - 1) % (EDIT_ROWS.length - 1));
        }

        const dx = (pad.justPressed(Gamepad.RIGHT) ? 1 : 0) - (pad.justPressed(Gamepad.LEFT) ? 1 : 0);

        if (!dx) {
            return;
        }

        const kind = EDIT_ROWS[card.row],
            field = fieldOf(kind),
            count = choiceCount(kind, lobby.choices);

        let step = dx;

        if (kind === 'perk') {
            for (let q = 0; q < count && perkLocked((slot.perk + step + count * 9) % count); q++) {
                step += dx;
            }
        }

        slot[field] = (((slot[field] + step) % count) + count) % count;
    }

    function campaignInput() {
        const pad = pads[0];

        if (!pad.connected) {
            return;
        }

        if (camp.unlocks.length) {
            if (pad.justPressed(Gamepad.CROSS) || pad.justPressed(Gamepad.START) || pad.justPressed(Gamepad.CIRCLE)) {
                camp.unlocks = [];
            }

            return;
        }

        const n = camp.cursor + 1;

        if (camp.phase === 1) {
            let cursor = camp.cursor;

            if (pad.justPressed(Gamepad.LEFT)) {
                cursor = Math.max(0, cursor - 1);
            }

            if (pad.justPressed(Gamepad.RIGHT)) {
                cursor = Math.min(LEVEL_COUNT - 1, cursor + 1);
            }

            if (pad.justPressed(Gamepad.UP) && cursor >= 5) {
                cursor -= 5;
            }

            if (pad.justPressed(Gamepad.DOWN) && cursor < 5) {
                cursor += 5;
            }

            if (cursor !== camp.cursor) {
                camp.cursor = cursor;
                camp.notice = '';
            }

            if (pad.justPressed(Gamepad.CIRCLE)) {
                enterMain();
                return;
            }

            if (pad.justPressed(Gamepad.CROSS) || pad.justPressed(Gamepad.START)) {
                if (!isPlayable(progress, n)) {
                    camp.notice = 'LOCKED: BEAT LEVEL ' + (n - 1) + ' FIRST';
                } else if (!levelReady(n)) {
                    camp.notice = 'NOT AVAILABLE IN THIS PORT YET';
                } else {
                    camp.phase = 2;
                    camp.notice = '';
                }
            }

            return;
        }

        if (pads[1].connected && pads[1].justPressed(Gamepad.START)) {
            camp.coop = !camp.coop;
            camp.notice = '';
        }

        campEdit(pads[0], 0);

        if (camp.coop && pads[1].connected) {
            campEdit(pads[1], 1);
        }

        if (pad.justPressed(Gamepad.CIRCLE)) {
            camp.phase = 1;
            camp.notice = '';
            return;
        }

        if (pad.justPressed(Gamepad.CROSS) || pad.justPressed(Gamepad.START)) {
            startCampaignLevel(n);
        }
    }

    const click = () => {
        if (prefs.sfx) {
            sounds.menu.play();
        }
    };

    const BUTTON_CONST = {
        CROSS: Gamepad.CROSS,
        CIRCLE: Gamepad.CIRCLE,
        SQUARE: Gamepad.SQUARE,
        TRIANGLE: Gamepad.TRIANGLE,
        L1: Gamepad.L1,
        R1: Gamepad.R1,
        L2: Gamepad.L2,
        R2: Gamepad.R2,
        UP: Gamepad.UP,
        DOWN: Gamepad.DOWN,
        LEFT: Gamepad.LEFT,
        RIGHT: Gamepad.RIGHT
    };

    const heldBy = (pad, names) => names.some(n => pad.pressed(BUTTON_CONST[n]));
    const pressedBy = (pad, names) => names.some(n => pad.justPressed(BUTTON_CONST[n]));
    const cameraPlayers = [];

    function cameraList() {
        if (!match.survival) {
            return match.players;
        }

        cameraPlayers.length = 0;

        for (const p of match.players) {
            if (!p.isZombie) {
                cameraPlayers.push(p);
            }
        }

        return cameraPlayers;
    }

    const pressedAny = button => pads.some(p => p.connected && p.justPressed(button));

    function mainInput(dt) {
        advanceBar(mainMenu, mainMeta.rows, dt);

        if (pressedAny(Gamepad.UP)) {
            moveMain(mainMenu, -1);
            mainNotice = '';
        }

        if (pressedAny(Gamepad.DOWN)) {
            moveMain(mainMenu, 1);
            mainNotice = '';
        }

        if (!(pressedAny(Gamepad.CROSS) || pressedAny(Gamepad.START))) {
            return;
        }

        const id = MAIN_ITEMS[mainMenu.cursor].id;

        click();

        if (id === 'campaign') {
            enterCampaign();
        } else if (id === 'custom') {
            enterLobby();
        } else if (id === 'credits') {
            enterCredits();
        } else if (id === 'options') {
            enterOptions();
        } else if (id === 'library') {
            enterLibrary();
        } else {
            mainNotice = 'NOT AVAILABLE IN THIS PORT YET';
        }
    }

    function creditsInput() {
        if (pressedAny(Gamepad.CIRCLE) || pressedAny(Gamepad.CROSS) || pressedAny(Gamepad.START)) {
            click();

            if (creditsImage) {
                creditsImage.free();
                creditsImage = null;
            }

            enterMain();
        }
    }

    function libraryInput() {
        const buttonIndex = libLayout.tiles.length;

        for (const [dir, pad] of [
            ['up', Gamepad.UP],
            ['down', Gamepad.DOWN],
            ['left', Gamepad.LEFT],
            ['right', Gamepad.RIGHT]
        ]) {
            if (pressedAny(pad)) {
                lib.index = moveCursor(libLayout, lib.index, dir);
            }
        }

        if (lib.index < buttonIndex) {
            lib.weapon = libLayout.tiles[lib.index].id;
        }

        if (pressedAny(Gamepad.CIRCLE)) {
            click();
            enterMain();
            return;
        }

        if (pressedAny(Gamepad.CROSS) || pressedAny(Gamepad.START)) {
            if (crateUnlocked(progress, lib.weapon)) {
                click();
                startTestWeapon(lib.weapon);
            }
        }
    }

    function libraryDraw() {
        Draw.rect(0, 0, 640, 448, MC.bg);
        shadowed(20, 20, 620, 60, MC.white);
        textBox('title', 'GUN LIBRARY', 20, 20, 620, 60, '#000000', 'left', 14);
        bar(660, 20, 220, 60, 'BACK', '#000000', 'left');

        for (const t of libLayout.titles) {
            text('small', t.text, t.x, t.y, '#ff6600');
        }

        libLayout.tiles.forEach((t, i) => {
            const open = crateUnlocked(progress, t.id),
                cx = t.x + TILE / 2,
                cy = t.y + TILE / 2;

            diamond(cx + 2, cy + 2, 29, MC.black);
            diamond(cx, cy, 28, open ? rgb('#000000') : rgb('#222222'));
            diamond(cx, cy, 25, open ? rgb('#ff9900') : rgb('#555555'));

            if (open) {
                kit.drawWeaponIcon(t.id, X(cx), Y(cy), 34 * S_);
            } else {
                textCenter('button', '?', cx, cy - 12, '#aaaaaa');
            }

            if (i === lib.index) {
                frame(t.x - 3, t.y - 3, TILE + 6, TILE + 6, 3, MC.white);
            }
        });

        shadowed(660, 100, 220, 326, MC.white);

        const w = WEAPONS[lib.weapon],
            open = crateUnlocked(progress, lib.weapon);

        wrapLines('button', niceName(w.name), 204)
            .slice(0, 2)
            .forEach((line, k) => text('button', line, 670, 106 + k * 24, '#000000'));

        box(670, 156, 200, 2, MC.black);

        const bars = open ? statBars(libStats, lib.weapon) : null;

        if (bars) {
            STAT_LABELS.forEach((label, k) => {
                const y = 166 + k * 50;

                text('small', label, 670, y, '#555555');
                box(670, y + 22, 200, 14, rgb('#dddddd'));
                box(670, y + 22, Math.round(200 * bars[k]), 14, rgb('#555555'));
            });
        } else {
            const level = unlockLevelOf(lib.weapon);

            textBox('body', open ? 'NO STATS' : 'LOCKED', 670, 200, 200, 30, '#cc0000', 'center', 0);

            if (!open) {
                textBox(
                    'small',
                    'Unlocks by beating campaign level ' + level,
                    670,
                    240,
                    200,
                    60,
                    '#333333',
                    'center',
                    0
                );
            }
        }

        const b = libLayout.button,
            hot = lib.index === libLayout.tiles.length;

        box(b.x + 3, b.y + 3, b.w, b.h, Color.new(0, 0, 0, 90));
        box(b.x, b.y, b.w, b.h, crateUnlocked(progress, lib.weapon) ? rgb('#990000') : rgb('#555555'));
        textBox('big', 'TEST WEAPON', b.x, b.y, b.w, b.h, '#000000');

        if (hot) {
            frame(b.x - 3, b.y - 3, b.w + 6, b.h + 6, 3, MC.white);
        }

        text('small', 'X: TEST WEAPON   O: BACK', 28, 540, '#aaaaaa');
    }

    function optionsInput() {
        if (opt.capture) {
            const pad = pads[opt.capture.pad].connected ? pads[opt.capture.pad] : pads[0];

            if (pad.justPressed(Gamepad.START) || pad.justPressed(Gamepad.SELECT)) {
                opt.capture = null;
                opt.notice = '';
                return;
            }

            for (const name of BUTTONS) {
                if (!pad.justPressed(BUTTON_CONST[name])) {
                    continue;
                }

                if (setBinding(prefs, opt.capture.pad, opt.capture.action, name)) {
                    opt.capture = null;
                    opt.notice = '';
                    saveOptions();
                    click();
                } else {
                    opt.notice = 'ALREADY USED BY ' + ACTION_LABELS[ownerOf(prefs, opt.capture.pad, name)];
                }

                break;
            }

            return;
        }

        if (pressedAny(Gamepad.UP)) {
            opt.row = (opt.row + 7) % 8;
        }

        if (pressedAny(Gamepad.DOWN)) {
            opt.row = (opt.row + 1) % 8;
        }

        const dx = (pressedAny(Gamepad.RIGHT) ? 1 : 0) - (pressedAny(Gamepad.LEFT) ? 1 : 0);

        opt.col = Math.max(0, Math.min(opt.row < 6 ? 3 : 1, opt.col + dx));

        if (pressedAny(Gamepad.CIRCLE)) {
            click();
            enterMain();
            return;
        }

        if (!(pressedAny(Gamepad.CROSS) || pressedAny(Gamepad.START))) {
            return;
        }

        click();

        if (opt.row < 6) {
            opt.capture = {pad: opt.col, action: ACTIONS[opt.row]};
            opt.notice = '';
        } else if (opt.row === 6) {
            if (opt.col === 0) {
                prefs.music = !prefs.music;
            } else {
                prefs.sfx = !prefs.sfx;
            }

            if (prefs.music) {
                if (!music.playing()) {
                    music.play();
                }
            } else {
                music.pause();
            }

            saveOptions();
        } else if (opt.col === 0) {
            enterMain();
        } else {
            for (let i = 0; i < 4; i++) {
                resetBindings(prefs, i);
            }

            saveOptions();
        }
    }

    function optionsDraw() {
        Draw.rect(0, 0, 640, 448, MC.bg);
        header(0, 'OPTIONS');

        for (let c = 0; c < 4; c++) {
            const x = 20 + 220 * c;

            shadowed(x, 100, 200, 26, MC.white);
            textBox('small', 'Player ' + (c + 1), x, 100, 200, 26, '#000000');

            ACTIONS.forEach((action, r) => {
                const hot = !opt.capture && opt.row === r && opt.col === c,
                    live = opt.capture && opt.capture.pad === c && opt.capture.action === action;

                uiButton(
                    x,
                    134 + r * 38,
                    200,
                    32,
                    ACTION_LABELS[action] + ':  ' + bindingText(prefs.binds[c][action]),
                    hot || live ? 'hot' : 'normal'
                );
            });
        }

        const hotAudio = c => !opt.capture && opt.row === 6 && opt.col === c;

        uiButton(20, 368, 420, 36, 'MUSIC:  ' + (prefs.music ? 'ON' : 'OFF'), hotAudio(0) ? 'hot' : 'normal');
        uiButton(460, 368, 420, 36, 'SOUND FX:  ' + (prefs.sfx ? 'ON' : 'OFF'), hotAudio(1) ? 'hot' : 'normal');
        uiButton(20, 418, 420, 36, 'BACK', !opt.capture && opt.row === 7 && opt.col === 0 ? 'hot' : 'normal');

        uiButton(
            460,
            418,
            420,
            36,
            'RESET ALL CONTROLS',
            !opt.capture && opt.row === 7 && opt.col === 1 ? 'hot' : 'normal'
        );

        text('small', 'X: CHANGE   O: BACK   START/SELECT cannot be assigned', 20, 470, '#aaaaaa');

        if (opt.capture) {
            box(0, 0, 900, 600, Color.new(0, 0, 0, 100));
            shadowed(250, 220, 400, 160, MC.white);
            textCenter('button', 'Press a valid button to assign', 450, 236, '#000000');

            textCenter(
                'big',
                ACTION_LABELS[opt.capture.action] + ' (PLAYER ' + (opt.capture.pad + 1) + ')',
                450,
                274,
                '#ff6600'
            );

            textCenter('small', opt.notice || 'START: CANCEL', 450, 336, opt.notice ? '#cc0000' : '#777777');
        }
    }

    function addCpu() {
        for (let i = 1; i < 4; i++) {
            const slot = lobby.slots[i];

            if (slot.type === 'off' || (slot.type === 'human' && !slot.joined && !pads[i].connected)) {
                return setSlotType(lobby, i, 'cpu');
            }
        }

        return false;
    }

    function removeCpu() {
        for (let i = 3; i >= 1; i--) {
            if (lobby.slots[i].type === 'cpu') {
                return setSlotType(lobby, i, 'off');
            }
        }

        return false;
    }

    let menuNotice = '';

    function showMapPreview() {
        const arena = arenaOfRow(menu, menu.mapRow);

        if (arena >= 0) {
            setSetting(lobby, 'arenaIndex', arena);
        }
    }

    function leaveMapPage() {
        const arena =
            menu.mapRow === 0 ? resolveArena(menu, validation ? 0.5 : Math.random()) : arenaOfRow(menu, menu.mapRow);

        setSetting(lobby, 'arenaIndex', arena);
        loadBackground(arena);
    }

    function menuPageInput() {
        const pad = pads[0];

        if (!pad.connected) {
            return;
        }

        let changed = false;

        if (pad.justPressed(Gamepad.UP)) {
            moveRow(menu, -1);
            changed = true;
        }

        if (pad.justPressed(Gamepad.DOWN)) {
            moveRow(menu, 1);
            changed = true;
        }

        const dir = (pad.justPressed(Gamepad.RIGHT) ? 1 : 0) - (pad.justPressed(Gamepad.LEFT) ? 1 : 0);

        if (menu.page === 0 && dir) {
            if (menu.row === SETUP_ROWS.lives) {
                setSetting(lobby, 'lives', clamp(lobby.lives + dir, 1, MAX_LIVES));
            } else if (menu.row === SETUP_ROWS.crates) {
                setSetting(lobby, 'crates', !lobby.crates);
            } else if (menu.row === SETUP_ROWS.pickups) {
                setSetting(lobby, 'pickups', !lobby.pickups);
            }

            changed = true;
        }

        if (menu.page === 1 && dir) {
            moveRow(menu, dir * 5);
            changed = true;
        }

        if (changed) {
            menuNotice = '';

            if (menu.page === 1) {
                showMapPreview();
            }
        }

        if (pad.justPressed(Gamepad.CROSS) || pad.justPressed(Gamepad.START)) {
            if (menu.page === 0 && !canContinue(menu)) {
                menuNotice = 'NOT AVAILABLE IN THIS PORT';
            } else {
                if (menu.page === 1) {
                    leaveMapPage();
                }

                if (nextPage(menu)) {
                    menuNotice = '';
                    changed = true;
                }
            }
        }

        if (pad.justPressed(Gamepad.CIRCLE)) {
            if (previousPage(menu)) {
                menuNotice = '';
                changed = true;
            } else if (menu.page === 0) {
                enterMain();
                return;
            }
        }

        if (changed) {
            lobbyLog();
        }
    }

    const teamRules = () => ({teams: MODES[menu.mode].gameMode === 3, solo: MODES[menu.mode].gameMode === 5});
    const slotActive = slot => slot.type === 'cpu' || (slot.type === 'human' && slot.joined);

    function lobbyInput() {
        if (menu.page < 2) {
            menuPageInput();
            return;
        }

        let changed = false;

        for (let i = 0; i < 4; i++) {
            const pad = pads[i],
                slot = lobby.slots[i];

            if (pad.justDisconnected && slot.type === 'human') {
                changed = disconnectPlayer(lobby, i) || changed;
            }

            if (!pad.connected) {
                continue;
            }

            const joined = slot.type === 'human' && slot.joined;

            if (!joined) {
                if (pad.justPressed(Gamepad.START) || pad.justPressed(Gamepad.CROSS)) {
                    changed = joinPlayer(lobby, i) || changed;
                    cards[i] = createCardState();
                }

                continue;
            }

            if (i === 0) {
                const step = (pad.justPressed(Gamepad.R2) ? 1 : 0) - (pad.justPressed(Gamepad.L2) ? 1 : 0);

                if (step) {
                    for (let k = 1; k <= 4; k++) {
                        const candidate = (focus + step * k + 8) % 4;

                        if (candidate === 0 || lobby.slots[candidate].type === 'cpu') {
                            focus = candidate;
                            break;
                        }
                    }
                }

                if (focus !== 0 && lobby.slots[focus].type !== 'cpu') {
                    focus = 0;
                }
            }

            const target = i === 0 ? focus : i,
                card = cards[target],
                tslot = lobby.slots[target];

            const dx = (pad.justPressed(Gamepad.RIGHT) ? 1 : 0) - (pad.justPressed(Gamepad.LEFT) ? 1 : 0);
            const dy = (pad.justPressed(Gamepad.DOWN) ? 1 : 0) - (pad.justPressed(Gamepad.UP) ? 1 : 0);

            if (dy) {
                moveEditRow(card, dy);
            }

            const row = EDIT_ROWS[card.row];

            if (dx && row !== 'clear') {
                const kind = row;

                const field = fieldOf(kind),
                    count = choiceCount(kind, lobby.choices);

                let step = dx;

                if (kind === 'perk') {
                    for (
                        let k = 0;
                        k < count && perkLocked((lobby.slots[target].perk + step + count * 9) % count);
                        k++
                    ) {
                        step += dx;
                    }
                }

                changed = cycleAppearance(lobby, target, field, step, count) || changed;
            }

            if (pad.justPressed(Gamepad.SQUARE) && teamRules().teams) {
                changed = toggleTeam(lobby, target) || changed;
            }

            if (pad.justPressed(Gamepad.CROSS) && row === 'clear') {
                if (target !== 0) {
                    changed = setSlotType(lobby, target, 'off') || changed;
                    cards[target] = createCardState();

                    if (i === 0) {
                        focus = 0;
                    }
                }
            }

            if (pad.justPressed(Gamepad.CIRCLE)) {
                if (slot.ready) {
                    changed = setReady(lobby, i, false) || changed;
                } else if (i === 0 && previousPage(menu)) {
                    changed = true;
                }
            }

            if (i === 0) {
                if (pad.justPressed(Gamepad.TRIANGLE)) {
                    changed = addCpu() || changed;
                }

                if (pad.justPressed(Gamepad.SELECT)) {
                    changed = removeCpu() || changed;
                }
            } else if (pad.justPressed(Gamepad.SELECT)) {
                changed = leavePlayer(lobby, i) || changed;
            }

            if (pad.justPressed(Gamepad.START)) {
                if (!slot.ready) {
                    changed = setReady(lobby, i, true) || changed;
                } else if (canStart(lobby, teamRules())) {
                    startFromLobby();
                    return;
                }
            }
        }

        if (changed) {
            lobbyLog();
        }
    }

    function pauseMatch(index, message) {
        paused = true;
        pauser = index;
        pauseIndex = 0;
        notice = message || '';
    }

    function matchAction(item) {
        if (item === 0) {
            paused = false;
            notice = '';
        } else if (item === 1) {
            startMatch(matchOptionsUsed, validation ? 12345 : freshSeed());
        } else if (matchOptionsUsed.campaign) {
            enterCampaign();
        } else if (matchOptionsUsed.test) {
            enterLibrary();
        } else {
            enterLobby(true);
        }
    }

    function matchInput() {
        const owners = humanPads();

        for (const index of owners) {
            const pad = pads[index];

            if (pad.justDisconnected && !paused && match.winner === -1) {
                pauseMatch(
                    index,
                    label(match.players.find(p => p.controllerIndex === index)) + ' CONTROLLER DISCONNECTED'
                );
            }
        }

        if (match.winner !== -1) {
            if (matchOptionsUsed.campaign) {
                return;
            }

            if (!validation && winTimer < TEAM_BANNER_TICKS / RULES.hz) {
                return;
            }

            for (const index of owners) {
                const pad = pads[index];

                if (!pad.connected) {
                    continue;
                }

                if (pad.justPressed(Gamepad.UP) || pad.justPressed(Gamepad.DOWN)) {
                    resultIndex = 1 - resultIndex;
                }

                if (pad.justPressed(Gamepad.CROSS)) {
                    if (resultIndex === 0) {
                        startMatch(matchOptionsUsed, validation ? 12345 : freshSeed());
                    } else {
                        enterLobby(true);
                    }

                    return;
                }

                if (pad.justPressed(Gamepad.START)) {
                    startMatch(matchOptionsUsed, validation ? 12345 : freshSeed());
                    return;
                }
            }

            return;
        }

        if (paused) {
            const pad = pads[pauser];

            if (pad.justPressed(Gamepad.UP)) {
                pauseIndex = (pauseIndex + 2) % 3;
            }

            if (pad.justPressed(Gamepad.DOWN)) {
                pauseIndex = (pauseIndex + 1) % 3;
            }

            if (pad.justPressed(Gamepad.CIRCLE)) {
                prefs.music = !prefs.music;

                if (prefs.music) {
                    music.play();
                } else {
                    music.pause();
                }

                saveOptions();
            }

            if (pad.justPressed(Gamepad.CROSS)) {
                matchAction(pauseIndex);
            } else if (pad.justPressed(Gamepad.START)) {
                paused = false;
                notice = '';
            }

            return;
        }

        for (const index of owners) {
            if (pads[index].connected && pads[index].justPressed(Gamepad.START)) {
                pauseMatch(index);
                return;
            }
        }

        for (const index of owners) {
            const pad = pads[index],
                input = pending[index];

            const keys = prefs.binds[index];

            input.move = (heldBy(pad, keys.right) ? 1 : 0) - (heldBy(pad, keys.left) ? 1 : 0);

            if (!input.move && Math.abs(pad.leftX) > 0.2) {
                input.move = pad.leftX;
            }

            input.jump = input.jump || pressedBy(pad, keys.jump);
            input.jumpHeld = heldBy(pad, keys.jump);
            input.down = input.down || pressedBy(pad, keys.down);
            input.downHeld = heldBy(pad, keys.down) || pad.leftY > 0.6;
            input.fire = heldBy(pad, keys.shoot);
            input.grenade = heldBy(pad, keys.bomb);
        }
    }

    const shadowRecords = new Float32Array(16 * 32),
        shadowWords = new Uint32Array(shadowRecords.buffer);

    const bodyRecords = new Float32Array(16 * 48),
        bodyWords = new Uint32Array(bodyRecords.buffer);

    const handRecords = new Float32Array(16 * 8),
        handWords = new Uint32Array(handRecords.buffer);

    const legBehind = new Float32Array(20 * 5),
        legAbove = new Float32Array(20 * 5);

    const actorList = [],
        actorX = [0, 0, 0, 0],
        actorY = [0, 0, 0, 0];

    function victoryActor() {
        const w = match.winner >= 0 && match.mode !== 3 && !validation ? match.players[match.winner] : null;
        return w && matchOptionsUsed.campaign && w.type !== 'human' ? null : w;
    }

    function stepWinPose(dt) {
        const w = victoryActor();

        w.vx = w.vy = 0;

        const held = pads.some((p, i) => p.connected && heldBy(p, prefs.binds[i].shoot));

        winPose.acc += dt * RULES.hz;

        while (winPose.acc >= 1) {
            winPose.acc--;
            animateIdle(w);
            animateJump(w);

            const d = held ? 2 : 3;

            winPose.lean += ((held ? -15 * w.facing : 0) - winPose.lean) / d;
            winPose.hand += ((held ? -10 : 0) - winPose.hand) / d;
        }
    }

    let survMeta = null,
        survImage = null;

    const survOptions = {
        width: 0,
        height: 0,
        startx: 0,
        starty: 0,
        endx: 0,
        endy: 0,
        color: Color.new(128, 128, 128),
        flipX: false,
        angle: 0,
        originX: 0,
        originY: 0
    };

    const duckList = [],
        duckX = [],
        duckY = [];

    function survival() {
        if (!survImage) {
            survMeta = JSON.parse(std.loadFile('assets/survival/atlas.json'));
            survImage = new Image(survMeta.image);

            if (!survImage.ready()) {
                throw new Error('Survival texture could not be loaded');
            }
        }

        return survMeta;
    }

    function survPart(name, x, y, scale, flip, tint) {
        const q = survMeta.parts[name],
            org = survMeta.origins[name],
            o = survOptions;

        o.width = q.w * scale;
        o.height = q.h * scale;
        o.startx = q.x;
        o.starty = q.y;
        o.endx = q.x + q.w;
        o.endy = q.y + q.h;
        o.flipX = flip;
        o.color = tint || neutralTint;
        survImage.draw(x - (flip ? q.w - org[0] : org[0]) * scale, y - org[1] * scale, o);
    }

    function survBlit(name, x, y, tint) {
        const q = survMeta.parts[name],
            o = survOptions;

        o.width = q.w;
        o.height = q.h;
        o.startx = q.x;
        o.starty = q.y;
        o.endx = q.x + q.w;
        o.endy = q.y + q.h;
        o.flipX = false;
        o.color = tint || neutralTint;
        survImage.draw(Math.round(x), Math.round(y), o);
    }

    function drawDucks() {
        survival();

        for (let i = 0; i < duckList.length; i++) {
            const z = duckList[i],
                frame = 1 + ((match.tick + z.id * 5) % 18);

            survPart(
                'duck' + frame,
                duckX[i],
                duckY[i] - 27.2 * 0.8,
                0.8,
                z.facing < 0,
                z.hit > 0 ? hurtTint : neutralTint
            );
        }

        survOptions.flipX = false;
    }

    const hurtTint = Color.new(128, 90, 90);

    function chestArt(f) {
        if (f === 2) {
            return 'chest2';
        }

        let best = 3;

        for (const c of survMeta.origins.chestFrames) {
            if (c !== 2 && c <= f && c >= best) {
                best = c;
            }
        }

        return 'chest' + best;
    }

    function drawChest(blend) {
        const c = match.chest;

        if (!c) {
            return;
        }

        survival();
        survPart(chestArt(c.frame), c.x, c.y, 1, false);

        const shown = c.randgun > 0 ? c.randgun : c.slot || c.randgun < 0 ? c.display || 0 : 0;

        if (c.frame >= 12 && c.frame < 160 && shown > 0) {
            kit.drawWeaponIcon(shown, c.x, c.y - 30, 70, 0);
        }
    }

    function drawWaveHud() {
        survival();

        const s = match.survival,
            q = survMeta.parts.wavehud,
            org = survMeta.origins;

        const x0 = 640 - q.w - 64,
            y0 = VIEW_Y + 4,
            ox = x0 - org.wavehud[0],
            oy = y0 - org.wavehud[1];

        survBlit('wavehud', x0, y0);

        const put = (table, n, pos) => {
            let cx = ox + pos[0];
            const text = String(Math.max(0, n));

            for (let i = 0; i < text.length; i++) {
                const d = table[text.charCodeAt(i) - 48];

                drawPart(d, cx, oy + pos[1]);
                cx += d.advance * 0.8;
            }
        };

        put(partLives, s.wave, org.numbers.wave);
        put(partAmmo, s.killed, org.numbers.left);
        put(partAmmo, s.total, org.numbers.total);
    }

    function drawWaveBanner() {
        if (waveBanner.t < 0) {
            return;
        }

        survival();

        const b = survMeta.origins.banner,
            top = b.top[Math.min(79, waveBanner.t)];

        if (top === null || top === undefined) {
            return;
        }

        const word = survMeta.parts.wave,
            text = String(waveBanner.wave);

        let width = word.w + b.gap;

        for (const ch of text) {
            width += survMeta.parts['digit' + ch].w + 2;
        }

        let x = Math.round(320 - width / 2);

        survBlit('wave', x, VIEW_Y + top);
        x += word.w + b.gap;

        for (const ch of text) {
            const d = survMeta.parts['digit' + ch];

            survBlit('digit' + ch, x, VIEW_Y + top + (word.h - d.h) / 2);
            x += d.w + 2;
        }
    }

    function drawActors(alpha) {
        let shadows = 0,
            bodies = 0,
            hands = 0,
            legs = 0;

        actorList.length = 0;
        duckList.length = 0;
        duckX.length = 0;
        duckY.length = 0;

        const posed = victoryActor();

        let posedX = 0,
            posedY = 0;

        const q = fxMeta.parts.shadow;

        for (const p of match.players) {
            if (!p.active || p.alpha <= 0) {
                continue;
            }

            const x = p.px + (p.x - p.px) * alpha,
                y = p.py + (p.y - p.py) * alpha;

            if (y < -100 || y > 680) {
                continue;
            }

            if (posed === p) {
                ((posedX = x), (posedY = y));
            }

            if (p.isZombie) {
                if (shadows < 31) {
                    const o = 16 * shadows++;

                    shadowRecords[o] = x - 16;
                    shadowRecords[o + 1] = y + 1 - 16;
                    shadowRecords[o + 2] = 32;
                    shadowRecords[o + 3] = 32;
                    shadowRecords[o + 4] = q.x;
                    shadowRecords[o + 5] = q.y;
                    shadowRecords[o + 6] = q.x + q.w;
                    shadowRecords[o + 7] = q.y + q.h;
                    shadowWords[o + 8] = shadowWords[o + 9] = shadowWords[o + 10] = 128;
                    shadowWords[o + 11] = 35;
                }

                duckList.push(p);
                duckX.push(x);
                duckY.push(y);
                continue;
            }

            const i = actorList.length;

            actorList.push(p);
            actorX[i] = x;
            actorY[i] = y;

            const o = 16 * shadows++;
            const s = p.scale / 80;

            shadowRecords[o] = x - 16 * s;
            shadowRecords[o + 1] = y + 1 - 16 * s;
            shadowRecords[o + 2] = 32 * s;
            shadowRecords[o + 3] = 32 * s;
            shadowRecords[o + 4] = q.x;
            shadowRecords[o + 5] = q.y;
            shadowRecords[o + 6] = q.x + q.w;
            shadowRecords[o + 7] = q.y + q.h;
            shadowWords[o + 8] = shadowWords[o + 9] = shadowWords[o + 10] = 128;
            shadowWords[o + 11] = Math.round((35 * p.alpha) / 100);

            if (p === posed) {
                continue;
            }

            if (kit.legRotated(p)) {
                kit.writeLegQuads(p, x, y, p.scale / 100, legBehind, legs, legAbove, legs);
                legs++;
            }

            bodies += kit.writeBody(p, x, y, p.scale / 100, bodyRecords, bodyWords, bodies);
            hands += kit.writeFrontHand(p, x, y, p.scale / 100, handRecords, handWords, hands);
        }

        if (shadows) {
            fxAtlas.drawList(shadowRecords, shadows);
        }

        if (duckList.length) {
            drawDucks();
        }

        if (legs) {
            kit.cosmeticsImage.drawQuads(legBehind, legs);
        }

        if (bodies) {
            kit.cosmeticsImage.drawList(bodyRecords, bodies);
        }

        if (legs) {
            kit.cosmeticsImage.drawQuads(legAbove, legs);
        }

        if (posed && posed.active) {
            kit.drawPosed(posed, posedX, posedY, posed.scale / 100, winPose.lean, winPose.hand);
        }

        for (let i = 0; i < actorList.length; i++) {
            if (!actorList[i].unarmed && actorList[i] !== posed) {
                kit.drawWeapon(actorList[i], actorX[i], actorY[i], actorList[i].scale / 100);
            }
        }

        if (hands) {
            kit.cosmeticsImage.drawList(handRecords, hands);
        }

        for (let i = 0; i < actorList.length; i++) {
            const p = actorList[i],
                x = actorX[i],
                y = actorY[i];

            if (p.invisible > 0) {
                continue;
            }

            const s = p.scale / 80;

            if (!p.isDouble) {
                Draw.triangle(x - 5, y - 85 * s, x + 5, y - 85 * s, x, y - 78 * s, accents[p.color]);
            }

            if (p.grenadeCharge > 0) {
                Draw.rect(x - 18, y - 76, 36, 4, ink);
                Draw.rect(x - 18, y - 76, (36 * p.grenadeCharge) / GRENADE.maxCharge, 4, yellow);
            }
        }
    }

    const HUD = JSON.parse(std.loadFile('assets/hud/hud.json'));
    const hudAtlas = new Image(HUD.atlas.image);

    if (!hudAtlas.ready()) {
        throw new Error('HUD texture could not be loaded');
    }

    const hudPartOptions = {width: 0, height: 0, startx: 0, starty: 0, endx: 0, endy: 0, color: 0};

    function drawPart(q, x, y, scale, tint) {
        const o = hudPartOptions,
            k = scale === undefined ? 1 : scale;

        o.width = q.w * k;
        o.height = q.h * k;
        o.startx = q.x;
        o.starty = q.y;
        o.endx = q.x + q.w;
        o.endy = q.y + q.h;
        o.color = tint === undefined ? NEUTRAL : tint;
        hudAtlas.draw(Math.round(x + q.ox * k), Math.round(y + q.oy * k), o);
    }

    const hudPart = (name, x, y, scale, tint) => drawPart(HUD.parts[name], x, y, scale, tint);
    const NEUTRAL = 128 + (128 << 8) + (128 << 16) + (128 << 24);
    const P = HUD.parts;

    const partLives = [],
        partAmmo = [],
        partWeapon = {},
        partName = {p: [], c: [], e: []},
        partInd = [],
        partCombo = {},
        partPerk = {};

    for (let d = 0; d < 10; d++) {
        partLives.push(P['lives' + d]);
        partAmmo.push(P['ammo' + d]);
    }

    for (let n = 1; n <= 8; n++) {
        if (P['perk_' + n]) {
            partPerk[n] = P['perk_' + n];
        }
    }

    for (let n = 1; P['name_e' + n]; n++) {
        partName.e.push(P['name_e' + n]);
    }

    for (let n = 1; n <= 4; n++) {
        partName.p.push(P['name_p' + n]);
        partName.c.push(P['name_c' + n]);
        partInd.push(P['ind' + n]);
    }

    for (const id of Object.keys(WEAPONS)) {
        partWeapon[id] = P['wpn' + id];
    }

    for (const key of Object.keys(P)) {
        if (key.startsWith('combo_')) {
            partCombo[key.slice(6)] = P[key];
        }
    }

    const stateParts = {
        card: P.card,
        hdrLives: P.hdrLives,
        hdrLevel: P.hdrLevel,
        hdrHealth: P.hdrHealth,
        levelup: P.levelup,
        flawless: P.flawless,
        almost: P.almost,
        beyond: P.beyond,
        skull: P.skull,
        gameover: P.gameover,
        lastlifeBright: P.lastlifeBright,
        lastlifeDark: P.lastlifeDark,
        ammoinf: P.ammoinf
    };

    function hudDigits(table, text, x, y) {
        let cursor = x;

        for (let i = 0; i < text.length; i++) {
            const q = table[text.charCodeAt(i) - 48];

            drawPart(q, cursor, y);
            cursor += q.advance;
        }

        return cursor - x;
    }

    function digitsWidth(table, text) {
        let w = 0;

        for (let i = 0; i < text.length; i++) {
            w += table[text.charCodeAt(i) - 48].advance;
        }

        return w;
    }

    function putRecord(q, x, y, scale) {
        const o = 16 * hudCount++,
            k = scale === undefined ? 1 : scale;

        hudRecords[o] = Math.round(x + q.ox * k);
        hudRecords[o + 1] = Math.round(y + q.oy * k);
        hudRecords[o + 2] = q.w * k;
        hudRecords[o + 3] = q.h * k;
        hudRecords[o + 4] = q.x;
        hudRecords[o + 5] = q.y;
        hudRecords[o + 6] = q.x + q.w;
        hudRecords[o + 7] = q.y + q.h;
        hudWords[o + 8] = hudWords[o + 9] = hudWords[o + 10] = hudWords[o + 11] = 128;
    }

    function putDigits(table, text, x, y) {
        let cursor = x;

        for (let i = 0; i < text.length; i++) {
            const q = table[text.charCodeAt(i) - 48];

            putRecord(q, cursor, y);
            cursor += q.advance;
        }
    }

    const hudTick = () => match.tick + (match.winner !== -1 ? Math.floor(winTimer * RULES.hz) : 0);

    function bannerCode(p, st) {
        const now = hudTick();

        if (match.mode === 4) {
            if (st.level >= 0 && p.level > st.level) {
                st.luAt = now;
            }

            st.level = p.level;

            if (st.luAt >= 0 && now - st.luAt < 90) {
                return 201 + (now - st.luAt);
            }

            return 0;
        }

        if (match.survival) {
            return 0;
        }

        if (p.lives !== st.lives) {
            if (p.lives === 1 && st.llStart < 0) {
                st.llStart = now;
            }

            if (p.lives === 0 && st.goAt < 0) {
                st.goAt = Math.max(now, st.llStart >= 0 ? st.llStart + 90 : now);
            }

            st.lives = p.lives;
        }

        if (st.goAt >= 0 && now >= st.goAt) {
            const f = now - st.goAt;
            return f < 90 ? 101 + f : 0;
        }

        if (st.llStart >= 0) {
            const f = now - st.llStart;

            if (f < 90) {
                return 1 + f;
            }
        }

        return 0;
    }

    function clearHud() {
        for (let i = 0; i < 64; i++) {
            hudRecords[16 * i + 2] = 0;
        }

        for (let i = 0; i < 16; i++) {
            portraitRecords[16 * i + 2] = 0;
        }

        for (let i = 0; i < 4; i++) {
            cardKeys[i] = -1;
        }
    }

    const shownLives = p => (match.mode === 4 ? p.level : p.lives);

    function cardKey(p, st) {
        return (
            shownLives(p) +
            32 * p.weaponId +
            4096 * (p.lives > 0 ? p.ammo : 0) +
            4294967296 * bannerCode(p, st) +
            (p.type === 'cpu' ? 1 << 27 : 0) +
            (p.perk || 0) * (1 << 28) +
            1
        );
    }

    function rebuildCard(p) {
        const F = HUD.fields,
            S = STAGE_SCALE,
            gutter = 2 * S;

        const slot = p.hudSlot,
            st = hudState[slot];

        const cx = HUD.slots[slot][0] * S,
            cy = VIEW_Y + HUD.slots[slot][1] * S;

        hudCount = 16 * slot;
        putRecord(stateParts.card, cx, cy);

        putRecord(
            match.mode === 4 ? stateParts.hdrLevel : match.survival ? stateParts.hdrHealth : stateParts.hdrLives,
            cx,
            cy
        );

        const total = match.totalLives;

        if (match.mode === 4 || match.survival) {
        } else if (p.lives === total) {
            putRecord(stateParts.flawless, cx, cy);
        } else if (p.lives === total - 1) {
            putRecord(stateParts.almost, cx, cy);
        } else if (p.lives > total) {
            putRecord(stateParts.beyond, cx, cy);
        }

        let portrait = 0;

        if (p.lives > 0) {
            portrait = kit.writePortrait(
                p,
                cx - 64.3 * S,
                cy + 43.8 * S,
                0.8221 * S * 0.9,
                portraitRecords,
                portraitWords,
                4 * slot
            );
        } else {
            putRecord(stateParts.skull, cx, cy);
        }

        for (let i = portrait; i < 4; i++) {
            portraitRecords[16 * (4 * slot + i) + 2] = 0;
        }

        putRecord(
            p.nameId ? partName.e[p.nameId - 1] : (p.type === 'cpu' ? partName.c : partName.p)[p.controllerIndex],
            cx + F.name.x * S + gutter,
            cy + F.name.y * S + gutter
        );

        if (partPerk[p.perk]) {
            putRecord(partPerk[p.perk], cx + 62, cy - 30);
        }

        const livesText = String(shownLives(p));

        putDigits(
            partLives,
            livesText,
            cx + F.lives.x * S + (F.lives.w * S - digitsWidth(partLives, livesText)) / 2,
            cy + F.lives.y * S + gutter
        );

        if (p.lives > 0 && !p.unarmed) {
            const weapon = WEAPONS[p.weaponId];

            if (weapon.magazine > 999) {
                putRecord(stateParts.ammoinf, cx + F.ammo.x * S + gutter, cy + F.ammo.y * S + gutter);
            } else {
                putDigits(partAmmo, String(p.ammo), cx + F.ammo.x * S + gutter, cy + F.ammo.y * S + gutter);
            }

            putRecord(partWeapon[p.weaponId], cx + F.weapon.x * S + gutter, cy + F.weapon.y * S + gutter);
        }

        const code = bannerCode(p, st);

        if (code >= 201) {
            putRecord(stateParts.levelup, cx, cy + HUD.banner.levelup.dy[code - 201] * S);
        } else if (code >= 101) {
            putRecord(stateParts.gameover, cx, cy + HUD.banner.gameover.dy[code - 101] * S);
        } else if (code >= 1) {
            putRecord(
                HUD.banner.lastlife.bright[code - 1] ? stateParts.lastlifeBright : stateParts.lastlifeDark,
                cx,
                cy + HUD.banner.lastlife.dy[code - 1] * S
            );
        }

        for (let i = hudCount; i < 16 * slot + 16; i++) {
            hudRecords[16 * i + 2] = 0;
        }
    }

    function drawCards(players) {
        lap('hud.pre');

        for (const p of players) {
            if (p.isDouble || p.isZombie) {
                continue;
            }

            const slot = p.hudSlot;
            let st = hudState[slot];

            if (!st) {
                st = hudState[slot] = {lives: -1, llStart: -1, goAt: -1, level: -1, luAt: -1};
            }

            const key = cardKey(p, st);

            if (key !== cardKeys[slot]) {
                cardKeys[slot] = key;
                rebuildCard(p);
            }
        }

        lap('hud.build');
        hudAtlas.drawList(hudRecords, 64);

        if (!skip.has('portrait')) {
            kit.cosmeticsImage.drawList(portraitRecords, 16);
        }

        lap('hud.draw');
    }

    function popupPart(name, x, y, tint) {
        const q = popupMeta.parts[name],
            o = hudPartOptions;

        o.width = q.w;
        o.height = q.h;
        o.startx = q.x;
        o.starty = q.y;
        o.endx = q.x + q.w;
        o.endy = q.y + q.h;
        o.color = tint;
        popupAtlas.draw(Math.round(x), Math.round(y), o);
        return q.w;
    }

    const feedName = p =>
        p.nameId ? 'kf_e' + p.nameId : 'kf_' + (p.type === 'cpu' ? 'c' : 'p') + (p.controllerIndex + 1);

    const tagTint = Color.new(128, 128, 128);
    const teamTints = [Color.new(128, 0, 26), Color.new(0, 51, 128)];

    function drawNameTags() {
        const zoom = STAGE_SCALE * framing.zoom,
            k = framing.zoom;

        for (const p of match.players) {
            if (!p.active || p.spawnPending || p.invisible > 0 || p.alpha < 100 || p.isDouble || p.isZombie) {
                continue;
            }

            const q =
                popupMeta.parts[
                    p.nameId ? 'tag_e' + p.nameId : 'tag_' + (p.type === 'cpu' ? 'c' : 'p') + (p.controllerIndex + 1)
                ];

            if (!q) {
                continue;
            }

            const x = p.px + (p.x - p.px) * drawBlend,
                y = p.py + (p.y - p.py) * drawBlend;

            const sx = 320 + (x - framing.x) * zoom,
                sy = VIEW_Y + 213.5 + (y - (99 * p.scale) / 80 - framing.y) * zoom;

            const o = hudPartOptions;

            o.width = q.w * k;
            o.height = q.h * k;
            o.startx = q.x;
            o.starty = q.y;
            o.endx = q.x + q.w;
            o.endy = q.y + q.h;
            o.color = match.mode === 3 ? teamTints[p.team === 0 ? 0 : 1] : tagTint;
            popupAtlas.draw(Math.round(sx - (q.w * k) / 2), Math.round(sy - (q.h * k) / 2), o);
        }
    }

    function drawKillFeed() {
        for (let i = 0; i < killFeed.length; i++) {
            const e = killFeed[i];
            const a = e.t <= 10 ? e.t * 10 : e.t > 110 ? 100 - (e.t - 110) * 10 : 100;

            if (a <= 1) {
                continue;
            }

            const tint = alphaTint[Math.max(0, Math.min(128, Math.round(a * 1.28)))];
            const y = VIEW_Y + 8 + i * 30 * STAGE_SCALE;
            let x = 8;

            if (e.killer && e.killer !== e.victim) {
                x += popupPart(feedName(e.killer), x, y, tint) + 8;
                x += popupPart('kf_' + e.verb, x, y, tint) + 8;
            } else {
                x += popupPart('kf_skull', x, y - 4, tint) + 6;
            }

            popupPart(feedName(e.victim), x, y, tint);
        }
    }

    function hudDraw() {
        const players = match.players;

        for (const mark of framing.indicators) {
            const p = players[mark.id];

            if (!p || p.isDouble || p.invisible > 0) {
                continue;
            }

            const sx = clamp(mark.x * STAGE_SCALE, 10, 630),
                sy = clamp(VIEW_Y + mark.y * STAGE_SCALE, 20, 420);

            Draw.rect(sx - 9, sy - 8, 18, 16, ink);
            Draw.rect(sx - 7, sy - 6, 14, 12, accents[p.color]);
            drawPart(partInd[p.controllerIndex], sx - 4, sy - 7);
        }

        if (!skip.has('combolist')) {
            drawCombos(drawBlend);
        }

        lap('combos');

        if (!skip.has('cards') && !matchOptionsUsed.test) {
            drawCards(players);
        }

        if (!skip.has('names')) {
            drawNames();
        }

        if (!skip.has('tags')) {
            drawNameTags();
        }

        if (!skip.has('feed')) {
            drawKillFeed();
        }

        if (match.survival && match.winner === -1) {
            drawWaveHud();
            drawWaveBanner();
        }

        lap('killfeed');

        if (match.winner !== -1) {
            if (match.mode === 3) {
                drawTeamWin();
            } else {
                drawWinnerClip();
            }

            if (matchOptionsUsed.campaign) {
                campaignBanner();
            } else if (validation || winTimer >= TEAM_BANNER_TICKS / RULES.hz) {
                resultsDraw();
            }
        } else if (paused) {
            pauseDraw();
        }
    }

    let dyStage = 0;

    const S_ = STAGE_SCALE,
        X = x => x * S_,
        Y = y => VIEW_Y + (y + dyStage) * S_;

    const MENU_BOOST = 1.2;

    const half = hex =>
        Color.new(
            parseInt(hex.slice(1, 3), 16) >> 1,
            parseInt(hex.slice(3, 5), 16) >> 1,
            parseInt(hex.slice(5, 7), 16) >> 1
        );

    const rgb = hex =>
        Color.new(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));

    const menuFonts = {};

    for (const [name, file, px] of [
        ['title', 'hud', 50],
        ['big', 'hud', 34],
        ['button', 'hud', 22],
        ['tag', 'hud', 20],
        ['body', 'hud', 18],
        ['small', 'hud', 16],
        ['tiny', 'hud', 11]
    ]) {
        const font = new Font('assets/fonts/' + file + '.ttf', {
            size: Math.max(6, Math.round(px * S_ * MENU_BOOST * 2))
        });

        font.scale = 0.5;
        menuFonts[name] = font;
    }

    const MC = {
        bg: rgb('#333333'),
        white: rgb('#ffffff'),
        orange: rgb('#ff6600'),
        orangeDim: rgb('#9a6a4a'),
        panel: rgb('#dfdfdf'),
        rowLight: rgb('#cccccc'),
        rowDark: rgb('#333333'),
        cellLight: rgb('#a3a3a3'),
        cellDark: rgb('#525252'),
        black: rgb('#000000'),
        shade: Color.new(0, 0, 0, 100),
        select: rgb('#ffe0cc')
    };

    const liftOf = font => font.size * 0.5 * 0.2;

    function text(fontName, str, x, y, hex) {
        const font = menuFonts[fontName];

        font.color = half(hex);
        font.print(X(x), Y(y) - liftOf(font), str);
    }

    function textWidth(fontName, str) {
        return menuFonts[fontName].getTextSize(str).width / S_;
    }

    function textFit(fontName, str, x, y, hex, maxW) {
        const font = menuFonts[fontName],
            k = Math.min(1, maxW / Math.max(1, textWidth(fontName, str)));

        font.scale = 0.5 * k;
        text(fontName, str, x, y + (1 - k) * 6, hex);
        font.scale = 0.5;
    }

    function textRight(fontName, str, right, y, hex) {
        text(fontName, str, right - textWidth(fontName, str), y, hex);
    }

    function textCenter(fontName, str, cx, y, hex) {
        text(fontName, str, cx - textWidth(fontName, str) / 2 + 1.5, y, hex);
    }

    const capOffset = fontName => 0.555 * NOMINAL[fontName] - 5.3;
    const NOMINAL = {title: 50, big: 34, button: 22, tag: 20, body: 18, small: 16, tiny: 11};

    function textBox(fontName, str, x, y, w, h, hex, align = 'center', pad = 8) {
        const tw = textWidth(fontName, str);
        const tx = align === 'left' ? x + pad : align === 'right' ? x + w - pad - tw : x + (w - tw) / 2 + 1.5;

        text(fontName, str, tx, y + h / 2 - capOffset(fontName), hex);
    }

    const box = (x, y, w, h, color) =>
        Draw.rect(
            Math.round(X(x)),
            Math.round(Y(y)),
            Math.max(1, Math.round(w * S_)),
            Math.max(1, Math.round(h * S_)),
            color
        );

    function frame(x, y, w, h, t, color) {
        box(x, y, w, t, color);
        box(x, y + h - t, w, t, color);
        box(x, y, t, h, color);
        box(x + w - t, y, t, h, color);
    }

    function wrapLines(fontName, str, maxWidth) {
        const lines = [];
        let line = '';

        for (const word of str.split(' ')) {
            const trial = line ? line + ' ' + word : word;

            if (line && textWidth(fontName, trial) > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = trial;
            }
        }

        lines.push(line);
        return lines;
    }

    const SHADOW_DARK = [rgb('#2d2d2d'), rgb('#202020'), rgb('#141414')],
        SHADOW_LIGHT = [rgb('#acacac'), rgb('#737373'), rgb('#4f4f4f')];

    function shadowed(x, y, w, h, color, light) {
        const set = light ? SHADOW_LIGHT : SHADOW_DARK;

        for (let k = 0; k < 3; k++) {
            box(x + 6 - 2 * k, y + 6 - 2 * k, w, h, set[k]);
        }

        box(x, y, w, h, color);
    }

    function header(ox, label) {
        shadowed(ox + 20, 20, 860, 60, MC.white);
        textBox('title', label, ox + 20, 20, 860, 60, '#000000', 'left', 14);
    }

    function bar(x, y, w, h, label, hex, align) {
        shadowed(x, y, w, h, MC.white);
        textBox('big', label, x, y, w, h, hex, align === 'left' ? 'left' : 'right', 16);
    }

    const gsetupImage = new Image('assets/ui/gsetup.png');
    const gsetupParts = JSON.parse(std.loadFile('assets/ui/gsetup.json')).parts;

    const gsetupOptions = {
        width: 0,
        height: 0,
        startx: 0,
        starty: 0,
        endx: 0,
        endy: 0,
        color: Color.new(128, 128, 128)
    };

    function drawGsetup(name, x, y) {
        const q = gsetupParts[name],
            o = gsetupOptions;

        o.width = q.w;
        o.height = q.h;
        o.startx = q.x;
        o.starty = q.y;
        o.endx = q.x + q.w;
        o.endy = q.y + q.h;
        gsetupImage.draw(Math.round(X(x + q.ox)), Math.round(Y(y + q.oy)), o);
    }

    function checkbox(x, y, checked) {
        box(x, y, 28, 28, rgb('#373737'));
        box(x + 3, y + 3, 22, 22, rgb('#dadada'));

        if (checked) {
            const red = rgb('#990000');

            for (let k = -2; k <= 2; k++) {
                Draw.line(X(x + 5 + k), Y(y + 14), X(x + 12 + k), Y(y + 23), red);
                Draw.line(X(x + 12 + k), Y(y + 23), X(x + 31 + k), Y(y - 6), red);
            }
        }
    }

    function drawSetupPage(ox) {
        header(ox, PAGES[0]);
        shadowed(ox + 20, 100, 360, 400, MC.panel);
        drawGsetup('gamemodes', ox + 30, 131);

        const shownMode = menu.row < MODES.length ? menu.row : menu.mode;

        for (let i = 0; i < MODES.length; i++) {
            const y = 161 + i * 65.7;

            shadowed(ox + 30, y, 334, 60, i === shownMode ? MC.orange : MC.white, true);
            drawGsetup('mode' + i, ox + 30, y);
        }

        const shown = MODES[shownMode];

        shadowed(ox + 400, 100, 480, 220, MC.white);
        drawGsetup('head' + shownMode, ox + 410, 134);
        box(ox + 410, 160, 440, 2, MC.black);

        for (let j = 0; gsetupParts['desc' + shownMode + '_' + j]; j++) {
            drawGsetup('desc' + shownMode + '_' + j, ox + 414, 182 + j * 27);
        }

        if (!shown.available) {
            textBox('body', 'NOT AVAILABLE IN THIS PORT', ox + 404, 280, 250, 24, '#ff6600', 'left', 10);
        }

        shadowed(ox + 670, 248, 198, 62, rgb('#d9d9d9'), true);
        drawGsetup('note0', ox + 678, 265);
        drawGsetup('note1', ox + 678, 288);
        shadowed(ox + 400, 340, 480, 160, MC.white);
        drawGsetup('options', ox + 412, 356);
        box(ox + 402, 373, 446, 2, MC.black);
        drawGsetup('lives', ox + 409, 404);
        box(ox + 472, 388, 62, 22, rgb('#cccccc'));
        box(ox + 472, 388, 62, 1, MC.black);
        box(ox + 532, 388, 2, 22, MC.black);

        {
            let dx = ox + 478;

            for (const ch of String(lobby.lives)) {
                drawGsetup('d' + ch, dx, 399);
                dx += 7.5;
            }
        }

        drawGsetup('crates', ox + 598, 404);
        checkbox(ox + 654, 390, lobby.crates);
        drawGsetup('pickups', ox + 586, 452);
        checkbox(ox + 654, 438, lobby.pickups);

        const cursors = {
            [SETUP_ROWS.lives]: [404, 384, 140, 30],
            [SETUP_ROWS.crates]: [576, 382, 120, 36],
            [SETUP_ROWS.pickups]: [576, 430, 120, 36]
        };

        const c = cursors[menu.row];

        if (c) {
            frame(ox + c[0], c[1], c[2], c[3], 3, MC.orange);
        }

        bar(ox + 20, 520, 200, 60, 'BACK', '#000000', 'left');
        text('tiny', 'TO MENU', ox + 150, 568 - capOffset('tiny'), '#000000');
        bar(ox + 240, 520, 640, 60, 'CONTINUE', shown.available ? '#000000' : '#777777', 'right');

        if (menuNotice) {
            text('body', menuNotice, ox + 262, 545, '#ff6600');
        }
    }

    const mapselImage = new Image('assets/ui/mapsel.png');
    const mapselParts = JSON.parse(std.loadFile('assets/ui/mapsel.json')).parts;

    let mapPreviewImage = null,
        mapPreviewFrame = 0;

    function mapPreview(frame) {
        if (frame !== mapPreviewFrame) {
            if (mapPreviewImage) {
                mapPreviewImage.free();
            }

            mapPreviewImage = new Image('assets/ui/maps/map' + frame + '.png');
            mapPreviewFrame = frame;
        }

        return mapPreviewImage;
    }

    function drawMapPage(ox) {
        header(ox, PAGES[1]);

        const count = mapRows(menu);

        for (let r = 0; r < count; r++) {
            const q = mapselParts['name' + r];

            shadowed(ox + 16, q.top, 200, q.ih, menu.mapRow === r ? MC.orange : MC.white);
            gsetupOptions.width = q.w;
            gsetupOptions.height = q.h;
            gsetupOptions.startx = q.x;
            gsetupOptions.starty = q.y;
            gsetupOptions.endx = q.x + q.w;
            gsetupOptions.endy = q.y + q.h;
            mapselImage.draw(Math.round(X(ox + 16 + q.ox)), Math.round(Y(q.top + q.oy)), gsetupOptions);
        }

        shadowed(ox + 240, 100, 640, 390, MC.white);

        const arena = arenaOfRow(menu, menu.mapRow);

        mapPreview(arena < 0 ? 13 : arena + 1).draw(Math.round(X(ox + 260)), Math.round(Y(120)), {
            width: Math.round(600 * S_),
            height: Math.round(350 * S_)
        });

        bar(ox + 20, 520, 200, 60, 'BACK', '#000000', 'left');
        bar(ox + 240, 520, 640, 60, 'CONTINUE', '#000000', 'right');
    }

    const UI = {
        face: rgb('#dcdcdc'),
        faceOff: rgb('#cfcfcf'),
        shadow: rgb('#8a8a8a'),
        cell: rgb('#6d6d6d'),
        clear: rgb('#d9a0a0'),
        hot: rgb('#ffcc00'),
        hotClear: rgb('#ff9900')
    };

    function uiButton(x, y, w, h, label, state, face) {
        box(x + 2, y + 2, w, h, UI.shadow);

        box(
            x,
            y,
            w,
            h,
            state === 'hot' ? (face ? UI.hotClear : UI.hot) : face || (state === 'disabled' ? UI.faceOff : UI.face)
        );

        textBox('small', label, x, y, w, h, state === 'disabled' ? '#888888' : '#000000');
    }

    function previewOf(slot) {
        return {
            color: slot.color,
            shirt: slot.shirt,
            hat: slot.hat,
            weaponId: LOADOUTS[slot.weapon],
            facing: 1,
            vx: 0,
            ground: 0,
            walk: 0,
            hit: 0,
            flash: 0,
            reload: 0,
            instagib: 0
        };
    }

    function drawEmptyPanel(cx, i) {
        const slot = lobby.slots[i],
            reserved = slot.type === 'human';

        textCenter('small', 'SLOT EMPTY', cx + 100, 114, '#cc0000');
        textCenter('button', 'SELECT A', cx + 100, 196, '#000000');
        textCenter('button', 'PLAYER TYPE', cx + 100, 222, '#000000');
        uiButton(cx + 25, 246, 150, 24, 'HUMAN PLAYER', reserved && pads[i].connected ? 'hot' : 'normal');
        uiButton(cx + 25, 280, 150, 24, 'AI PLAYER', 'normal');

        textCenter(
            'small',
            reserved && pads[i].connected ? 'START: JOIN ON THIS PAD' : reserved ? 'NO CONTROLLER' : 'START: JOIN',
            cx + 100,
            314,
            '#333333'
        );

        if (i > 0) {
            textCenter('small', 'P1 TRIANGLE: ADD AI', cx + 100, 330, '#333333');
        }
    }

    function drawEditorPanel(cx, i, target, campaignCard) {
        const slot = lobby.slots[target],
            card = campaignCard || cards[target],
            human = campaignCard || slot.type === 'human';

        const controlled = campaignCard ? true : target === 0 ? focus === 0 : target === focus || slot.type === 'human';
        const row = controlled ? EDIT_ROWS[card.row] : '';

        if (!campaignCard) {
            uiButton(
                cx + 22,
                109,
                160,
                24,
                'CLEAR SLOT',
                row === 'clear' ? 'hot' : target === 0 ? 'disabled' : 'normal',
                UI.clear
            );

            box(cx, 145, 200, 3, MC.black);
        }

        if (slot.type === 'cpu' && !campaignCard) {
            textCenter('button', 'AI PLAYER', cx + 100, 150, '#ffa265');
        }

        uiButton(cx + 16, 193, 80, 24, 'HAT', row === 'hat' ? 'hot' : 'normal');
        uiButton(cx + 16, 227, 80, 24, 'SHIRT', row === 'shirt' ? 'hot' : 'normal');
        uiButton(cx + 16, 261, 80, 24, 'HANDGUN', row === 'gun' ? 'hot' : 'normal');
        uiButton(cx + 16, 321, 80, 24, 'PERK', row === 'perk' ? 'hot' : 'normal');
        kit.drawPerk(slot.perk, X(cx + 144), Y(333), 0.85 * S_);
        kit.drawCharacter(previewOf(slot), X(cx + 145), Y(100 + 191), 1.345 * S_, false);
        text('small', 'NAME:', cx + 22, 371, '#000000');

        if (human) {
            box(cx + 26, 391, 150, 24, rgb('#99ccff'));
            box(cx + 26, 413, 150, 2, MC.black);
            box(cx + 174, 391, 2, 24, MC.black);
        }

        textBox(
            'body',
            !human ? 'CPU ' + (target + 1) : 'Player ' + (target + 1),
            cx + 26,
            391,
            150,
            24,
            '#000000',
            'left',
            6
        );

        uiButton(cx + 20, 427, 158, 24, 'COLOR', row === 'color' ? 'hot' : 'normal');

        if (!campaignCard && teamRules().teams) {
            uiButton(cx + 20, 457, 158, 24, 'TEAM ' + (slot.team === 0 ? 'A' : 'B') + '  (SQUARE)', 'normal');
        }
    }

    function drawCard(ox, i) {
        const slot = lobby.slots[i],
            cx = ox + 20 + 220 * i,
            card = cards[i];

        box(cx, 100, 200, 400, MC.white);

        for (let k = 0; k < 2; k++) {
            const offset = (k - card.slide) * 400;

            if (Math.abs(offset) >= 400) {
                continue;
            }

            dyStage = offset;

            if (k === 0) {
                drawEmptyPanel(cx, i);
            } else {
                drawEditorPanel(cx, i, i);
            }
        }

        dyStage = 0;

        if (i === focus && focus !== 0 && slotActive(slot)) {
            frame(cx, 100, 200, 400, 4, MC.orange);
        }
    }

    function drawPlayerPage(ox) {
        for (let i = 0; i < 4; i++) {
            drawCard(ox, i);
        }

        box(ox + 20, -1000, 860, 1018, MC.bg);
        box(ox + 20, 80, 860, 20, MC.bg);
        box(ox + 20, 500, 860, 20, MC.bg);
        box(ox + 20, 580, 860, 1000, MC.bg);
        header(ox, PAGES[2]);
        bar(ox + 20, 520, 200, 60, 'BACK', '#000000', 'left');

        const blockers = startBlockers(lobby, teamRules());

        bar(ox + 240, 520, 640, 60, 'START', blockers.length ? '#777777' : '#000000', 'right');

        const message = blockers.length
            ? blockers
                  .map(b =>
                      b.reason === 'minimum-players'
                          ? 'NEED 2 PLAYERS (P1 TRIANGLE ADDS AI)'
                          : b.reason === 'one-team'
                            ? 'PUT PLAYERS ON BOTH TEAMS (SQUARE)'
                            : 'P' +
                              (b.player + 1) +
                              (b.reason === 'join-required' ? ' PRESS START' : ' PRESS START (READY)')
                  )
                  .join('   ')
            : 'EVERYONE IS READY';

        textBox(
            'body',
            message,
            ox + 240,
            focus !== 0 ? 520 : 520,
            640,
            focus !== 0 ? 44 : 60,
            blockers.length ? '#ff6600' : '#009900',
            'left',
            18
        );

        if (focus !== 0) {
            textBox('small', 'EDITING CPU ' + (focus + 1) + '  (L2/R2)', ox + 240, 556, 640, 22, '#333333', 'left', 18);
        }
    }

    function lobbyDraw() {
        Draw.rect(0, 0, 640, 448, MC.bg);

        const pageDraws = [drawSetupPage, drawMapPage, drawPlayerPage];

        for (let pg = 0; pg < 3; pg++) {
            const ox = (pg - menu.slide) * 900;

            if (ox <= -900 || ox >= 900) {
                continue;
            }

            pageDraws[pg](ox);
        }
    }

    let campPreview = null,
        campPreviewMap = 0;

    function campaignPreview(map) {
        if (map === 13) {
            return null;
        }

        if (map !== campPreviewMap) {
            if (campPreview) {
                campPreview.free();
            }

            campPreview = new Image('assets/ui/maps/map' + map + '.png');
            campPreviewMap = map;
        }

        return campPreview;
    }

    function drawWinnerClip() {
        const w = victoryActor();

        if (!w) {
            return;
        }

        const f = Math.min(41, 1 + Math.floor(winTimer * RULES.hz)),
            top = winnerMeta.top[f - 1],
            a = winnerMeta.alpha[f - 1];

        if (top === null || a <= 0) {
            return;
        }

        const total = match.totalLives,
            variant = w.lives === total ? 1 : w.lives === total - 1 ? 2 : 0;

        const q = winnerMeta.parts['flawless' + variant],
            o = hudPartOptions,
            k = 0.8 * framing.zoom,
            zoom = STAGE_SCALE * framing.zoom;

        const sx = 320 + (w.x - framing.x) * zoom,
            sy = VIEW_Y + 213.5 + (w.y - 150 * 0.8 - framing.y) * zoom;

        o.width = q.w * k;
        o.height = q.h * k;
        o.startx = q.x;
        o.starty = q.y;
        o.endx = q.x + q.w;
        o.endy = q.y + q.h;
        o.color = alphaTint[Math.round(a * 128)];
        winnerImage.draw(Math.round(sx + q.ox * k), Math.round(sy + top * k), o);
    }

    const TEAM_BANNER_TICKS = 100;

    function drawTeamWin() {
        const winner = match.winner >= 0 ? match.players[match.winner] : null;

        if (!winner) {
            return;
        }

        const f = Math.min(20, 2 + Math.floor(winTimer * RULES.hz)),
            top = teamWinMeta.slide[f - 1];

        const q = teamWinMeta.parts[winner.team === 0 ? 'teamA' : 'teamB'],
            o = hudPartOptions;

        o.width = q.w;
        o.height = q.h;
        o.startx = q.x;
        o.starty = q.y;
        o.endx = q.x + q.w;
        o.endy = q.y + q.h;
        o.color = alphaTint[128];
        teamWinImage.draw(Math.round(teamWinMeta.ox), Math.round(VIEW_Y + top), o);
    }

    const loseMeta = JSON.parse(std.loadFile('assets/hud/campaignlose.json'));
    const loseImage = new Image(loseMeta.image);

    if (!loseImage.ready()) {
        throw new Error('Campaign lose texture could not be loaded');
    }

    function campaignBanner() {
        const winner = match.winner >= 0 ? match.players[match.winner] : null;

        if (match.mode === 3 || (winner && winner.type === 'human')) {
            return;
        }

        const f = Math.min(20, 2 + Math.floor(winTimer * RULES.hz)),
            q = loseMeta.parts.lose,
            o = hudPartOptions;

        o.width = q.w;
        o.height = q.h;
        o.startx = q.x;
        o.starty = q.y;
        o.endx = q.x + q.w;
        o.endy = q.y + q.h;
        o.color = alphaTint[128];
        loseImage.draw(Math.round(loseMeta.ox), Math.round(VIEW_Y + loseMeta.slide[f - 1]), o);
    }

    const campMeta = JSON.parse(std.loadFile('assets/ui/campaign.json'));
    const campImage = new Image(campMeta.image);

    if (!campImage.ready()) {
        throw new Error('Campaign texture could not be loaded');
    }

    const campOptions = {width: 0, height: 0, startx: 0, starty: 0, endx: 0, endy: 0, color: Color.new(128, 128, 128)};

    function campPart(name, x, y, w, h) {
        const q = campMeta.parts[name],
            o = campOptions;

        o.width = w === undefined ? q.w : w;
        o.height = h === undefined ? q.h : h;
        o.startx = q.x;
        o.starty = q.y;
        o.endx = q.x + q.w;
        o.endy = q.y + q.h;
        campImage.draw(Math.round(X(x)), Math.round(Y(y)), o);
    }

    function drawSlider() {
        for (let i = 0; i < LEVEL_COUNT; i++) {
            const col = i % 5,
                row = (i / 5) | 0,
                x = 28 + 347 * col + camp.scroll,
                y = 100 + 216.05 * row,
                state = progress.levels[i];

            if (x > 900 || x + 310 < 0) {
                continue;
            }

            shadowed(x, y, 310, 185, MC.white);
            campPart(state === LOCKED ? 'lock' : 'level' + (i + 1), x + 5, y + 5);

            if (state === DONE) {
                campPart('done', x + 5, y + 5);
            }

            if (i === camp.cursor) {
                frame(x - 4, y - 4, 318, 193, 4, MC.orange);
            }
        }
    }

    function drawInfo(n, level) {
        for (let k = 0; k < 2; k++) {
            const cx = 27 + 220 * k;

            shadowed(cx, 100, 200, 400, MC.white);

            if (k === 0 || camp.coop) {
                drawEditorPanel(cx, k, k, campCards[k]);
            } else {
                textCenter('small', 'SLOT EMPTY', cx + 100, 114, '#cc0000');
                textCenter('button', 'PLAYER 2', cx + 100, 196, '#000000');

                textCenter(
                    'small',
                    pads[1].connected ? 'P2 START: JOIN CO-OP' : 'NO CONTROLLER',
                    cx + 100,
                    246,
                    '#333333'
                );
            }
        }

        shadowed(467, 100, 403, 375, MC.white);

        const q = campMeta.parts.tutorial,
            image = level.map === 13 ? null : campaignPreview(level.map);

        const pw = Math.round(X(375)),
            ph = Math.round((375 * S_ * 249) / 427);

        if (image) {
            image.draw(Math.round(X(481)), Math.round(Y(114)), {width: pw, height: ph});
        } else {
            campPart('tutorial', 481, 114, pw, Math.round((pw * q.h) / q.w));
        }

        const top = 114 + ph / S_ + 10;

        textFit(
            'big',
            (level.title.startsWith('BOSS') ? '' : 'Level ' + n + ': ') + level.title,
            481,
            top,
            '#000000',
            375
        );

        textFit('big', 'Map: ' + level.mapName, 481, top + 34, '#000000', 375);
        box(481, top + 72, 375, 2, MC.black);

        wrapLines('body', level.objective, 370)
            .slice(0, 3)
            .forEach((line, k) => text('body', line, 481, top + 80 + k * 22, '#000000'));

        box(467, 490, 403, 56, rgb('#990000'));
        textCenter('big', 'Start Level', 668, 498, '#000000');
    }

    function campaignDraw() {
        Draw.rect(0, 0, 640, 448, MC.bg);

        const n = camp.cursor + 1,
            level = levelOf(n);

        if (camp.phase === 1) {
            drawSlider();
        } else {
            drawInfo(n, level);
        }

        header(0, 'CAMPAIGN');
        bar(20, 520, 200, 60, 'BACK', '#000000', 'left');

        if (camp.phase === 1) {
            text('tiny', 'TO MENU', 150, 568 - capOffset('tiny'), '#000000');
        }

        const status =
            camp.notice ||
            (camp.phase === 2
                ? camp.coop
                    ? 'CO-OP: PLAYER 2 JOINED (P2 START TO LEAVE)'
                    : pads[1].connected
                      ? 'P2 START: JOIN CO-OP'
                      : ''
                : 'X: SELECT LEVEL');

        if (status) {
            text('body', status, 262, 545, camp.notice ? '#ff6600' : '#ffffff');
        }

        if (camp.unlocks.length) {
            drawUnlocks();
        }
    }

    function diamond(cx, cy, r, color) {
        const x = X(cx),
            y = Y(cy),
            d = r * S_;

        Draw.triangle(x - d, y, x, y - d, x + d, y, color);
        Draw.triangle(x - d, y, x, y + d, x + d, y, color);
    }

    function drawUnlocks() {
        box(0, 0, 900, 600, Color.new(0, 0, 0, 100));
        shadowed(235, 150, 430, 280, MC.white);
        text('big', 'Level ' + camp.unlockLevel + ' Completed', 250, 156, '#000000');
        box(250, 200, 400, 2, MC.black);
        text('button', 'New Unlocks:', 250, 208, '#000000');

        const n = camp.unlocks.length;

        camp.unlocks.forEach((item, k) => {
            const cx = 450 + (k - (n - 1) / 2) * 135,
                cy = 290;

            if (item.kind === 'gun') {
                diamond(cx + 3, cy + 3, 40, MC.black);
                diamond(cx, cy, 38, rgb('#000000'));
                diamond(cx, cy, 35, rgb('#ff9900'));
                kit.drawWeaponIcon(item.id, X(cx), Y(cy), 46 * S_);
            } else {
                kit.drawPerk(item.index, X(cx), Y(cy), 1.1 * S_);
            }

            textCenter('tiny', item.name, cx, cy + 50, '#000000');
        });

        box(250, 368, 400, 2, MC.black);
        box(350, 382, 200, 30, rgb('#ffcc00'));
        box(350, 410, 200, 3, MC.black);
        textCenter('button', 'Continue', 450, 384, '#000000');
    }

    const mainMeta = JSON.parse(std.loadFile('assets/ui/mainmenu.json'));
    const mainImage = new Image(mainMeta.image);

    if (!mainImage.ready()) {
        throw new Error('Main menu texture could not be loaded');
    }

    const mainOptions = {width: 0, height: 0, startx: 0, starty: 0, endx: 0, endy: 0, color: Color.new(128, 128, 128)};

    function mainPart(name, x, y, tint) {
        const q = mainMeta.parts[name],
            o = mainOptions;

        o.width = q.w;
        o.height = q.h;
        o.startx = q.x;
        o.starty = q.y;
        o.endx = q.x + q.w;
        o.endy = q.y + q.h;
        o.color = tint || neutralTint;
        mainImage.draw(Math.round(x), Math.round(y), o);
    }

    const neutralTint = Color.new(128, 128, 128);

    function mainDraw() {
        const m = mainMenu;

        if (m.barAlpha > 0) {
            mainPart('bar' + (m.cursor + 1), 0, VIEW_Y + m.barY * S_, alphaTint[Math.round(m.barAlpha * 1.28)]);
        }

        mainPart('logo', mainMeta.place.logo[0], VIEW_Y + mainMeta.place.logo[1]);

        for (let i = 1; i <= MAIN_ITEMS.length; i++) {
            mainPart('label' + i, mainMeta.place['label' + i][0], VIEW_Y + mainMeta.place['label' + i][1]);
        }

        if (mainNotice) {
            text('body', mainNotice, 40, 380, '#ffffff');
        }
    }

    let creditsImage = null;

    function creditsDraw() {
        if (!creditsImage) {
            creditsImage = new Image('assets/ui/credits.png');
        }

        creditsImage.draw(0, VIEW_Y, {width: 640, height: 427});

        const port = CREDITS[CREDITS.length - 1];

        text('small', port.role + ': ' + port.people[0].name + ', ' + port.people[0].quote, 150, 26, '#ff6600');
    }

    function pauseButtons(items, selected, x, y, w) {
        for (let i = 0; i < items.length; i++) {
            box(x, y + i * 50, w, 42, MC.orange);

            if (i === selected) {
                frame(x, y + i * 50, w, 42, 4, MC.black);
            }

            textCenter('button', items[i], x + w / 2, y + i * 50 + 8, '#000000');
        }
    }

    function pauseDraw() {
        box(0, 0, 900, 600, Color.new(0, 0, 0, 90));
        box(250, 120, 400, 340, MC.white);
        textCenter('big', 'PAUSED', 450, 130, '#000000');
        box(270, 172, 360, 2, MC.black);

        if (notice) {
            textCenter('small', notice, 450, 184, '#ff6600');
        }

        pauseButtons(
            [
                'RESUME',
                'RESTART MATCH',
                matchOptionsUsed.campaign
                    ? 'BACK TO CAMPAIGN'
                    : matchOptionsUsed.test
                      ? 'BACK TO LIBRARY'
                      : 'BACK TO SETUP'
            ],
            pauseIndex,
            280,
            210,
            340
        );

        textCenter('small', 'UP/DOWN   X SELECT   START RESUME   CIRCLE MUSIC', 450, 430, '#333333');
    }

    const SUMMARY_ROWS = [
        ['Kills', p => String(p.stats.kos), p => p.stats.kos, true],
        ['Deaths', p => String(p.stats.deaths), null, false],
        [
            'K/D Ratio',
            p => (p.stats.kos / Math.max(1, p.stats.deaths)).toFixed(2),
            p => p.stats.kos / Math.max(1, p.stats.deaths),
            true
        ],
        ['Shots Fired', p => String(p.stats.shots), null, false],
        ['Shots Hit', p => String(p.stats.hits), null, false],
        [
            'Accuracy',
            p => (p.stats.shots ? Math.round((100 * p.stats.hits) / p.stats.shots) : 0) + '%',
            p => (p.stats.shots ? p.stats.hits / p.stats.shots : 0),
            true
        ],
        ['Crates Collected', p => String(p.stats.crates), null, false],
        ['Powerups', p => String(p.stats.powerups), null, false],
        ['TOTAL POINTS', p => String(p.stats.points), p => p.stats.points, true]
    ];

    function resultsDraw() {
        const players = match.players.filter(p => !p.isDouble && !p.isZombie),
            n = players.length;

        box(0, 0, 900, 600, MC.bg);
        box(10, 10, 880, 70, MC.white);
        text('title', 'Post Game Summary', 24, 6, '#000000');

        const winner = match.winner >= 0 ? players[match.winner] : null;

        const survived = match.survival
            ? 'WAVE ' + match.survival.wave + '  -  ' + match.survival.total + ' DUCKS'
            : null;

        textRight(
            'big',
            survived ||
                (winner
                    ? (match.mode === 3 ? 'TEAM ' + (winner.team === 0 ? 'A' : 'B') : label(winner)) + ' WINS'
                    : 'DRAW'),
            870,
            20,
            '#ff6600'
        );

        const colW = Math.min(169, (900 - 225) / n);

        for (let i = 0; i < n; i++) {
            const x = 220 + colW * i;

            box(x, 105, colW - 18, 55, MC.rowDark);
            textCenter('body', label(players[i]), x + (colW - 18) / 2, 112, '#ffffff');
            box(x, 142, colW - 18, 4, accents[players[i].color]);
        }

        SUMMARY_ROWS.forEach(([name, format, score, highlight], r) => {
            const y = 165 + r * 36,
                light = r % 2 === 0;

            box(10, y, 205, 32, light ? MC.rowLight : MC.rowDark);
            textRight('button', name, 205, y + 4, light ? '#000000' : '#333333');

            let best = -Infinity;

            if (score) {
                for (const p of players) {
                    best = Math.max(best, score(p));
                }
            }

            for (let i = 0; i < n; i++) {
                const x = 220 + colW * i;

                box(x, y, colW - 14, 32, light ? MC.cellLight : MC.cellDark);
                text('button', format(players[i]), x + 8, y + 4, light ? '#000000' : '#cccccc');

                if (highlight && score && best > 0 && score(players[i]) === best) {
                    frame(x, y, colW - 14, 32, 3, MC.orange);
                }
            }
        });

        const labels = ['REMATCH', 'CONTINUE'];

        for (let k = 0; k < 2; k++) {
            const x = 460 + k * 220;

            box(x, 530, 210, 56, MC.white);

            if (resultIndex === k) {
                frame(x, 530, 210, 56, 4, MC.orange);
            }

            textCenter('big', labels[k], x + 105, 538, '#000000');
        }
    }

    function drawBoxes(blend) {
        const t = match.tick + blend;

        for (const box of match.boxes) {
            if (!box.active) {
                continue;
            }

            const bob = Math.sin(t * 0.18 + box.x) * 2.5,
                a = Math.round(box.alpha * 1.28);

            pickupOptions.color = Color.new(128, 128, 128, a);
            pickupImage.draw(box.x - fx.pickup.originX, box.y - fx.pickup.originY + bob, pickupOptions);
            kit.drawWeaponIcon(box.weapon, box.x - 1.75, box.y - 1.8 + bob, 34, -0.17, Color.new(128, 128, 128, a));
        }
    }

    const snowCos = Math.cos((snow.rotation * Math.PI) / 180),
        snowSin = Math.sin((snow.rotation * Math.PI) / 180);

    function layerY(layer, index) {
        const value = layer.y[index];
        return value === null ? layer.y[index + 1] : value;
    }

    const fxMeta = JSON.parse(std.loadFile('assets/fx/atlas.json'));
    const fxAtlas = new Image(fxMeta.image);

    if (!fxAtlas.ready()) {
        throw new Error('Effect texture could not be loaded');
    }

    const explosionMeta = JSON.parse(std.loadFile('assets/fx/explosion.json'));
    const explosionAtlas = new Image(explosionMeta.image);
    const popupMeta = JSON.parse(std.loadFile('assets/hud/popups.json'));
    const popupAtlas = new Image(popupMeta.image);
    const crateMeta = JSON.parse(std.loadFile('assets/hud/cratenames.json'));
    const crateAtlas = new Image(crateMeta.image);

    if (!explosionAtlas.ready() || !popupAtlas.ready() || !crateAtlas.ready()) {
        throw new Error('Effect textures could not be loaded');
    }

    const snowDot = fxMeta.parts.snowdot;

    const snowRecords = new Float32Array(16 * snow.dots.length),
        snowColors = new Uint32Array(snowRecords.buffer);

    snow.dots.forEach((d, i) => {
        const o = 16 * i,
            x = d[0] * snowCos - d[1] * snowSin,
            y = d[0] * snowSin + d[1] * snowCos;

        snowRecords[o] = x - snowDot.originX;
        snowRecords[o + 1] = y - snowDot.originY;
        snowRecords[o + 2] = snowDot.w;
        snowRecords[o + 3] = snowDot.h;
        snowRecords[o + 4] = snowDot.x;
        snowRecords[o + 5] = snowDot.y;
        snowRecords[o + 6] = snowDot.x + snowDot.w;
        snowRecords[o + 7] = snowDot.y + snowDot.h;
        snowColors[o + 8] = snowColors[o + 9] = snowColors[o + 10] = snowColors[o + 11] = 128;
    });

    const snowCount = snow.dots.length,
        snowOffset = {x: 0, y: 0, count: snowCount};

    function drawSnow(blend) {
        const ticks = match.tick + blend;
        const span = snow.frames - snow.loopStart + 1;
        const frame = ticks < snow.frames ? 1 + ticks : snow.loopStart + ((ticks - snow.frames) % span);

        const i = Math.min(snow.frames - 2, Math.floor(frame) - 1),
            k = Math.min(1, frame - 1 - i);

        for (const layer of snow.layers) {
            const y0 = layerY(layer, i),
                y1 = layerY(layer, i + 1),
                oy = y0 + (y1 - y0) * k;

            snowOffset.x = snow.origin[0] + layer.x * snowCos - oy * snowSin;
            snowOffset.y = snow.origin[1] + layer.x * snowSin + oy * snowCos;
            fxAtlas.drawList(snowRecords, snowOffset);
        }
    }

    const alphaTint = [];

    for (let a = 0; a <= 128; a++) {
        alphaTint.push(Color.new(128, 128, 128, a));
    }

    const fxOptions = {
        width: 0,
        height: 0,
        startx: 0,
        starty: 0,
        endx: 0,
        endy: 0,
        angle: 0,
        originX: 0,
        originY: 0,
        flipY: false,
        color: 0
    };

    const dustRecords = new Float32Array(16 * 64),
        dustWords = new Uint32Array(dustRecords.buffer);

    for (let i = 0; i < 64; i++) {
        dustWords[16 * i + 8] = dustWords[16 * i + 9] = dustWords[16 * i + 10] = 128;
    }

    function drawThrown(blend) {
        const q = fxMeta.parts.deagle,
            o = fxOptions;

        for (const t of match.thrown) {
            if (!t.active) {
                continue;
            }

            const x = t.px + (t.x - t.px) * blend,
                y = t.py + (t.y - t.py) * blend;

            o.width = q.w;
            o.height = q.h;
            o.startx = q.x;
            o.starty = q.y;
            o.endx = q.x + q.w;
            o.endy = q.y + q.h;
            o.flipY = false;
            o.flipX = t.facing < 0;
            o.angle = (t.rot * Math.PI) / 180;
            o.originX = t.facing < 0 ? q.w - q.originX : q.originX;
            o.originY = q.originY;
            o.color = alphaTint[128];
            fxAtlas.draw(x - o.originX, y - o.originY, o);
        }

        o.flipX = false;
    }

    function drawFxSprites(blend) {
        const o = fxOptions,
            parts = fxMeta.parts,
            pool = fxs.pool;

        let batched = 0;

        popupCount = 0;

        for (let i = 0; i < pool.length; i++) {
            const p = pool[i];

            if (!p.active) {
                continue;
            }

            const kind = p.kind;

            if (kind === KIND.COMBO || kind === KIND.NAME || kind === KIND.BLING) {
                popupList[popupCount++] = p;
                continue;
            }

            const x = p.px + (p.x - p.px) * blend,
                y = p.py + (p.y - p.py) * blend;

            const alpha = (p.alpha * 1.28) | 0;

            if (p.batch) {
                let q = p.q;

                if (!q) {
                    q = p.q = parts[p.part];
                }

                const r = 16 * batched++,
                    sx = p.scale;

                dustRecords[r] = x - q.originX * sx;
                dustRecords[r + 1] = y - q.originY * sx;
                dustRecords[r + 2] = q.w * sx;
                dustRecords[r + 3] = q.h * sx;
                dustRecords[r + 4] = q.x;
                dustRecords[r + 5] = q.y;
                dustRecords[r + 6] = q.x + q.w;
                dustRecords[r + 7] = q.y + q.h;
                dustWords[r + 11] = alpha;
                continue;
            }

            if (p.atlas === ATLAS.WEAPON) {
                kit.drawDroppedGun(p.weapon, x, y, p.flip, p.rot);
                continue;
            }

            if (kind === KIND.GROW && skip.has('grow')) {
                continue;
            }

            let image = fxAtlas,
                q = p.q,
                unit = 1;

            if (!q) {
                q = p.q = p.atlas === ATLAS.EXPLOSION ? explosionMeta.parts[p.part] : parts[p.part];
            }

            if (p.atlas === ATLAS.EXPLOSION) {
                image = explosionAtlas;
                unit = q.scale;
            }

            const sx = p.scale * unit,
                sy = p.scale * p.scaleY * unit,
                h = q.h * (sy < 0 ? -sy : sy);

            o.width = q.w * sx;
            o.height = h;
            o.startx = q.x;
            o.starty = q.y;
            o.endx = q.x + q.w;
            o.endy = q.y + q.h;
            o.flipY = sy < 0;
            o.angle = kind === KIND.BLOOD ? (p.rot * Math.PI) / 180 : p.rot;
            o.originX = q.originX * sx;
            o.originY = q.originY * (sy < 0 ? -sy : sy);
            o.color = alphaTint[alpha > 128 ? 128 : alpha];
            image.draw(x - o.originX, y - o.originY, o);
        }

        if (batched) {
            fxAtlas.drawList(dustRecords, batched);
        }
    }

    const popupList = [];
    let popupCount = 0;

    const comboRecords = new Float32Array(16 * 16),
        comboWords = new Uint32Array(comboRecords.buffer);

    for (let i = 0; i < 16; i++) {
        comboWords[16 * i + 8] = comboWords[16 * i + 9] = comboWords[16 * i + 10] = 128;
    }

    function drawCombos(blend) {
        const zoom = STAGE_SCALE * framing.zoom;
        let n = 0;

        for (let i = 0; i < popupCount; i++) {
            const p = popupList[i];

            if (p.kind !== KIND.COMBO || n >= 16) {
                continue;
            }

            const q = partCombo[p.key] || partCombo['12_HITS'];
            const k = (p.scale * framing.zoom) / HUD.comboRender;

            const x = p.px + (p.x - p.px) * blend,
                y = p.py + (p.y - p.py) * blend;

            const r = 16 * n++;

            comboRecords[r] = 320 + (x - framing.x) * zoom - (q.w * k) / 2 + q.ox * k;
            comboRecords[r + 1] = VIEW_Y + 213.5 + (y - framing.y) * zoom - (q.h * k) / 2 + q.oy * k;
            comboRecords[r + 2] = q.w * k;
            comboRecords[r + 3] = q.h * k;
            comboRecords[r + 4] = q.x;
            comboRecords[r + 5] = q.y;
            comboRecords[r + 6] = q.x + q.w;
            comboRecords[r + 7] = q.y + q.h;
            comboWords[r + 11] = (p.alpha * 1.28) | 0;
        }

        if (n) {
            hudAtlas.drawList(comboRecords, n);
        }
    }

    const DUST_PER_BURST = 6;
    const blingMeta = JSON.parse(std.loadFile('assets/hud/bling.json'));
    const teamWinMeta = JSON.parse(std.loadFile('assets/hud/teamwin.json'));
    const winnerMeta = JSON.parse(std.loadFile('assets/hud/winner.json'));
    const winnerImage = new Image(winnerMeta.image);

    if (!winnerImage.ready()) {
        throw new Error('Winner texture could not be loaded');
    }

    const teamWinImage = new Image(teamWinMeta.image);

    if (!teamWinImage.ready()) {
        throw new Error('Team win texture could not be loaded');
    }

    const blingImage = new Image(blingMeta.image);

    if (!blingImage.ready()) {
        throw new Error('Bling texture could not be loaded');
    }

    function drawBling(p) {
        const player = match.players[p.weapon];
        const q = blingMeta.parts[p.part];

        if (!player || !player.active || !q) {
            return;
        }

        const zoom = STAGE_SCALE * framing.zoom,
            k = framing.zoom,
            sc = (p.scale / 100) * k;

        const sx = 320 + (player.x - framing.x) * zoom,
            sy = VIEW_Y + 213.5 + (player.y - p.level - framing.y) * zoom;

        const o = hudPartOptions;

        o.width = q.w * sc;
        o.height = q.h * sc;
        o.startx = q.x;
        o.starty = q.y;
        o.endx = q.x + q.w;
        o.endy = q.y + q.h;
        o.color = alphaTint[Math.max(0, Math.min(128, Math.round(p.alpha * 1.28)))];
        blingImage.draw(Math.round(sx + q.ox * sc), Math.round(sy + q.oy * sc), o);
    }

    function drawNames() {
        const zoom = STAGE_SCALE * framing.zoom;

        for (let i = 0; i < popupCount; i++) {
            const p = popupList[i];

            if (p.kind === KIND.BLING) {
                drawBling(p);
                continue;
            }

            if (p.kind !== KIND.NAME) {
                continue;
            }

            const q = crateMeta.parts[p.part];

            if (!q) {
                continue;
            }

            const sx = 320 + (p.x - framing.x) * zoom,
                sy = VIEW_Y + 213.5 + (p.y - framing.y) * zoom;

            const o = hudPartOptions,
                k = framing.zoom;

            o.width = q.w * k;
            o.height = q.h * k;
            o.startx = q.x;
            o.starty = q.y;
            o.endx = q.x + q.w;
            o.endy = q.y + q.h;
            o.color = alphaTint[Math.max(0, Math.min(128, Math.round(p.alpha * 1.28)))];
            crateAtlas.draw(Math.round(sx - (q.w * k) / 2), Math.round(sy - (q.h * k) / 2), o);
        }
    }

    function spawnEffects(event) {
        switch (event.type) {
            case 'shot': {
                const w = WEAPONS[event.weapon],
                    f = event.facing;

                spawnFlash(fxs, event.x + w.flashX * f, event.y - 38, f);

                for (const e of w.eject) {
                    if (e.t === 0) {
                        spawnShell(fxs, event.x + w.shellX * f, event.y + e.y, e.s);
                    } else {
                        queueShell(fxs, e.t, event.player, e.s, e.y);
                    }
                }

                break;
            }

            case 'reload': {
                const owner = match.players[event.player],
                    w = WEAPONS[owner.weaponId];

                for (const e of w.ejectOnReload) {
                    spawnShell(fxs, event.x + w.shellX * event.facing, event.y + e.y, e.s);
                }

                for (const d of w.dropMag) {
                    queueDrop(fxs, d.t, event.player, d.s);
                }

                if (w.reloadShells) {
                    for (const r of w.reloadShells) {
                        queueShells(fxs, r.t, event.player, r.n);
                    }
                }

                break;
            }

            case 'magHit': {
                for (let i = 0; i < 4; i++) {
                    spawnBlood(fxs, event.x, event.y);
                }

                spawnStain(fxs, event.x + event.vx, event.y);
                spawnCombo(fxs, event.x + event.vx, event.y - 50, -6);
                break;
            }

            case 'hit': {
                spawnBlood(fxs, event.bx, event.by);
                spawnBlood(fxs, event.bx, event.by);
                spawnStain(fxs, event.bx + 25 * event.dir, event.by);
                spawnCombo(fxs, event.bx + 25 * event.dir, event.by - 50, event.combo);
                break;
            }

            case 'explosion': {
                const x = event.x,
                    y = event.y - 20;

                spawnGrow(fxs, 'glow', x, y, 1, 2, 1.9, 20, false);
                spawnGrow(fxs, 'ring', x, y, 0.1, 2, 1.95, 10, false);
                spawnGrow(fxs, 'disc', x, y, 1, 2, 1.9, 20, false);
                spawnGrow(fxs, 'shock', x, y, 0.1, 2.5, 2.49, 10, true);

                for (let i = 0; i < 5; i++) {
                    spawnPuff(fxs, x, y);
                    spawnDebris(fxs, 'fire', x, y, 0.02, 0);
                }

                spawnCombo(fxs, x, y - 30, -2);
                shakeX = (20 + Math.floor(Math.random() * 30)) * (Math.random() < 0.5 ? -1 : 1);
                break;
            }

            case 'doubleEnd':
                if (event.killed) {
                    break;
                }

            case 'instaDeath': {
                const x = event.x,
                    y = event.y - 20;

                spawnGrow(fxs, 'glow', x, y, 1, 2, 1.9, 20, false);

                for (let i = 0; i < 3; i++) {
                    spawnPuff(fxs, x, y);
                    spawnDebris(fxs, 'fire', x, y, 0.02, 0);
                    spawnBlood(fxs, event.x, event.y);
                }

                spawnStain(fxs, event.x, event.y);
                spawnCombo(fxs, event.x, event.y - 50, -5);
                break;
            }

            case 'crateTaken':
                for (let i = 0; i < 5; i++) {
                    spawnDebris(fxs, 'package', event.x, event.y, 0.02, 0);
                }

                break;

            case 'boxTaken':
            case 'chestTake':
                for (let i = 0; i < 10; i++) {
                    spawnDebris(fxs, 'pickup', event.x, event.y + 20, 0.06, 1.2);
                }

                break;

            case 'duckBite':
                for (let i = 0; i < 4; i++) {
                    spawnBlood(fxs, event.x, event.y);
                }

                spawnStain(fxs, event.x, event.y);
                break;

            case 'duckBoom': {
                const x = event.x,
                    y = event.y - 20;

                spawnGrow(fxs, 'glow', x, y, 1, 2, 1.9, 20, false);
                spawnGrow(fxs, 'ring', x, y, 0.1, 2, 1.95, 10, false);
                spawnGrow(fxs, 'disc', x, y, 1, 2, 1.9, 20, false);

                for (let i = 0; i < 2; i++) {
                    spawnPuff(fxs, x, y);
                    spawnDebris(fxs, 'fire', x, y, 0.02, 0);
                }

                spawnCombo(fxs, event.x, event.y - 50, -3);
                break;
            }

            case 'waveUp':
                waveBanner.t = 0;
                waveBanner.wave = event.wave;
                break;

            case 'powerup':
                for (let i = 0; i < 10; i++) {
                    spawnDebris(fxs, 'pickup', event.x, event.y + 40, 0.06, 1.2);
                }

                break;

            case 'pickup':
                if (event.weapon >= 10) {
                    spawnCrateName(fxs, event.x, event.y - 70, event.weapon);
                }

                break;

            case 'dropgun':
                spawnDropGun(fxs, event.x, event.y, event.facing, event.weapon);
                break;

            case 'death': {
                const victim = match.players[event.player];

                const verb =
                    event.killer >= 0
                        ? {cheapshot: 'cheapshotd', greedy: 'greedykilled', nade: 'exploded'}[event.kind] || 'killed'
                        : event.grenade
                          ? 'exploded'
                          : 'killed';

                if (matchOptionsUsed.campaign !== 1) {
                    killFeed.push({killer: event.killer >= 0 ? match.players[event.killer] : null, victim, verb, t: 0});
                }

                if (event.killer >= 0) {
                    if (match.mode === 4) {
                        spawnBling(fxs, event.killer, 5, Math.min(16, match.players[event.killer].level));
                    } else {
                        spawnBling(fxs, event.killer, {kill: 1, cheapshot: 2, greedy: 3, nade: 4}[event.kind]);
                    }
                }

                if (killFeed.length > 5) {
                    killFeed.shift();
                }

                break;
            }

            case 'land':
                if (event.impact > 3) {
                    for (let i = 0; i < DUST_PER_BURST; i++) {
                        spawnDust(fxs, event.x, event.y, match.arena.originalMap);
                    }
                }

                break;

            case 'jump':
                if (event.fromGround) {
                    for (let i = 0; i < DUST_PER_BURST; i++) {
                        spawnDust(fxs, event.x, event.y, match.arena.originalMap);
                    }
                }

                break;
        }
    }

    const shellOrigin = id => {
        const p = match.players[id];

        return p && p.active
            ? {x: p.x, y: p.y, facing: p.facing, shellX: WEAPONS[p.weaponId].shellX, shootX: WEAPONS[p.weaponId].shootX}
            : null;
    };

    function worldDraw(blend) {
        background.draw(0, 0, stageOptions);
        lap('bg');

        for (const c of match.crates) {
            if (c.active) {
                const sc = CRATE_SCALE[c.frame - 1],
                    cy = c.py + (c.y - c.py) * blend;

                crateOptions.width = cratePart.w * sc[0];
                crateOptions.height = cratePart.h * sc[1];
                crateImage.draw(c.x - cratePart.originX * sc[0], cy - cratePart.originY * sc[1], crateOptions);
            }
        }

        drawBoxes(blend);
        drawChest(blend);
        powerKit.drawOrbs(match);
        powerKit.drawEffects(blend, false);
        lap('boxes');

        const bulletPool = match.bullets;

        for (let i = 0; i < match.bulletTop; i++) {
            const b = bulletPool[i];

            if (!b.active) {
                continue;
            }

            const x = b.px + (b.x - b.px) * blend,
                y = b.py + (b.y - b.py) * blend;

            if (b.kind === 'instagib') {
                const left = b.dir > 0 ? x - 70 : x - 2;

                Draw.rect(left, y - 2, 72, 5, beam);
                Draw.rect(left, y - 1, 72, 2, cyan);
            } else {
                Draw.rect(x - 10 * b.dir, y - 1, 12, 2, yellow);
            }
        }

        lap('bullets');
        drawActors(blend);
        powerKit.drawEquipment(match, blend);
        lap('actors');

        for (const g of match.grenades) {
            if (g.active) {
                kit.drawFrom(
                    grenadeAtlas,
                    grenadeParts.grenade,
                    g.px + (g.x - g.px) * blend,
                    g.py + (g.y - g.py) * blend,
                    0,
                    0,
                    1,
                    0.8,
                    neutral,
                    (g.rotation * Math.PI) / 180
                );
            }
        }

        if (!skip.has('fx')) {
            drawFxSprites(blend);
        }

        drawThrown(blend);
        powerKit.drawEffects(blend, true);
        lap('fxsprites');
        lap('fx');

        if (match.arena.effect === 'mapfx_wall') {
            wallImage.draw(fx.wall.x, fx.wall.y);
        }

        if (match.arena.effect === 'mapfx_snow') {
            drawSnow(blend);
        }
    }

    function logPads() {
        if (!validation) {
            return;
        }

        for (let i = 0; i < 2; i++) {
            const pad = pads[i];

            if (pad.buttons === pad.previousButtons) {
                continue;
            }

            const p = match.players.find(item => item.controllerIndex === i);

            console.log(
                'GM2_PAD_INPUT ' +
                    JSON.stringify({
                        pad: i,
                        screen,
                        tick: match.tick,
                        buttons: pad.buttons,
                        x: p ? p.x : null,
                        y: p ? p.y : null,
                        vx: p ? p.vx : null,
                        vy: p ? p.vy : null,
                        shots: match.stats.shots,
                        jumps: match.stats.jumps
                    })
            );
        }
    }

    Loop.addSystem({
        name: 'gm2-input',
        preUpdate(dt) {
            const saveResult = saveStore.poll(),
                campaignResult = campaignStore.poll(),
                optionsResult = optionsStore.poll();

            if (optionsResult) {
                console.log('GM2_OPTIONS_SAVE_RESULT ' + optionsResult);
            }

            if (saveResult) {
                console.log('GM2_SAVE_RESULT ' + saveResult);
            }

            if (campaignResult) {
                console.log('GM2_CAMPAIGN_SAVE_RESULT ' + campaignResult);
            }

            lapBegin();
            visualHold = Math.max(0, visualHold - dt);

            if (resultsHold > 0 && (resultsHold -= dt) <= 0) {
                finishValidation();
            }

            Gamepad.update();
            logPads();

            if (screen === 'lobby') {
                lobbyInput();
                stepSlide(menu, dt);

                for (let i = 0; i < 4; i++) {
                    stepCard(cards[i], slotActive(lobby.slots[i]), dt);
                }
            } else if (screen === 'intro') {
                introInput(dt);
            } else if (screen === 'campaign') {
                campaignInput();
                stepCampSlider(dt);
            } else if (screen === 'credits') {
                creditsInput();
            } else if (screen === 'options') {
                optionsInput();
            } else if (screen === 'library') {
                libraryInput();
            } else if (screen === 'main') {
                mainInput(dt);

                if (visualHold === 0) {
                    updateCamera(framing, cameraList(), dt, CAMERA_OPTIONS);
                }
            } else {
                matchInput();

                if (screen === 'match' && match.winner !== -1 && !paused) {
                    winTimer += dt;
                }

                if (screen === 'match' && !paused && victoryActor()) {
                    stepWinPose(dt);
                }

                if (matchOptionsUsed && matchOptionsUsed.campaign && match.winner !== -1 && !validation) {
                    campaignMatchInput();
                }

                lap('input');

                if (screen === 'match' && !paused && visualHold === 0) {
                    VICTORY_CAMERA.focus = victoryActor();
                    updateCamera(framing, cameraList(), dt, VICTORY_CAMERA.focus ? VICTORY_CAMERA : CAMERA_OPTIONS);
                    lap('camera');

                    if (validation) {
                        cameraStats.min = Math.min(cameraStats.min, framing.zoom);
                        cameraStats.max = Math.max(cameraStats.max, framing.zoom);
                        cameraStats.indicators = Math.max(cameraStats.indicators, framing.indicators.length);
                        cameraStats.samples++;
                    }
                }
            }

            Sound.process();
            lap('sound');
        }
    });

    let resultsHold = 0;

    function validationDone() {
        reportSent = true;

        let best = 0;

        match.players.forEach((p, i) => {
            if (p.stats.kos > match.players[best].stats.kos) {
                best = i;
            }
        });

        match.winner = best;
        resultIndex = 0;
        resultsHold = 2.6;
        console.log('GM2_RESULTS_VIEW ' + JSON.stringify({winner: best, stats: match.players.map(p => p.stats)}));
    }

    function finishValidation() {
        console.log(
            'GM2_VALIDATION_COMPLETE ' +
                JSON.stringify({
                    rounds: validationStats.length,
                    stats: match.stats,
                    camera: cameraStats,
                    arenaTotal: ARENAS.length,
                    frame: Loop.getStats(),
                    vramFree: Screen.getFreeVRAM(),
                    audio: Sound.getMemoryStats()
                })
        );

        enterLobby();
    }

    Loop.run(
        {
            update() {
                if ((screen !== 'match' && screen !== 'main') || paused || match.winner !== -1 || visualHold > 0) {
                    return;
                }

                lapBegin();
                prof.updates++;

                const inputs = inputBuffer;

                inputs.length = match.players.length;

                for (let i = 0; i < match.players.length; i++) {
                    const p = match.players[i];

                    inputs[i] =
                        p.type === 'cpu'
                            ? botInput(match, p.id)
                            : pads[p.controllerIndex].connected
                              ? pending[p.controllerIndex]
                              : idleInput;
                }

                if (validation) {
                    for (let i = 0; i < inputs.length; i++) {
                        if (inputs[i].ai) {
                            inputs[i].forceGrenade = match.tick % 180 >= 100 && match.tick % 180 < 120;
                        }
                    }
                }

                const powerRound =
                    validation &&
                    !reportSent &&
                    rounds[validationRound] &&
                    rounds[validationRound].powerKind !== undefined
                        ? rounds[validationRound]
                        : null;

                if (powerRound) {
                    for (let i = 0; i < matchOptionsUsed.players.length; i++) {
                        inputs[i] = idleInput;
                    }

                    if (match.tick === 24) {
                        const p = match.players[0];

                        p.x = p.px = match.powerups[0].x;
                        p.vx = 0;
                    }

                    if (powerRound.powerKind === POWER.speed && match.tick >= 23) {
                        inputs[0] = {move: 1};
                    }

                    if (powerRound.powerKind === POWER.jetpack && match.tick >= 30) {
                        const p = match.players[0];

                        if (match.tick === 30) {
                            p.y = p.py -= 80;
                            p.jumps = 0;
                            p.jumpKey = false;
                        }

                        inputs[0] = {jumpHeld: true};
                    }
                }

                lap('bots');

                if (validation) {
                    match.mark = lap;
                }

                stepMatch(match, inputs);

                for (let i = 0; i < match.bulletTop; i++) {
                    const b = match.bullets[i];

                    if (b.active && b.kind === 'instagib') {
                        spawnTrail(fxs, b.x, b.y, b.dir);
                    }
                }

                powerKit.step(match);

                if (powerRound && match.tick === 14) {
                    visualHold = 1.5;

                    console.log(
                        'GM2_POWERUP_ORB ' +
                            JSON.stringify({kind: powerRound.powerKind, name: POWER_NAMES[powerRound.powerKind]})
                    );
                }

                if (powerRound && match.tick === 37) {
                    visualHold = 1.5;

                    const p = match.players[0];

                    console.log(
                        'GM2_POWERUP_VIEW ' +
                            JSON.stringify({
                                kind: powerRound.powerKind,
                                name: POWER_NAMES[powerRound.powerKind],
                                powerups: p.stats.powerups,
                                lives: p.lives,
                                alpha: p.alpha,
                                shield: p.shield,
                                jetfuel: p.jetfuel,
                                speedTime: p.speedTime,
                                scale: p.scale,
                                double: match.players.some(q => q.isDouble && q.active)
                            })
                    );
                }

                lap('sim.rest');

                for (const g of match.grenades) {
                    if (!g.active) {
                        continue;
                    }

                    const a = ((g.rotation - 90) * Math.PI) / 180;

                    if ((match.tick & 1) === 0) {
                        spawnSpark(fxs, g.x + Math.cos(a) * 25, g.y + Math.sin(a) * 25);
                    }
                }

                shakeX *= 0.875;

                if (Math.abs(shakeX) < 0.5) {
                    shakeX = 0;
                }

                for (let k = killFeed.length - 1; k >= 0; k--) {
                    if (++killFeed[k].t > 130) {
                        killFeed.splice(k, 1);
                    }
                }

                for (const input of pending) {
                    input.jump = false;
                    input.down = false;
                }

                lap('events.pre');
                flushPending(fxs, shellOrigin);
                lap('fx.flush');
                updateEffects(fxs, match.gravity);
                lap('fx.update');

                for (const event of match.events) {
                    powerKit.event(event, match);
                    spawnEffects(event);
                    lap('fx.spawn');

                    if (
                        validation &&
                        event.type === 'explosion' &&
                        !explosionLogged &&
                        event.x >= 0 &&
                        event.x <= 900 &&
                        event.y >= 0 &&
                        event.y <= 600
                    ) {
                        explosionLogged = true;
                        explosionCountdown = 4;
                    }

                    if (event.type === 'reload' || event.type === 'shot') {
                        const w =
                            WEAPONS[event.weapon !== undefined ? event.weapon : match.players[event.player].weaponId];

                        for (const e of event.type === 'reload' ? w.reloadSounds : w.cycleSounds) {
                            sfxQueue.push({t: e.t, key: e.s, x: event.x});
                        }
                    }

                    let key =
                        event.type === 'shot'
                            ? 'gun_' + WEAPONS[event.weapon].sound
                            : event.type === 'grenadeHit'
                              ? ''
                              : event.type === 'duckBoom'
                                ? 'explosion'
                                : event.type === 'chestTake'
                                  ? 'bolt2'
                                  : event.type;

                    if (key === 'land' && !(event.impact > 3)) {
                        key = '';
                    }

                    if (event.silent) {
                        key = '';
                    }

                    const pool = VARIANTS[key];

                    if (pool) {
                        key = pool[Math.floor(Math.random() * pool.length)];
                    }

                    if (sounds[key]) {
                        sounds[key].pan = Math.max(-70, Math.min(70, Math.round((event.x - 450) / 6)));

                        if (prefs.sfx) {
                            sounds[key].play();
                        }
                    }

                    if (event.type === 'hit' || event.type === 'grenadeHit') {
                        const target = match.players[event.player];

                        if (target && target.type === 'human' && !event.silent) {
                            pads[target.controllerIndex].rumble(0.4, 0.2, 80);
                        }
                    }
                }

                for (let k = sfxQueue.length - 1; k >= 0; k--) {
                    const q = sfxQueue[k];

                    if (q.t-- > 0) {
                        continue;
                    }

                    const s = sounds[q.key];

                    if (s && prefs.sfx) {
                        s.pan = Math.max(-70, Math.min(70, Math.round((q.x - 450) / 6)));
                        s.play();
                    }

                    sfxQueue.splice(k, 1);
                }

                if (waveBanner.t >= 0 && ++waveBanner.t >= 80) {
                    waveBanner.t = -1;
                }

                lap('events');

                if (explosionCountdown >= 0 && --explosionCountdown === 0) {
                    visualHold = 1.5;
                    explosionCountdown = -1;
                    console.log('GM2_EXPLOSION_VIEW ' + JSON.stringify({round: validationRound, holdSeconds: 1.5}));
                }

                if (validation && !reportSent && match.tick % 175 === 0) {
                    console.log(
                        'GM2_PROGRESS ' +
                            JSON.stringify({
                                round: validationRound,
                                tick: match.tick,
                                arena: ARENAS[match.arenaIndex].name,
                                players: match.players.length,
                                stats: match.stats,
                                camera: {
                                    x: framing.x,
                                    y: framing.y,
                                    zoom: framing.zoom,
                                    targets: framing.targetCount,
                                    indicators: framing.indicators.length
                                },
                                frame: Loop.getStats()
                            })
                    );
                }

                if (
                    validation &&
                    !reportSent &&
                    ((rounds[validationRound].sweep && match.tick === 70) ||
                        (rounds[validationRound].weaponSweep && match.tick === 85))
                ) {
                    console.log(
                        'GM2_MAP_VIEW ' +
                            JSON.stringify({
                                arena: ARENAS[match.arenaIndex].name,
                                index: match.arenaIndex,
                                gravity: match.gravity,
                                weapons: match.players.map(p => p.weaponId),
                                frame: Loop.getStats(),
                                players: match.players.map(p => ({
                                    x: Math.round(p.x),
                                    y: Math.round(p.y),
                                    ground: p.ground
                                }))
                            })
                    );
                }

                if (
                    validation &&
                    !reportSent &&
                    (match.tick >= (rounds[validationRound].ticks || 350) || match.winner !== -1)
                ) {
                    const result = {
                        round: validationRound,
                        arena: ARENAS[match.arenaIndex].name,
                        players: match.players.length,
                        weapon: matchOptionsUsed.players[0].weaponId,
                        stats: match.stats,
                        vram: {
                            avgUploaded: vram.frames ? Math.round(vram.sum / vram.frames) : 0,
                            maxUploaded: vram.max,
                            ...vramNow()
                        },
                        prof: profReport()
                    };

                    validationStats.push(result);
                    console.log('GM2_ROUND_RESULT ' + JSON.stringify(result));

                    if (++validationRound < rounds.length) {
                        startValidationRound(validationRound);

                        console.log(
                            'GM2_ARENA_READY ' +
                                JSON.stringify({
                                    round: validationRound,
                                    arena: ARENAS[match.arenaIndex].name,
                                    players: match.players.length,
                                    weapon: WEAPONS[matchOptionsUsed.players[0].weaponId].name
                                })
                        );
                    } else {
                        validationDone();
                    }
                }
            },
            draw(alpha) {
                sceneFrames++;

                lapBegin();
                prof.frames++;

                if (validation && screen === 'match' && sceneFrames > 5) {
                    const uploaded = Screen.getMemoryStats(Screen.VRAM_UPLOADED);

                    vram.frames++;
                    vram.sum += uploaded;
                    vram.max = Math.max(vram.max, uploaded);
                }

                if (screen === 'intro') {
                    Camera2D.screenSpace(introDraw);
                } else if (screen === 'lobby') {
                    Camera2D.screenSpace(lobbyDraw);
                } else if (screen === 'campaign') {
                    Camera2D.screenSpace(campaignDraw);
                } else if (screen === 'credits') {
                    Camera2D.screenSpace(creditsDraw);
                } else if (screen === 'options') {
                    Camera2D.screenSpace(optionsDraw);
                } else if (screen === 'library') {
                    Camera2D.screenSpace(libraryDraw);
                } else {
                    camera.x = framing.x - shakeX;
                    camera.y = framing.y;
                    camera.zoomX = STAGE_SCALE * framing.zoom;
                    camera.zoomY = STAGE_SCALE * framing.zoom;
                    drawBlend = paused || match.winner !== -1 || visualHold > 0 ? 1 : alpha;
                    worldDraw(drawBlend);
                    lap('worldTail');
                    Camera2D.screenSpace(screen === 'main' ? mainDraw : hudDraw);
                    lap('hud');
                }

                if (sceneFrames === 120) {
                    console.log('GM2_VISUAL_READY');
                }
            }
        },
        {fixedStep: 1 / RULES.hz, maxSteps: 5, clearColor: ink}
    );
}
