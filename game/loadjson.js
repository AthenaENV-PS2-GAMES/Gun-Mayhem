import * as std from 'std';

// std.loadFile() returns null when the disc read fails (seen on the PS2 through OPL), which used to surface as
// "cannot read property 'atlas' of null". Retry a few times, then say which file it was.
export function loadJson(path) {
    for (let attempt = 0; attempt < 8; attempt++) {
        const text = std.loadFile(path);

        if (text) {
            if (attempt > 0) {
                console.log('GM2_LOAD_RETRY ' + path + ' ' + attempt);
            }

            return JSON.parse(text);
        }
    }

    throw new Error('cannot read ' + path);
}
