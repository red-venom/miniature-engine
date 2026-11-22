# Answer key for the diagnostic (do NOT paste this into the GM chat)

This is for the designer, to mark the GM's answers to `1_GM_DIAGNOSTIC.md`. If the GM sees it, the
self-test becomes worthless.

## Part A: expected

| ID | Expected |
|---|---|
| A1 | 26 knowledge files: `00`–`25` `.md`, plus any saves (e.g. `claude/campaign_log.md`). `README.md` or `PROJECT_INSTRUCTIONS.txt` in Knowledge = a setup error: they pollute rule searches |
| A3 | `### No Profile for X? Bandits, Archers, Guards, Sergeants, Cult Leaders (pp. 318–319, 321, 353–356)` |
| A4a | `10_combat.md` · `## Attack Checklist (run after every attack roll)` |
| A4b | `14_between_adventures.md` · `## Downtime Procedure (p. 190)` |
| A4c | `10_combat.md` · `### Darkness in Combat (pp. 130, 166, 316)` |
| A4d | `07_talents.md` · `### Doomed (p. 118)` |
| A4e | `06_skills.md` · `### Swim (S) – Advanced (p. 114)` |
| A5 | "knocked out" → `11_injury_healing_death.md` At 0 Wounds / Unconscious, or `12` Unconscious (Condition). "jump to the roof" → `09_wilderness_crafts_travel.md` Leaping (small gap Very Easy) |
| A6 | 8 sections: 1 Find the rule, 2 Never invent, 3 Dice, 4 Every Test, 5 Fairness, 6 Combat, 7 Keeping track, 8 Style |
| A7 | Last line starts `- Player commands: "rules: <topic>", "sheet", "status", "roll for me", ...` and ends `See 00_GM_INSTRUCTIONS.md.` A different last line means the instructions were cut off |
| A8 | `DICE HELPER (Python; the JavaScript version follows it):` |

## Part B: expected helper output

```
Test 62 · mod +0 · Roll 44 · SL +5 · Astounding Success · DOUBLE: Critical
Test 48 · mod +0 · Roll 100 · SL -6 · Astounding Failure · DOUBLE: Fumble
Test 46 · mod +0 · Roll 72→27 · SL +2 · Success
Test 52 · mod +0 · Roll 77 · SL -2 · Failure · DOUBLE: Fumble
```
(Helper v2 format. Older v1 output started "Roll 44 · target 62"; same numbers.)

- B3: if the second call fails with "undefined", state does not persist; the instructions already say
  to include the definition every time. If it works, state persists (either way is fine; note which).

## Part C: expected answers

| ID | Expected | Source |
|---|---|---|
| C1 | SB 3 + WPB 2 + 2 × TB 3 = **11** | `02` Wounds, p. 40 |
| C2 | Reverse 23 → 32 → **Right Arm (Primary)** (25–44) | `10` Hit Locations, p. 164 |
| C3 | **Very Easy, +6 SL** | `01` Difficulty Table, p. 131; `09` Leaping |
| C4 | After both dice are rolled, before the winner, Hit Location, Damage or Critical is worked out. The attack has no effect on its target; each side's own roll keeps normal consequences (a failed Melee Test still loses Momentum; nobody gains Momentum from the voided exchange; Fumbles apply). Must be labelled as a GM ruling | `01` How Did That Miss?, p. 133 |
| C5 | **No** (except a creature with the Champion trait). A defender's Critical Hit still inflicts a Critical Wound | `10` Attack Procedure, pp. 164–165 |
| C6 | **Yes**, the winner gains Momentum. Lost on: a failed Melee Test, any Wound loss (Bleeding included), any new Condition | `10` Momentum, p. 168 |
| C7 | No Spell called Fireball exists in this edition. Refuse and offer real options (e.g. Bolt, a Lore of Fire Spell the character knows) | `16`/`17` "Spells in this book" lists |
| C8 | **No Wrath.** A units die of 0 counts as 10 (Default, must be labelled), so with 0 Sin only a Fumble triggers Wrath. 40 is not a double | `15` Sin and Wrath, p. 218 |
| C9 | Fortune restored at the start of a chat only if the log's Session status is "ended" (or at a break after about 4 hours). `save` = checkpoint, changes nothing. `end session` = end-of-session effects (e.g. Corruption Test), status "ended", then the save. Not mid-encounter | Instructions §7; `13` When the Session Ends; p. 265 |
| C10 | Recover all Wounds → spend XP → Regional Event → Character Event → shopping → Endeavours → money spent except banked/earned → ready. (Session XP is awarded first.) | `14` Downtime Procedure, p. 190 |
| C11 | 45 = Skill for that attack; +7 = Damage. Damage = +7 + SL of the winning margin, then − TB − AP (minimum 1 Wound) | `21` Reading a Stat Block, pp. 318–319 |
| C12 | Swim is Advanced, so no Test; starts Drowning at once (1 Wound per Round, see `10`/`09`); defaults for escape and rescue in `09` Non-swimmers in Deep Water | `06` Swim, p. 114; `09`; p. 169 |
| C13 | Human (or Watchman/Thug) profile + Leader template; Skills = new Characteristic + template modifier (pp. 354–356 method); recalculate SB, TB, Wounds, Damage; fix before the fight; record in Secrets; describe danger in words | `21` No Profile for X?; `22` Applying a Template |
| C14 | `GM ruling (not in the rules): <ruling> (nearest rule: <name, page>)` in the reply, and the reply ends with `Logged: <ruling>` | Instructions §2 |

## How to mark

- **Retrieval failure** = NOT FOUND, or the wrong file or heading for A3–A5 or Part C. Fix by adding
  keywords or aliases to the heading.
- **Truncation** = A6 shows fewer than 8 sections, or A7 doesn't match. Fix by making a shorter
  instructions version.
- **Tool failure** = B2 output doesn't match, or B1 has no tool. Fix the helper wording, or the
  no-tool fallback.
- **Comprehension failure** = right file but wrong answer. Fix the rule wording.
