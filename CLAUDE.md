# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A playable Werewolves (Mafia) party game that runs entirely on spreadsheet formulas — no macros, no scripts. The deliverable is `Werewolves.xlsx`; the spreadsheet itself is the game engine. The two Python files are build tooling:

- `generate_werewolves.py` — rebuilds the workbook with openpyxl. Python never computes game logic; it only writes formula strings into cells.
- `verify_werewolves.py` — the test suite. Recalculates the workbook through headless LibreOffice and plays a scripted game against it (24 assertions).

## Commands

```bash
pip install openpyxl                      # only dependency of the generator
python3 generate_werewolves.py            # rebuilds Werewolves.xlsx (--out for another path)
python3 verify_werewolves.py              # verifies Werewolves.xlsx (or a path given as argv[1])
```

The verifier needs `soffice` on PATH **with the Calc component** — on Debian/Ubuntu that means `libreoffice-calc`, not just `libreoffice-core` (core alone fails with "source file could not be loaded").

There is no linter, no CI, and no test framework. The verifier is the entire test suite: three passes run in order (fresh workbook → scripted game → hunter's revenge), `check()` prints each assertion and exits at the first failure. There is no way to run one check in isolation.

## The workbook is a committed build artifact

Never hand-edit `Werewolves.xlsx`. Any behavior change goes into `generate_werewolves.py`; then regenerate, verify, and commit the regenerated file together with the generator change.

Rebuilds are content-deterministic but not byte-identical: only `docProps/core.xml` (openpyxl's embedded timestamps) differs. So after a rebuild `git status` always shows `Werewolves.xlsx` as modified even if nothing real changed — don't commit a timestamp-only diff, but do commit the workbook whenever the generator changed.

## Architecture

### Generator layout constants ↔ verifier coordinates are coupled

`generate_werewolves.py` defines every sheet's geometry as module-level constants (`N_PLAYERS = 20`, `N_ROUNDS = 10`, `SETUP_TOP = 14`, `DAY_FINAL = 51`, `BOARD_TOP = 11`, …) plus cross-sheet range strings (`NAMES`, `ROLETAB`, `VICTIMS`, `LYNCHED`, `ORDTAB`, …) from which all formulas are assembled.

`verify_werewolves.py` does **not** import these — it hard-codes the same coordinates (Setup names in rows 14–33, win banner at Game Board (3,2), day override in row 50, elimination row 51, night rows 4+…). If you move or resize anything in the generator, you must update the verifier's cell coordinates to match, and vice versa.

### The death-phase ledger is the core data model

Each player's row on Game Board computes a single "death phase" ordinal via `MATCH` against the night-victims column and the day-eliminations row: odd = died in night (2n−1), even = voted out on day (2n), 999 = alive sentinel (rendered as blank). Everything else derives from that one number: ALIVE/DEAD status, fate text, live wolf/town counts, the win banner, the "targeting a corpse" warnings on Night, and the Hunter timing. The Hunter's revenge cell avoids circular references by only taking effect once the Hunter's own death phase is real — arming it early does nothing.

### Determinism — no RAND(), and the verifier depends on it

Roles are dealt by ranking a seed-based pseudo-random key (`ABS(SIN(seed·1.98987 + row·7.23319))`), deliberately avoiding volatile `RAND()` so recalculation never reshuffles a game in progress. The verifier relies on the exact deal produced by the default seed 42 and the 8 `SAMPLE_PLAYERS` (2 Werewolves / 1 Seer / 1 Doctor / 4 Villagers). Changing the seed default, the sample players, or the key formula will break verifier expectations even if the game still works.

### Formula dialect constraints

- Must work in Excel 2019+, Google Sheets, and LibreOffice Calc — stick to `VLOOKUP`/`COUNTIF(S)`/`MATCH`/`INDEX`/`RANK`-era functions. `TEXTJOIN` (wolf-pack line on Role Cards) is the single knowingly-modern exception and is documented as degrading to `#NAME?` in older Excel.
- No macros, ever — that is the product's core promise.
- Formulas must evaluate correctly in LibreOffice specifically, because that's what the verifier uses to recalculate.
- The verifier scans every sheet for error markers (`#REF!`, `Err:`, …) but skips "How to Play" because its text mentions `#NAME?` literally — putting error strings in visible text on any other sheet will fail the scan.

### Generator conventions

One `build_*(ws)` function per sheet, composed from small helpers: `input_cell` (🟡 yellow = the only cells a user types in), `calc_cell` (grey = computed), `header_row`, `name_dropdown` (data validation against the `PlayerNames` defined name). Formulas are Python f-strings — in `build_day` some are `.format()` templates where `{c}` is the day column letter, so brace-escaping matters there.

## Keeping docs in sync

`README.md` is user-facing and mirrors gameplay details (sheet list, roles, engine explanation, the "24 assertions" count, compatibility notes). Update it when game features, sheets, or the verifier's check count change.
