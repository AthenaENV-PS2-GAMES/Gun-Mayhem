import {loadJson} from './loadjson.js';

export function loadPowerupKit() {
    const meta = loadJson('assets/powerups/atlas.json');

    const image = new Image(meta.image),
        parts = meta.parts;

    if (!image.ready()) {
        throw new Error('Power-up textures could not be loaded');
    }

    const tints = [];

    for (let a = 0; a <= 128; a++) {
        tints.push(Color.new(128, 128, 128, a));
    }

    const fuelTints = [];

    for (let a = 0; a <= 128; a++) {
        fuelTints.push(Color.new(128, 51, 0, a));
    }

    const opts = {
        width: 0,
        height: 0,
        startx: 0,
        starty: 0,
        endx: 0,
        endy: 0,
        color: 0,
        flipX: false,
        angle: 0,
        originX: 0,
        originY: 0
    };

    function draw(name, x, y, scale = 1, alpha = 100, facing = 1, angle = 0) {
        const q = parts[name];

        if (!q || alpha <= 0 || scale <= 0) {
            return;
        }

        const s = scale * q.scale,
            o = opts;

        o.width = q.w * s;
        o.height = q.h * s;
        o.startx = q.x;
        o.starty = q.y;
        o.endx = q.x + q.w;
        o.endy = q.y + q.h;
        o.color = tints[Math.max(0, Math.min(128, Math.round(alpha * 1.28)))];
        o.flipX = facing < 0;
        o.angle = angle;
        o.originX = (facing < 0 ? q.w - q.originX : q.originX) * s;
        o.originY = q.originY * s;
        image.draw(x - o.originX, y - o.originY, o);
    }

    const pool = [];

    for (let i = 0; i < 48; i++) {
        pool.push({
            active: false,
            kind: '',
            part: '',
            x: 0,
            y: 0,
            px: 0,
            py: 0,
            vx: 0,
            vy: 0,
            t: 0,
            scale: 1,
            alpha: 100,
            angle: 0,
            facing: 1,
            owner: 0
        });
    }

    let next = 0;

    function spawn(kind, part, event) {
        const q = pool[next];

        next = (next + 1) % pool.length;
        q.active = true;
        q.kind = kind;
        q.part = part;
        q.x = q.px = event.x;
        q.y = q.py = event.y;
        q.vx = q.vy = q.t = q.angle = 0;
        q.scale = 1;
        q.alpha = 100;
        q.facing = event.facing || 1;
        q.owner = event.player;
        return q;
    }

    function event(e, match) {
        if (e.type === 'powerup') {
            spawn('name', 'name' + e.kind, e);
        }

        if (e.type === 'lifeup') {
            spawn('life', 'life', e);
        }

        if (e.type === 'doubleSpawn') {
            spawn('double', 'double', e);
        }

        if (e.type === 'speedTrail') {
            const q = spawn('trail', 'trail', e);

            q.alpha = 20;
            q.scale = match.players[e.player].scale / 100;
        }

        if (e.type === 'jet') {
            const p = match.players[e.player],
                q = spawn('jet', 'jet', e);

            q.x = q.px = e.x - 22 * p.facing;
            q.y = q.py = e.y - 18;
            q.vx = Math.random() * 10 - 5;
            q.vy = Math.random() * 5 + 1;
            q.angle = Math.random() * Math.PI * 2;
            q.alpha = 0;
        }

        if (e.type === 'droppack') {
            const p = match.players[e.player],
                q = spawn('drop', 'drop', e);

            q.y = q.py = e.y - 36;
            q.vx = 5 * p.facing;
            q.vy = Math.random() * 5 - 10;
        }
    }

    function step(match) {
        for (const q of pool) {
            if (!q.active) {
                continue;
            }

            q.px = q.x;
            q.py = q.y;
            q.t++;

            switch (q.kind) {
                case 'name':
                    q.y -= 2;
                    q.alpha = q.t < 40 ? Math.min(80, q.t * 10) : 80 - (q.t - 39) * 10;

                    if (q.t >= 47) {
                        q.active = false;
                    }

                    break;

                case 'life': {
                    const p = match.players[q.owner];

                    q.x = p.x;
                    q.y = p.y - (30 + 80 * (1 - Math.pow(0.8, q.t)));
                    q.scale = q.t <= 20 ? 0.9 + 6.1 * Math.pow(0.8, q.t) : 1;
                    q.alpha = q.t <= 40 ? Math.min(100, q.t * 50) : 100 - (q.t - 40) * 10;

                    if (q.t >= 50) {
                        q.active = false;
                    }

                    break;
                }

                case 'double':
                    q.y++;
                    q.scale -= 0.05;
                    q.alpha -= 5;
                    break;

                case 'trail':
                    if (q.t >= 10) {
                        q.active = false;
                    }

                    break;

                case 'jet':
                    q.x += q.vx;
                    q.y += q.vy;
                    q.vx *= 0.9;
                    q.scale -= 0.07;
                    q.alpha = Math.min(100, q.alpha + 15);
                    break;

                case 'drop':
                    q.x += q.vx;
                    q.y += q.vy;
                    q.vy += match.gravity * 1.3;
                    q.angle += 0.12;
                    break;
            }

            if (q.alpha < 0 || q.scale <= 0.1 || q.y >= 900) {
                q.active = false;
            }
        }
    }

    function drawOrbs(match) {
        for (const o of match.powerups) {
            if (!o.active) {
                continue;
            }

            if (o.picked) {
                draw('flash' + (32 + 4 * Math.floor(o.pickedFrame / 4)), o.x, o.y);
                continue;
            }

            const grow = Math.min(1, o.frame / 20);

            draw('aura', o.x, o.y, grow, 0.75 * 100);
            draw('icon' + o.kind, o.x, o.y + 2, grow);
        }
    }

    function drawEffects(blend, foreground) {
        for (const q of pool) {
            if (!q.active || (q.kind === 'name' || q.kind === 'life') !== foreground) {
                continue;
            }

            draw(q.part, q.px + (q.x - q.px) * blend, q.py + (q.y - q.py) * blend, q.scale, q.alpha, q.facing, q.angle);
        }
    }

    function drawEquipment(match, blend) {
        for (const p of match.players) {
            if (!p.active || p.spawnPending || p.alpha <= 0) {
                continue;
            }

            const x = p.px + (p.x - p.px) * blend,
                y = p.py + (p.y - p.py) * blend,
                s = p.scale / 100;

            if (p.jetOn) {
                draw('pack', x, y - 45.4 * s, s, p.alpha, p.facing);

                const fuel = (33.3 * s * Math.max(0, p.jetfuel)) / 100;

                Draw.rect(
                    x + (-27.75 * p.facing - 2.1) * s,
                    y - 24.55 * s - fuel,
                    4.25 * s,
                    fuel,
                    fuelTints[Math.max(0, Math.min(128, Math.round(p.alpha * 1.28)))]
                );
            }

            if (p.shieldAlpha > 0) {
                draw(
                    'shield' + (6 + 2 * Math.floor(Math.max(0, p.shieldFrame - 6) / 2)),
                    x,
                    y - 35 * s,
                    s,
                    (p.shieldAlpha * p.alpha) / 100
                );
            }
        }
    }

    return {
        event,
        step,
        drawOrbs,
        drawEffects,
        drawEquipment,
        reset() {
            for (const q of pool) {
                q.active = false;
            }
        }
    };
}
