export const ITEMS = Object.freeze([
    {id: 'campaign', label: 'CAMPAIGN', text: 'beat challenges to unlock new weapons and maps (co-op available)'},
    {id: 'custom', label: 'CUSTOM GAME', text: 'play a custom game with up to 4 players!'},
    {id: 'library', label: 'GUN LIBRARY', text: 'view your collection of weapons'},
    {id: 'options', label: 'OPTIONS', text: 'change game settings and controls'},
    {id: 'credits', label: 'CREDITS', text: 'check out who made this game'}
]);

export const BAR = {alphaMax: 80, alphaStep: 20};

export function createMainMenu() {
    return {cursor: 0, barY: -50, barAlpha: 0, acc: 0};
}

export function moveMain(menu, delta) {
    menu.cursor = (menu.cursor + delta + ITEMS.length) % ITEMS.length;
    return menu;
}

export function stepBar(menu, rows) {
    menu.barY += (rows[menu.cursor] - menu.barY) / 2;

    if (Math.abs(rows[menu.cursor] - menu.barY) < 0.5) {
        menu.barY = rows[menu.cursor];
    }

    menu.barAlpha = Math.min(BAR.alphaMax, menu.barAlpha + BAR.alphaStep);
    return menu;
}

export function advanceBar(menu, rows, dt, hz = 35) {
    menu.acc += dt * hz;

    while (menu.acc >= 1) {
        menu.acc -= 1;
        stepBar(menu, rows);
    }

    return menu;
}

export const CREDITS = Object.freeze([
    {role: 'Code / Design', people: [{name: 'Kevin Gu', quote: "Don't touch the screen!"}]},
    {
        role: 'Art guy',
        people: [
            {
                name: 'Arvin Eksiri',
                quote: 'I can finish drawing 20 maps in one week (actual speed: 7 days per map on average)'
            }
        ]
    },
    {role: 'Music', people: [{name: 'Kevin MacLeod', quote: ''}]},
    {
        role: 'Testing',
        people: [
            {name: 'TimmyFool', quote: "I've got this in the bag"},
            {name: 'Lufas', quote: '-no quote-'},
            {name: 'Arfizzy', quote: 'Get Owned!'}
        ]
    },
    {role: 'PS2 port', people: [{name: 'Gibran Khalil', quote: 'using AthenaEnv'}]}
]);
