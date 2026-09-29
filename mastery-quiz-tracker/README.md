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
| **Watch List** | Students whose results are well below what students with the same KS2 results achieve in their year group (rules set on **Settings**). |
| **Year 7 … Year 11** | One table per year group, laid out like the original Year 11 tracker: student details, KS2 band, class, then two columns per test — *Raw Score* and *Stanine*. Rows are grouped class by class. Class and KS2-band slicers sit in the frozen top-left corner. |
| **Assessment Info** | The register of tests (max mark, date, how many sat, completion, mean, SD) and the stanine lookup. |
| **Settings** | Academic year, class teachers, watch-list rules. |

## Everyday use

**Class teachers**

1. Open your year group's sheet and click your class in the **Class** slicer. The class is one
   unbroken block, in surname order.
2. Type each mark in the test's *Raw Score* column. Type **A** for absent. Leave the cell empty if the
   student has not sat the test yet. Out-of-range marks are refused.
3. To paste marks, paste one class at a time, in the same order as the sheet. Excel also pastes into
   rows that a filter hides, so a longer list would change the next class's marks. Excel sorts
   *O'Brien* as *OBrien* and *Smith-Jones* as *SmithJones*, so check such names after pasting.
4. The *Stanine* column, the register and every dashboard update by themselves.

Score entry works in Excel for the web too; only the buttons need desktop Excel.

**What the workbook protects** (desktop Excel, macros enabled): a paste that reaches rows hidden by a
filter, typing over or clearing the grey columns, marks that the score check would refuse but that
arrive by paste or fill (text such as `12/35`, dates, numbers above the maximum), and marks pasted past
the end of the table into rows with no student. Each is undone at
once with an explanation. Two limits: a paste from another program (not Excel) is recognised only in
English Excel for Windows, and your own Ctrl+Z is always left alone. In Excel for the web, where macros
do not run, the register's **Check** column counts any invalid marks for each test instead.

**Data lead**

- **Manage tests** (on Start, each year sheet, the Dashboard and the register) opens a form:
  - *Add a test* — year group, optional code (e.g. `4C09`), title, maximum mark and date. It adds the
    two columns at the right-hand end of that year's table, with the stanine formula, the 0-to-max
    check and the traffic-light icons, adds a row to the register and takes you to the new column.
  - *Edit or remove a test* — fix a title, code, maximum mark or date (Excel rewrites every formula
    that uses the renamed columns), or remove a test added by mistake, after a confirmation that says
    how many marks will be deleted.
- **Update students** reads a new *All Students* export from the MIS. Students are matched by UPN
  (by name only for rows that have no UPN, so two students who share a name are never merged; an export
  with an empty UPN column is refused); details and classes are updated, new students are added to their
  year group, and anyone missing from the export is listed — never deleted. **Marks are never
  touched.** A summary appears before anything changes, a backup copy is saved next to the file when
  it lives on your computer, and every change is listed on an *Update Report* sheet. The macros store
  codes, titles and class names as text, so `4.10` stays `4.10`. Use the `.xlsx` export rather than a
  `.csv`: Excel turns a class such as `7-1` into a date when it opens a CSV file.
- Type teachers' names next to their classes on **Settings** to show them on the dashboards.
- If the buttons do nothing, Excel is blocking macros (many school IT policies do). Marks, stanines and
  dashboards still work. The end of the **Start** sheet explains how to add a test by hand.

## How the stanines work

For each test, a student's mark becomes a z-score against their **whole year group** —
`(mark − year mean) ÷ year standard deviation` (population SD) — and falls into one of nine bands,
each half a standard deviation wide: 5 is average, about 4 % of students get a 1 and 4 % a 9. This
is the same method as the original Year 11 tracker; rebuilt with the same students, all 49 stanines
and all 110 KS2 bands in that file come out identical.

- **Avg KS2** is the mean of the KS2 maths and reading scaled scores (or the one that exists), and its
  **band** is a stanine within the year group.
- **vs Expected** = mean stanine − the mean stanine that students with the same KS2 band achieve in the
  year group. The expected value comes from a straight line fitted to the year group's own results
  (shown as the *KS2 link* on **Settings**; it appears once ten students have a KS2 band and a mean
  stanine). A plain "mean stanine − KS2 band" would be unfair: KS2 only partly predicts science results,
  so high-KS2 students would look as if they were slipping (regression to the mean) and students in KS2
  bands 1–2 could never be flagged at all. The Watch List and the class
  comparisons use *vs Expected*, so top sets and bottom sets are judged fairly.
- Stanines settle once every class has entered its marks for a test; until then they are relative to
  the students entered so far. They also move a little whenever marks are corrected or a student's row is
  deleted, so copy a stanine elsewhere (a report, a data drop) only once a test is complete.
- A stanine shows where a student stands **within their own year group** on that test. A whole year
  group therefore always averages about stanine 5, and stanines cannot show that one year group is
  stronger than another. Mean % cannot either, because tests differ in difficulty: only a test sat by
  several year groups could compare them. Compare classes and students, not year groups.

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
6. On Year 8, try three accidents: paste `abc` into a *Raw Score* cell; type over a grey *Stanine*
   cell; filter the Class slicer to one class, copy a column of 40 cells and paste it into that class's
   first mark. Each is undone with a message.
7. **Manage tests → Edit or remove a test**: rename it to `Check`, maximum 12 → *Save changes*; the
   stanines still work. Then **Remove test** → Yes: the columns and the register row disappear.
8. Close without saving.

If anything in steps 2–7 fails, the manual set-up below takes about five minutes.

## If Excel ever removes the macros

The macros are plain text in [`vba/`](vba). To put them back by hand (desktop Excel):

1. Press **Alt+F11**. **File → Import File** → `vba/modTracker.bas`, then `vba/modImport.bas`.
2. **Insert → UserForm**. In the Properties window set **(Name)** to `frmTests`. Right-click it →
   **View Code** and paste the contents of `vba/frmTests.vba` (every control is created in code, so
   there is nothing to draw).
3. Double-click the **Dashboard** sheet in the project tree and paste `vba/shDashboard.vba`. Double-click
   **ThisWorkbook** and paste `vba/ThisWorkbook.vba`.
4. Save as **Excel Macro-Enabled Workbook (.xlsm)**. The buttons call the macros by name, so they work
   again straight away.

## Limits worth knowing

- **One file per academic year.** Next September, students move up a year group and every test starts
  again. There is no *New academic year* button yet: build a fresh tracker from the new export with the
  generator (or add that button before September 2027).
- **Eight classes per year group** fit on the Overview and Dashboard. With more, the extra classes are
  left out and both sheets say so; the year sheets and the Watch List still include every student.
- **Sharing.** On a network drive only one person can edit at a time. For several teachers at once,
  keep the file in SharePoint or OneDrive; co-authoring a macro-enabled file there has not been tested.
- **Backups.** Each *Update students* run saves a full copy next to the file. Delete old copies: they
  hold the same personal data.
- **Speed.** At 1,500 students with 40 tests per year group, one typed mark takes under a second to
  recalculate in LibreOffice (0.07 s for the demo). Excel is usually faster, but that has not been
  measured.

## Compatibility

| | Scores, formulas, dashboards | Slicers | Buttons and the form |
| --- | --- | --- | --- |
| Excel for Microsoft 365 / 2021 / 2019 / 2016 (Windows) | ✓ | ✓ | ✓ |
| Excel 2013 (Windows) | ✓ | ✓ | ✓ |
| Excel for Mac 2016 or later | ✓ | ✓ | expected to work, not tested ¹ |
| Excel for the web, Teams | ✓ | ✓ | ✗ (macros do not run in the browser) |
| LibreOffice Calc | ✓ | ✗ | ✗ |

No dynamic-array functions are used, so older versions of Excel calculate everything.

¹ On a Mac, two things are untested: the form creates its tabs and boxes in code when it opens,
and **Update students** may need permission to save its backup copy in the tracker's folder. If
the backup cannot be saved, Excel asks before it changes anything.

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
| `verify_tracker.py` | Recalculates copies of a workbook in LibreOffice — one per dashboard selection — and compares every KS2 band, stanine, *vs Expected* value (including the fitted line), register figure, Overview and Dashboard cell and Watch List row with an independent Python calculation; reads the VBA back with oletools; checks LibreOffice imports the modules and the form; runs the macros' helper functions (including the guard's mark check) in LibreOffice's VBA engine; and repeats everything on an edge-case workbook (a brand-new test, a single-score test, absences, missing KS2, a student with no class, an empty year group, a mark typed as text and one above the maximum). |

Formulas are restricted to what Excel and LibreOffice calculate identically, so the checks are
meaningful: tables are always referenced as `table[#Data]` (LibreOffice reads a bare table name as
including its header row), and no criterion ever matches blank cells (LibreOffice trims trailing blank
cells from such ranges).
