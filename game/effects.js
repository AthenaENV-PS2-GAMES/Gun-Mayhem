export const FX_CAP = 64;

export const KIND = Object.freeze({
    FLASH: 1,
    SHELL: 2,
    BLOOD: 3,
    STAIN: 4,
    DUST: 5,
    COMBO: 6,
    GROW: 7,
    PUFF: 8,
    DEBRIS: 9,
    SPARK: 10,
    DROP: 11,
    NAME: 12,
    BLING: 13,
    TRAIL: 14
});

export const ATLAS = Object.freeze({FX: 0, EXPLOSION: 1, WEAPON: 2, POPUPS: 3});
const DEG = Math.PI / 180;
const rand = Math.random;
const randInt = n => Math.floor(rand() * n);

export const COMBO_STYLES = Object.freeze({
    1: {r: 255, g: 153, b: 0},
    2: {r: 255, g: 51, b: 0},
    3: {r: 255, g: 255, b: 0}
});

export function createEffects() {
    const pool = [];

    for (let i = 0; i < FX_CAP; i++) {
        pool.push({
            active: false,
            kind: 0,
            part: '',
            x: 0,
            y: 0,
            px: 0,
            py: 0,
            vx: 0,
            vy: 0,
            rot: 0,
            vrot: 0,
            alpha: 100,
            scale: 1,
            scaleY: 1,
            t: 0,
            speed: 0,
            text: '',
            key: '',
            style: 1,
            level: 1,
            target: 1.9,
            atlas: 0,
            weapon: 0,
            flip: false,
            to: 1,
            fade: 20,
            shrink: 0,
            grav: 0,
            batch: false,
            q: null
        });
    }

    return {pool, next: 0, pending: []};
}

export function resetEffects(fx) {
    for (const p of fx.pool) {
        p.active = false;
    }

    fx.pending.length = 0;
}

function slot(fx, kind, part, x, y) {
    const k = fx.next;

    for (let i = 0; i < 4; i++) {
        const c = fx.pool[(k + i) % FX_CAP];

        if (!c.active) {
            fx.next = (k + i + 1) % FX_CAP;
            return init(c, kind, part, x, y);
        }
    }

    fx.next = (k + 1) % FX_CAP;
    return init(fx.pool[k], kind, part, x, y);
}

function init(p, kind, part, x, y) {
    p.active = true;
    p.kind = kind;
    p.part = part;
    p.x = p.px = x;
    p.y = p.py = y;
    p.vx = p.vy = p.rot = p.vrot = p.speed = p.t = 0;
    p.alpha = 100;
    p.scale = 1;
    p.scaleY = 1;
    p.text = '';
    p.style = 1;
    p.level = 1;
    p.atlas = 0;
    p.weapon = 0;
    p.flip = false;
    p.shrink = 0;
    p.grav = 0;
    p.q = null;

    p.batch =
        part !== '' &&
        (kind === KIND.DUST ||
            kind === KIND.SHELL ||
            kind === KIND.SPARK ||
            kind === KIND.DEBRIS ||
            kind === KIND.PUFF);

    return p;
}

// The bright core of the flash sprite sits this far from its registration point. Turning the flash 180 degrees (facing
// left) or mirroring it vertically swings the core to the other side of that point, so the flash is anchored on its core:
// (x, y) is where the core is centred (see game/muzzle.js) and the sprite is drawn with its origin moved onto the core.
export const FLASH_CORE = Object.freeze({x: 31, y: 22.1});

export function spawnFlash(fx, x, y, facing) {
    const p = slot(fx, KIND.FLASH, 'flash', x, y);

    p.rot = (facing > 0 ? 0 : 180) * DEG;

    if (randInt(2) === 0) {
        p.scaleY = -1;
    }
}

export function spawnShell(fx, x, y, part) {
    const p = slot(fx, KIND.SHELL, part, x, y);

    if (part === 'shell3' || part === 'shot3') {
        p.vx = rand() * 4 - 2;
        p.vy = rand() * 2;
    } else if (part === 'shell4') {
        p.vx = rand() * 2 - 1;
        p.vy = rand() * 5;
    } else {
        p.vx = rand() * 10 - 5;
        p.vy = rand() * 5 - 10;
    }

    p.vrot = (rand() * 10 + 5) * (randInt(2) === 0 ? -1 : 1) * DEG;
}

export function spawnTrail(fx, x, y, facing) {
    const p = slot(fx, KIND.TRAIL, 'instatrail', x, y);

    p.rot = facing > 0 ? 0 : Math.PI;
}

export function spawnBlood(fx, x, y) {
    const p = slot(fx, KIND.BLOOD, 'blood', x, y);
    let rot = randInt(135) - 90;

    if (randInt(2) === 0) {
        rot += 180;
    }

    p.rot = rot;
    p.speed = rand() * 5 + 5;
    p.x += Math.cos(rot * DEG) * p.speed;
    p.y += Math.sin(rot * DEG) * p.speed;
    p.px = p.x;
    p.py = p.y;
    p.scale = (100 - randInt(60)) / 100;
}

export function spawnStain(fx, x, y) {
    const p = slot(fx, KIND.STAIN, 'stain' + (1 + randInt(3)), x, y);

    p.rot = randInt(360) * DEG;
    p.scale = 1.5;
}

export function spawnDust(fx, x, y, mapNumber) {
    const p = slot(fx, KIND.DUST, 'dust' + Math.max(1, Math.min(13, mapNumber)), x + randInt(10) - 5, y);

    p.vx = rand() * 24 - 12;
    p.vy = rand() - 1;
    p.alpha = Math.min(100, Math.round(Math.abs(p.vx) + 10) * 4);
    p.scale = (100 + randInt(80)) / 100;
    p.vrot = (rand() * 10 + 5) * (randInt(2) === 0 ? -1 : 1) * DEG;
}

export function spawnCombo(fx, x, y, combo) {
    const p = slot(fx, KIND.COMBO, '', x, y);

    p.rot = (randInt(15) + 5) * (randInt(2) === 0 ? -1 : 1) * DEG;
    p.scale = 1;
    p.target = 1.9;
    p.style = 1;

    if (combo === 1) {
        p.text = 'HIT';
    } else if (combo > 1) {
        p.text = combo + ' HITS';
    } else {
        const named = {
            '-1': ['SNIPED', 2, 1.999],
            '-2': ['BOOM', 3, 1.99],
            '-3': ['QUACK', 3, 1.99],
            '-4': ['PWND', 2, 1.99],
            '-5': ['SPLAT', 2, 1.99],
            '-6': ['SMACKED', 2, 1.99],
            '-7': ['POW', 3, 1.95]
        }[combo];

        if (!named) {
            p.active = false;
            return;
        }

        p.text = named[0];
        p.style = named[1];
        p.target = named[2];
    }

    p.key = p.text.replace(' ', '_');
}

export function spawnGrow(fx, part, x, y, s0, to, thresh, fade, rotJitter) {
    const p = slot(fx, KIND.GROW, part, x, y);

    p.atlas = ATLAS.EXPLOSION;
    p.scale = s0;
    p.to = to;
    p.target = thresh;
    p.fade = fade;
    p.rot = rotJitter ? (randInt(20) - 10) * DEG : randInt(2) === 0 ? 0 : Math.PI * 0;
}

export function spawnPuff(fx, x, y) {
    const p = slot(fx, KIND.PUFF, 'puff', x + randInt(80) - 40, y + randInt(80) - 20);

    p.vx = rand() * 10 - 5;
    p.vy = rand() * 4 - 5;
    p.x += p.vx;
    p.y += p.vy;
    p.px = p.x;
    p.py = p.y;
    p.scale = (100 + randInt(100)) / 100;
}

export function spawnDebris(fx, part, x, y, shrink, fixedGravity) {
    const p = slot(fx, KIND.DEBRIS, part, x + randInt(20) - 10, y - randInt(20));

    p.vx = rand() * 20 - 10;
    p.vy = rand() * 10 - 20;
    p.vrot = (rand() * 10 + 5) * (randInt(2) === 0 ? -1 : 1) * DEG;
    p.shrink = shrink;
    p.grav = fixedGravity || 0;
}

export function spawnSpark(fx, x, y) {
    const p = slot(fx, KIND.SPARK, 'spark', x, y);

    p.vx = rand() * 10 - 5;
    p.vy = rand() * 4 - 2;
    p.x += p.vx;
    p.y += p.vy;
    p.px = p.x;
    p.py = p.y;
    p.vrot = (rand() * 10 + 5) * (randInt(2) === 0 ? -1 : 1) * DEG;
}

export function spawnDrop(fx, part, x, y, vx, vy, vrotDegrees, flip, weapon) {
    const p = slot(fx, KIND.DROP, part, x, y);

    p.vx = vx;
    p.vy = vy;
    p.vrot = vrotDegrees * DEG;
    p.flip = flip;
    p.weapon = weapon || 0;

    if (weapon) {
        p.atlas = ATLAS.WEAPON;
    }

    p.batch = part !== '';
}

export function spawnDropGun(fx, x, y, facing, weapon) {
    spawnDrop(
        fx,
        '',
        x,
        y,
        5 * facing,
        rand() * 5 - 10,
        (rand() * 2 + 5) * (randInt(2) === 0 ? -1 : 1),
        facing < 0,
        weapon
    );
}

export function spawnDropMag(fx, part, x, y) {
    spawnDrop(fx, part, x, y, 0, 0, 5 * (randInt(2) === 0 ? -1 : 1), false, 0);
}

export function spawnSpeedLoader(fx, x, y) {
    spawnDrop(fx, 'speedloader', x, y, rand() * 2 - 1, 0, (rand() * 10 + 5) * (randInt(2) === 0 ? -1 : 1), false, 0);
}

export function spawnCrateName(fx, x, y, weapon) {
    const p = slot(fx, KIND.NAME, 'crate' + weapon, x, y);

    p.atlas = ATLAS.POPUPS;
    p.alpha = 0;
    p.level = 1;
    p.weapon = weapon;
}

export function spawnBling(fx, player, mod, level) {
    const p = slot(fx, KIND.BLING, mod === 5 ? 'bling5_' + level : 'bling' + mod, 0, 0);

    p.alpha = 0;
    p.scale = 700;
    p.level = 30;
    p.weapon = player;
}

export function queueShell(fx, delay, id, part, dy) {
    fx.pending.push({t: delay, id, part, dy, drop: false});
}

export function queueShells(fx, delay, id, count) {
    fx.pending.push({t: delay, id, part: 'shell4', dy: -38, drop: false, count});
}

export function queueDrop(fx, delay, id, part) {
    fx.pending.push({t: delay, id, part, dy: 0, drop: true});
}

export function updateEffects(fx, gravity) {
    const pool = fx.pool;

    for (let i = 0; i < pool.length; i++) {
        const p = pool[i];

        if (!p.active) {
            continue;
        }

        p.px = p.x;
        p.py = p.y;
        p.t++;

        switch (p.kind) {
            case KIND.TRAIL:
                p.alpha -= 20;

                if (p.alpha <= 1) {
                    p.active = false;
                }

                break;

            case KIND.FLASH:
                p.alpha -= 51;

                if (p.alpha <= 1) {
                    p.active = false;
                }

                break;

            case KIND.SHELL:
                p.x += p.vx;
                p.y += p.vy;
                p.rot += p.vrot;
                p.vy += gravity * 1.3;

                if (p.y >= 700 || p.t > 32) {
                    p.active = false;
                }

                break;

            case KIND.BLOOD: {
                p.speed += 0.5;
                p.rot += p.rot > -90 && p.rot < 90 ? 4 : -4;
                p.x += Math.cos(p.rot * DEG) * p.speed;
                p.y += Math.sin(p.rot * DEG) * p.speed;

                if (p.y >= 700 || p.t > 28) {
                    p.active = false;
                }

                break;
            }

            case KIND.STAIN:
                p.scale += 0.5;
                p.alpha -= 20;

                if (p.alpha <= 1) {
                    p.active = false;
                }

                break;

            case KIND.DUST:
                p.x += p.vx;
                p.y += p.vy;
                p.vx *= 0.8;
                p.rot += p.vrot;
                p.alpha -= 3;

                if (p.alpha <= 1) {
                    p.active = false;
                }

                break;

            case KIND.GROW:
                if (p.level === 1) {
                    p.scale += (p.to - p.scale) / 3;

                    if (p.scale >= p.target) {
                        p.level = 2;
                    }
                }

                if (p.level === 2) {
                    p.alpha -= p.fade;
                }

                if (p.alpha <= 1) {
                    p.active = false;
                }

                break;

            case KIND.PUFF:
                p.x += p.vx;
                p.vy -= 0.1;
                p.vx *= 0.9;
                p.y += p.vy;
                p.scale -= 0.06;

                if (p.scale <= 0.1) {
                    p.active = false;
                }

                break;

            case KIND.DEBRIS:
                p.x += p.vx;
                p.y += p.vy;
                p.rot += p.vrot;
                p.scale -= p.shrink;
                p.vy += p.grav || gravity * 1.3;

                if (p.y >= 700 || p.scale <= 0.01 || p.t > 60) {
                    p.active = false;
                }

                break;

            case KIND.SPARK:
                p.x += p.vx;
                p.vx *= 0.2;
                p.y += p.vy;
                p.scale -= 0.05;
                p.rot += p.vrot;
                p.alpha -= 20;

                if (p.alpha <= 1) {
                    p.active = false;
                }

                break;

            case KIND.DROP:
                p.x += p.vx;
                p.y += p.vy;
                p.rot += p.vrot;
                p.vy += gravity * 1.3;

                if (p.y >= 700 || p.t > 90) {
                    p.active = false;
                }

                break;

            case KIND.NAME:
                p.y -= 0.5;

                if (p.level === 1) {
                    if (p.alpha < 80) {
                        p.alpha += 10;
                    }

                    if (p.t >= 40) {
                        p.level = 2;
                    }
                }

                if (p.level === 2) {
                    p.alpha -= 10;
                }

                if (p.alpha <= 1 && p.t > 1) {
                    p.active = false;
                }

                break;

            case KIND.BLING:
                if (p.t <= 20) {
                    if (p.alpha < 100) {
                        p.alpha += 50;
                    }

                    if (p.scale > 100) {
                        p.scale += (90 - p.scale) / 5;
                    }
                } else if (p.t >= 40) {
                    p.alpha -= 10;

                    if (p.alpha <= 1) {
                        p.active = false;
                    }
                }

                p.level += (110 - p.level) / 5;
                break;

            case KIND.COMBO:
                if (p.level === 1) {
                    p.scale += (2 - p.scale) / 3;

                    if (p.scale >= p.target) {
                        p.level = 2;
                    }
                }

                if (p.level === 2) {
                    p.scale -= 0.03;
                    p.alpha -= 10;
                }

                if (p.alpha <= 1) {
                    p.active = false;
                }

                break;

            default:
                p.active = false;
        }
    }
}

export function flushPending(fx, spawnAt) {
    for (let i = fx.pending.length - 1; i >= 0; i--) {
        const q = fx.pending[i];

        if (q.t > 0) {
            q.t--;
            continue;
        }

        const at = spawnAt(q.id);

        if (at) {
            if (q.count) {
                for (let n = 0; n < q.count; n++) {
                    spawnShell(fx, at.x + (at.shootX + 4) * at.facing, at.y + q.dy, q.part);
                }
            } else if (!q.drop) {
                spawnShell(fx, at.x + at.shellX * at.facing, at.y + q.dy, q.part);
            } else if (q.part === 'speedloader') {
                spawnSpeedLoader(fx, at.x + (at.shootX + 4) * at.facing, at.y - 38);
            } else {
                spawnDropMag(fx, q.part, at.x + (at.shootX - 5) * at.facing, at.y - 20);
            }
        }

        fx.pending.splice(i, 1);
    }
}

export function activeCount(fx) {
    let n = 0;

    for (const p of fx.pool) {
        if (p.active) {
            n++;
        }
    }

    return n;
}
