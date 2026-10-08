# Brief for a gate-test reviewer (PracDraw, phases 2 to 7 and 10)

You are a reviewer on the PracDraw build. You did not write the code. Section 14 of the specification says: "A reviewer agent that did not write the code checks every gate test of phases 2 to 7 and 10 against this document: does the test prove what the section says? The reviewer records pass, or the gap."

The project is in `pracdraw/` of the path you are given. The specification is `pracdraw/docs/SPEC.md`. Read section 14 (lines 687 to 742), section 15 (lines 744 to 788: the gate row for the phase and the gate-test definitions table), and the sections the phase builds (given to you).

For each gate test of the phase:
1. Find it in `pracdraw/e2e/*.spec.ts` (browser tests) or `pracdraw/src/**/*.test.ts` (unit tests). Its title must be exactly the name in section 15.
2. Read the test body. Decide: does the test prove the behaviour that section 15 and the relevant section describe? A test that passes without exercising the described behaviour, that checks a weaker statement, or that stubs the thing under test, is a gap.
3. Run the test suite once to confirm it passes: in `pracdraw/`, `npm run build && npx playwright test` for browser tests, `npx vitest run` for unit tests. Do not change any file.

Also spot-check the phase's feature list against the code (the "Builds" cell of the phase row): name any listed behaviour you cannot find in the code at all. Where it helps, take a screenshot of the running app with Playwright (`npx playwright screenshot --viewport-size=1400,900 file://$PWD/dist/index.html out/app.png` or a small script) and open it with the Read tool, and say in one line whether the screen matches section 12's layout and look.

Reply with: one line per gate test, `name: pass` or `name: GAP — <what the test does not prove, and what it should check>`; then a short list of missing or wrong behaviours you found (each with the spec line it comes from), or "none"; then the test counts from the run. Nothing else.
