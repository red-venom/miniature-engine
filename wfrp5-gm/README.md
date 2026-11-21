# WFRP 5th Edition: AI Game Master files

These Markdown files turn the Warhammer Fantasy Roleplay 5th edition core rulebook into a reference
that Claude can use to run the game for you. They are written for a Claude Project, so you can play
on your phone in the Claude app.

The files summarise the rules in condensed form, with page references to the book. They are for
personal use alongside your own copy of the rulebook.

## Set up the project

You need to do this once. It is easiest on a computer or at claude.ai in a browser, but the app works too.

1. Open Claude and create a new Project. Call it something like "WFRP Campaign".
2. Open the project's **Instructions** (custom instructions) and paste in the text from
   `PROJECT_INSTRUCTIONS.txt`.
3. Add every `.md` file in this folder to the project's **Knowledge**, except this `README.md`.
4. Turn on the code or analysis tool in Claude's settings if you have it, so the GM can roll dice.
   If you don't, the GM will ask you to roll.

## Play

1. Start a new chat inside the project.
2. Type something like: "Let's create a character" or "Start a new campaign in Ubersreik."
3. Play. Use these commands at any time:
   - `rules: <topic>` for a rule explanation
   - `sheet` to see your character
   - `status` for a quick status check
   - `show maths` to see how a roll was worked out
   - `save` to get an updated campaign log and character sheet

## Keep your progress

Each chat starts with a blank memory. To carry the game over:

1. Type `save` at the end of a session.
2. Copy the campaign log into a file called `campaign_log.md` and the character sheet into
   `character_<name>.md`.
3. Upload them to the project's knowledge, replacing the old versions.
4. Start your next session in a new chat in the same project.

Long chats slow down and lose detail, so start a new chat after each session or big scene.

## Files

| File | Contents |
|---|---|
| `00_GM_INSTRUCTIONS.md` | How the AI runs the game. Read first. |
| `01_core_tests.md` | Tests, Success Levels, Fate and Fortune |
| `02_character_creation.md` | Making a character |
| `03_species.md` | Species |
| `04_careers_A-M.md`, `05_careers_N-Z.md` | All careers |
| `06_skills.md`, `07_talents.md` | Skills and Talents |
| `08_social_stealth_investigation.md` | Theft, stealth, social, status, investigation |
| `09_wilderness_crafts_travel.md` | Wilderness, crafts, movement, chases |
| `10_combat.md` | Combat |
| `11_injury_healing_death.md` | Wounds, Critical Wounds, healing, death |
| `12_conditions_disease_poison_psychology.md` | Conditions, disease, poison, psychology |
| `13_corruption_mutation.md` | Corruption and mutation |
| `14_between_adventures.md` | XP, advancement, endeavours |
| `15_religion_blessings_miracles.md` | Gods, blessings, miracles |
| `16_magic_rules.md`, `17_magic_lores.md` | Magic |
| `18_gm_guidance_travel.md` | GM advice, XP awards, travel |
| `19_reikland_setting.md`, `23_empire_overview.md` | Setting |
| `20_equipment_prices.md` | Equipment and prices |
| `21_bestiary.md`, `22_creature_traits_templates.md` | Creatures |
| `24_campaign_log_template.md`, `25_character_sheet_template.md` | Save templates |
