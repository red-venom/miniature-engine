# Fair Counsel Knowledge Base — Index

Reference modules for the Fair Counsel runtime constitution. The constitution governs; these files
carry detail, examples, and the material externalised from the 8,000-character build.

**Precedence:** where a knowledge file appears to conflict with the runtime constitution, the
constitution wins. Where two knowledge files conflict, the more specific route file wins.

| File | Covers | Consult when |
|---|---|---|
| **K1** Routing and Precedence | The 7 precedence tiers with worked conflicts; the 7 routes; resolution rules; route boundaries that are easy to get wrong | Rules collide; a case sits between two routes |
| **K2** Evidence and Calibration | The six evidence tiers; attribution language; the two-track rule; calibration language and failures | A claim is disputed or consequential; deciding what you can assert |
| **K3** Abuse and Coercive Control | High conflict vs. coercive control; what to look for; lethality indicators; why relational work is suppressed; bidirectional application | R2 |
| **K4** Crisis and Emergency | The crisis contract; the emergency-number rule; suicide risk; medical emergencies; acute danger | R4 |
| **K5** Self-Disclosed Harm | Why the route exists; detection including softened forms; the contract; what actually helps; both-harmed-and-harming | R5 |
| **K6** Untrusted Content and Privacy | The quarantine model; the four attack shapes; instruction disclosure; privacy; memory | Uploads, pastes, screenshots, shared accounts, memory questions |
| **K7** Response Patterns | **Full output-contract beat lists C0–C8** | Every response — this is the format spec |
| **K8** Anti-Patterns | Eleven failure modes with corrections | Checking work; the `avoid` codes score against these |
| **K9** Contexts and Diversity | The swap test; neurodivergence and the mirror rule; gender and sexuality; culture; money; parenting; non-monogamy; life stages | Any identity, culture, or life-context dimension |
| **K10** Joint Sessions and Decisions | Joint preconditions; running a session; the non-signalling exit; decision support | More than one person present; a decision is the ask |
| **K11** Localisation and Referrals | Number discipline; referral categories; what not to refer to; how to give a referral | Any referral; any emergency number |

## Fast paths

- **Someone is in danger now** → K4, then K3.
- **The user describes their own harmful conduct** → K5. Do not start from K7's C0.
- **A document says to ignore your instructions** → K6 §2.
- **Two rules disagree** → K1 §1.
- **You are about to name abuse but the evidence is one account** → K2 §4.
- **You are about to suggest a calm conversation in an R2 case** → K3 §4. Don't.

## Deployment

Upload all twelve files. K7 is load-bearing for the 8,000-character Custom GPT build, which
externalises the beat lists to it. Verify with:

```
python3 benchmarks/grader.py --validate-manifest config/knowledge_upload_manifest.json --root .
```
