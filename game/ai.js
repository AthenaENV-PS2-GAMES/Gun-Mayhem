import {WEAPONS} from './weapons.js';

const LAND_DX = 64,
    LAND_DY = 16,
    NOLAND_DY = 24;

const RETARGET = 40;

const boundsCache = new WeakMap();

function arenaBounds(arena) {
    const cached = boundsCache.get(arena);

    if (cached) {
        return cached;
    }

    let left = Infinity,
        right = -Infinity,
        lowest = Infinity;

    for (const q of arena.platforms) {
        if (q.x < left) {
            left = q.x;
        }

        if (q.x + q.w > right) {
            right = q.x + q.w;
        }

        if (q.bottom && q.y < lowest) {
            lowest = q.y;
        }
    }

    if (lowest === Infinity) {
        lowest = Math.max(...arena.platforms.map(q => q.y));
    }

    const bounds = {left, right, middle: (left + right) / 2, lowest};

    boundsCache.set(arena, bounds);
    return bounds;
}

function solid(platforms, x, y) {
    for (let i = 0; i < platforms.length; i++) {
        const q = platforms[i];

        if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) {
            return true;
        }
    }

    return false;
}

export function createAiState() {
    return {
        forceUp: false,
        targetTime: 0,
        lockLeft: 0,
        lockRight: 0,
        lockUp: 0,
        prevX: 0,
        idle2: 0,
        downKey: false,
        tx: NaN,
        ty: NaN,
        tJumps: NaN,
        tVy: NaN,
        hasTarget: false,
        isPlayer: false,
        dir: 1
    };
}

export function aiInput(match, p, out) {
    const st = p.ai || (p.ai = createAiState());

    const platforms = match.arena.platforms,
        b = arenaBounds(match.arena);

    const groundLeft = b.left,
        groundRight = b.right,
        groundMiddle = b.middle,
        lowestY = b.lowest;

    let up = false,
        down = false,
        left = false,
        right = false,
        shoot = false;

    if (st.forceUp) {
        up = true;
        st.forceUp = false;
    }

    const X = p.x,
        Y = p.y,
        vx = p.vx,
        vy = p.vy,
        jn = p.jumps,
        facing = p.facing;

    if (++st.targetTime >= RETARGET) {
        let low = 5000;

        for (let i = 0; i < match.players.length; i++) {
            const o = match.players[i];

            if (!o.active || o.team === p.team || o.ownerId === p.ownerId) {
                continue;
            }

            const dx = o.x - X,
                dy = o.y - 30 - Y,
                d = Math.round(Math.sqrt(dx * dx + dy * dy));

            if (d < low) {
                low = d;
                st.tx = o.x;
                st.ty = o.y;
                st.tJumps = o.jumps;
                st.tVy = o.vy;
                st.isPlayer = true;
                st.hasTarget = true;
                st.ref = o;
            }
        }

        let forced = p.boss || p.isZombie;

        for (let i = 0; i < match.crates.length && !forced; i++) {
            const c = match.crates[i];

            if (!c.active) {
                continue;
            }

            const dx = c.x - X,
                dy = c.y - 30 - Y,
                d = Math.round(Math.sqrt(dx * dx + dy * dy));

            if (d < low) {
                low = d;
                st.tx = c.x;
                st.ty = c.y;
                st.tJumps = NaN;
                st.tVy = NaN;
                st.isPlayer = false;
                st.hasTarget = true;
                st.ref = c;
            }
        }

        for (let i = 0; i < match.powerups.length && !forced; i++) {
            const o = match.powerups[i];

            if (!o.active || o.picked) {
                continue;
            }

            const dx = o.x - X,
                dy = o.y - 30 - Y,
                d = Math.round(Math.sqrt(dx * dx + dy * dy));

            if (d < low) {
                low = d;
                st.tx = o.x;
                st.ty = o.y;
                st.tJumps = NaN;
                st.tVy = NaN;
                st.isPlayer = false;
                st.hasTarget = true;
                st.ref = o;
            }

            if ((!p.isDouble && o.kind === 0) || o.kind === 3) {
                st.tx = o.x;
                st.ty = o.y;
                st.tJumps = NaN;
                st.tVy = NaN;
                st.isPlayer = false;
                st.hasTarget = true;
                st.ref = o;
                forced = true;
            }
        }

        st.targetTime = 0;
    }

    if (st.hasTarget && st.ref) {
        const r = st.ref;

        st.tx = r.x;
        st.ty = r.y;

        if (st.isPlayer) {
            st.tJumps = r.jumps;
            st.tVy = r.vy;
        }
    }

    const tx = st.hasTarget ? st.tx : NaN,
        ty = st.hasTarget ? st.ty : NaN;

    const land1x = X - LAND_DX,
        land1y = Y + LAND_DY,
        land2x = X + LAND_DX,
        land2y = Y + LAND_DY,
        noland = Y + NOLAND_DY;

    if (st.prevX === Math.round(X) && !p.dummy) {
        if (++st.idle2 >= 4) {
            st.idle2 = 0;

            if (jn === 2) {
                up = true;
            }

            if (tx < X) {
                st.lockLeft = 10;
            }

            if (tx >= X) {
                st.lockRight = 10;
            }
        }
    } else {
        st.idle2 = 0;
    }

    st.prevX = Math.round(X);

    if (ty <= Y + 10 && ty >= Y - 80 && jn === 2) {
        let optimalX;

        if (st.isPlayer) {
            if (tx >= groundMiddle) {
                st.dir = 1;
            }

            if (tx < groundMiddle) {
                st.dir = -1;
            }

            optimalX = tx - 150 * st.dir;
        } else {
            optimalX = tx;
        }

        if (X > groundLeft + 200 && optimalX < X - 40) {
            left = true;
        }

        if (X < groundRight - 200 && optimalX > X + 40) {
            right = true;
        }

        if (X > optimalX - 40 && X < optimalX + 40) {
            if (tx > X && facing === -1) {
                right = true;
            }

            if (tx <= X && facing === 1) {
                left = true;
            }
        }
    } else if (ty > Y + 10) {
        if ((X > groundLeft + 50 && st.tJumps === 2) || (X > groundLeft - 10 && !st.isPlayer)) {
            if (tx < X - 30) {
                left = true;
            }
        }

        if ((X < groundRight - 50 && st.tJumps === 2) || (X < groundRight + 10 && !st.isPlayer)) {
            if (tx > X + 30) {
                right = true;
            }
        }

        if (
            (X > tx - 30 && X < tx + 30 && Math.round(st.tVy) === 1 && st.tJumps === 2) ||
            (X > tx - 30 && X < tx + 30 && !st.isPlayer)
        ) {
            down = true;
        }

        if (solid(platforms, X, Y + 95) && st.tJumps === 2) {
            down = true;
        }
    } else if (ty < Y - 80) {
        if (vy < 0 && jn === 1 && solid(platforms, X, Y - 30) && Math.abs(vx) <= 5) {
            up = true;
        }

        if (
            (jn === 2 && solid(platforms, X, Y - 75) && Math.abs(vx) <= 5) ||
            (jn === 2 && solid(platforms, X, Y - 120) && Math.abs(vx) <= 5)
        ) {
            up = true;
        } else if (
            (jn === 2 && solid(platforms, X - 100, Y - 80) && st.lockLeft === 0 && vx >= -5) ||
            (jn === 2 && solid(platforms, X - 100, Y - 120) && st.lockLeft === 0 && vx >= -5)
        ) {
            up = true;
            st.lockLeft = 20;
        } else if (
            (jn === 2 && solid(platforms, X + 100, Y - 80) && st.lockRight === 0 && vx <= 5) ||
            (jn === 2 && solid(platforms, X + 100, Y - 120) && st.lockRight === 0 && vx <= 5)
        ) {
            up = true;
            st.lockRight = 20;
        } else if (jn === 2) {
            if (tx < X && st.lockRight === 0) {
                st.lockLeft = 10;
            } else if (tx > X && st.lockLeft === 0) {
                st.lockRight = 10;
            }
        }
    }

    if (X < groundLeft + 100 || X > groundRight - 100) {
        if (groundMiddle < X - 40) {
            left = true;
        }

        if (groundMiddle > X + 40) {
            right = true;
        }
    }

    if (Math.abs(vx) > 30 && jn === 2) {
        up = true;
    }

    if ((vx > 15 || vx < -15) && jn === 2) {
        up = true;
    }

    if (!solid(platforms, land2x, land2y) && vx > 10 && jn === 2) {
        up = true;
    }

    if (!solid(platforms, land1x, land1y) && vx < -10 && jn === 2) {
        up = true;
    }

    const lowEnough = Y > lowestY - 100;

    if ((X > groundRight - 100 && st.isPlayer) || (X > groundRight && !st.isPlayer)) {
        if (p.jetfuel > 0 && X > groundRight && vy > -1) {
            st.lockUp = 10;
        }

        if (jn === 2) {
            up = true;
        }

        if (vy > 0 && vx < -1 && jn === 1 && X < groundRight + 100) {
            up = true;
        }

        if (X > groundRight && !solid(platforms, X, noland) && jn === 1 && lowEnough) {
            up = true;
        }
    }

    if ((X < groundLeft + 100 && st.isPlayer) || (X < groundLeft && !st.isPlayer)) {
        if (p.jetfuel > 0 && X < groundLeft && vy > -1) {
            st.lockUp = 10;
        }

        if (jn === 2) {
            up = true;
        }

        if (vy > 0 && vx > 1 && jn === 1 && X > groundLeft - 100) {
            up = true;
        }

        if (X < groundLeft && !solid(platforms, X, noland) && jn === 1 && lowEnough) {
            up = true;
        }
    }

    if (!solid(platforms, land2x, land2y) && jn === 2) {
        right = false;
    }

    if (!solid(platforms, land1x, land1y) && jn === 2) {
        left = false;
    }

    if (!solid(platforms, land2x - 15, land2y) && jn === 2) {
        right = false;
        left = true;
    }

    if (!solid(platforms, land1x + 15, land1y) && jn === 2) {
        left = false;
        right = true;
    }

    if (st.lockRight >= st.lockLeft) {
        st.lockLeft = 0;
    }

    if (st.lockLeft > st.lockRight) {
        st.lockRight = 0;
    }

    if (st.lockRight > 0) {
        right = true;
        st.lockRight--;
    }

    if (st.lockLeft > 0) {
        left = true;
        st.lockLeft--;
    }

    if (st.lockUp > 0) {
        up = true;
        st.lockUp--;
    }

    if (st.isPlayer && ty < Y + 20 && ty > Y - 80) {
        if ((tx > X && facing === 1) || (tx < X && facing === -1)) {
            if (WEAPONS[p.weaponId].pellets > 1) {
                const d = Math.abs(tx - X);

                if (d > 15 && d < 150) {
                    shoot = true;
                }
            } else {
                shoot = true;
            }
        }
    }

    if (p.dummy) {
        shoot = false;
    }

    out.move = (right ? 1 : 0) - (left ? 1 : 0);

    if (left && right) {
        p.facing = 1;
    }

    out.jumpHeld = up;
    out.jump = up && !p.jumpKey;
    out.down = down && !st.downKey;
    st.downKey = down;
    out.fire = shoot;
    out.grenade = !!out.forceGrenade;
    return out;
}
