export const PAGES = Object.freeze(['GAME SETUP', 'MAP SELECTION', 'PLAYER SETUP']);

export const MODES = Object.freeze([
    {
        name: 'Last Man Standing',
        gameMode: 1,
        available: true,
        text: 'Free for all. Last player alive wins the game. Weapons are picked up in crates.'
    },
    {
        name: 'Last Man Standing (Team mode)',
        gameMode: 3,
        available: true,
        text: 'Same as last man standing, except players battle in teams.'
    },
    {
        name: 'Duck Survival',
        gameMode: 5,
        available: true,
        text: 'Play by yourself or with a friend. Survive for as long as possible. Random weapons can obtained through crates or the random weapon box.'
    },
    {
        name: 'Gun Game',
        gameMode: 4,
        available: true,
        text: 'Kill your opponents to level up your weapon. First player to get a kill with all the weapons wins the game.'
    },
    {
        name: '1 Hit 1 Kill',
        gameMode: 2,
        available: true,
        text: 'Given the most powerful gun in the game, eliminate your opponents. Be mindful of ammo consumption, as you are only given 5 shots per life.'
    }
]);

export const SETUP_ROWS = Object.freeze({
    modes: MODES.length,
    lives: MODES.length,
    crates: MODES.length + 1,
    pickups: MODES.length + 2,
    count: MODES.length + 3
});

export function createMenu(arenaCount) {
    if (!Number.isInteger(arenaCount) || arenaCount < 1) {
        throw new RangeError('arena count must be positive');
    }

    return {
        page: 0,
        row: 0,
        mode: 0,
        mapRow: 0,
        arenaCount,
        slide: 0,

        target: 0,
        randomPick: -1
    };
}

export const mapRows = menu => menu.arenaCount + 1;

export const arenaOfRow = (menu, row) => (row === 0 ? -1 : menu.arenaCount - row);
export const rowOfArena = (menu, arena) => menu.arenaCount - arena;

export function resolveArena(menu, sample) {
    const arena = arenaOfRow(menu, menu.mapRow);

    if (arena >= 0) {
        return arena;
    }

    return Math.min(menu.arenaCount - 1, Math.floor(sample * menu.arenaCount));
}

export function moveRow(menu, delta) {
    if (menu.page === 0) {
        menu.row = (menu.row + delta + SETUP_ROWS.count) % SETUP_ROWS.count;

        if (menu.row < MODES.length && MODES[menu.row].available) {
            menu.mode = menu.row;
        }
    } else if (menu.page === 1) {
        menu.mapRow = (menu.mapRow + delta + mapRows(menu)) % mapRows(menu);
    }

    return menu;
}

export function canContinue(menu) {
    if (menu.page === 0) {
        return MODES[menu.row < MODES.length ? menu.row : menu.mode].available;
    }

    return true;
}

export function nextPage(menu) {
    if (menu.page >= PAGES.length - 1) {
        return false;
    }

    if (!canContinue(menu)) {
        return false;
    }

    menu.page++;
    menu.target = menu.page;
    return true;
}

export function previousPage(menu) {
    if (menu.page <= 0) {
        return false;
    }

    menu.page--;
    menu.target = menu.page;
    return true;
}

export function stepSlide(menu, dt) {
    const gap = menu.target - menu.slide;

    if (Math.abs(gap) < 0.002) {
        menu.slide = menu.target;
        return menu;
    }

    menu.slide += gap * (1 - Math.pow(1 - 1 / 3, Math.min(0.25, dt) * 35));
    return menu;
}

export const EDIT_ROWS = Object.freeze(['clear', 'hat', 'shirt', 'gun', 'perk', 'color']);

export const HANDGUN_COUNT = 6;

export const createCardState = () => ({row: 1, slide: 1, target: 1});

export const cardPanel = (card, active) => (active ? 1 : 0);

export function stepCard(card, active, dt) {
    card.target = cardPanel(card, active);

    const gap = card.target - card.slide;

    if (Math.abs(gap) < 0.01) {
        card.slide = card.target;
        return false;
    }

    card.slide += gap * (1 - Math.pow(0.5, Math.min(0.25, dt) * 35));
    return true;
}

export function moveEditRow(card, delta) {
    card.row = (card.row + delta + EDIT_ROWS.length) % EDIT_ROWS.length;
    return card;
}

export const PERKS = Object.freeze([
    {name: "I Don't Need Perks", locked: false},
    {name: 'Speed+', locked: false},
    {name: 'Jump+', locked: true},
    {name: 'Mini Gun', locked: false},
    {name: 'No Recoil', locked: false},
    {name: 'Blast Shield', locked: true},
    {name: 'Extra Ammo', locked: false},
    {name: 'Extra Nades', locked: false},
    {name: 'Gun Spawn', locked: true}
]);

const unlockedPerks = new Set();

export const setUnlockedPerks = indexes => {
    unlockedPerks.clear();

    for (const i of indexes) {
        unlockedPerks.add(i);
    }
};

export const perkLocked = index => !!PERKS[index]?.locked && !unlockedPerks.has(index);

export const fieldOf = kind => (kind === 'gun' ? 'weapon' : kind);

export const choiceCount = (kind, lobbyChoices) =>
    kind === 'gun' ? Math.min(HANDGUN_COUNT, lobbyChoices.weapon) : kind === 'perk' ? PERKS.length : lobbyChoices[kind];
