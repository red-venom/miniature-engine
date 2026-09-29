# 🐺 Werewolves — the spreadsheet edition

A complete, playable version of the party game **Werewolves** (a.k.a. Mafia) that runs
entirely on spreadsheet formulas. No macros, no scripts, no add-ins — the workbook itself
is the game engine. One moderator drives it; 5–20 players lie to each other around it.

**[⬇ Download `Werewolves.xlsx`](Werewolves.xlsx)** and open it in Excel, upload it to
Google Sheets, or open it in LibreOffice.

## What the spreadsheet does for you

| Sheet | What happens there |
| --- | --- |
| **How to Play** | Rules, the moderator's checklist and a night-script to read aloud. |
| **Setup** | Type player names, pick role counts, set a seed — roles are dealt secretly and deterministically from the seed. |
| **Role Cards** | Pass the device around: each player picks their name, sees their secret role (werewolves see their packmates), clears it, passes it on. |
| **Night** | Enter who the wolves attack, who the Doctor protects, who the Seer inspects — the sheet resolves the save, answers the Seer and writes the morning announcement. |
| **Day** | Record everyone's vote; the tally finds the eliminated player, flags ties, and has a moderator override row. |
| **Game Board** | Live dashboard: who's alive, who died how, wolves-vs-town count, Hunter's revenge cell, and a banner that declares the winner the moment a side has won. |

Everything you type goes in 🟡 yellow cells; everything grey computes itself — including
warnings when you accidentally target someone who is already dead.

## Quick start

1. Open `Werewolves.xlsx` — it ships with 8 sample players so you can poke at it immediately.
2. Replace the names on **Setup**, keep or tweak the suggested role counts, change the seed.
3. Deal roles with **Role Cards**, then alternate **Night** and **Day** until the
   **Game Board** banner crowns a winner.

Roles included: Werewolf 🐺, Seer 🔮, Doctor 💉, Hunter 🏹 and Villager 🌾.

## How the engine works (for the curious)

- **Secret role dealing** — each player row gets a pseudo-random key
  `ABS(SIN(seed·1.98987 + row·7.23319))` and `RANK` turns the keys into a shuffle; the
  shuffled order is matched against the role roster. Same seed → same deal, new seed →
  fresh deal, and no volatile `RAND()` reshuffling the game mid-play.
- **The death ledger** — every player's "death phase" is computed with `MATCH` against the
  night-victim column and the day-elimination row (odd ordinals = nights, even = days).
  Status, fate descriptions, live counts and the win banner all derive from that one number.
- **Hunter's revenge without circular references** — the revenge cell only takes effect
  once the Hunter's own death phase is real, so arming it early does nothing.

## Regenerate or test it

```bash
pip install openpyxl
python3 generate_werewolves.py            # rebuilds Werewolves.xlsx
python3 verify_werewolves.py              # needs LibreOffice
```

The verifier recalculates the workbook with headless LibreOffice and plays a scripted
game against it — night kills, a doctor save, seer answers, a tied vote, a moderator
override, the Hunter's last arrow and both win conditions — 24 assertions in all.

## Compatibility

Excel 2019+/365, Google Sheets and LibreOffice Calc. In older Excel the single
`TEXTJOIN` formula (the wolf-pack line on Role Cards) shows `#NAME?`; everything else
is plain `VLOOKUP`/`COUNTIF`/`MATCH`-era functions.

## Also in this repository

**[Science Mastery Quiz Tracker](mastery-quiz-tracker/)** — a macro-enabled workbook that tracks
mastery quizzes for Years 7–11, converts marks to stanines and shows how every class and year group
is doing, with a form for adding tests and a verifier that recalculates it in LibreOffice.
