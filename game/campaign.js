export const MODE = {lms: 1, oneHit: 2, team: 3, gunGame: 4, survival: 5};
export const AI = {standard: 2, double: 3, jetpack: 4, ghost: 5, boss: 6};
export const LEVEL_COUNT = 10;

export const LOCKED = 0,
    OPEN = 1,
    DONE = 2;

export const LEVELS = Object.freeze([
    {
        n: 1,
        mapName: 'Testing Room',
        objective: 'Learn the basics of the game.',
        title: 'Tutorial',
        goal: 'Kill the dummy 3 times to win.',
        map: 13,
        mode: MODE.lms,
        lives: 3,
        crates: false,
        powerups: false,
        killfeed: false,
        enemies: [{name: 'Dummy', color: 8, shirt: 24, hat: 1, gun: 0, perk: 0, ptype: AI.standard}]
    },
    {
        n: 2,
        mapName: 'Safari Showdown',
        objective: 'Face off against a single AI opponent.',
        title: 'Easy Win',
        map: 12,
        mode: MODE.lms,
        lives: 7,
        crates: true,
        powerups: true,
        firepower: 0.6,
        damage: 1.3,
        enemies: [{name: 'Caveman Johnson', color: 8, shirt: 10, hat: 7, gun: 1, perk: 0, ptype: AI.standard}]
    },
    {
        n: 3,
        mapName: 'Polar Pwnage',
        objective: 'Level up your gun by killing your opponent. First kill on level 15 wins.',
        title: 'Gun Game',
        map: 10,
        mode: MODE.gunGame,
        lives: 7,
        crates: false,
        powerups: false,
        firepower: 0.8,
        damage: 1.2,
        enemies: [{name: 'Santa', color: 1, shirt: 11, hat: 3, gun: 2, perk: 7, ptype: AI.standard}]
    },
    {
        n: 4,
        mapName: 'Hovering Houses',
        objective: 'Just a simple one on one. Or is it?',
        title: 'Seeing Double',
        map: 8,
        mode: MODE.lms,
        lives: 7,
        crates: true,
        powerups: false,
        cheapshot: true,
        killDouble: true,
        enemies: [{name: 'Pylon Man', color: 9, shirt: 1, hat: 9, gun: 1, perk: 0, ptype: AI.double}]
    },
    {
        n: 5,
        mapName: 'Great Wall Brawl',
        objective:
            'Defeat your opponent, but mind the falling dynamite! P.S. Your opponent is resistant to dynamites :)',
        title: 'BOSS 1: Dynamite Dodge',
        map: 5,
        mode: MODE.lms,
        lives: 7,
        crates: true,
        powerups: true,
        dynamiteEvery: 80,
        enemies: [{name: 'Gun Fu Master', color: 7, shirt: 9, hat: 10, gun: 3, perk: 6, ptype: AI.standard}]
    },
    {
        n: 6,
        mapName: 'Grim City',
        objective: 'Face off against 2 AI opponents.',
        title: 'Double Team',
        map: 11,
        mode: MODE.team,
        lives: 5,
        crates: true,
        powerups: true,
        teams: true,
        enemies: [
            {name: 'Mafia Guy', color: 2, shirt: 3, hat: 5, gun: 2, perk: 0, ptype: AI.standard},
            {name: 'Mafia Dude', color: 2, shirt: 4, hat: 5, gun: 3, perk: 0, ptype: AI.standard}
        ]
    },
    {
        n: 7,
        mapName: 'Dessert Duel',
        objective: 'Your opponent has a recharging jetpack.',
        title: 'Unfair Advantage',
        map: 2,
        mode: MODE.lms,
        lives: 7,
        crates: true,
        powerups: true,
        enemies: [{name: 'Jet Pack Bunny', color: 4, shirt: 30, hat: 17, gun: 4, perk: 5, ptype: AI.jetpack}]
    },
    {
        n: 8,
        mapName: 'Underwater Slaughter',
        objective: 'Defeat your opponent using the most powerful gun in the game.',
        title: 'One Hit One Kill',
        map: 3,
        mode: MODE.oneHit,
        lives: 7,
        crates: true,
        powerups: true,
        enemies: [{name: 'Pirate', color: 10, shirt: 8, hat: 15, gun: 1, perk: 5, ptype: AI.standard}]
    },
    {
        n: 9,
        mapName: 'No Name',
        objective: 'Put your perception skills to the test.',
        title: 'The Ghost',
        map: 1,
        mode: MODE.lms,
        lives: 7,
        crates: true,
        powerups: true,
        enemies: [{name: 'Sinusoidal Sam', color: 5, shirt: 5, hat: 1, gun: 6, perk: 2, ptype: AI.ghost}]
    },
    {
        n: 10,
        mapName: 'Desert Destruction',
        objective: 'The final test. Only the best will win.',
        title: 'BOSS 2: Minigun Maniac',
        map: 7,
        mode: MODE.lms,
        lives: 5,
        crates: true,
        powerups: false,
        aiIgnoresCrates: true,
        enemies: [{name: 'The Boss', color: 6, shirt: 14, hat: 13, gun: 6, perk: 6, ptype: AI.boss}]
    }
]);

export const ENEMY_NAMES = Object.freeze([...new Set(LEVELS.flatMap(l => l.enemies.map(e => e.name)))]);

const UNLOCK_INDEX = Object.freeze([
    [18, 29],
    [40, 52],
    [19, 30],
    [41, 53],
    [20, 31],
    [42, 54],
    [21, 32],
    [43, 55],
    [22, 33],
    [44, 56]
]);

const LOCKED_INDEX = UNLOCK_INDEX.flat();
export const unlocksOf = n => UNLOCK_INDEX[n - 1].map(i => i + 10);
export const levelOf = n => LEVELS[n - 1];

export function createProgress() {
    const levels = new Array(LEVEL_COUNT).fill(LOCKED);

    levels[0] = OPEN;
    levels[1] = OPEN;

    const guns = new Array(57).fill(true);

    for (const i of LOCKED_INDEX) {
        guns[i] = false;
    }

    return {levels, guns};
}

export function refreshOpen(progress) {
    for (let i = 0; i < LEVEL_COUNT - 1; i++) {
        if (progress.levels[i] === DONE && progress.levels[i + 1] === LOCKED) {
            progress.levels[i + 1] = OPEN;
        }
    }

    return progress;
}

export function completeLevel(progress, n) {
    const fresh = unlocksOf(n).filter(id => !progress.guns[id - 10]);

    progress.levels[n - 1] = DONE;

    for (const id of unlocksOf(n)) {
        progress.guns[id - 10] = true;
    }

    refreshOpen(progress);
    return fresh;
}

export const isPlayable = (progress, n) => n >= 1 && n <= LEVEL_COUNT && progress.levels[n - 1] !== LOCKED;
export const crateUnlocked = (progress, id) => id < 10 || id >= 67 || progress.guns[id - 10] !== false;
export const doneCount = progress => progress.levels.filter(v => v === DONE).length;

export function snapshotProgress(progress) {
    return {version: 1, levels: progress.levels.slice(), guns: progress.guns.map(v => (v ? 1 : 0)).join('')};
}

export function applyProgress(progress, data) {
    if (
        !data ||
        data.version !== 1 ||
        !Array.isArray(data.levels) ||
        data.levels.length !== LEVEL_COUNT ||
        typeof data.guns !== 'string' ||
        data.guns.length !== 57
    ) {
        return false;
    }

    if (!data.levels.every(v => v === LOCKED || v === OPEN || v === DONE)) {
        return false;
    }

    progress.levels = data.levels.slice();
    progress.guns = Array.from(data.guns, c => c === '1');
    progress.levels[0] = Math.max(progress.levels[0], OPEN);
    progress.levels[1] = Math.max(progress.levels[1], OPEN);
    refreshOpen(progress);
    return true;
}

export const IMPLEMENTED = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

function shirtIndex(frame, counts) {
    if (!counts.shirtIds) {
        return frame - 1 < counts.shirt ? Math.max(0, frame - 1) : 0;
    }

    const wanted = frame >= 16 && frame <= 29 ? 24 : frame,
        index = counts.shirtIds.indexOf(wanted);

    return index < 0 ? 0 : index;
}

export function enemyPlayer(enemy, counts, controllerIndex, level) {
    const fit = (value, count) => (value - 1) % count;

    const aiType =
        {[AI.double]: 'decoy', [AI.jetpack]: 'jetpack', [AI.ghost]: 'ghost', [AI.boss]: 'boss'}[enemy.ptype] ||
        'standard';

    return {
        controllerIndex,
        type: 'cpu',
        name: enemy.name,
        nameId: ENEMY_NAMES.indexOf(enemy.name) + 1,
        unarmed: enemy.gun === 0,
        aiType,
        color: fit(enemy.color, counts.color),
        shirt: shirtIndex(enemy.shirt, counts),
        hat: fit(enemy.hat, counts.hat),
        perk: Math.max(0, enemy.perk - 1),
        weaponId:
            aiType === 'boss'
                ? 55
                : counts.weaponIds[Math.max(0, Math.min(counts.weaponIds.length - 1, enemy.gun - 1))],
        team: level.teams ? 1 : 10 + controllerIndex,
        dummy: enemy.gun === 0,
        cheapTimer: level.n === 4 ? 120 : 0,
        firepower: level.firepower === undefined ? 1 : level.firepower,
        damage: level.damage === undefined ? 1 : level.damage
    };
}

export function lockedGuns(progress) {
    const out = [];

    progress.guns.forEach((open, i) => {
        if (!open) {
            out.push(i + 10);
        }
    });

    return out;
}

export const PERK_UNLOCK = Object.freeze({
    2: {index: 2, text: 'Perk: Triple Jump'},
    5: {index: 5, text: 'Perk: Blast Shield'},
    6: {index: 8, text: 'Perk: Gun Spawn'}
});

export const unlockedPerkIndexes = progress =>
    Object.keys(PERK_UNLOCK)
        .filter(n => progress.levels[n - 1] === DONE)
        .map(n => PERK_UNLOCK[n].index);
