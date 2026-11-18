export const CAMERA = Object.freeze({
    width: 900,
    height: 600,
    minZoom: 0.55,
    maxZoom: 1.18,

    positionRate: -35 * Math.log(7 / 8),
    zoomInRate: 2.5,
    zoomOutRate: 9,
    fallbackSpawnY: -120,
    maxFrameDelta: 0.25,
    victoryZoom: 2
});

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const finite = value => typeof value === 'number' && Number.isFinite(value);

export function createCamera() {
    return resetCamera({});
}

export function resetCamera(state) {
    state.x = 450;
    state.y = 300;
    state.zoom = 1;
    state.targetX = 450;
    state.targetY = 300;
    state.targetZoom = 1;
    state.targetCount = 0;
    state.targets = [];
    state.indicators = [];
    state.bounds = {left: 0, right: 900, top: 0, bottom: 600};
    state.safeBounds = {left: 28, right: 872, top: 78, bottom: 570};
    return state;
}

export function projectPoint(state, x, y) {
    return {x: (x - state.x) * state.zoom + 450, y: (y - state.y) * state.zoom + 300};
}

function live(p) {
    return p && p.active !== false && p.lives !== 0 && finite(p.x) && finite(p.y);
}

function spawning(p) {
    return p.spawnPending === true || (p.spawnPending === undefined && p.y < CAMERA.fallbackSpawnY);
}

function updateBounds(state, players) {
    const inverse = 1 / state.zoom;
    const view = state.bounds;

    view.left = state.x - 450 * inverse;
    view.right = state.x + 450 * inverse;
    view.top = state.y - 300 * inverse;
    view.bottom = state.y + 300 * inverse;

    const safe = state.safeBounds;

    safe.left = state.x + (28 - 450) * inverse;
    safe.right = state.x + (872 - 450) * inverse;
    safe.top = state.y + (78 - 300) * inverse;
    safe.bottom = state.y + (570 - 300) * inverse;
    state.indicators.length = 0;

    for (let i = 0; i < players.length; i++) {
        const p = players[i];

        if (!live(p)) {
            continue;
        }

        const px = (p.x - state.x) * state.zoom + 450,
            py = (p.y - 32 - state.y) * state.zoom + 300;

        if (px >= 28 && px <= 872 && py >= 78 && py <= 570) {
            continue;
        }

        const dx = px - 450,
            dy = py - 300;

        const tx = dx === 0 ? Infinity : dx < 0 ? -422 / dx : 422 / dx;
        const ty = dy === 0 ? Infinity : dy < 0 ? -222 / dy : 270 / dy;
        const factor = Math.min(tx, ty, 1);
        const edge = tx < ty ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'top' : 'bottom';

        const pool = state.indicatorPool || (state.indicatorPool = []);
        const n = state.indicators.length;
        const mark = pool[n] || (pool[n] = {id: 0, edge: '', kind: '', x: 0, y: 0});

        mark.id = p.id === undefined ? i : p.id;
        mark.edge = edge;
        mark.kind = spawning(p) ? 'respawn' : 'outside';
        mark.x = clamp(450 + dx * factor, 28, 872);
        mark.y = clamp(300 + dy * factor, 78, 570);
        state.indicators.push(mark);
    }
}

export function updateCamera(state, players, dt, options = {}) {
    if (!finite(state.x) || !finite(state.y) || !finite(state.zoom) || state.zoom <= 0) {
        resetCamera(state);
    }

    players = Array.isArray(players) ? players : [];
    state.targets.length = 0;

    let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;

    for (let i = 0; i < players.length; i++) {
        const p = players[i];

        if (!live(p) || spawning(p) || p.x < -600 || p.x > 1500 || p.y < -350 || p.y > 850) {
            continue;
        }

        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
        state.targets.push(p.id === undefined ? i : p.id);
    }

    state.targetCount = state.targets.length;

    const minZoom = finite(options.minZoom) ? clamp(options.minZoom, 0.3, 1.5) : CAMERA.minZoom;
    const maxZoom = finite(options.maxZoom) ? clamp(options.maxZoom, minZoom, 2) : Math.max(minZoom, CAMERA.maxZoom);

    if (options.fixed || !state.targetCount) {
        state.targetX = 450;
        state.targetY = 300;
        state.targetZoom = clamp(1, minZoom, maxZoom);
    } else {
        state.targetX = clamp((minX + maxX) / 2, -150, 1050);
        state.targetY = clamp((minY + maxY) / 2 + 20, -100, 650);

        state.targetZoom = clamp(
            Math.min(820 / (maxX - minX + 100), 480 / (maxY - minY + 140), maxZoom),
            minZoom,
            maxZoom
        );
    }

    const snap = options.focus && live(options.focus);

    if (snap) {
        state.targets.length = 0;
        state.targets.push(options.focus.id === undefined ? 0 : options.focus.id);
        state.targetCount = 1;
        state.targetZoom = state.zoom = CAMERA.victoryZoom;
        state.targetX = state.x = options.focus.x;
        state.targetY = state.y = options.focus.y - (400 - 300) / CAMERA.victoryZoom;
    }

    const elapsed = finite(dt) ? clamp(dt, 0, CAMERA.maxFrameDelta) : 0;

    if (state.cachedElapsed === undefined || Math.abs(elapsed - state.cachedElapsed) > 1e-4) {
        state.cachedElapsed = elapsed;
        state.positionFactor = 1 - Math.exp(-CAMERA.positionRate * elapsed);
        state.zoomInFactor = 1 - Math.exp(-CAMERA.zoomInRate * elapsed);
        state.zoomOutFactor = 1 - Math.exp(-CAMERA.zoomOutRate * elapsed);
    }

    const positionFactor = state.positionFactor;
    const zoomFactor = state.targetZoom < state.zoom ? state.zoomOutFactor : state.zoomInFactor;

    if (!snap) {
        state.x += (state.targetX - state.x) * positionFactor;
        state.y += (state.targetY - state.y) * positionFactor;
        state.zoom += (state.targetZoom - state.zoom) * zoomFactor;
        state.zoom = clamp(state.zoom, minZoom, maxZoom);
    }

    if (options.clampStage) {
        const halfW = 450 / state.zoom,
            halfH = 300 / state.zoom;

        state.x = halfW >= 450 ? 450 : clamp(state.x, halfW, 900 - halfW);
        state.y = halfH >= 300 ? 300 : clamp(state.y, halfH, 600 - halfH);
    }

    updateBounds(state, players);
    return state;
}
