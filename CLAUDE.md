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

There is no linter, no CI, and no test framework. The verifier is the entire test suite: three passes run in order (fresh workbook → scripted game → hunter's revenge), `check()` prints each assertion and exits at the first failure. Individual `check()`s can't be isolated, but each pass is a plain function you can call directly (pass 2 takes the `roles` dict pass 1 returns) — worth doing when one fails, since `main()` runs them in a `TemporaryDirectory` that discards the scripted and hunter workbooks; pass your own already-created directory to keep them.

## The workbook is a committed build artifact

Never hand-edit `Werewolves.xlsx`. Any behavior change goes into `generate_werewolves.py`; then regenerate, verify, and commit the regenerated file together with the generator change.

Rebuilds are content-deterministic but not byte-identical: only `docProps/core.xml` (openpyxl's embedded timestamps) differs. So after a rebuild `git status` always shows `Werewolves.xlsx` as modified even if nothing real changed — don't commit a timestamp-only diff, but do commit the workbook whenever the generator changed.

## Architecture

### Generator layout constants ↔ verifier coordinates are coupled

`generate_werewolves.py` builds the Setup / Night / Day / Game Board geometry from module-level constants (`N_PLAYERS`, `N_ROUNDS`, `SETUP_TOP`, `DAY_FINAL`, `BOARD_TOP`, …) plus cross-sheet range strings (`NAMES`, `ROLETAB`, `VICTIMS`, `LYNCHED`, `ORDTAB`); Role Cards and How to Play use literal refs instead. One range escapes the scheme: `LYNCHED` hard-codes the last day column as `$L` where the rest of Day derives it as `get_column_letter(2 + N_ROUNDS)` — coincidentally correct at `N_ROUNDS = 10`, but raise it and the extra days vanish from the Game Board ledger with no error, the lynched player simply staying ALIVE.

`verify_werewolves.py` does **not** import these — it hard-codes the same coordinates (Setup names in rows 14–33, elimination row 51, night rows 4+…), so moving or resizing anything means editing both files. The coupling is textual as well: most assertions substring-match display copy lifted straight from the generator — "killed in the night", "IS A WEREWOLF", "already dead", "TIE", "VILLAGE WINS", "Shot by the Hunter" — and the generator's own conditional formatting keys off the same strings via `SEARCH("killed"/"Doctor"/"VILLAGE WINS")`. Rewording an announcement or the banner fails the suite and silently drops the colour rules, without any logic changing.

### The death-phase ledger is the core data model

Each player's row on Game Board computes a single "death phase" ordinal via `MATCH` against the night-victims column and the day-eliminations row: odd = died in night (2n−1), even = voted out on day (2n), 999 = alive sentinel (rendered as blank). Everything else derives from that one number: ALIVE/DEAD status, fate text, live wolf/town counts, the win banner, the "targeting a corpse" warnings on Night, and the Hunter timing. The Hunter's revenge avoids circular references by duplication: `J4`/`J5` on Game Board recompute the Hunter's own phase straight from `VICTIMS`/`LYNCHED` rather than reading column F, because every F cell already references `$J$5` — the obvious DRY rewrite of `J5` as a lookup on `ORDTAB` (whose column 5 *is* F) makes all 20 phase cells circular. While the Hunter lives `J5` is 999, so arming `G7` early does nothing.

### Determinism — no RAND(), and the verifier depends on it

Roles are dealt by ranking a seed-based pseudo-random key (`ABS(SIN(seed·1.98987 + row·7.23319))`), deliberately avoiding volatile `RAND()` so recalculation never reshuffles a game in progress — the verifier scripts pass 2 on top of pass 1's deal in a separate recalculation, so a stable deal is load-bearing. It does **not** depend on *which* player draws what: it reads the dealt roles back off the recalculated Setup sheet and looks wolves/seer/doctor/hunter up by value, so a new seed default, new sample names, or retuned key constants all still pass 24/24. What is hard-coded is the *shape* of the default setup — exactly 8 `SAMPLE_PLAYERS` in contiguous rows (it zips the filtered name list against the unfiltered role column, so a gap silently misaligns roles) and the role counts `C6:C9` = 2/1/1/0, which yield the asserted 2/1/1/4 deal, the "2 werewolf(s)" banner, and pass 2's 3–3 tie. Pass 3 flips `C9` to 1 and expects exactly one Hunter.

### Formula dialect constraints

- Must work in Excel 2019+, Google Sheets, and LibreOffice Calc — stick to `VLOOKUP`/`COUNTIF(S)`/`MATCH`/`INDEX`/`RANK`-era functions. `TEXTJOIN` (wolf-pack line on Role Cards) is the single knowingly-modern exception and is documented as degrading to `#NAME?` in older Excel.
- No macros, ever — that is the product's core promise.
- The verifier scans every sheet for error markers (`#REF!`, `Err:`, …) but skips "How to Play" because its text mentions `#NAME?` literally — putting error strings in visible text on any other sheet will fail the scan.

### Generator conventions

One `build_*(ws)` function per sheet, composed from small helpers: `input_cell` (🟡 yellow = the only cells a user types in), `calc_cell` (grey = computed), `header_row`, `name_dropdown` (data validation against the `PlayerNames` defined name). Formulas are Python f-strings — in `build_day` some are `.format()` templates where `{c}` is the day column letter, so brace-escaping matters there.

The `ROLES` list feeds prose only — the How to Play blurb and the Role Cards cheat sheet written to rows 3–7. The mechanics are literal and live elsewhere: the deal is a nested-IF cascade over the count cells `$C$6:$C$9` with Villager as the fallback, and both Role Cards formulas `VLOOKUP` a literal `$J$3:$L$7` sized to exactly five roles. A sixth entry in `ROLES` lands on row 8, so it deals to nobody and its card renders "(roles not dealt yet)" via `IFERROR` — and nothing catches it, because no verifier check ever exercises a dealt card.

## Keeping docs in sync

`README.md` is user-facing and mirrors gameplay details (sheet list, roles, engine explanation, the "24 assertions" count, compatibility notes). Update it when game features, sheets, or the verifier's check count change.
