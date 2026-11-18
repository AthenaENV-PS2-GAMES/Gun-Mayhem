import * as std from 'std';
import {COLORS, SHIRTS, HATS, COSMETIC_PLACEMENT, COSMETIC_ASSETS} from './cosmetics.js';
import {WEAPONS} from './weapons.js';
import {HEAD_BOB} from './idle.js';

const FLASH_SCALE = 0.8;

export function loadCharacterKit() {
    const colors = new Image('assets/cosmetics/atlas.png');
    const accessories = colors;
    const weaponAtlas = new Image('assets/weapons/atlas.png');

    if (!colors.ready() || !weaponAtlas.ready()) {
        throw new Error('Character textures could not be loaded');
    }

    const colorParts = JSON.parse(std.loadFile('assets/cosmetics/atlas.json')).parts;
    const accessoryParts = colorParts;
    const weaponParts = JSON.parse(std.loadFile('assets/weapons/atlas.json')).parts;

    const IDLE_ANGLE = (40 * Math.PI) / 180,
        lerp = (a, b, m) => a + (b - a) * m;

    const headBob = p => (p.headFrame ? HEAD_BOB[p.headFrame - 1] : 0);

    const neutral = Color.new(128, 128, 128),
        hurt = Color.new(128, 90, 90),
        phase = Color.new(40, 112, 128);

    const flash = Color.new(255, 221, 98);

    const menuArt = new Image('assets/ui/menu.png');
    const menuParts = JSON.parse(std.loadFile('assets/ui/menu.json')).parts;

    const eyesOf = p => {
        const hat = HATS[p.hat || 0];
        return hat && hat.eyes ? colorParts[hat.eyes] : colorParts.eyes;
    };

    const colorSets = COLORS.map(c => ({
        foot: colorParts[c.prefix + '_foot'],
        body: colorParts[c.prefix + '_body'],
        head: colorParts[c.prefix + '_head'],
        hand: colorParts[c.prefix + '_hand']
    }));

    const drawOptions = {
        width: 0,
        height: 0,
        startx: 0,
        starty: 0,
        endx: 0,
        endy: 0,
        flipX: false,
        color: neutral,
        angle: 0,
        originX: 0,
        originY: 0
    };

    function drawFrom(image, p, x, y, lx, ly, facing, scale, tint = neutral, angle = 0) {
        const dx = x + scale * (facing > 0 ? lx - p.originX : -lx + p.originX - p.w),
            o = drawOptions;

        o.width = p.w * scale;
        o.height = p.h * scale;
        o.startx = p.x;
        o.starty = p.y;
        o.endx = p.x + p.w;
        o.endy = p.y + p.h;
        o.flipX = facing < 0;
        o.color = tint;
        o.angle = angle;
        o.originX = facing > 0 ? p.originX * scale : (p.w - p.originX) * scale;
        o.originY = p.originY * scale;
        image.draw(dx, y + scale * (ly - p.originY), o);
    }

    function drawCharacter(p, x, y, scale = FLASH_SCALE, effects = true) {
        const set = colorSets[p.color || 0],
            f = p.facing || 1;

        const moving = Math.abs(p.vx || 0) > 0.2 && p.ground >= 0;
        const swing = moving ? Math.sin(p.walk || 0) * 7 : 0;
        const bob = moving ? Math.abs(Math.sin(p.walk || 0)) * 2 : 0;

        const tint = p.instagib > 0 ? ((p.instagib >> 1) & 1 ? phase : neutral) : p.hit > 0 ? hurt : neutral;

        drawFrom(colors, set.foot, x, y, 4 + swing, -12.2 - Math.max(0, swing * 0.4), f, scale, tint);
        drawFrom(colors, set.body, x, y, 0, -34.7 - bob, f, scale, tint);

        const shirt = SHIRTS[p.shirt || 0];

        if (shirt && shirt.part) {
            drawFrom(
                accessories,
                accessoryParts[shirt.part],
                x,
                y,
                COSMETIC_PLACEMENT.shirt[0],
                COSMETIC_PLACEMENT.shirt[1] - bob,
                f,
                scale,
                tint
            );
        }

        const hb = headBob(p);

        drawFrom(colors, set.head, x, y, 9.45, -56 - bob + hb, f, scale, tint);

        const hat = HATS[p.hat || 0],
            over = !!(hat && hat.eyesOver);

        if (!over) {
            drawFrom(colors, eyesOf(p), x, y, 0, -46 - bob + hb, f, scale);
        }

        if (hat && hat.part) {
            drawFrom(
                accessories,
                accessoryParts[hat.part],
                x,
                y,
                COSMETIC_PLACEMENT.hat[0],
                COSMETIC_PLACEMENT.hat[1] - bob + hb,
                f,
                scale,
                tint
            );
        }

        if (over) {
            drawFrom(colors, eyesOf(p), x, y, 0, -46 - bob + hb, f, scale);
        }

        drawFrom(colors, set.foot, x, y, -17 - swing, -6.8 - Math.max(0, -swing * 0.4), f, scale, tint);

        const weapon = WEAPONS[p.weaponId || 1],
            kick = effects && p.flash ? -5 : 0;

        const m = p.idleMix || 0;

        drawFrom(
            colors,
            set.hand,
            x,
            y,
            lerp(weapon.handX, 20, m) + kick,
            lerp(-25 + weapon.handY, -28.75, m) - bob,
            f,
            scale,
            tint
        );

        drawFrom(
            weaponAtlas,
            weaponParts[weapon.part],
            x,
            y,
            lerp(weapon.shootX, -5, m) + kick,
            lerp(-35 + weapon.shootY, -24.15, m) - bob,
            f,
            scale,
            neutral,
            lerp(effects ? (p.reload ? 0.6 * f : p.flash ? (-weapon.blowback / 100) * f : 0) : 0, IDLE_ANGLE * f, m)
        );

        drawFrom(
            colors,
            set.hand,
            x,
            y,
            lerp(weapon.shootX, -5, m) + kick,
            lerp(-35 + weapon.shootY, -24.5, m) - bob,
            f,
            scale,
            tint
        );
    }

    function drawPosed(p, x, y, scale, lean, handDx) {
        const set = colorSets[p.color || 0],
            f = p.facing || 1,
            tint = neutral;

        const th = (lean * Math.PI) / 180,
            c = Math.cos(th),
            s = Math.sin(th),
            PY = -34.7;

        const rot = (lx, ly) => {
            const sx = f * lx,
                sy = ly - PY;

            return [(sx * c - sy * s) * f, PY + sx * s + sy * c];
        };

        const part = (image, q, lx, ly) => {
            const r = rot(lx, ly);

            drawFrom(image, q, x, y, r[0], r[1], f, scale, tint, th);
        };

        drawFrom(colors, set.foot, x, y, 4, -12.2, f, scale, tint);
        part(colors, set.body, 0, -34.7);

        const shirt = SHIRTS[p.shirt || 0];

        if (shirt && shirt.part) {
            part(accessories, accessoryParts[shirt.part], COSMETIC_PLACEMENT.shirt[0], COSMETIC_PLACEMENT.shirt[1]);
        }

        const hb = headBob(p);

        part(colors, set.head, 9.45, -56 + hb);

        const hat = HATS[p.hat || 0],
            over = !!(hat && hat.eyesOver);

        if (!over) {
            part(colors, eyesOf(p), 0, -46 + hb);
        }

        if (hat && hat.part) {
            part(accessories, accessoryParts[hat.part], COSMETIC_PLACEMENT.hat[0], COSMETIC_PLACEMENT.hat[1] + hb);
        }

        if (over) {
            part(colors, eyesOf(p), 0, -46 + hb);
        }

        drawFrom(colors, set.foot, x, y, -17, -6.8, f, scale, tint);

        const weapon = WEAPONS[p.weaponId || 1],
            m = p.idleMix || 0;

        drawFrom(
            colors,
            set.hand,
            x,
            y,
            lerp(weapon.handX, 20, m) + handDx,
            lerp(-25 + weapon.handY, -28.75, m),
            f,
            scale,
            tint
        );

        if (!p.unarmed) {
            drawFrom(
                weaponAtlas,
                weaponParts[weapon.part],
                x,
                y,
                lerp(weapon.shootX, -5, m) + handDx,
                lerp(-35 + weapon.shootY, -24.15, m),
                f,
                scale,
                neutral,
                lerp(0, IDLE_ANGLE * f, m)
            );
        }

        drawFrom(
            colors,
            set.hand,
            x,
            y,
            lerp(weapon.shootX, -5, m) + handDx,
            lerp(-35 + weapon.shootY, -24.5, m),
            f,
            scale,
            tint
        );
    }

    function drawWeaponIcon(id, x, y, maxWidth, angle = 0, tint = neutral) {
        const part = weaponParts[WEAPONS[id].part],
            scale = Math.min(0.8, maxWidth / part.w);

        drawFrom(weaponAtlas, part, x, y, part.originX - part.w / 2, part.originY - part.h / 2, 1, scale, tint, angle);
    }

    function drawPortrait(p, x, y, scale) {
        const set = colorSets[p.color || 0];

        drawFrom(colors, set.head, x, y, 9.45, -56, 1, scale);

        const hat = HATS[p.hat || 0],
            over = !!(hat && hat.eyesOver);

        if (!over) {
            drawFrom(colors, eyesOf(p), x, y, 0, -46, 1, scale);
        }

        if (hat && hat.part) {
            drawFrom(
                accessories,
                accessoryParts[hat.part],
                x,
                y,
                COSMETIC_PLACEMENT.hat[0],
                COSMETIC_PLACEMENT.hat[1],
                1,
                scale
            );
        }

        if (over) {
            drawFrom(colors, eyesOf(p), x, y, 0, -46, 1, scale);
        }
    }

    function drawBust(p, x, y, scale, silhouette = false) {
        const set = colorSets[p.color || 0];

        if (silhouette) {
            drawFrom(menuArt, menuParts.grey_body, x, y, 0, -34.7, 1, scale);

            const shirt = SHIRTS[p.shirt || 0];

            if (shirt && shirt.part) {
                drawFrom(
                    accessories,
                    accessoryParts[shirt.part],
                    x,
                    y,
                    COSMETIC_PLACEMENT.shirt[0],
                    COSMETIC_PLACEMENT.shirt[1],
                    1,
                    scale
                );
            }

            drawFrom(menuArt, menuParts.grey_head, x, y, 9.45, -56, 1, scale);
            return;
        }

        drawFrom(colors, set.body, x, y, 0, -34.7, 1, scale);

        const shirt = SHIRTS[p.shirt || 0];

        if (shirt && shirt.part) {
            drawFrom(
                accessories,
                accessoryParts[shirt.part],
                x,
                y,
                COSMETIC_PLACEMENT.shirt[0],
                COSMETIC_PLACEMENT.shirt[1],
                1,
                scale
            );
        }

        drawFrom(colors, set.head, x, y, 9.45, -56, 1, scale);

        const hat = HATS[p.hat || 0],
            over = !!(hat && hat.eyesOver);

        if (!over) {
            drawFrom(colors, eyesOf(p), x, y, 0, -46, 1, scale);
        }

        if (hat && hat.part) {
            drawFrom(
                accessories,
                accessoryParts[hat.part],
                x,
                y,
                COSMETIC_PLACEMENT.hat[0],
                COSMETIC_PLACEMENT.hat[1],
                1,
                scale
            );
        }

        if (over) {
            drawFrom(colors, eyesOf(p), x, y, 0, -46, 1, scale);
        }
    }

    function drawPerk(index, x, y, scale, tint = neutral) {
        const part = menuParts['perk' + (index + 1)];

        drawFrom(menuArt, part, x, y, part.originX - part.w / 2, part.originY - part.h / 2, 1, scale, tint);
    }

    function drawDroppedGun(id, x, y, flip, angle, tint = neutral) {
        const part = weaponParts[WEAPONS[id].part];

        drawFrom(weaponAtlas, part, x, y, 0, 0, flip ? -1 : 1, FLASH_SCALE, tint, angle);
    }

    const TINT_NEUTRAL = [128, 128, 128],
        TINT_HURT = [128, 90, 90],
        TINT_PHASE = [40, 112, 128];

    let actorAlpha = 128;
    const alphaOf = p => Math.max(0, Math.min(128, Math.round((p.alpha === undefined ? 100 : p.alpha) * 1.28)));
    const weaponTints = [];

    for (let a = 0; a <= 128; a++) {
        weaponTints.push(Color.new(128, 128, 128, a));
    }

    function put(floats, words, rec, q, x, y, lx, ly, f, scale, tint) {
        const o = 16 * rec;

        floats[o] = x + scale * (f > 0 ? lx - q.originX : -lx + q.originX - q.w);
        floats[o + 1] = y + scale * (ly - q.originY);
        floats[o + 2] = q.w * scale;
        floats[o + 3] = q.h * scale;
        floats[o + 4] = f > 0 ? q.x : q.x + q.w;
        floats[o + 5] = q.y;
        floats[o + 6] = f > 0 ? q.x + q.w : q.x;
        floats[o + 7] = q.y + q.h;
        words[o + 8] = tint[0];
        words[o + 9] = tint[1];
        words[o + 10] = tint[2];
        words[o + 11] = actorAlpha;
    }

    const legRotated = p => Math.abs(p.legRot || 0) > 1;

    function writeLegQuad(floats, rec, q, x, y, lx, ly, f, scale, tint, deg) {
        const o = 20 * rec,
            th = (deg * Math.PI) / 180,
            c = Math.cos(th),
            s = Math.sin(th);

        const ox = x + f * lx * scale,
            oy = y + ly * scale;

        const xs = [f * (0 - q.originX) * scale, f * (q.w - q.originX) * scale],
            ys = [(0 - q.originY) * scale, (q.h - q.originY) * scale];

        const us = f > 0 ? [q.x, q.x + q.w] : [q.x + q.w, q.x],
            vs = [q.y, q.y + q.h];

        let k = 0;

        for (const j of [0, 1]) {
            for (const i of [0, 1]) {
                floats[o + 2 * k] = ox + xs[i] * c - ys[j] * s;
                floats[o + 2 * k + 1] = oy + xs[i] * s + ys[j] * c;
                floats[o + 8 + 2 * k] = us[i];
                floats[o + 8 + 2 * k + 1] = vs[j];
                k++;
            }
        }

        floats[o + 16] = tint[0];
        floats[o + 17] = tint[1];
        floats[o + 18] = tint[2];
        floats[o + 19] = actorAlpha;
    }

    function writeLegQuads(p, x, y, scale, behind, nb, above, na) {
        actorAlpha = alphaOf(p);

        const set = colorSets[p.color || 0],
            f = p.facing || 1;

        const tint =
            p.instagib > 0 ? ((p.instagib >> 1) & 1 ? TINT_PHASE : TINT_NEUTRAL) : p.hit > 0 ? TINT_HURT : TINT_NEUTRAL;

        writeLegQuad(behind, nb, set.foot, x, y, 4, -12.2, f, scale, tint, p.legRot);
        writeLegQuad(above, na, set.foot, x, y, -17, -6.8, f, scale, tint, p.legRot);
    }

    function writeBody(p, x, y, scale, floats, words, first) {
        actorAlpha = alphaOf(p);

        const set = colorSets[p.color || 0],
            f = p.facing || 1;

        const dy = p.bodyDy || 0,
            jump = legRotated(p);

        const moving = Math.abs(p.vx || 0) > 0.2 && p.ground >= 0;
        const swing = moving ? Math.sin(p.walk || 0) * 7 : 0;
        const bob = moving ? Math.abs(Math.sin(p.walk || 0)) * 2 : 0;

        const tint =
            p.instagib > 0 ? ((p.instagib >> 1) & 1 ? TINT_PHASE : TINT_NEUTRAL) : p.hit > 0 ? TINT_HURT : TINT_NEUTRAL;

        const weapon = WEAPONS[p.weaponId || 1],
            kick = p.flash ? -5 : 0;

        let n = first;

        if (!jump) {
            put(floats, words, n++, set.foot, x, y, 4 + swing, -12.2 - Math.max(0, swing * 0.4), f, scale, tint);
        }

        put(floats, words, n++, set.body, x, y, 0, -34.7 - bob + dy, f, scale, tint);

        const shirt = SHIRTS[p.shirt || 0];

        if (shirt && shirt.part) {
            put(
                floats,
                words,
                n++,
                accessoryParts[shirt.part],
                x,
                y,
                COSMETIC_PLACEMENT.shirt[0],
                COSMETIC_PLACEMENT.shirt[1] - bob + dy,
                f,
                scale,
                tint
            );
        }

        const hb = headBob(p);

        put(floats, words, n++, set.head, x, y, 9.45, -56 - bob + dy + hb, f, scale, tint);

        const hat = HATS[p.hat || 0],
            over = !!(hat && hat.eyesOver);

        if (!over) {
            put(floats, words, n++, eyesOf(p), x, y, 0, -46 - bob + dy + hb, f, scale, TINT_NEUTRAL);
        }

        if (hat && hat.part) {
            put(
                floats,
                words,
                n++,
                accessoryParts[hat.part],
                x,
                y,
                COSMETIC_PLACEMENT.hat[0],
                COSMETIC_PLACEMENT.hat[1] - bob + dy + hb,
                f,
                scale,
                tint
            );
        }

        if (over) {
            put(floats, words, n++, eyesOf(p), x, y, 0, -46 - bob + dy + hb, f, scale, TINT_NEUTRAL);
        }

        if (!jump) {
            put(floats, words, n++, set.foot, x, y, -17 - swing, -6.8 - Math.max(0, -swing * 0.4), f, scale, tint);
        }

        const m = p.idleMix || 0;

        put(
            floats,
            words,
            n++,
            set.hand,
            x,
            y,
            lerp(weapon.handX, 20, m) + kick,
            lerp(-25 + weapon.handY, -28.75, m) - bob,
            f,
            scale,
            tint
        );

        return n - first;
    }

    function writeFrontHand(p, x, y, scale, floats, words, first) {
        actorAlpha = alphaOf(p);

        const set = colorSets[p.color || 0],
            f = p.facing || 1;

        const moving = Math.abs(p.vx || 0) > 0.2 && p.ground >= 0;
        const bob = moving ? Math.abs(Math.sin(p.walk || 0)) * 2 : 0;

        const tint =
            p.instagib > 0 ? ((p.instagib >> 1) & 1 ? TINT_PHASE : TINT_NEUTRAL) : p.hit > 0 ? TINT_HURT : TINT_NEUTRAL;

        const weapon = WEAPONS[p.weaponId || 1],
            kick = p.flash ? -5 : 0;

        const m = p.idleMix || 0;

        put(
            floats,
            words,
            first,
            set.hand,
            x,
            y,
            lerp(weapon.shootX, -5, m) + kick,
            lerp(-35 + weapon.shootY, -24.5, m) - bob,
            f,
            scale,
            tint
        );

        return 1;
    }

    function drawWeapon(p, x, y, scale) {
        const f = p.facing || 1;
        const moving = Math.abs(p.vx || 0) > 0.2 && p.ground >= 0;
        const bob = moving ? Math.abs(Math.sin(p.walk || 0)) * 2 : 0;

        const weapon = WEAPONS[p.weaponId || 1],
            kick = p.flash ? -5 : 0;

        const m = p.idleMix || 0;

        drawFrom(
            weaponAtlas,
            weaponParts[weapon.part],
            x,
            y,
            lerp(weapon.shootX, -5, m) + kick,
            lerp(-35 + weapon.shootY, -24.15, m) - bob,
            f,
            scale,
            weaponTints[alphaOf(p)],
            lerp(p.reload ? 0.6 * f : p.flash ? (-weapon.blowback / 100) * f : 0, IDLE_ANGLE * f, m)
        );
    }

    function writePortrait(p, x, y, scale, floats, words, first) {
        const set = colorSets[p.color || 0],
            hat = HATS[p.hat || 0];

        let n = 0;

        const put = (q, lx, ly) => {
            const o = 16 * (first + n++);

            floats[o] = x + scale * (lx - q.originX);
            floats[o + 1] = y + scale * (ly - q.originY);
            floats[o + 2] = q.w * scale;
            floats[o + 3] = q.h * scale;
            floats[o + 4] = q.x;
            floats[o + 5] = q.y;
            floats[o + 6] = q.x + q.w;
            floats[o + 7] = q.y + q.h;
            words[o + 8] = words[o + 9] = words[o + 10] = words[o + 11] = 128;
        };

        put(set.head, 9.45, -56);

        const over = !!(hat && hat.eyesOver);

        if (!over) {
            put(eyesOf(p), 0, -46);
        }

        if (hat && hat.part) {
            put(accessoryParts[hat.part], COSMETIC_PLACEMENT.hat[0], COSMETIC_PLACEMENT.hat[1]);
        }

        if (over) {
            put(eyesOf(p), 0, -46);
        }

        return n;
    }

    return {
        legRotated,
        writeLegQuads,
        drawCharacter,
        drawPosed,
        drawFrom,
        drawWeaponIcon,
        drawPerk,
        drawPortrait,
        drawBust,
        drawDroppedGun,
        writePortrait,
        writeBody,
        writeFrontHand,
        drawWeapon,
        cosmeticsImage: colors,
        neutral
    };
}
