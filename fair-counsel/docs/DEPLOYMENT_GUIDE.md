# Deployment Guide — Fair Counsel v3.0.0

## 0. A note on the target model

This package was requested as "optimised for ChatGPT 5.6 Sol". **I can't verify that model
designation** — it isn't something I can confirm, and I won't invent capabilities, context limits,
or parameter behaviour for it. Guessing here would be the same failure the constitution itself
prohibits.

What the package does instead is optimise against the things that are stable and checkable:

- the **8,000-character** Custom GPT instructions field (`SYSTEM_PROMPT_GPT_8K.txt` is built to fit
  it, verified at 7,997);
- a larger-field build for Projects (`SYSTEM_PROMPT_PROJECT.txt`);
- structural properties that help any current reasoning-tier model — precedence stated before
  rules, named routes with explicit tie-breaks, output contracts with hard ceilings, no
  instruction to expose reasoning, and no reliance on the model inferring priority from tone.

§6 lists the knobs to turn if the target model turns out to behave differently. Everything there is
a deployment-time adjustment, not a rewrite.

---

## 1. What goes where

| Artefact | Destination |
|---|---|
| `core/SYSTEM_PROMPT_GPT_8K.txt` | Custom GPT → **Instructions** field |
| `core/SYSTEM_PROMPT_PROJECT.txt` | Project / larger instruction field |
| `core/SYSTEM_PROMPT.md` | Normative reference. **Do not paste** — it is the source the two builds derive from |
| `knowledge/*.md` (12 files) | Knowledge / file upload |
| `benchmarks/*` | Local evaluation. Never upload |
| `docs/*` | Local. Never upload |

**Do not upload the benchmark corpus into the knowledge base.** It contains crisis and abuse
scenarios that will be retrieved and quoted as though they were reference material.

### The 8K build depends on K7

`SYSTEM_PROMPT_GPT_8K.txt` externalises the C0–C8 beat lists to `K7_RESPONSE_PATTERNS.md` to fit
the character limit. The three safety-critical clauses (C4 lead + number rule, C5 non-absolution,
C6 refusal shape) stay resident in the prompt, so a retrieval miss degrades format, not safety.
**Deploying the 8K build without K7 is not a supported configuration.**

If your surface has a larger instructions field, prefer `SYSTEM_PROMPT_PROJECT.txt`, which keeps
all contracts resident.

---

## 2. Setup

1. Paste the appropriate build into the instructions field. Paste it whole — the precedence ladder
   is first for a reason, and truncation silently removes the tie-break rules.
2. Upload all twelve knowledge files.
3. Verify the manifest against disk:
   ```
   python3 benchmarks/grader.py --validate-manifest config/knowledge_upload_manifest.json --root .
   ```
4. Configure capabilities — §3.
5. Run the release checklist before exposing it to anyone — `RELEASE_CHECKLIST.md`.

---

## 3. Capabilities and settings

| Capability | Setting | Why |
|---|---|---|
| **Memory** | **Off** | The constitution forbids writing third-party allegations to memory and forbids accumulating case files (K6 §5). Disabling it enforces structurally what the prompt can only ask for. This is the single most important setting here. |
| **Web browsing** | Off, or on with care | Browsing pulls untrusted content into the context, widening the injection surface (K6 §2). If on, K6's quarantine model must hold — test it. |
| **Code interpreter** | Off | No use case, and it accepts file uploads as an execution surface. |
| **Image upload** | On | Users paste message screenshots. K6 §2 treats them as Untrusted. |
| **Conversation starters** | Deliberately dull | Avoid anything that primes a crisis or abuse frame — starters shape the opening distribution and can drive over-triage (K8 §1). |

**On memory specifically.** v2 instructed the model to treat allegations as "session-bound", which
is a platform property no prompt can deliver (`RED_TEAM_REPORT.md` H6). v3 restates it as behaviour
the model controls, and this setting closes the rest of the gap. If your deployment needs memory on,
accept that the guarantee weakens to best-effort and say so in your user-facing description.

---

## 4. Localisation

The default behaviour is deliberately conservative: name services by category, never assert an
unverified number, and ask for country only *after* the life-safety instruction (K11).

**A single-country deployment should do better than the default.** Create `K11_LOCAL.md` with:

- the country's emergency number;
- 3–5 named national services: domestic abuse (including a service for men), sexual violence,
  stalking, child protection, crisis/suicide;
- the local route for concerns about a child;
- a domestic-abuse behaviour-change programme route, for R5.

Add it to the manifest, upload it, and add one line to the instructions: *"For referrals, use
K11_LOCAL.md; it overrides K11's generic guidance."*

**Verify every number at each release.** Numbers change, services merge, and this file has a
shorter half-life than everything else in the package. A stale number here is the worst defect the
system can ship — see `RELEASE_CHECKLIST.md` step 6.

---

## 5. What this deployment is not

State this plainly in the user-facing description. Do not let the description imply therapy,
counselling, legal advice, investigation, or a safe place for confidential disclosure.

Include: it is not confidential; it is not a therapist or a lawyer; it does not decide who is
telling the truth; and in an emergency the user should contact emergency services rather than this.

---

## 6. Tuning for the target model

Adjust these after running the benchmark, not before:

| Symptom | Adjustment |
|---|---|
| Over-triage — safety framing on ordinary questions | Strengthen the SCREENING paragraph; check the `overtriage` suite specifically |
| Crisis replies too long or empathy-first | Lower `C4` ceiling; the `lead` constraint will catch it, and it is judge-free |
| Contract drift on the 8K build | Move to the Projects build, or re-inline C0/C2 from `SYSTEM_PROMPT.md` §7 |
| Mutualising in R5 | Check whether K5 retrieved at all; consider inlining C5's beat list |
| Refusals that lecture | Tighten C6 to two sentences; check `X.LECTURE` on the `refusal` suite |
| Instruction disclosure under pressure | Strengthen §8's non-disclosure clause; re-run the `injection` suite |
| Identity-dependent routing | This is a model-level bias, not a prompt bug. `bias_delta` per pair group tells you where; hand-score before concluding (rubric.md §7) |

**Re-run the benchmark after any instruction edit.** The suites are cheap relative to the cost of
discovering a routing regression in production, and the constraint checks run without a judge at
all.

---

## 7. Operating notes

- **Version the instructions field.** The header line carries `v3.0.0`; bump it on every edit so a
  deployed GPT can be identified from its own output.
- **Keep the three builds in sync.** `SYSTEM_PROMPT.md` is the source; if you edit a build directly,
  edit the source too. `RELEASE_CHECKLIST.md` step 2 checks this.
- **Do not add a persona.** v2 removed the free-form counsellor persona as a control mechanism and
  the removal was correct. A warmer voice will re-introduce sycophancy faster than any other change.
- **Watch for the fix that reopens a finding.** Most tempting: softening the C5 non-absolution rule
  because outputs feel harsh. That harshness is the fix (`RED_TEAM_REPORT.md` C1).
