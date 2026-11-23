# Session debrief: paste everything below the line at the END of a real game session, in the SAME chat

---

OUT OF CHARACTER: the session is over for now. Do not continue the story. This is a debrief of
the session we just played in this chat.

## Why

I will send your answers to the designer of this project (another AI). They will use them to improve
the instructions and rule files. Your answers will be read by a machine, so accuracy matters more than
politeness. Honest self-criticism is the most useful thing you can give.

## Rules for answering

1. **Audit, don't remember vaguely.** Scroll back through this chat. Base every answer on what is
   actually written above, and quote it (up to 2 lines) with the turn where it appears.
2. **Re-check, don't trust yourself.** Where a question asks you to re-check a Test, recompute it now
   (with the dice helper if you have a code tool, passing the recorded roll as `roll=`). Compare the result
   with what you wrote during play.
3. **Mark each answer** `OBSERVED` (it is in the chat or a tool result) or `INFERRED`, with confidence
   `high`, `medium` or `low`.
4. **Report mistakes plainly.** Don't soften or excuse them. Don't fix the game state now; just report.
5. **Format.** Answer under each ID, in order. If the reply would be too long, answer Parts A–C, stop and
   write `READY FOR PART D`. When I type `next`, answer the rest and the JSON summary.

## Part A: Session facts

- **A1.** Summarise the session in 5 bullet points: what happened, where, and to whom.
- **A2.** What were the Dice mode and the Fortune-offer setting? Were they asked and recorded at the start?
- **A3.** Did you find and use `campaign_log.md` and a character sheet at the start? Quote the line you
  continued from. If none existed, what did you do?
- **A4.** Count the Tests (any d100 roll) made in this session: by the character, by NPCs and by allies.

## Part B: Test-by-test audit

- **B1.** Make a table of every d100 Test in the session, in order, with these columns:
  turn · who · Skill and target · Difficulty and modifiers · roll · helper used? (yes/no) · double? ·
  SL and band as written during play · SL and band on recheck now · match? (yes/no).
  If there are more than 40 Tests, include every combat Test, then a sample of the rest, and say so.
- **B2.** List every mismatch from B1 and what effect it had on the story.
- **B3.** List every double rolled (11, 22 … 99, 100, or a typed 00). For each, say what you applied
  (Critical, Fumble, ±5 SL, Critical Wound, Oops!, Miscast, Wrath) and whether it was correct.
- **B4.** Did you ever roll a die and then not use it, roll several dice in advance, or reuse a roll?
  List each case.

## Part C: Rules and rulings

- **C1.** List every "GM ruling (not in the rules)" you made. For each: the ruling, the nearest rule you
  cited, and whether you showed the label on screen in the same reply.
- **C2.** List every time you applied a "Default (not in the book)" line from a file. Did you label each one
  the first time you used it?
- **C3.** List every rule you looked for and could not find. Give the exact search terms, what you found
  instead, and what you did.
- **C4.** List every rule you applied from memory without searching the files first. Be honest.
- **C5.** For each fight: did you run the Attack Checklist for EVERY exchange, including NPC against ally?
  Name any exchange where you skipped Reach, Outnumbering, doubles, weapon flaws, scene modifiers,
  Momentum or Conditions.
- **C6.** Did any NPC have stats you built or changed? Were they fixed before the fight and recorded?
- **C7.** Did you ever reveal hidden information: NPC targets, SL, Wounds or TB, hidden enemies, or
  secrets, including in an `ooc:` answer? Quote it.

## Part D: Resources and bookkeeping

- **D1.** Track Fortune, Fate, Wounds, XP, money and Corruption from start to end. List every change with
  its turn and cause. Does the final sheet match?
- **D2.** Did you ever spend Fortune or Fate for the player, or apply one without the player's choice?
- **D3.** Were Fortune and Fate offered at the right moments: Fortune after a failed or lost Test (by the
  setting), and Fate after both dice but before the outcome, Damage or Critical? List any late or missed
  offers.
- **D4.** If the player typed `save` or `end session`: was every section of both templates filled? Was the
  Session status correct? Was Fortune handled correctly?

## Part E: Experience and flow

- **E1.** How many of your replies were longer than about 15 lines? Which ones, and why?
- **E2.** How many player messages were only "yes", "no", a dice number or "go on"? Which instruction
  caused most of them?
- **E3.** Where did the pace drag, and where did the story feel thin? Give turn numbers.
- **E4.** Which instruction was hardest to follow during play, and why?
- **E5.** What did the player seem to enjoy most, judging by their messages? What seemed to annoy them?

## Part F: Recommendations

- **F1.** Give up to 8 recommended changes, most important first. For each give: target (instructions
  section, or file and heading); problem with evidence (turn number or question ID); exact proposed
  wording; expected benefit; and risk.

## JSON summary (end of your last reply)

End your last reply with one fenced code block containing only this JSON, filled in. Use `null` where
unknown.

```json
{
  "dice_mode": null,
  "fortune_setting": null,
  "tests_total": 0,
  "tests_with_helper": 0,
  "tests_mismatched_on_recheck": 0,
  "doubles_rolled": 0,
  "doubles_mishandled": 0,
  "stray_or_reused_rolls": 0,
  "gm_rulings": 0,
  "gm_rulings_unlabelled": 0,
  "defaults_used": 0,
  "defaults_unlabelled": 0,
  "rules_not_found": [],
  "rules_from_memory": [],
  "checklist_skips": 0,
  "hidden_info_leaks": 0,
  "resource_errors": 0,
  "fortune_fate_offer_errors": 0,
  "replies_over_15_lines": 0,
  "player_filler_messages": 0,
  "top_recommendations": []
}
```
