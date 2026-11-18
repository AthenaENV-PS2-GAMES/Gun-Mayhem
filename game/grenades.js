import {createAiState} from './ai.js';

export const GRENADE = Object.freeze({
    ammo: 3,
    minCharge: 1,
    chargeStep: 0.5,
    maxCharge: 14,
    gravity: 1,
    fuse: 51,
    radius: 200,
    bounceX: 0.6,
    bounceY: 0.4,
    visualScale: 0.8,
    explosionTicks: 18,
    poolSize: 12
});

export function createGrenades() {
    const pool = [];

    for (let i = 0; i < GRENADE.poolSize; i++) {
        pool.push({
            active: false,
            explosion: 0,
            x: 0,
            y: 0,
            px: 0,
            py: 0,
            vx: 0,
            vy: 0,
            rotation: 0,
            spin: 10,
            age: 0,
            owner: 0,
            hitground: false
        });
    }

    return pool;
}

export function throwGrenade(match, p, charge = GRENADE.minCharge) {
    if (!p.active || !(p.grenades > 0)) {
        return false;
    }

    const g = match.grenades.find(item => !item.active && item.explosion === 0);

    if (!g) {
        return false;
    }

    charge = Math.max(GRENADE.minCharge, Math.min(GRENADE.maxCharge, charge));
    g.active = true;
    g.explosion = 0;
    g.x = p.x + 30 * p.facing;
    g.y = p.y - 35;
    g.px = g.x;
    g.py = g.y;
    g.vx = charge * p.facing;
    g.vy = -charge;
    g.rotation = p.facing * 50;
    g.spin = 10 * p.facing;
    g.age = 0;
    g.owner = p.ownerId === undefined ? p.id : p.ownerId;
    g.hitground = false;
    p.grenades--;
    match.stats.grenades = (match.stats.grenades || 0) + 1;
    match.events.push({type: 'throw', player: p.id, x: g.x, y: g.y});
    return true;
}

function explode(match, g) {
    g.active = false;
    g.explosion = GRENADE.explosionTicks;
    match.stats.explosions = (match.stats.explosions || 0) + 1;

    for (const p of match.players) {
        if (!p.active) {
            continue;
        }

        const dx = p.x - g.x,
            dy = p.y - 30 - g.y;

        const distance = Math.round(Math.sqrt(dx * dx + dy * dy));

        if (distance > GRENADE.radius) {
            continue;
        }

        const angle = Math.atan2(dy, dx);
        const protectedPlayer = p.perk === 5 || p.perknumber === 6 || p.shield > 0 || p.shieldtime > 0;

        p.vx += (Math.cos(angle) * (350 - distance)) / (protectedPlayer ? 25 : 5);
        p.vy += (Math.sin(angle) * (350 - distance)) / (protectedPlayer ? 50 : 10);

        if (p.shield > 0) {
            p.shieldFrame = 23;
        }

        p.lastHit = g.owner;
        p.hit = 8;
        p.hitByGrenade = true;
        match.stats.grenadeHits = (match.stats.grenadeHits || 0) + 1;
        match.events.push({type: 'grenadeHit', player: p.id, x: p.x, y: p.y});
    }

    match.events.push({type: 'explosion', player: g.owner, x: g.x, y: g.y});
}

export function updateGrenades(match) {
    for (const g of match.grenades) {
        if (g.explosion > 0) {
            g.explosion--;
        }

        if (!g.active) {
            continue;
        }

        g.px = g.x;
        g.py = g.y;

        if (!g.hitground) {
            g.rotation += g.spin;
        } else {
            const target = Math.abs(90 - g.rotation) < Math.abs(-90 - g.rotation) ? 90 : -90;

            g.rotation += (target - g.rotation) / 5;
        }

        if (g.vy < 24) {
            g.vy += match.gravity === undefined ? GRENADE.gravity : match.gravity + 0.12;
        }

        g.x += g.vx;
        g.y += g.vy;

        if (g.vy > 0) {
            for (const platform of match.arena.platforms) {
                if (
                    g.x >= platform.x &&
                    g.x <= platform.x + platform.w &&
                    g.py + 8 <= platform.y &&
                    g.y + 8 >= platform.y
                ) {
                    g.y = platform.y - 8;
                    g.spin *= 0.5;
                    g.vx *= GRENADE.bounceX;
                    g.vy *= -GRENADE.bounceY;
                    g.hitground = true;
                    match.stats.grenadeBounces = (match.stats.grenadeBounces || 0) + 1;
                    break;
                }
            }
        }

        g.age++;

        if (g.age === 40) {
            for (const p of match.players) {
                if (p.type !== 'cpu' || !p.active || p.perk === 5) {
                    continue;
                }

                const dx = p.x - g.x,
                    dy = p.y - 30 - g.y;

                if (p.y < g.y + 20 && Math.round(Math.sqrt(dx * dx + dy * dy)) <= 150) {
                    const st = p.ai || (p.ai = createAiState());

                    st.forceUp = true;

                    if (p.x < g.x) {
                        st.lockRight = 10;
                    }

                    if (p.x > g.x) {
                        st.lockLeft = 10;
                    }
                }
            }
        }

        if (g.age >= GRENADE.fuse) {
            explode(match, g);
        }

        if (g.y >= 900 || g.x < -500 || g.x > 1400) {
            g.active = false;
        }
    }
}
