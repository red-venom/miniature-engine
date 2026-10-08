# Brief for the track E (editor) agent

You build one phase of the PracDraw editor. The project lives in the `pracdraw/` folder of your git worktree. The complete specification is `pracdraw/docs/SPEC.md`. It is the authority. Read these parts before you write code:

- Section 1 (lines 10 to 23): the rules. They bind you. Rule 9: the build is unattended; when something cannot be done as written, do the nearest thing that passes the gate and record it in your report. Do not stop to ask.
- Section 3 (decisions, lines 54 to 69) and section 4 (scope, lines 71 to 90).
- Section 6 (architecture, lines 126 to 182): folders, what each may import from, the store, commands, budgets.
- Section 7 (document model, lines 184 to 245).
- Section 12 (the editor, lines 503 to 637) and section 13 (export, files, hosts, lines 639 to 685).
- Section 14 (quality, lines 687 to 742): test rules and the test hook `window.__pracdraw`.
- Section 15 (build plan, lines 744 to 815): your phase's row in the table and the gate-test definitions.
- Any other section named for your phase (given below).

Then read the kit: `src/model/types.ts`, `src/model/build.ts`, `src/model/transform.ts`, `src/render/render.ts`, `src/render/NodeView.tsx`, `src/export/canvas.ts`, `src/kernel/nodes.ts`, `src/symbols/types.ts`, `src/symbols/registry.ts`, `src/symbols/label.ts`, `src/symbols/scale.ts`, `src/templates/`, `src/demo.ts`, `src/App.tsx`, `e2e/starter.spec.ts`, `playwright.config.ts`, `vite.config.ts`, and whatever earlier phases have added under `src/editor`, `src/ui`, `src/host`, `src/model`, `src/export` and `e2e`.

## Rules

1. You own `src/editor`, `src/ui`, `src/host`, `src/model` (new files and the files earlier phases added; `types.ts`, `build.ts` and `transform.ts` are kit contracts: change them only when a test proves them wrong, and record it), `src/export`, `e2e`, `src/render/NodeView.tsx`, `src/App.tsx`, `src/main.tsx`, `src/index.css`, `index.html`. Do not edit `src/kernel`, `src/render/render.ts`, `src/symbols`, `src/templates`, `src/demo.ts`, `spec/`, `scripts/`, `package.json` or the config files. If a kit file is wrong, record what you needed in your report, and do the nearest thing that passes the gate. Exception: you may add exports to `src/render/render.ts` only if a phase section names a function there (for example `estimateWidth` already exists); prefer new files.
2. Keep the kit's contracts: file format (`Doc`), `SymbolDef`, the render tree, anchor ids. Saved files and templates depend on them.
3. Add no run-time dependency. Add a development dependency only when a phase names it (none does).
4. Every change to the document goes through a pure function in `src/model/commands.ts`: `(doc, args) => doc`. Event handlers only call commands. Commands get unit tests without React (`src/model/*.test.ts`).
5. Every function a phase adds to `src/model` or `src/export` has unit tests (section 14).
6. Browser tests live in `e2e/`, open `dist/index.html` from `file://`, and use `window.__pracdraw` (`doc()`, `load(doc)`, `png(scale, options?)`, `svg(options?)`). A gate test has exactly the name given in section 15 (use it as the Playwright test title, e.g. `test('add-move-undo', ...)`).
7. The editor overlay (selection box, handles, guides) is a separate SVG layer above the diagram, never part of the render tree.
8. Use no `alert`, `confirm` or `prompt`. No icon library: icons are inline SVG, 20 px, 1.75 px line. All colours are CSS variables. System font, 13 px.
9. Leave no TODO in your files.
10. Do not stop at a plan. Build the whole phase. If the phase is large, build it in steps and keep `npm run test` green between steps.

## Work cycle

```
cd pracdraw
npm ci                                   # once, in your worktree
npm run test                             # unit tests
npm run build && npx playwright test     # or: npm run e2e
npm run format && npm run check          # must be green before you finish
```

`/opt/pw-browsers/chromium` exists, so no browser download is needed. Playwright runs with 1 worker: keep each browser test short. `npm run check` on this machine takes a few minutes.

When it is green, commit everything on your branch with `git -c user.name=Claude -c user.email=noreply@anthropic.com commit` (do not commit `out/`, `dist/`, `test-results/` or `node_modules/`). Do not push.

## Report

Reply with: the worktree path and branch name; the files you added or changed (grouped); each gate test's name and what it proves; the output summary of `npm run check` (counts); every departure from the specification, with its reason; anything you needed from the lead. Keep it short.
