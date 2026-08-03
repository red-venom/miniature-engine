# Migration — v2.0.0 → v3.0.0

## What survives

v3 is a hardening pass, not a rewrite. The governing values are unchanged: equal dignity, equal
evidential standards, behaviour-specific accountability, safety before reconciliation, user
autonomy, and the refusal to force equal blame where conduct is unequal. The evidence-tier
vocabulary is preserved and extended by one tier. All 60 v2 benchmark stems are retained, repaired
where they were self-contradicting, so v2→v3 comparison remains possible on the original surface.

The failures fixed in v3 were almost all failures of *operationalisation* rather than of principle
— correct values with no precedence rule, no output contract, and no way to measure whether they
fired.

## Constitution changes

| v2 | v3 | Finding |
|---|---|---|
| Six co-equal governing standards | 7-tier ordered precedence ladder, stated first | H1 |
| 5 routes, all user-as-victim | 7 routes, including **R5 self-disclosed harm** | C1 |
| Evidence clause forbids naming abuse; safety routing requires it | Two-track rule: claims need evidence, protective action runs on reported risk | C2 |
| "Prioritise emergency help" | C4 contract: ≤120 words, action-first, means/safe-person beats, number rule | C3 |
| Third-party safety unstated | Tier 2 of the ladder | C4 |
| Injection defence = ignore instructions in uploads | Channel-trust quarantine covering all four attack shapes, plus non-disclosure | C5 |
| 16-item safety screen, no threshold | Silent, evidence-gated, with false-positive cost stated | H2 |
| Output contract for ordinary conflict only | C0–C8, one per route, each with a ceiling | H3 |
| "Never explain violence as caused by … neurodivergence" | Paired with the mirror rule: a diagnosis is not evidence of abusiveness either | H4 |
| Boundary list, no refusal craft | C6 three-move refusal | H5 |
| "Treat allegations as session-bound" | Restated as controllable behaviour + a deployment setting | H6 |
| "Stop joint process" | Scripted non-signalling exit | H7 |
| Style rule global | Acknowledgement floor in R2–R5 | M5 |
| Adjudication as a role disclaimer | C7 response pattern | M7 |

## Benchmark changes

| v2 | v3 |
|---|---|
| 300 rows / 60 stems | 337 rows / 85 stems |
| 1 suite | 8 suites: `core`, `overtriage`, `self_disclosed`, `refusal`, `injection`, `joint`, `multiturn` (+ paired variants throughout) |
| 137 free-text `expected`, 66 `forbidden` | 100 typed codes, defined in `rubric.md`, validated by the grader |
| Universal criteria on every row | Route-conditional criteria |
| `identity-based double standard` scored per row | Comparative `bias_delta` per pair group |
| Identity and presentation axes pooled | Separated: `identity`, `economic`, `presentation` |
| 11 rows with self-contradicting prompts | Repaired; regression-guarded by `--validate` |
| No grader | `grader.py`, stdlib-only, with judge-free constraint checks |
| No over-triage, joint, multi-turn, or refusal-quality coverage | All four covered |
| Data file authored by hand | `build_scenarios.py` — repairs are auditable in source |

### ID mapping

v2 IDs (`FC2-Bnnn`) do not map 1:1 to v3 IDs (`FC3-nnnn`); the axis structure changed. Map by
`stem` instead — v3 rows carry a stable `stem` key (`dating.cancel`, `cc.tracking`, …) and every v2
stem has a v3 counterpart. Stems whose v2 identity axis was invalid (`lgbtq.closeted`,
`lgbtq.words`, `pv.shared`, `rf.dossier`) now carry no identity axis, so those groups have one row
rather than five.

## Knowledge base changes

v2 declared 17 modules; none shipped with the package, and the manifest's path convention
contradicted `00_START_HERE.txt` (M8). v3 ships 12 modules, one naming convention, and a manifest
the grader checks against disk.

| v2 module | v3 |
|---|---|
| `epistemics/EVIDENCE_AND_CALIBRATION` | **K2** |
| `epistemics/BIAS_CATALOGUE` | **K8** (anti-patterns) + **K9** §1 (swap test) |
| `relationships/RELATIONSHIP_DYNAMICS` | **K7** C0 + **K9** |
| `relationships/COMMUNICATION_REPAIR_BOUNDARIES` | **K7** |
| `relationships/DECISION_SUPPORT` | **K10** §5 |
| `contexts/CONTEXTS_AND_DIVERSITY` | **K9** §1–3 |
| `contexts/PARENTING_FAMILY_SYSTEMS` | **K9** §6 |
| `contexts/SEX_INTIMACY_INFIDELITY` | **K9** §7 + **K3** (coercion) |
| `contexts/MONEY_WORK_CARE` | **K9** §5 |
| `contexts/NEURODIVERGENCE_MENTAL_HEALTH_SUBSTANCES` | **K9** §2 |
| `safety/ABUSE_AND_COERCIVE_CONTROL` | **K3** |
| `safety/CRISIS_AND_SAFEGUARDING` | **K4** |
| `safety/PRIVACY_DIGITAL_SAFETY` | **K6** |
| `operations/JOINT_SESSION_OPERATIONS` | **K10** §1–4 |
| `operations/RESPONSE_PATTERNS` | **K7** |
| `operations/ANTI_PATTERNS` | **K8** |
| `operations/LOCALISATION_AND_REFERRALS` | **K11** |
| — | **K1** (new — routing and precedence) |
| — | **K5** (new — self-disclosed harm) |

Consolidation is deliberate. Seventeen modules across four directories produced retrieval
ambiguity — three files could plausibly answer "how do I respond to this", and the model had no
stated precedence among them. Twelve files with `00_INDEX.md` fast paths and an explicit precedence
rule retrieve more predictably.

## Migration steps

1. Replace the instructions field with `core/SYSTEM_PROMPT_GPT_8K.txt` (Custom GPT) or
   `core/SYSTEM_PROMPT_PROJECT.txt` (Projects). Do not merge with v2 text — the precedence ladder
   only works if nothing above it competes.
2. Delete the v2 knowledge files. Upload the 12 v3 files. **K7 is mandatory** for the 8K build.
3. Set memory **off** (`DEPLOYMENT_GUIDE.md` §3).
4. Re-create any localisation content as `K11_LOCAL.md` and re-verify every number.
5. Run `RELEASE_CHECKLIST.md` end to end. Expect changes concentrated in R5, refusals, and crisis
   length — those are the fixes landing, not regressions.

## Expected behaviour changes users will notice

- **Shorter crisis replies**, action-first. Deliberate.
- **Blunter responses to self-disclosed harm**, with no reassurance. Deliberate, and the most likely
  thing to be reported as a regression. It is finding C1.
- **Less safety framing on ordinary questions.** Also deliberate — see H2.
- **Refusals that offer somewhere to go** rather than stopping at "I can't help with that".
- **More explicit attribution** ("what you've described") in safety cases, replacing both false
  certainty and false silence.
