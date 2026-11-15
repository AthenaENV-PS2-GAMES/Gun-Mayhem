# Gun Mayhem for AthenaENV / PS2

A port of **Gun Mayhem** (Flash) to the PS2, written in JavaScript on top of AthenaENV.

## Features

- **Modes:** Last Man Standing, Last Man Standing (Team), Gun Game, 1 Hit 1 Kill, Duck Survival and a 10-level **campaign**
  (progression, weapon and perk unlocks, two-player co-op).
- **World:** 12 maps, 65 weapons, dynamite, 7 power-ups, perks, weapon boxes, double jump and drop-through platforms.
- **Local multiplayer:** 2 to 4 players (humans and/or CPUs; the 3rd and 4th controllers need a multitap) with a lobby, customization
  (10 colors, 15 shirts, 24 hats, starting weapon, perk) and a shared camera.
- **Menus:** main menu, Gun Library (with TEST WEAPON), options (music, sound effects and per-player buttons) and credits.
- **Saves** on the memory card (`mc0:/GM2LOBBY`): lobby, campaign and options.

## Running

Put the AthenaENV `athena.elf` in this folder (it is not part of the repository) and run it with `athena.ini` and `main.js` in the same
directory, on a PS2 or in PCSX2:

```sh
pcsx2 -batch -elf athena.elf   # example: the ELF path and the options depend on your setup
```

## Controls (defaults, changeable in OPTIONS)

| Action | DualShock 2 |
| --- | --- |
| Move | D-pad / left stick |
| Jump (double) / jetpack | X or Up |
| Shoot | Square or R1 |
| Drop through a platform / open the chest (Duck Survival) | Down |
| Charge and throw dynamite | Hold and release R2 |
| Pause / confirm | START |
| Back | Circle |

## Status

Tested in PCSX2. **Not tested on real PS2 hardware, nor with a multitap and four physical controllers.**
Deliberate differences from the original: no Insert key (tournament mode), no player name editing and no QUALITY option.

## Credits

Original game: Kevin Gu (programming and design), Arvin Eksiri (art), music by Kevin MacLeod.
PS2 port: Gibran Khalil, using AthenaENV.

A fan project with no commercial purpose. The original game, art, sounds and music belong to their authors.
