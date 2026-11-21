# Character Sheet Template

Based on the 5th edition character sheet (pp. 377–378). The GM keeps this up to date and outputs it
on `sheet` or `save`. The player saves it as `character_<name>.md` in the project.

Hit locations (reverse the digits of the successful attack roll, p. 164; see `10_combat.md`): 01–09 Head · 10–24 Left (secondary) arm ·
25–44 Right (primary) arm · 45–79 Body · 80–89 Left leg · 90–00 Right leg.

Money: 1 Gold Crown (GC) = 20 Silver Shillings (SS) = 240 Brass Pennies (d).

```
# <Name>

## Identity
- Species: <...>   Class: <...>   Appearance: <...>
- Career: <career> — Level <1–4>: <level title>   Status: <Brass/Silver/Gold n>
- Career path history: <earlier careers and levels>
- Personal ambition: <...>   Party ambition: <...>
- Known languages: <...>

## Characteristics
| | WS | BS | S | T | I | Ag | Dex | Int | WP | Fel |
|---|---|---|---|---|---|---|---|---|---|---|
| Initial | | | | | | | | | | |
| Advances | | | | | | | | | | |
| Current | | | | | | | | | | |
| Bonus | | | | | | | | | | |
Career characteristics this level: <list>

## Fate and Fortune
- Fate: <n>   Fortune: <current>/<max>

## Movement
- Movement <M> · Walk <M×2> · Run <M×4>

## Wounds
- Max Wounds = SB + 2×TB + WPB (+TB if Hardy) = <n>
- Current Wounds: <n>
- Critical Wounds and Injuries: <list with effects and healing progress>
- Conditions: <list>

## Experience
- Current XP: <n>   Spent: <n>   Total: <n>
- Career Advancement Tracker (level <n>): <how many boxes ticked / required>

## Skills (Characteristic · Advances · Total)
- Basic: Art? Athletics (Ag) <adv> <total>; Bribery (Fel); Charm (Fel); Charm Animal (WP); Climb (S);
  Consume Alcohol (T); Cool (WP); Dodge (Ag); Drive (Ag); Endurance (T); Entertain (Fel); Gamble (Int);
  Gossip (Fel); Haggle (Fel); Intimidate (S); Intuition (I); Leadership (Fel); Melee (Basic) (WS);
  Melee (other) (WS); Navigation (Int); Outdoor Survival (Int); Perception (I); Ride (Ag); Row (S);
  Stealth (Rural/Urban/Underground) (Ag)
  [List only skills with advances, plus their totals. Untrained basic skills use the bare Characteristic.]
- Advanced (only if trained): <skill (spec) · char · adv · total>

## Talents
| Talent | Times taken | Effect summary |
|---|---|---|

## Spells and Prayers
| Name | CN | Range | Target | Duration | Notes |
|---|---|---|---|---|---|

## Armour (AP by location)
| Head | L arm | R arm | Body | L leg | R leg | Shield |
|---|---|---|---|---|---|---|
Armour worn: <name, locations, AP, qualities, Enc>

## Weapons
| Name | Group | Enc | Range/Reach | Damage | Qualities |
|---|---|---|---|---|---|
Ammunition: <type and count>

## Trappings
- <item> (Enc <n>)
- Encumbrance total <n> / Max <SB+TB> · Effect: <none / overburdened ...>

## Wealth
- <n> GC · <n> SS · <n> d

## Corruption and Mutation
- Corruption Points: <n>   Mutations: <list with effects>

## Religion
- Deity / cult: <...>   Sin Points: <n>   Blessings / Miracles known: <...>

## Notes
- <contacts, debts, reputations, enemies, property>
```
