# How PracDraw is built: the agent method

Releases 1.0 and 1.1 were built by a lead agent with sub-agents, as section 15 of `docs/SPEC.md` asks. These briefs are the ones that worked. Reuse them for new packs, new templates and new editor work.

| Brief | For | Notes |
| --- | --- | --- |
| `author.md` | A symbol author (one or more packs) | Rule 1 says which priority to build. For a new pack, change it to "build the rows of your pack in `spec/catalogue.json`". |
| `template-author.md` | A template author (one group file) | Rule 1 says which priority to build. |
| `reviewer.md` | A visual reviewer of symbols and templates | The reviewer never changes code. It writes one line for each symbol or template. |
| `editor.md` | The track E agent (editor, model, export, UI, browser tests) | One agent at a time. |
| `gate-reviewer.md` | A reviewer of gate tests | Checks that each test proves what the specification says. |

## The cycle

1. The lead writes a short prompt for each agent: the brief to read, the files the agent owns, the symbols or templates to build, and the commit message trailer.
2. Each agent works in its own git worktree and branch, runs `npm run check`, and commits. It does not push.
3. The lead merges one branch at a time and runs `npm run check` on the merged tree. A gate counts only on the merged tree.
4. A separate reviewer opens every picture (`npm run sheet <pack>` or `npm run sheet templates`) or checks every gate test. The reviewer gives `pass` or the defect.
5. The author fixes defects and the reviewer looks again. After three rounds, the item is recorded as "accepted with a note".
6. The lead records every departure from the specification, with its reason, in `REPORT.md`.

## Rules that kept it safe

- File ownership (section 15 of the specification): authors edit only their pack or group file. The lead owns `src/kernel`, `src/symbols/registry.ts`, `types.ts`, `kit.ts`, `spec/`, `scripts/`, `package.json` and `README.md`.
- A reviewer never writes the code it reviews. A tool or test that a reviewer proves can fail (by breaking the code on purpose and seeing it fail) is worth more than one that only passes.
- Write each commit message to a file and use `git commit -F <file>`. A long inline message with quotes can break the shell.
- Usage limits can stop an agent. Commit the work in progress, then resume the same agent (it keeps its context) or start a fresh one in the same worktree. Run a cut-off review again from the start.
- Line numbers in the briefs are the lines of `docs/SPEC.md` at release 1.0. If the specification has grown, look for the section heading instead.
