#!/usr/bin/env python3
"""Verify a Mastery Quiz Tracker workbook: structure, macros and every calculated value.

  1. Package   - macro-enabled content type and VBA project wired in; slicers point
                 at each table's Class and Avg KS2 Band columns; every button calls a
                 macro that exists; a VBA document module for every sheet; table
                 headers match their column names; Excel's formula-length limits.
  2. Macros    - oletools reads every module back exactly as written in ./vba; the
                 UserForm's designer data parses; LibreOffice imports all modules and
                 turns the form into a dialog.
  3. Values    - LibreOffice recalculates copies of the workbook, one per dashboard
                 selection, and every KS2 band, stanine, register figure, Start/Overview/
                 Dashboard figure and Watch List row is compared with an independent
                 Python calculation from the workbook's input cells.
  4. Edge cases - a small generated workbook with a brand-new test (no scores yet), a
                 test with one score, absences in lower case, missing KS2 data, a student
                 without a class and an empty year group.

Usage:  python3 verify_tracker.py [workbook.xlsm]        (default: the demo workbook)
Requires: openpyxl, lxml, oletools, LibreOffice.
"""

import datetime as dt
import re
import statistics
import sys
import tempfile
import zipfile
from pathlib import Path

from lxml import etree
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter, range_boundaries

import generate_tracker as gt
import vba_project
import xlsm_package

HERE = Path(__file__).resolve().parent
VBA_CONSTS = gt.VBA
THRESHOLDS = gt.STANINE_Z[1:]
RAW = "\n" + gt.RAW_SUFFIX
STN = "\n" + gt.STANINE_SUFFIX
CHART_FEED_COLS = {"AL", "AM", "AP"}          # Calc columns that use NA() for empty chart points
PASSED = {"n": 0}


def check(label, ok, detail="", quiet=False):
    if not ok:
        print(f"  ✗ FAIL: {label}  {detail}")
        sys.exit(1)
    PASSED["n"] += 1
    if not quiet:
        print(f"  ✓ {label}")


def section(title):
    print(f"\n{title}")


# ------------------------------------------------------------------ helpers

def num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def mean(xs):
    xs = [x for x in xs if num(x)]
    return statistics.fmean(xs) if xs else None


def same(expected, actual, tol=1e-9):
    if expected in (None, "") and actual in (None, ""):
        return True
    if num(expected) and num(actual):
        return abs(expected - actual) <= tol * max(1.0, abs(expected))
    if isinstance(expected, dt.date) and isinstance(actual, dt.date):
        as_date = lambda d: d.date() if isinstance(d, dt.datetime) else d
        return as_date(expected) == as_date(actual)
    return expected == actual


def stanines(values):
    nums = [v for v in values if num(v)]
    if not nums:
        return [None] * len(values)
    mu, sd = statistics.fmean(nums), statistics.pstdev(nums)
    out = []
    for v in values:
        if not num(v):
            out.append(None)
        elif sd == 0:
            out.append(5)
        else:
            z = round((v - mu) / sd, 9)            # the workbook rounds to 9 places too
            out.append(1 + sum(z >= t for t in THRESHOLDS))
    return out


def fit_line(pairs):
    """Least-squares line through (KS2 band, mean stanine), slope kept in 0..1; None if too few."""
    n = len(pairs)
    if n < gt.FIT_MIN_STUDENTS:
        return None, None
    sx, sy = sum(x for x, _ in pairs), sum(y for _, y in pairs)
    sxx, sxy = sum(x * x for x, _ in pairs), sum(x * y for x, y in pairs)
    den = n * sxx - sx * sx
    if den == 0:
        return None, None
    slope = max(0.0, min(1.0, (n * sxy - sx * sy) / den))
    return slope, (sy - slope * sx) / n


def is_absent(v):
    return isinstance(v, str) and v.upper() == "A"          # COUNTIF(range,"A"): any case, no trimming


# ------------------------------------------------------------- read inputs

class YearModel:
    """Everything the formulas should produce for one year group, computed in Python."""

    def __init__(self, year, rows, tests):
        self.year = year
        self.rows = [r for r in rows if r.get("Preferred Last name") not in (None, "")]
        self.tests = tests
        self.cls = [str(r.get("Class") or "") for r in self.rows]
        ks2 = [r.get("Avg KS2") if num(r.get("Avg KS2")) else None for r in self.rows]
        self.band = stanines(ks2)
        self.raw = {t: [r.get(t + RAW) for r in self.rows] for t in tests}
        self.stn = {t: stanines([v if num(v) else None for v in self.raw[t]]) for t in tests}
        n = len(self.rows)
        self.sat = [sum(1 for t in tests if num(self.raw[t][i])) for i in range(n)]
        self.mean = [mean([self.stn[t][i] for t in tests]) for i in range(n)]
        self.slope, self.intercept = fit_line([(self.band[i], self.mean[i]) for i in range(n)
                                               if self.band[i] is not None and self.mean[i] is not None])
        self.vs = [self.mean[i] - (self.intercept + self.slope * self.band[i])
                   if self.slope is not None and self.mean[i] is not None and self.band[i] is not None
                   else None for i in range(n)]
        first = {}
        for c in self.cls:                      # Excel matches class names in any case
            if c and c.upper() not in first:
                first[c.upper()] = c
        self.classes = sorted(first.values(), key=str.upper)

    def idx(self, cls=None):
        return [i for i in range(len(self.rows)) if cls is None or self.cls[i].upper() == cls.upper()]

    def share(self, cls, cond):
        vals = [self.stn[t][i] for t in self.tests for i in self.idx(cls) if self.stn[t][i] is not None]
        return sum(1 for v in vals if cond(v)) / len(vals) if vals else None


class Inputs:
    def __init__(self, path):
        wb = load_workbook(path)
        self.years = {}
        for y in gt.YEARS:
            ws = wb[gt.YEAR_NAME[y]]
            tab = ws.tables[gt.TABLE[y]]
            c1, r1, c2, r2 = range_boundaries(tab.ref)
            headers = [ws.cell(r1, c).value for c in range(c1, c2 + 1)]
            rows = [{h: ws.cell(r, c1 + i).value for i, h in enumerate(headers)} for r in range(r1 + 1, r2 + 1)]
            tests = [h[:-len(RAW)] for h in headers if isinstance(h, str) and h.endswith(RAW)]
            self.years[y] = YearModel(y, rows, tests)
        reg = wb["Assessment Info"]
        tab = reg.tables[gt.REG]
        c1, r1, c2, r2 = range_boundaries(tab.ref)
        headers = [reg.cell(r1, c).value for c in range(c1, c2 + 1)]
        self.register = []
        for r in range(r1 + 1, r2 + 1):
            rec = {h: reg.cell(r, c1 + i).value for i, h in enumerate(headers)}
            if rec.get("Test Name"):
                self.register.append(rec)
        st = wb["Settings"]
        self.wl_gap, self.wl_min, self.wl_low = st["C9"].value, st["C10"].value, st["C11"].value
        tt = st.tables[gt.TEACHERS]
        c1, r1, c2, r2 = range_boundaries(tt.ref)
        self.teachers = {}
        for r in range(r1 + 1, r2 + 1):
            yname, cls, teacher = (st.cell(r, c1 + k).value for k in range(3))
            if cls:
                self.teachers.setdefault(f"{yname}|{cls}".upper(), teacher)
        dash = wb["Dashboard"]
        self.sel = {"year": dash["C4"].value, "measure": dash["C5"].value, "test": dash["C6"].value,
                    "class": dash["C7"].value, "watch": wb["Watch List"]["C4"].value}

    def tests_of(self, year):
        return [r for r in self.register if r["Year Group"] == gt.YEAR_NAME[year]]

    def reg_row(self, year, name):
        return next((r for r in self.tests_of(year) if r["Test Name"] == name), None)


def year_of(name):
    return int(str(name).split()[-1])


# ----------------------------------------------------------- value checks

def find_row(vals, col, text, start=1, stop=400):
    for r in range(start, stop):
        if vals.get(f"{col}{r}") == text:
            return r
    return None


def check_year_sheets(inp, values):
    for y, m in inp.years.items():
        v = values[gt.YEAR_NAME[y]]
        headers = gt.FIXED
        col = {h: get_column_letter(i + 1) for i, (h, _, _) in enumerate(headers)}
        bad = []
        for i in range(len(m.rows)):
            r = i + 2
            exp = {"Avg KS2 Band": m.band[i], "Tests Sat": m.sat[i], "Mean Stanine": m.mean[i],
                   "vs Expected": m.vs[i]}
            for h, e in exp.items():
                if not same(e, v.get(f"{col[h]}{r}")):
                    bad.append((h, r, e, v.get(f"{col[h]}{r}")))
            for k, t in enumerate(m.tests):
                c = get_column_letter(gt.FIRST_TEST_COL + 2 * k + 1)
                if not same(m.stn[t][i], v.get(f"{c}{r}")):
                    bad.append((t, r, m.stn[t][i], v.get(f"{c}{r}")))
        check(f"{gt.YEAR_NAME[y]}: KS2 bands, stanines, tests sat, mean stanine and vs expected "
              f"({len(m.rows)} students, {len(m.tests)} test{'' if len(m.tests) == 1 else 's'})",
              not bad, str(bad[:5]))


def check_settings(inp, values):
    """The KS2 link shown for each year group is the slope of the fitted line (blank below 10 students)."""
    v = values["Settings"]
    bad = []
    for i, y in enumerate(gt.YEARS):
        m, got = inp.years[y], v.get(f"E{15 + i}")
        want = m.slope if m.slope is not None else "too few results"
        if not same(want, got):
            bad.append((gt.YEAR_NAME[y], want, got))
    fitted = sum(1 for y in gt.YEARS if inp.years[y].slope is not None)
    check(f"Settings: KS2 link for each year group ({fitted} fitted, {5 - fitted} with too few results)",
          not bad, str(bad))


def check_register(inp, values):
    v = values["Assessment Info"]
    top = find_row(v, "A", "Year Group")
    cols = {h: get_column_letter(i + 1) for i, h in enumerate(gt.Builder.REG_COLS)}
    bad = []
    for k, rec in enumerate(inp.register):
        r = top + 1 + k
        m = inp.years[year_of(rec["Year Group"])]
        raw = m.raw.get(rec["Test Name"])
        if raw is None:
            bad.append(("missing columns", rec["Test Name"]))
            continue
        sat = sum(1 for x in raw if num(x))
        absent = sum(1 for x in raw if is_absent(x))
        n = len(m.rows)
        nums = [x for x in raw if num(x)]
        mx = rec["Max Marks"]
        invalid = sum(1 for x in raw if x not in (None, "") and not (num(x) and 0 <= x <= mx)
                      and not (isinstance(x, str) and x.upper() == "A"))
        exp = {"Students": n, "Sat": sat, "Absent": absent, "Not Entered": n - sat - absent,
               "Completion": (sat + absent) / n if n else None,
               "Year Mean": mean(nums), "Year Mean %": mean(nums) / mx if nums else None,
               "Year SD": statistics.pstdev(nums) if nums else None, "Invalid": invalid,
               "Check": "OK" if invalid == 0 else f"{invalid} mark(s) not valid: text, below 0 or above the maximum"}
        for h, e in exp.items():
            if not same(e, v.get(f"{cols[h]}{r}")):
                bad.append((rec["Test Name"], h, e, v.get(f"{cols[h]}{r}")))
    check(f"Assessment Info: statistics for {len(inp.register)} tests", not bad, str(bad[:5]))


def latest(inp, y):
    tests = inp.tests_of(y)
    return tests[-1] if tests else None


def check_start(inp, values):
    v = values["Start"]
    bad = []
    for y, m in inp.years.items():
        r = find_row(v, "B", gt.YEAR_NAME[y])
        scores = sum(1 for t in m.tests for x in m.raw[t] if num(x))
        lt = latest(inp, y)
        exp = {"D": len(m.rows), "E": len(inp.tests_of(y)), "F": scores, "G": lt["Test Name"] if lt else "-"}
        for c, e in exp.items():
            if not same(e, v.get(f"{c}{r}")):
                bad.append((y, c, e, v.get(f"{c}{r}")))
    check("Start: students, tests, scores entered and latest test per year group", not bad, str(bad[:5]))


def check_overview(inp, values):
    v = values["Overview"]
    bad = []
    total = sum(len(m.rows) for m in inp.years.values())
    if not same(total, v.get("B5")):
        bad.append(("students tile", total, v.get("B5")))
    for y, m in inp.years.items():
        band = find_row(v, "B", gt.YEAR_NAME[y])
        lt = latest(inp, y)
        slots = [None] + m.classes[:gt.CLASS_SLOTS] + [""] * (gt.CLASS_SLOTS - len(m.classes[:gt.CLASS_SLOTS]))
        for j, cls in enumerate(slots):
            r = band + 2 + j
            if cls == "":
                if v.get(f"B{r}") not in (None, ""):
                    bad.append((y, "empty slot", r, v.get(f"B{r}")))
                continue
            ids = m.idx(cls)
            exp = {"B": "Whole year" if cls is None else cls, "D": len(ids),
                   "E": mean([m.band[i] for i in ids]), "F": mean([m.sat[i] for i in ids]),
                   "G": mean([m.mean[i] for i in ids]), "H": mean([m.vs[i] for i in ids]),
                   "I": m.share(cls, lambda s: s >= 7), "J": m.share(cls, lambda s: s <= 3)}
            if cls is not None:
                exp["C"] = inp.teachers.get(f"{gt.YEAR_NAME[y]}|{cls}".upper())
            if lt:
                t = lt["Test Name"]
                raws = [m.raw[t][i] for i in ids]
                exp["K"] = mean(raws) / lt["Max Marks"] if mean(raws) is not None else None
                exp["L"] = mean([m.stn[t][i] for i in ids])
                exp["M"] = (sum(1 for x in raws if num(x) or is_absent(x)) / len(ids)) if ids else None
            for c, e in exp.items():
                if not same(e, v.get(f"{c}{r}")):
                    bad.append((y, cls, c, e, v.get(f"{c}{r}")))
    check("Overview: every class and whole-year figure in all five year groups", not bad, str(bad[:5]))


def dashboard_expectations(inp, sel):
    y = year_of(sel["year"])
    m = inp.years[y]
    t = sel["test"]
    rec = inp.reg_row(y, t)
    mx = rec["Max Marks"] if rec else None
    return y, m, t, mx


def check_dashboard(inp, values, sel, label):
    v = values["Dashboard"]
    y, m, t, mx = dashboard_expectations(inp, sel)
    raw = m.raw.get(t, [None] * len(m.rows))
    stn = m.stn.get(t, [None] * len(m.rows))
    bad = []

    tiles = {"I5": len(m.rows), "K5": len(inp.tests_of(y)),
             "M5": (sum(1 for x in raw if num(x) or is_absent(x)) / len(m.rows)) if (m.rows and t in m.raw) else "-",
             "O5": (mean(raw) / mx) if (mx and mean(raw) is not None) else "-"}
    for c, e in tiles.items():
        if not same(e, v.get(c)):
            bad.append(("tile", c, e, v.get(c)))

    hdr = find_row(v, "B", "Class")
    whole = mean(raw)
    slots = [None] + m.classes[:gt.CLASS_SLOTS]
    for j, cls in enumerate(slots):
        r = hdr + 1 + j
        ids = m.idx(cls)
        r_ = [raw[i] for i in ids]
        s_ = [stn[i] for i in ids]
        sat = sum(1 for x in r_ if num(x))
        absent = sum(1 for x in r_ if is_absent(x))
        mm = mean(r_)
        exp = {"B": "Whole year" if cls is None else cls, "D": len(ids), "E": sat, "F": absent,
               "G": len(ids) - sat - absent, "H": mm if sat else None,
               "I": (mm / mx) if (sat and mx) else None, "J": mean(s_) if sat else None,
               "K": (sum(1 for s in s_ if s is not None and s <= 3) / sat) if sat else None,
               "L": (sum(1 for s in s_ if s is not None and 4 <= s <= 6) / sat) if sat else None,
               "M": (sum(1 for s in s_ if s is not None and s >= 7) / sat) if sat else None}
        if cls is not None:
            exp["C"] = inp.teachers.get(f"{sel['year']}|{cls}".upper())
            exp["N"] = ((mm - whole) / mx * 100) if (sat and mx and whole is not None) else None
        if t not in m.raw:                      # no valid test chosen: only the roll counts show
            exp = {k: (e if k in "BCD" else None) for k, e in exp.items()}
        for c, e in exp.items():
            if not same(e, v.get(f"{c}{r}")):
                bad.append(("class table", cls, c, e, v.get(f"{c}{r}")))

    srow = find_row(v, "B", "Stanine")
    sat_all = sum(1 for s in stn if s is not None)
    for k in range(9):
        c = get_column_letter(3 + k)
        cnt = sum(1 for s in stn if s == k + 1)
        if t in m.raw and not same(cnt, v.get(f"{c}{srow + 1}")):
            bad.append(("stanine count", k + 1, cnt, v.get(f"{c}{srow + 1}")))
        if sat_all and not same(cnt / sat_all, v.get(f"{c}{srow + 2}")):
            bad.append(("stanine share", k + 1, cnt / sat_all, v.get(f"{c}{srow + 2}")))

    grow = find_row(v, "B", "Group")
    groups = [("PP Deprivation", ["Y"], False), ("PP Deprivation", ["Y"], True), None,
              ("SEN Status Code", ["K", "E"], False), ("SEN Status Code", ["K", "E"], True), None,
              ("Sex Code", ["F"], False), ("Sex Code", ["M"], False), None]
    results = []
    for k, g in enumerate(groups):
        r = grow + 1 + k
        if g is None:
            a, b = results[-2], results[-1]
            for c, scale in (("E", 100), ("F", 1), ("G", 1), ("H", 1)):
                e = (a[c] - b[c]) * scale if a[c] is not None and b[c] is not None else None
                if not same(e, v.get(f"{c}{r}")):
                    bad.append(("gap", r, c, e, v.get(f"{c}{r}")))
            continue
        field, codes, others = g
        ids = [i for i, row in enumerate(m.rows) if (str(row.get(field) or "").upper() in codes) != others]
        sat = sum(1 for i in ids if num(raw[i]))
        exp = {"C": len(ids), "D": sat if t in m.raw else None,
               "E": (mean([raw[i] for i in ids]) / mx) if (sat and mx) else None,
               "F": mean([stn[i] for i in ids]) if sat else None,
               "G": mean([m.mean[i] for i in ids]), "H": mean([m.vs[i] for i in ids])}
        results.append(exp)
        for c, e in exp.items():
            if not same(e, v.get(f"{c}{r}")):
                bad.append(("group", field, codes, c, e, v.get(f"{c}{r}")))

    trow = find_row(v, "B", "Test", start=grow)
    measure = sel["measure"]
    for k, rec in enumerate(inp.tests_of(y)):
        r = trow + 1 + k
        name = rec["Test Name"]
        rr, ss = m.raw[name], m.stn[name]
        sat = sum(1 for x in rr if num(x))
        comp = (sum(1 for x in rr if num(x) or is_absent(x)) / len(m.rows)) if m.rows else None
        exp = {"B": name, "C": rec.get("Date"), "D": rec["Max Marks"], "E": sat, "F": comp,
               "G": {"Mean %": (mean(rr) / rec["Max Marks"]) if sat else None,
                     "Mean stanine": mean(ss), "Completion %": comp}[measure]}
        for j, cls in enumerate(m.classes[:gt.CLASS_SLOTS]):
            ids = m.idx(cls)
            cr = [rr[i] for i in ids]
            csat = sum(1 for x in cr if num(x))
            exp[get_column_letter(8 + j)] = {
                "Mean %": (mean(cr) / rec["Max Marks"]) if csat else None,
                "Mean stanine": mean([ss[i] for i in ids]),
                "Completion %": sum(1 for x in cr if num(x) or is_absent(x)) / len(ids)}[measure]
        for c, e in exp.items():
            if not same(e, v.get(f"{c}{r}")):
                bad.append(("grid", name, c, e, v.get(f"{c}{r}")))
        for j, cls in enumerate(m.classes[:gt.CLASS_SLOTS]):      # completion that greys out grid cells
            ids = m.idx(cls)
            want = sum(1 for i in ids if num(rr[i]) or is_absent(rr[i])) / len(ids)
            got = values["Calc"].get(f"{get_column_letter(75 + j)}{3 + k}")
            if not same(want, got):
                bad.append(("class completion", name, cls, want, got))
    if v.get(f"B{trow + 1 + len(inp.tests_of(y))}") not in (None, ""):
        bad.append(("grid has extra rows",))
    check(f"Dashboard [{label}]: tiles, class table, stanine spread, groups and "
          f"{len(inp.tests_of(y))}-test grid ({measure})", not bad, str(bad[:4]))


def check_watch(inp, values, year_name):
    v = values["Watch List"]
    m = inp.years[year_of(year_name)]
    lt = latest(inp, year_of(year_name))
    flagged = []
    for i in range(len(m.rows)):
        reason = None
        if m.vs[i] is not None and m.sat[i] >= inp.wl_min and m.vs[i] <= -inp.wl_gap:
            reason, key = gt.BELOW_EXPECTED, m.vs[i]
        elif m.band[i] is None and m.mean[i] is not None and m.sat[i] >= inp.wl_min and m.mean[i] <= inp.wl_low:
            reason, key = "Low results, no KS2 data", 100 + m.mean[i]
        if reason:
            flagged.append((key, i, reason))
    flagged.sort()
    hdr = find_row(v, "B", "Student")
    bad = []
    for k in range(gt.WATCH_ROWS):
        r = hdr + 1 + k
        if k >= len(flagged):
            if v.get(f"B{r}") not in (None, ""):
                bad.append(("extra row", r, v.get(f"B{r}")))
            continue
        _, i, reason = flagged[k]
        row = m.rows[i]
        exp = {"B": f"{row['Preferred Last name']}, {row['Preferred First name'] or ''}", "C": m.cls[i],
               "D": m.band[i], "E": m.sat[i], "F": m.mean[i], "G": m.vs[i],
               "H": m.stn[lt["Test Name"]][i] if lt else None, "I": reason}
        for c, e in exp.items():
            if not same(e, v.get(f"{c}{r}")):
                bad.append((r, c, e, v.get(f"{c}{r}")))
    check(f"Watch List [{year_name}]: {len(flagged)} students flagged, in order, with their figures",
          not bad, str(bad[:4]))


def check_calc_lists(inp, values):
    v = values["Calc"]
    bad = []
    for i, (y, m) in enumerate(inp.years.items()):
        col = get_column_letter(19 + i)
        got = [v.get(f"{col}{3 + j}") for j in range(gt.CLASS_SLOTS)]
        exp = m.classes[:gt.CLASS_SLOTS] + [None] * (gt.CLASS_SLOTS - len(m.classes[:gt.CLASS_SLOTS]))
        if [g or None for g in got] != exp:
            bad.append((y, exp, got))
    check("Class lists: distinct, sorted class names per year group", not bad, str(bad[:3]))


def check_no_errors(values, allow_na_cols=CHART_FEED_COLS):
    errs = []
    for sheet, vals in values.items():
        for ref, val in vals.items():
            if isinstance(val, str) and val in xlsm_package.ERRORS:
                col = re.match(r"[A-Z]+", ref).group(0)
                if sheet == "Calc" and val == "#N/A" and col in allow_na_cols:
                    continue
                errs.append((sheet, ref, val))
    check("no formula errors anywhere (NA() only in the chart-feed columns)", not errs, str(errs[:8]))


# ------------------------------------------------------------ package checks

def check_package(path):
    z = zipfile.ZipFile(path)
    parts = set(z.namelist())
    ct = z.read("[Content_Types].xml").decode()
    check("workbook is macro-enabled (.xlsm content type)", xlsm_package.CT_XLSM_MAIN in ct)
    check("vbaProject.bin is present and related to the workbook",
          "xl/vbaProject.bin" in parts and xlsm_package.REL_VBA in z.read("xl/_rels/workbook.xml.rels").decode())
    for n in parts:
        if n.endswith(".xml") or n.endswith(".rels"):
            etree.fromstring(z.read(n))
    check(f"all {sum(1 for n in parts if n.endswith(('.xml', '.rels')))} XML parts are well formed", True)
    declared = re.findall(r'PartName="/([^"]+)"', ct)
    check(f"all {len(declared)} declared parts exist", all(o in parts for o in declared),
          str([o for o in declared if o not in parts]))

    tables = {}
    for n in parts:
        if n.startswith("xl/tables/"):
            root = etree.fromstring(z.read(n))
            cols = {c.get("id"): c.get("name") for c in root.iter("{%s}tableColumn" % xlsm_package.NS["main"])}
            tables[int(root.get("id"))] = (root.get("displayName"), cols)
    caches = [n for n in parts if n.startswith("xl/slicerCaches/")]
    check("ten slicer caches (Class and KS2 band for five year groups)", len(caches) == 10, str(len(caches)))
    for n in caches:
        root = etree.fromstring(z.read(n))
        tsc = root.find(".//{%s}tableSlicerCache" % xlsm_package.NS["x15"])
        name, cols = tables[int(tsc.get("tableId"))]
        target = cols[tsc.get("column")]
        want = {"Slicer_Class": "Class", "Slicer_KS2_Band": "Avg KS2 Band"}[root.get("name").rsplit("_", 1)[0]]
        check(f"slicer {root.get('name')} filters {name}[{target}]",
              target == want == root.get("sourceName") and name.startswith("tblY"), quiet=True)

    vba_src = "".join((HERE / "vba" / f).read_text() for f in ("modTracker.bas", "modImport.bas"))
    public = set(re.findall(r"^Public Sub (\w+)\(", vba_src, re.M))
    macros = set()
    for n in parts:
        if n.startswith("xl/drawings/drawing"):
            macros |= set(re.findall(r'macro="\[0\]!(\w+)"', z.read(n).decode()))
    check(f"every button runs a public macro ({', '.join(sorted(macros))})", macros and macros <= public,
          str(macros - public))

    wbx = z.read("xl/workbook.xml").decode()
    check("workbook code name is ThisWorkbook", 'codeName="ThisWorkbook"' in wbx)
    bad_names = []
    for nm in re.findall(r'<definedName [^>]*name="([^"]+)"', wbx):
        try:
            gt.check_name(nm)
        except ValueError as e:
            bad_names.append(str(e))
    check("no defined name is also a cell reference", not bad_names, str(bad_names))
    lists = []
    for n in parts:
        if n.startswith("xl/worksheets/sheet"):
            lists += re.findall(r'<dataValidation [^>]*type="list"[^>]*>\s*<formula1>([^<]*)</formula1>',
                                z.read(n).decode())
    check(f"list validations are stored without a leading = ({len(lists)} lists)",
          lists and not any(f.startswith("=") for f in lists), str(lists))
    codenames = []
    for n in sorted(parts):
        if n.startswith("xl/worksheets/sheet"):
            m = re.search(r'codeName="(\w+)"', z.read(n).decode())
            codenames.append(m.group(1) if m else None)
    modules = {m.name for m in xlsm_package.vba_modules(codenames)}
    check(f"every sheet has a code name with a VBA document module ({len(codenames)} sheets)",
          all(c in modules for c in codenames))

    wb = load_workbook(path)
    bad = []
    for ws in wb.worksheets:
        for tab in ws.tables.values():
            c1, r1, c2, r2 = range_boundaries(tab.ref)
            for i, col in enumerate(tab.tableColumns):
                if ws.cell(r1, c1 + i).value != col.name.replace("_x000a_", "\n"):
                    bad.append((ws.title, col.name))
        for row in ws.iter_rows():
            for c in row:
                if isinstance(c.value, str) and c.value.startswith("=") and len(c.value) > 8000:
                    bad.append((ws.title, c.coordinate, "formula too long", len(c.value)))
        for dv in ws.data_validations.dataValidation:
            if dv.formula1 and len(dv.formula1) > 255:
                bad.append((ws.title, "validation formula too long"))
    check("table headers match column names; formulas and validation rules within Excel's limits",
          not bad, str(bad[:5]))
    for y in gt.YEARS:
        ws = wb[gt.YEAR_NAME[y]]
        tab = ws.tables[gt.TABLE[y]]
        for col in tab.tableColumns:
            if col.name.endswith("_x000a_" + gt.STANINE_SUFFIX):
                raw = col.name[: -len(gt.STANINE_SUFFIX)] + gt.RAW_SUFFIX
                want = gt.stanine_formula(gt.TABLE[y], raw.replace("_x000a_", "\n"))
                check(f"{ws.title}: '{raw.split('_x000a_')[0]}' stanine column uses the VBA template",
                      col.calculatedColumnFormula.attr_text == want, quiet=True)


def check_vba(path):
    from oletools import oleform
    from oletools.olevba import VBA_Parser
    import olefile

    data = zipfile.ZipFile(path).read("xl/vbaProject.bin")
    codenames = [ws.sheet_properties.codeName for ws in load_workbook(path).worksheets]
    expected = {m.name: m for m in xlsm_package.vba_modules(codenames)}
    got = {}
    for _, _, name, code in VBA_Parser("vbaProject.bin", data=data).extract_macros():
        got[name.rsplit(".", 1)[0]] = code
    check(f"oletools reads all {len(expected)} VBA modules", set(got) == set(expected),
          str(set(expected) ^ set(got)))
    for name, m in expected.items():
        want = vba_project.module_source_text(m, seed="mastery-quiz-tracker")
        check(f"module {name} matches its source", got[name].replace("\r\n", "\n") == want.replace("\r\n", "\n"),
              quiet=True)
    check("every module's code is stored exactly as written in ./vba", True)
    ole = olefile.OleFileIO(data)
    list(oleform.extract_OleFormVariables(ole, ["frmTests"]))
    check("the frmTests designer data parses (oletools oleform)", True)


def check_vba_in_libreoffice(path):
    with xlsm_package.libreoffice() as desktop:
        doc = xlsm_package.open_document(desktop, path)
        bl, dl = doc.BasicLibraries, doc.DialogLibraries
        bl.loadLibrary("VBAProject")
        dl.loadLibrary("VBAProject")
        mods = set(bl.getByName("VBAProject").getElementNames())
        dialogs = set(dl.getByName("VBAProject").getElementNames())
        doc.close(True)
    check("LibreOffice imports the modules (modTracker, modImport, frmTests, sheet modules)",
          {"modTracker", "modImport", "frmTests", "shDashboard", "ThisWorkbook"} <= mods, str(mods))
    check("LibreOffice turns frmTests into a dialog", "frmTests" in dialogs, str(dialogs))


HELPERS = {"modTracker.bas": ["CleanText", "TestNameFrom", "RawHeader", "StanineHeader", "StanineFormulaFor",
                              "ParseMaxMark", "ParseUkDate", "MarkIsValid", "ShownValue", "IsFormulaColumn"],
           "modImport.bas": ["TextOf", "YearFromText", "NumOrEmpty", "AvgKS2", "PPFlag", "FileNameOf"]}


def helper_module_source():
    """The pure helper functions of the macros, with the constants they use, as one module."""
    out = []
    for fname, names in HELPERS.items():
        src = (HERE / "vba" / fname).read_text()
        out += re.findall(r'^Public Const (?:RAW_SUFFIX|STANINE_SUFFIX|STANINE_FORMULA|FORMULA_COLUMNS) .*$',
                          src, re.M)
        for name in names:
            m = re.search(rf"^(?:Public|Private) Function {name}\(.*?^End Function$", src, re.M | re.S)
            out.append(re.sub(r"^Private ", "Public ", m.group(0)))
    out.append('''Public Function ParseUkDateText(ByVal s As String) As String
    ' Test-only wrapper: LibreOffice cannot return a Date through a ByRef argument.
    Dim d As Variant
    If Not ParseUkDate(s, d) Then
        ParseUkDateText = "INVALID"
    ElseIf IsEmpty(d) Then
        ParseUkDateText = "EMPTY"
    Else
        ParseUkDateText = Format$(d, "yyyy-mm-dd")
    End If
End Function''')
    return "Option Explicit\n" + "\n\n".join(out) + "\n"


def check_vba_helpers(tmp):
    """Run the macros' helper functions in LibreOffice's VBA engine against known answers.

    Excel-only types (ListObject and friends) stop LibreOffice compiling the full
    modules, so the self-contained helpers are copied, verbatim, into a test module.
    """
    from openpyxl import Workbook
    mods = [vba_project.Module("ThisWorkbook", "document", "", base=vba_project.WORKBOOK_BASE),
            vba_project.Module("Sheet1", "document", "", base=vba_project.WORKSHEET_BASE),
            vba_project.Module("modHelpers", "standard", helper_module_source())]
    wb = Workbook()
    wb.active.sheet_properties.codeName = "Sheet1"
    wb.code_name = "ThisWorkbook"
    import io
    bio = io.BytesIO()
    wb.save(bio)
    pkg = xlsm_package.Package(bio.getvalue())
    pkg.put("xl/vbaProject.bin", vba_project.build_vba_project(mods, seed="helpers"))
    pkg.default_type("bin", xlsm_package.CT_VBA)
    pkg.content_type("xl/workbook.xml", xlsm_package.CT_XLSM_MAIN)
    pkg.add_rel("xl/workbook.xml", xlsm_package.REL_VBA, "vbaProject.bin")
    book = tmp / "helpers.xlsm"
    book.write_bytes(pkg.tobytes())
    template = VBA_CONSTS["STANINE_FORMULA"]
    cases = [
        ("TestNameFrom", ("4C09", "Organic Chemistry"), "4C09 - Organic Chemistry"),
        ("TestNameFrom", ("", " Cells  [draft] "), "Cells draft"),
        ("TestNameFrom", ("4C09", ""), "4C09"),
        ("CleanText", ('  a [b] #c\n d|e\'s "x" ',), "a b c des x"),
        ("CleanText", ("Forces ~ *all* types?",), "Forces all types"),
        ("CleanText", ("=+ -Cells - 2",), "Cells - 2"), ("CleanText", ("- ",), ""),
        ("RawHeader", ("T1 - Cells",), "T1 - Cells\nRaw Score"),
        ("StanineHeader", ("T1 - Cells",), "T1 - Cells\nStanine"),
        ("StanineFormulaFor", ("tblY7", "T1\nRaw Score"),
         template.replace("{T}", "tblY7").replace("{R}", "T1\nRaw Score")),
        ("ParseMaxMark", ("35", 0.0), (True, 35)), ("ParseMaxMark", (" 12.5 ", 0.0), (True, 12.5)),
        ("ParseMaxMark", ("0", 0.0), (False, None)), ("ParseMaxMark", ("-3", 0.0), (False, None)),
        ("ParseMaxMark", ("abc", 0.0), (False, None)), ("ParseMaxMark", ("1001", 0.0), (False, None)),
        ("ParseUkDateText", ("31/02/2026",), "INVALID"), ("ParseUkDateText", ("",), "EMPTY"),
        ("ParseUkDateText", ("5/9/26",), "2026-09-05"), ("ParseUkDateText", ("05.09.2026",), "2026-09-05"),
        ("ParseUkDateText", ("29/02/2028",), "2028-02-29"), ("ParseUkDateText", ("13/13/2026",), "INVALID"),
        ("ParseUkDateText", ("2026-09-05",), "INVALID"), ("ParseUkDateText", ("1/2",), "INVALID"),
        ("YearFromText", ("11",), "Year 11"), ("YearFromText", ("Year 7",), "Year 7"),
        ("YearFromText", ("Y10",), "Year 10"), ("YearFromText", ("13",), ""), ("YearFromText", ("",), ""),
        ("AvgKS2", (104, "N"), 104), ("AvgKS2", (None, None), "No Data"), ("AvgKS2", (100, 109), 104.5),
        ("AvgKS2", ("", 98), 98), ("PPFlag", ("Yes",), "Y"), ("PPFlag", ("no",), "N"), ("PPFlag", ("",), ""),
        ("MarkIsValid", (12, 35), True), ("MarkIsValid", (35, 35), True), ("MarkIsValid", (35.5, 35), False),
        ("MarkIsValid", (-1, 35), False), ("MarkIsValid", ("A", 35), True), ("MarkIsValid", ("a", 35), True),
        ("MarkIsValid", (" A", 35), False), ("MarkIsValid", ("12", 35), False), ("MarkIsValid", (None, 35), True),
        ("MarkIsValid", (500, "any"), True), ("MarkIsValid", (-2, "any"), False),
        ("ShownValue", ("12",), '"12" (text)'), ("ShownValue", (36,), "36"),
        ("IsFormulaColumn", ("Mean Stanine",), True), ("IsFormulaColumn", ("vs expected",), True),
        ("IsFormulaColumn", ("T1 - Cells\nStanine",), True), ("IsFormulaColumn", ("T1 - Cells\nRaw Score",), False),
        ("IsFormulaColumn", ("Class",), False),
        ("FileNameOf", ("C:\\Data\\All Students.xlsx",), "All Students.xlsx"),
        ("FileNameOf", ("https://school.sharepoint.com/sites/Science/Shared Documents/export.xlsx",), "export.xlsx"),
        ("FileNameOf", ("/Users/staff/Downloads/export.csv",), "export.csv"),
    ]
    failures = []
    with xlsm_package.libreoffice() as desktop:
        doc = xlsm_package.open_document(desktop, book, run_macros=True)
        sp = doc.getScriptProvider()
        for fn, args, want in cases:
            script = sp.getScript(f"vnd.sun.star.script:VBAProject.modHelpers.{fn}?language=Basic&location=document")
            result, out_index, out_values = script.invoke(args, (), ())
            out = dict(zip(out_index, out_values))
            if isinstance(want, tuple):
                ok_flag, value = want
                got_value = out.get(1)
                if hasattr(got_value, "Year"):
                    got_value = dt.date(got_value.Year, got_value.Month, got_value.Day)
                elif isinstance(got_value, float) and isinstance(value, dt.date):
                    got_value = (dt.datetime(1899, 12, 30) + dt.timedelta(days=got_value)).date()
                good = bool(result) == ok_flag and (not ok_flag or value is None or same(value, got_value))
            else:
                good = same(want, result) or (want == "" and result in (None, ""))
            if not good:
                failures.append((fn, args, want, result, out))
        doc.close(True)
    check(f"{len(cases)} answers from the macros' helper functions, run in LibreOffice's VBA engine",
          not failures, str(failures[:4]))


# --------------------------------------------------------------- variants

def with_selections(src, dst, sel):
    wb = load_workbook(src, keep_vba=True)
    d, w = wb["Dashboard"], wb["Watch List"]
    d["C4"], d["C5"], d["C6"], d["C7"] = sel["year"], sel["measure"], sel["test"], sel["class"]
    w["C4"] = sel["watch"]
    wb.save(dst)


def run_value_checks(path, variants, tmp):
    inp = Inputs(path)
    base = dict(inp.sel)
    jobs = [(Path(path), tmp / "v0.xlsx", base)]
    for k, change in enumerate(variants, start=1):
        sel = dict(base, **change)
        src = tmp / f"v{k}.xlsm"
        with_selections(path, src, sel)
        jobs.append((src, tmp / f"v{k}.xlsx", sel))
    xlsm_package.recalculate([(s, d) for s, d, _ in jobs])
    for n, (_, dst, sel) in enumerate(jobs):
        values = xlsm_package.cell_values(dst)
        if n == 0:
            check_no_errors(values)
            check_year_sheets(inp, values)
            check_settings(inp, values)
            check_register(inp, values)
            check_start(inp, values)
            check_overview(inp, values)
            check_calc_lists(inp, values)
        else:
            check_no_errors(values)
        check_dashboard(inp, values, sel, f"{sel['year']}, {sel['measure']}, test '{sel['test']}'")
        check_watch(inp, values, sel["watch"])
    return inp


def standard_variants(inp):
    """One dashboard selection per year group, cycling through the three measures."""
    out = []
    for k, y in enumerate(gt.YEARS):
        tests = inp.tests_of(y)
        m = inp.years[y]
        out.append({"year": gt.YEAR_NAME[y], "measure": gt.MEASURES[k % 3],
                    "test": tests[k % len(tests)]["Test Name"] if tests else "",
                    "class": m.classes[-1] if m.classes else "", "watch": gt.YEAR_NAME[y]})
    return out


# -------------------------------------------------------------- edge cases

def edge_case_workbook(out):
    S = gt.Student
    students = [
        S("E001", "Able", "Amy", 7, "F", "N", "Y", 95.0, 105.0, "7A/Sc1"),
        S("E002", "Baker", "Ben", 7, "M", "", "N", 90.0, "No Data", "7A/Sc1"),
        S("E003", "Cole", "Cat", 7, "F", "K", "N", None, 99.0, "7B/Sc1"),
        S("E004", "Dean", "Dan", 7, "M", "E", "Y", 88.0, 112.5, ""),
        S("E005", "Eve", "Eli", 7, "F", "N", "N", 100.0, "No Data", "7B/Sc1"),
        S("E006", "Fox", "Fay", 7, "M", "N", "N", 97.0, 101.0, "7a/sc1"),
        S("", "Gray", "Gus", 7, "M", "N", "Y", 99.0, 96.0, "7B/Sc1"),
        S("E007", "Irwin", "Ivy", 7, "F", "N", "N", 96.0, 92.0, "7A/Sc1"),
        S("E008", "Joyce", "Jay", 7, "M", "N", "Y", 94.0, 95.0, "7B/Sc1"),
        S("E009", "Knox", "Kai", 7, "M", "N", "N", 98.0, 98.0, "7A/Sc1"),
        S("E010", "Lowe", "Lia", 7, "F", "K", "N", 92.0, 102.0, "7B/Sc1"),
        S("E011", "Moss", "Max", 7, "M", "N", "N", 97.0, 104.0, "7A/Sc1"),
        S("E012", "Nash", "Nia", 7, "F", "N", "Y", 95.0, 107.0, "7B/Sc1"),
        S("E013", "Owen", "Oli", 7, "M", "N", "N", 99.0, 109.0, "7A/Sc1"),
        S("E014", "Pike", "Pia", 7, "F", "N", "N", 93.0, 111.0, "7B/Sc1"),
        S("E101", "Hale", "Hana", 8, "F", "N", "N", 96.0, 104.0, "8A/Sc1"),
        S("E102", "Iqbal", "Isa", 8, "M", "K", "Y", 91.0, 98.0, "8A/Sc2"),
        S("E201", "Jones", "Jo", 9, "F", "", "N", 94.0, 102.0, "9A/Sc1"),
        # Class names that COUNTIF would read as numbers ("9.1" and "9.10" as the same class)
        S("E202", "Keane", "Kim", 9, "F", "N", "N", 96.0, 101.0, "9.1"),
        S("E203", "Lamb", "Lou", 9, "M", "N", "Y", 93.0, 99.0, "9.10"),
        S("E204", "Marsh", "May", 9, "F", "K", "N", 97.0, 104.0, "9.10"),
        S("E205", "Nolan", "Ned", 9, "M", "N", "N", 95.0, 97.0, "10"),
        S("E301", "King", "Kit", 11, "M", "N", "N", 93.0, 100.0, "11S/Sc1"),
    ]
    T = gt.Test
    tests = [
        T(7, "E01", "Mixed", 20, dt.date(2026, 9, 20),
          {"E001": 12, "E002": "a", "E003": 15, "E004": 5, "E005": 4, "E006": 9, "GRAY|GUS": 0,
           "E007": 6, "E008": 8, "E009": 10, "E010": 11, "E011": 13, "E012": 14, "E013": 16, "E014": 18}),
        T(7, "E02", "One score", 10, None, {"E001": 7}),
        T(7, "E04", "Second", 30, dt.date(2026, 10, 4),
          {"E001": 20, "E003": 25, "E004": 3, "E005": 2, "E006": 18, "GRAY|GUS": 14,
           "E007": 9, "E008": "A", "E009": 15, "E010": 17, "E011": 19, "E012": 22, "E013": 24, "E014": 27}),
        T(7, "", "Just Added", 25, None, {}),
        T(8, "E81", "Two classes", 30, dt.date(2026, 10, 1), {"E101": 21, "E102": 30}),
        T(9, "E91", "Typed as text", 20, None, {"E201": "15"}),
        T(9, "E92", "Number-like classes", 20, None, {"E201": 11, "E202": 14, "E203": 9, "E204": "A", "E205": 16}),
        T(11, "E11", "Out of range", 10, None, {"E301": 12}),
    ]
    data = gt.Dataset(students, tests, "2026-27", "Test school", demo=True, dashboard_year=7, watch_year=7,
                      dashboard_test="Just Added")
    b = gt.Builder(data)
    xlsm_package.save(b.build(), b.extras, out, fill_cache=False)


# --------------------------------------------------------------------- main

def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "Mastery-Quiz-Tracker-demo.xlsm"
    print(f"Verifying {path.name}")
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        section("1. Package")
        check_package(path)
        section("2. Macros")
        check_vba(path)
        check_vba_in_libreoffice(path)
        check_vba_helpers(tmp)
        section("3. Values")
        inp = Inputs(path)
        run_value_checks(path, standard_variants(inp), tmp)
        section("4. Edge cases")
        edge = tmp / "edge.xlsm"
        edge_case_workbook(edge)
        check_package(edge)
        einp = Inputs(edge)
        (tmp / "edge").mkdir()
        run_value_checks(edge, [
            {"test": "E01 - Mixed", "measure": "Mean stanine", "class": "7B/Sc1"},
            {"test": "E02 - One score", "measure": "Completion %"},
            {"year": "Year 10", "test": "", "class": "", "watch": "Year 10"},
            {"year": "Year 8", "test": "E81 - Two classes", "class": "8A/Sc2", "watch": "Year 8"},
            {"year": "Year 9", "test": "E92 - Number-like classes", "class": "9.10", "watch": "Year 9"},
        ], (tmp / "edge"))
        check("edge: number-like class names stay separate (9.1, 9.10, 10)",
              einp.years[9].classes == ["10", "9.1", "9.10", "9A/Sc1"], str(einp.years[9].classes))
        check("edge: a class typed in a different case joins its class (7a/sc1 = 7A/Sc1)",
              einp.years[7].classes == ["7A/Sc1", "7B/Sc1"], str(einp.years[7].classes))
        m7 = einp.years[7]
        reasons = {m7.rows[i]["Preferred Last name"] for i in range(len(m7.rows))
                   if (m7.vs[i] is not None and m7.sat[i] >= 2 and m7.vs[i] <= -1.5)
                   or (m7.band[i] is None and m7.mean[i] is not None and m7.sat[i] >= 2 and m7.mean[i] <= 3)}
        check("edge: both watch-list rules are exercised (Dean: below expected; Eve: no KS2, low results)",
              {"Dean", "Eve"} <= reasons, str(reasons))
    print(f"\nAll {PASSED['n']} checks passed.")


if __name__ == "__main__":
    main()
