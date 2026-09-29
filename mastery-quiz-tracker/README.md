# 🧪 Science Mastery Quiz Tracker — Years 7 to 11

One Excel workbook that tracks every mastery quiz for every year group, turns each mark
into a **stanine** so students can be compared across tests, classes and year groups,
and shows how each class and each year group is doing — without a single empty
placeholder column.

**[⬇ Download the demo workbook](Mastery-Quiz-Tracker-demo.xlsm)** — every student, class and
score in it is made up, so you can try every button safely.

| Sheet | What it does |
| --- | --- |
| **Start** | Buttons, a year-group summary, instructions for teachers and the data lead, the stanine key. |
| **Overview** | Every class in every year group: mean stanine, progress against KS2, share of results at stanines 7–9 and 1–3, and the latest test. |
| **Dashboard** | One year group in depth: the chosen test by class, its stanine spread against the expected spread, PP / SEN / sex gaps, a colour-coded grid of every test by class, and a trend chart for one class. |
| **Watch List** | Students whose results are well below their KS2 starting point (rules set on **Settings**). |
| **Year 7 … Year 11** | One table per year group, laid out like the original Year 11 tracker: student details, KS2 band, class, then two columns per test — *Raw Score* and *Stanine*. Class and KS2-band slicers sit in the frozen top-left corner. |
| **Assessment Info** | The register of tests (max mark, date, how many sat, completion, mean, SD) and the stanine lookup. |
| **Settings** | Academic year, class teachers, watch-list rules. |

## Everyday use

**Class teachers**

1. Open your year group's sheet and click your class in the **Class** slicer.
2. Type each mark in the test's *Raw Score* column. Type **A** for absent. Leave the cell empty if the
   student has not sat the test yet. Out-of-range marks are refused.
3. The *Stanine* column, the register and every dashboard update by themselves.

Score entry works in Excel for the web too; only the buttons need desktop Excel.

**Data lead**

- **Manage tests** (on Start, each year sheet, the Dashboard and the register) opens a form:
  - *Add a test* — year group, optional code (e.g. `4C09`), title, maximum mark and date. It adds the
    two columns at the right-hand end of that year's table, with the stanine formula, the 0-to-max
    check and the traffic-light icons, adds a row to the register and takes you to the new column.
  - *Edit or remove a test* — fix a title, code, maximum mark or date (Excel rewrites every formula
    that uses the renamed columns), or remove a test added by mistake, after a confirmation that says
    how many marks will be deleted.
- **Update students** reads a new *All Students* export from the MIS. Students are matched by UPN
  (by name when a UPN is missing); details and classes are updated, new students are added to their
  year group, and anyone missing from the export is listed — never deleted. **Marks are never
  touched.** A summary appears before anything changes, a backup copy is saved next to the file when
  it lives on your computer, and every change is listed on an *Update Report* sheet.
- Type teachers' names next to their classes on **Settings** to show them on the dashboards.

## How the stanines work

For each test, a student's mark becomes a z-score against their **whole year group** —
`(mark − year mean) ÷ year standard deviation` (population SD) — and falls into one of nine bands,
each half a standard deviation wide: 5 is average, about 4 % of students get a 1 and 4 % a 9. This
is the same method as the original Year 11 tracker; rebuilt with the same students, all 49 stanines
and all 110 KS2 bands in that file come out identical.

- **Avg KS2** is the mean of the KS2 maths and reading scaled scores (or the one that exists), and its
  **band** is a stanine within the year group. **vs KS2 band** = mean stanine − KS2 band, so it shows
  progress from each student's starting point.
- Stanines settle once every class has entered its marks for a test; until then they are relative to
  the students entered so far.
- A whole year group always averages about stanine 5, so the dashboards compare year groups by mean %
  and compare classes by both.

## First time in Excel: a five-minute acceptance test

The workbook, its formulas and its macros were built and tested without Excel (see *How it is built
and tested*). Please run this once in desktop Excel before sharing the file with staff:

1. Open the file. If Excel says macros are blocked, close it, right-click the file → **Properties** →
   tick **Unblock** → OK, and open it again. Click **Enable Content**.
2. **Start** shows five year groups with their student counts. The year sheets show the Class and KS2
   band slicers in their top-left corners.
3. **Manage tests → Add a test**: Year 8, code `T1`, title `Acceptance`, maximum 10 → *Add test*.
   Excel opens Year 8 at the new *Raw Score* column.
4. Type `3`, `7`, `10` and `A` for four students: stanines appear; typing `11` is refused.
5. **Dashboard**: choose Year 8 — the grid shows *T1 - Acceptance*; the charts follow the year group.
6. **Manage tests → Edit or remove a test**: rename it to `Check`, maximum 12 → *Save changes*; the
   stanines still work. Then **Remove test** → Yes: the columns and the register row disappear.
7. Close without saving.

If anything in steps 2–6 fails, the manual set-up below takes about five minutes.

## If Excel ever removes the macros

The macros are plain text in [`vba/`](vba). To put them back by hand (desktop Excel):

1. Press **Alt+F11**. **File → Import File** → `vba/modTracker.bas`, then `vba/modImport.bas`.
2. **Insert → UserForm**. In the Properties window set **(Name)** to `frmTests`. Right-click it →
   **View Code** and paste the contents of `vba/frmTests.vba` (every control is created in code, so
   there is nothing to draw).
3. Double-click the **Dashboard** sheet in the project tree and paste `vba/shDashboard.vba`.
4. Save as **Excel Macro-Enabled Workbook (.xlsm)**. The buttons call the macros by name, so they work
   again straight away.

## Compatibility

| | Scores, formulas, dashboards | Slicers | Buttons and the form |
| --- | --- | --- | --- |
| Excel for Microsoft 365 / 2021 / 2019 / 2016 (Windows) | ✓ | ✓ | ✓ |
| Excel 2013 (Windows) | ✓ | ✓ | ✓ |
| Excel for Mac 2016 or later | ✓ | ✓ | expected to work, not tested |
| Excel for the web, Teams | ✓ | ✓ | ✗ (macros do not run in the browser) |
| LibreOffice Calc | ✓ | ✗ | ✗ |

No dynamic-array functions are used, so older versions of Excel calculate everything.

## Privacy

The real workbook holds personal data about children (names, UPNs, SEN and PP status,
attendance). Keep it in a staff-only location. **Never commit a real export or a real workbook to
this repository** — it is public. Put them in `private/`, which git ignores.

## How it is built and tested

```bash
pip install openpyxl lxml oletools
python3 generate_tracker.py                       # demo workbook with fictional students
python3 generate_tracker.py --students private/All_Students.xlsx \
    --carry-over "private/Year 11 tracker.xlsx" \
    --out "private/Science Mastery Quiz Tracker 2026-27.xlsm"
python3 verify_tracker.py [workbook.xlsm]         # needs LibreOffice
```

| File | Role |
| --- | --- |
| `generate_tracker.py` | Builds every sheet, table, formula, name, rule and chart with openpyxl. Reads the formula templates from `vba/modTracker.bas`, so a test added by the macro and a test written by the generator are identical. |
| `xlsm_package.py` | Adds what openpyxl cannot write: table slicers (mirroring Excel's own XML), macro buttons, the VBA project, and cached values computed by LibreOffice so the numbers show before Excel recalculates. |
| `vba_project.py` | Writes `vbaProject.bin` from the text in `vba/`: the compound-file container, VBA compression, the `dir`/`PROJECT` streams and an empty UserForm designer, following Microsoft's [MS-CFB], [MS-OVBA] and [MS-OFORMS] specifications and the layout of a project saved by Office. |
| `verify_tracker.py` | Recalculates copies of a workbook in LibreOffice — one per dashboard selection — and compares every KS2 band, stanine, register figure, Overview and Dashboard cell and Watch List row with an independent Python calculation; reads the VBA back with oletools; checks LibreOffice imports the modules and the form; runs the macros' helper functions in LibreOffice's VBA engine; and repeats everything on an edge-case workbook (a brand-new test, a single-score test, absences, missing KS2, a student with no class, an empty year group). |

Formulas are restricted to what Excel and LibreOffice calculate identically, so the checks are
meaningful: tables are always referenced as `table[#Data]` (LibreOffice reads a bare table name as
including its header row), and no criterion ever matches blank cells (LibreOffice trims trailing blank
cells from such ranges).
