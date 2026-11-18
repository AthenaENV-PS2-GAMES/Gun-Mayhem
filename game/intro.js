export const FPS = 35;

export const INTRO_SOUNDS = Object.freeze([
    [2, 122],
    [2, 123],
    [8, 127],
    [32, 128],
    [32, 129],
    [77, 122],
    [77, 130],
    [85, 133],
    [85, 134]
]);

export const INTRO_SOUND_IDS = Object.freeze([...new Set(INTRO_SOUNDS.map(e => e[1]))]);

const ENTER = 224;
const FADE_STEPS = 10;

export function createIntro(meta) {
    return {meta, frame: 0, done: false, played: 0};
}

export function dueSounds(intro) {
    const out = [],
        reached = 2 + Math.floor(intro.frame);

    for (const [frame, id] of INTRO_SOUNDS) {
        if (frame <= reached && frame > intro.played) {
            out.push(id);
        }
    }

    intro.played = Math.min(reached, 225);
    return out;
}

export function stepIntro(intro, dt) {
    intro.frame += dt * FPS;

    const m = intro.meta,
        total = ENTER + m.pgm.fadeFrom + FADE_STEPS;

    if (intro.frame >= total) {
        intro.done = true;
    }

    return intro;
}

const part = (name, x, y, sx = 1, sy = 1, angle = 0, alpha = 1) => ({kind: 'part', name, x, y, sx, sy, angle, alpha});
const rect = (x0, y0, x1, y1, alpha = 1) => ({kind: 'rect', x0, y0, x1, y1, alpha});

const frameItem = tile => ({kind: 'frame', tile, alpha: 1});

function armorTiles(m, n) {
    return m.frames[n - m.frameFrom] || [];
}

function armorItems(m, n) {
    return armorTiles(m, n).map(frameItem);
}

export function armorPagesAhead(intro, count) {
    const m = intro.meta,
        current = m.frameFrom + Math.floor(intro.frame),
        out = [];

    for (let n = current; n < current + count && n < m.frameFrom + m.frames.length; n++) {
        for (const id of armorTiles(m, n)) {
            const page = m.tiles[id].page;

            if (!out.includes(page)) {
                out.push(page);
            }
        }
    }

    return out.sort((a, b) => a - b);
}

function creditItems(m, f, alpha) {
    const p = m.pgm,
        K = p.scale,
        [px, py] = p.place,
        items = [];

    for (const l of p.letters) {
        if (f >= l.from) {
            items.push(part('p' + l.id, px + l.x * K, py + l.y * K, 1, 1, 0, alpha));
        }
    }

    p.bars.x.forEach((bx, k) => {
        const j = f - k;

        if (j < 1 || j > p.bars.rects.length) {
            return;
        }

        const r = p.bars.rects[j - 1];

        if (!r) {
            return;
        }

        items.push(
            rect(
                px + (bx + p.bars.x0) * K,
                py + (p.bars.y + r[0]) * K,
                px + (bx + p.bars.x0 + p.bars.w) * K,
                py + (p.bars.y + r[1]) * K,
                alpha
            )
        );
    });

    if (f >= p.text.frm) {
        items.push(part('p139', px + p.text.x * K, py + p.text.y * K, 1, 1, 0, alpha));
    }

    const sy = p.line.sy[f - 1];

    if (sy > 0) {
        items.push(part('p138', px + p.line.x * K, py + p.line.y * K, 1, sy, 0, alpha));
    }

    return items;
}

export function introItems(intro) {
    const m = intro.meta,
        t = Math.floor(intro.frame);

    if (intro.done) {
        return [];
    }

    if (t < ENTER) {
        return armorItems(m, m.frameFrom + t);
    }

    const f = t - ENTER + 1;

    if (f <= m.pgm.fadeFrom) {
        return creditItems(m, f, 1);
    }

    return creditItems(m, m.pgm.fadeFrom, Math.max(0, 1 - (f - m.pgm.fadeFrom) / FADE_STEPS));
}
