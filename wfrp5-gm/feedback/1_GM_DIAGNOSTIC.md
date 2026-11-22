# GM diagnostic: paste everything below the line into a NEW chat in the WFRP project

---

OUT OF CHARACTER: this is a diagnostic, not a game. Do not start or continue any adventure.

## Who you are talking to and why

I am the player. I will send your answers to the designer of this project, who is another AI.
They will use your answers to fix the project's instructions and rule files. Your answers will be read
by a machine, so accuracy matters more than politeness.

## Rules for answering

1. **Do, don't predict.** When a question asks you to search, open a file or run code, actually do it,
   then report what happened. Never describe what you "would" find.
2. **Evidence.** Quote exact text (up to 2 lines) and name the file and heading it came from.
   If you can't find something, write `NOT FOUND` and list the search terms you tried.
3. **Separate what you saw from what you think.** Mark every answer `OBSERVED` (you saw it in a tool
   result or file) or `INFERRED` (your belief), with confidence `high`, `medium` or `low`.
4. **No guessing to look helpful.** "I don't know" and "I can't tell" are useful answers. A confident wrong
   answer is the worst outcome.
5. **Criticism is the point.** "No problems" is only useful if you checked. Report every confusion,
   conflict or gap, even small ones.
6. **Don't fix anything yourself** and don't rewrite rules. Report only.
7. **Format.** Answer every question under its ID (for example `A3`), in order. Keep each answer short.
   Then end with the JSON summary block described at the end.
8. **Length.** Answer Part A and Part B in your first reply, then stop and write `READY FOR PART C`.
   When I type `next`, answer Parts C and D, then stop and write `READY FOR PART E`. When I type `next`
   again, answer Parts E and F and the JSON summary. If a reply is still too long, stop at a question
   boundary and say where you stopped.

## Part A: What can you see?

- **A1.** List every project knowledge file you can see, by exact file name. Say how many there are.
- **A2.** Can you read whole files, or do you only get search results or excerpts? Explain how you can tell.
- **A3.** Open or search `21_bestiary.md` and quote the heading that contains "No Profile for X?".
  Did you find it with a search, or was the file already in your context?
- **A4.** Find and quote the first line of each of these headings, naming the file each is in:
  (a) "Attack Checklist"; (b) "Downtime Procedure"; (c) "Darkness in Combat"; (d) "Doomed";
  (e) "Swim". For each, say how many searches it took.
- **A5.** Search for a rule using everyday words a player might use, not the heading name:
  "what happens if I'm knocked out" and "can I jump over to the other roof". Report what you found,
  which file and heading, and whether it was the right rule.
- **A6.** Your instructions are divided into sections that start with `===`. List the title of every section
  you can see, in order, and how many there are.
- **A7.** Quote the very last line of your instructions, exactly. (This checks whether they were cut off.)
- **A8.** Quote the first line of the section called "DICE HELPER". Can you see both the Python
  version and the JavaScript version of the helper in full?

## Part B: Your tools

- **B1.** Which code or analysis tool do you have, if any? Give its name and its language
  (Python or JavaScript). If you have none, say so and skip to Part C.
- **B2.** Copy the dice helper for your tool's language from your instructions. In ONE code call, define it
  and run exactly these four calls:
  `wt(62, roll=44)`, `wt(48, roll=0)`, `wt(46, roll=72, adv=1)`, `wt(52, roll=77, combat=True)`.
  Paste the four output lines exactly as printed.
- **B3.** Now make a SECOND, separate code call that runs only `wt(42)` without defining the function first.
  Did it work, or did it fail because `wt` was undefined? Paste the output or the error.
- **B4.** Run `wt(42)` correctly (definition included) three times in separate calls. Paste the outputs.
  Do the rolls look random?
- **B5.** Did anything about using the helper feel awkward, slow or error-prone? Be specific.

## Part C: Rules self-test

Answer from the project files only, not from memory. For each, give the answer, then the file and
heading you used, then the book page cited there. Search for each one; don't answer from these
questions' wording.

- **C1.** A character has S 34, T 38 and WP 27. What are their maximum Wounds? Show the working.
- **C2.** A successful melee attack roll is 23. Which hit location is struck?
- **C3.** What Difficulty is jumping a small gap? What SL modifier is that?
- **C4.** When exactly can a player spend Fate on "How Did That Miss?" during an opposed melee exchange?
  What happens to Momentum afterwards?
- **C5.** In a melee exchange, the defender wins the Opposed Test. Does the defender deal Damage?
- **C6.** A defender's own roll failed (negative SL), but they still won the Opposed Test. Do they gain
  Momentum? List everything that makes a character lose Momentum.
- **C7.** The player says "I cast Fireball." What do you do?
- **C8.** A priest with 0 Sin Points rolls 40 on a Pray Test. Is there a Wrath of the Gods roll? Why?
- **C9.** When is Fortune restored to maximum in this project? What does `save` do, and what does
  `end session` do?
- **C10.** List the steps of the Downtime procedure, in order.
- **C11.** A stat block shows "Hand Weapon (45/+7)". What do 45 and +7 mean? How is Damage worked out?
- **C12.** A character with no Swim Skill falls into a deep river. What happens?
- **C13.** You need a bandit leader and the bestiary has no bandit. How do you build one?
- **C14.** The book is silent on something you need to rule on. Write the exact line you would show
  the player.

## Part D: Your instructions

- **D1.** List every instruction that conflicts with another instruction or with a rule file. Quote both
  sides and say which one you would follow.
- **D2.** List every instruction you find ambiguous, with the two or more ways you could read it.
- **D3.** Which instructions will you most likely forget or skip in a long fight? Rank the top 5, and say why
  for each one.
- **D4.** Which instructions make replies longer than about 15 lines on a phone? Estimate how many lines
  a typical combat Round takes under the current rules.
- **D5.** Is any instruction pointless, outdated or repeated? Quote it.
- **D6.** Is there anything you needed during Parts A–C that the instructions or files didn't tell you?

## Part E: The play experience (your predictions)

These are INFERRED answers. Keep them grounded in Parts A–D.

- **E1.** Imagine a typical 2-hour session with one fight, one social scene and one investigation.
  Where will the player most likely be bored, confused or frustrated by the process?
- **E2.** In "own dice" mode and "GM rolls" mode, how many messages does one combat Round take?
  What could cut this without breaking a rule?
- **E3.** What three things could make the game feel more alive (atmosphere, NPCs, pacing) while keeping
  the rules strict?
- **E4.** What is most likely to go wrong when the player saves and resumes in a new chat?
- **E5.** If you could ask the designer one question, what would it be?

## Part F: Recommendations

- **F1.** Give up to 10 recommended changes, most important first. For each, give:
  - target (instructions section, or file and heading)
  - problem (one line, with evidence ID such as `A4` or `D1`)
  - exact proposed wording to add or replace
  - expected benefit
  - risk (what it might break)

## JSON summary (end of your last reply)

End your last reply with one fenced code block containing only this JSON, filled in.
Use `null` where unknown.

```json
{
  "files_visible": 0,
  "whole_files_readable": null,
  "instructions_sections_visible": 0,
  "instructions_last_line_seen": "",
  "code_tool": {"available": null, "language": null, "state_persists_between_calls": null},
  "helper_outputs_match_expected_format": null,
  "selftest_answers": {"C1": "", "C2": "", "C3": "", "C4": "", "C5": "", "C6": "", "C7": "", "C8": "", "C9": "", "C10": "", "C11": "", "C12": "", "C13": "", "C14": ""},
  "selftest_not_found": [],
  "conflicts_found": 0,
  "ambiguities_found": 0,
  "top_skip_risks": [],
  "estimated_messages_per_combat_round": {"own_dice": null, "gm_rolls": null},
  "top_recommendations": []
}
```
