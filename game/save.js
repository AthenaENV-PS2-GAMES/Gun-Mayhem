import {HANDGUN_COUNT, perkLocked, PERKS} from './menu.js';

export const SAVE_DIR = 'mc0:/GM2LOBBY';
export const SAVE_FILE = SAVE_DIR + '/lobby.json';
export const CAMPAIGN_FILE = SAVE_DIR + '/campaign.json';
export const SAVE_VERSION = 1;
export const SAVE_TITLE = 'GUN MAYHEM PS2\nLOBBY SETTINGS';
const FIELDS = ['color', 'shirt', 'hat', 'weapon', 'perk'];

export function snapshotLobby(lobby) {
    return {
        version: SAVE_VERSION,
        lives: lobby.lives,
        crates: lobby.crates,
        pickups: lobby.pickups,
        slots: lobby.slots.map(slot =>
            FIELDS.reduce((o, f) => {
                o[f] = slot[f];
                return o;
            }, {})
        )
    };
}

const inRange = (v, count) => Number.isInteger(v) && v >= 0 && v < count;

export function applySnapshot(lobby, data) {
    if (!data || data.version !== SAVE_VERSION || !Array.isArray(data.slots)) {
        return 0;
    }

    let restored = 0;

    if (Number.isInteger(data.lives) && data.lives >= 1 && data.lives <= 99) {
        lobby.lives = data.lives;
        restored++;
    }

    if (typeof data.crates === 'boolean') {
        lobby.crates = data.crates;
        restored++;
    }

    if (typeof data.pickups === 'boolean') {
        lobby.pickups = data.pickups;
        restored++;
    }

    const counts = {
        color: lobby.choices.color,
        shirt: lobby.choices.shirt,
        hat: lobby.choices.hat,
        weapon: Math.min(HANDGUN_COUNT, lobby.choices.weapon),
        perk: PERKS.length
    };

    data.slots.slice(0, lobby.slots.length).forEach((saved, i) => {
        if (!saved || typeof saved !== 'object') {
            return;
        }

        for (const field of FIELDS) {
            if (!inRange(saved[field], counts[field])) {
                continue;
            }

            if (field === 'perk' && perkLocked(saved.perk)) {
                continue;
            }

            lobby.slots[i][field] = saved[field];
            restored++;
        }
    });

    return restored;
}

export function createSaveStore(card, port = 0, iconBytes = null, file = SAVE_FILE) {
    let job = null;

    const ready = () => {
        try {
            return !!card && card.getInfo(port).connected;
        } catch (error) {
            return false;
        }
    };

    function writeIcon() {
        try {
            if (!iconBytes || card.exists(SAVE_DIR + '/icon.sys')) {
                return;
            }

            const icon = iconBytes();

            if (!icon) {
                return;
            }

            card.writeFile(SAVE_DIR + '/icon.ico', icon);
            card.writeFile(SAVE_DIR + '/icon.sys', card.createIconSys({title: SAVE_TITLE, icon: 'icon.ico'}));
        } catch (error) {}
    }

    return {
        load() {
            try {
                if (!ready() || !card.exists(file)) {
                    return null;
                }

                return card.readJSON(file);
            } catch (error) {
                return null;
            }
        },
        save(data) {
            try {
                if (!ready()) {
                    return false;
                }

                if (!card.exists(SAVE_DIR)) {
                    card.mkdir(SAVE_DIR);
                }

                writeIcon();
                job = card.writeJSONAsync(file, data, {atomic: true});
                return true;
            } catch (error) {
                return false;
            }
        },

        poll() {
            if (!job) {
                return null;
            }

            try {
                const status = card.poll(job);

                if (status.state === 'running') {
                    return null;
                }

                job = null;
                return status.state === 'done' ? 'ok' : String(status.error || status.state);
            } catch (error) {
                job = null;
                return String(error);
            }
        }
    };
}
