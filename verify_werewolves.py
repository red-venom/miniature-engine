#!/usr/bin/env python3
"""Smoke-test Werewolves.xlsx by recalculating it with headless LibreOffice.

Two passes:
  1. static  — fresh workbook: roles deal correctly for the sample players,
               no formula errors anywhere, board shows everyone alive.
  2. game    — inject a full scripted game (night kills, a doctor save, seer
               checks, day votes, a tie, an override) into a copy, recalc,
               and assert statuses, announcements and the win banner.

Usage:  python3 verify_werewolves.py [Werewolves.xlsx]
Requires: libreoffice, openpyxl.
"""

import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

from openpyxl import load_workbook

NS = {
    "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
}
ERROR_MARKS = ("Err:", "#NAME?", "#REF!", "#VALUE!", "#DIV/0!", "#N/A", "#NULL!", "#NUM!")

CHECKS = {"passed": 0}


def recalc_to_cells(xlsx: Path, workdir: Path) -> dict:
    """Convert via LibreOffice to flat-XML ODS and return {sheet: {(row, col): text}}."""
    workdir.mkdir(parents=True, exist_ok=True)
    proc = subprocess.run(
        ["soffice", "--headless", f"-env:UserInstallation=file://{workdir}/lo-profile",
         "--convert-to", "fods", "--outdir", str(workdir), str(xlsx)],
        check=True, capture_output=True, text=True, timeout=300)
    fods = workdir / (xlsx.stem + ".fods")
    if not fods.exists():
        sys.exit(f"LibreOffice produced no output.\nstdout: {proc.stdout}\nstderr: {proc.stderr}")
    root = ET.parse(fods).getroot()
    sheets = {}
    for tbl in root.iter(f"{{{NS['table']}}}table"):
        grid = {}
        row_idx = 0
        for tr in tbl.findall(f"{{{NS['table']}}}table-row"):
            row_rep = int(tr.get(f"{{{NS['table']}}}number-rows-repeated", 1))
            col_idx = 0
            for tc in tr:
                if not tc.tag.endswith("}table-cell") and not tc.tag.endswith("}covered-table-cell"):
                    continue
                col_rep = int(tc.get(f"{{{NS['table']}}}number-columns-repeated", 1))
                text = "\n".join(
                    "".join(p.itertext()) for p in tc.findall(f"{{{NS['text']}}}p"))
                if text:
                    for dr in range(row_rep):
                        for dc in range(col_rep):
                            grid[(row_idx + dr + 1, col_idx + dc + 1)] = text
                col_idx += col_rep
            row_idx += row_rep
        sheets[tbl.get(f"{{{NS['table']}}}name")] = grid
    return sheets


def check(label, cond, detail=""):
    if not cond:
        print(f"  ✗ FAIL: {label} {detail}")
        sys.exit(1)
    CHECKS["passed"] += 1
    print(f"  ✓ {label}")


def no_formula_errors(sheets):
    bad = [(s, rc, t) for s, grid in sheets.items() if s != "How to Play"  # docs mention #NAME? literally
           for rc, t in grid.items() if any(m in t for m in ERROR_MARKS)]
    check("no formula errors in any sheet", not bad, str(bad[:5]))


def col(grid, c, top, bot):
    return [grid.get((r, c), "") for r in range(top, bot + 1)]


def run_static(xlsx: Path, workdir: Path):
    print("pass 1: fresh workbook")
    sheets = recalc_to_cells(xlsx, workdir / "static")
    no_formula_errors(sheets)

    setup, board = sheets["Setup"], sheets["Game Board"]
    names = [n for n in col(setup, 3, 14, 33) if n]
    roles = dict(zip(names, col(setup, 6, 14, 33)))
    check("8 sample players present", len(names) == 8, names)
    counts = {r: list(roles.values()).count(r) for r in set(roles.values())}
    check("roles dealt 2 wolves / 1 seer / 1 doctor / 4 villagers",
          counts == {"Werewolf": 2, "Seer": 1, "Doctor": 1, "Villager": 4}, counts)
    check("setup verdict is happy", "✅" in setup.get((12, 2), ""), setup.get((12, 2)))
    check("everyone starts alive", col(board, 4, 11, 18) == ["ALIVE"] * 8)
    check("banner says game on", "Game on — 2 werewolf" in board.get((3, 2), ""), board.get((3, 2)))
    check("role card prompts for a name", "pick your name" in sheets["Role Cards"].get((5, 2), ""))
    return roles


def run_game(xlsx: Path, roles: dict, workdir: Path):
    """Script a game on a copy: N1 kill, D1 lynch a wolf, N2 doctor save,
    D2 tie then override onto the Hunter... except sample setup has no hunter,
    so instead: D2 tie, override lynches the last wolf -> village wins."""
    print("pass 2: scripted game")
    by_role = {}
    for name, role in roles.items():
        by_role.setdefault(role, []).append(name)
    wolf1, wolf2 = sorted(by_role["Werewolf"])
    seer, doctor = by_role["Seer"][0], by_role["Doctor"][0]
    v1, v2, *_ = sorted(by_role["Villager"])

    wb = load_workbook(xlsx)
    night, day = wb["Night"], wb["Day"]
    setup_names = [wb["Setup"][f"C{r}"].value for r in range(14, 34)]
    vote_row = {n: 4 + i for i, n in enumerate(setup_names) if n}

    # Night 1: wolves eat v1, the doctor guards themselves, the seer finds wolf1.
    night["B4"], night["C4"], night["D4"] = v1, doctor, wolf1
    # Day 1: everyone alive votes out wolf1 (v1 is dead and does not vote).
    for n in roles:
        if n != v1:
            day[f"C{vote_row[n]}"] = wolf1
    # Night 2: wolves attack v2 but the doctor saves them; seer checks v2.
    night["B5"], night["C5"], night["D5"] = v2, v2, v2
    # Day 2: 3-3 tie between wolf2 and v2, then the moderator override
    # (after a table revote) eliminates wolf2 -> village wins.
    alive = [n for n in roles if n not in (v1, wolf1)]  # 6 left
    for i, n in enumerate(alive):
        day[f"D{vote_row[n]}"] = wolf2 if i % 2 == 0 else v2
    day["D50"] = wolf2

    scripted = workdir / "scripted.xlsx"
    wb.save(scripted)
    sheets = recalc_to_cells(scripted, workdir / "game")
    no_formula_errors(sheets)

    board, nightg, dayg = sheets["Game Board"], sheets["Night"], sheets["Day"]
    status = dict(zip([board.get((r, 2)) for r in range(11, 19)],
                      [board.get((r, 4)) for r in range(11, 19)]))
    check("night 1 victim is dead", status[v1] == "DEAD", status)
    check("night 1 announcement reads killed",
          "killed in the night" in nightg.get((4, 6), ""), nightg.get((4, 6)))
    check("seer identifies the wolf", "IS A WEREWOLF" in nightg.get((4, 5), ""), nightg.get((4, 5)))
    check("day 1 lynches wolf1", dayg.get((51, 3)) == wolf1, dayg.get((51, 3)))
    check("wolf1 fate says voted out day 1", "Day 1" in board_fate(board, wolf1), board_fate(board, wolf1))
    check("doctor save works — v2 alive", status[v2] == "ALIVE", status)
    check("night 2 announcement reads saved", "Doctor" in nightg.get((5, 6), ""), nightg.get((5, 6)))
    check("seer clears v2", "not a werewolf" in nightg.get((5, 5), ""), nightg.get((5, 5)))
    check("day 2 tie is flagged", "TIE" in dayg.get((48, 4), ""), dayg.get((48, 4)))
    check("override eliminates wolf2", dayg.get((51, 4)) == wolf2)
    check("village win banner shows", "VILLAGE WINS" in board.get((3, 2), ""), board.get((3, 2)))

    # Bonus: night 3 targets the long-dead v1 -> warning column must complain.
    wb2 = load_workbook(scripted)
    wb2["Night"]["B6"] = v1
    warned = workdir / "warned.xlsx"
    wb2.save(warned)
    warn_sheets = recalc_to_cells(warned, workdir / "warn")
    check("targeting a corpse raises a ⚠️ check",
          "already dead" in warn_sheets["Night"].get((6, 8), ""), warn_sheets["Night"].get((6, 8)))


def run_hunter(xlsx: Path, workdir: Path):
    """Reconfigure with a Hunter, shoot them, and check the revenge mechanics."""
    print("pass 3: hunter's revenge")
    wb = load_workbook(xlsx)
    wb["Setup"]["C9"] = 1
    hunted = workdir / "hunter-setup.xlsx"
    wb.save(hunted)
    sheets = recalc_to_cells(hunted, workdir / "hunter-roles")
    setup = sheets["Setup"]
    roles = {setup[(r, 3)]: setup[(r, 6)] for r in range(14, 22)}
    hunter = next(n for n, ro in roles.items() if ro == "Hunter")
    bystander = sorted(n for n, ro in roles.items() if ro == "Villager")[0]

    # Revenge armed while the Hunter is still alive must do nothing…
    wb = load_workbook(hunted)
    wb["Game Board"]["G7"] = bystander
    armed = workdir / "hunter-armed.xlsx"
    wb.save(armed)
    board = recalc_to_cells(armed, workdir / "hunter-alive")["Game Board"]
    check("revenge is inert while the Hunter lives",
          dict(board_rows(board))[bystander] == "ALIVE")

    # …and fire the moment the wolves eat the Hunter.
    wb = load_workbook(armed)
    wb["Night"]["B4"] = hunter
    fired = workdir / "hunter-fired.xlsx"
    wb.save(fired)
    board = recalc_to_cells(fired, workdir / "hunter-dead")["Game Board"]
    status = dict(board_rows(board))
    check("wolves kill the Hunter", status[hunter] == "DEAD", status)
    check("the Hunter's shot lands", status[bystander] == "DEAD", status)
    check("fate reads shot by the Hunter",
          "Shot by the Hunter" in board_fate(board, bystander), board_fate(board, bystander))


def board_rows(board):
    return [(board.get((r, 2)), board.get((r, 4))) for r in range(11, 31) if board.get((r, 2))]


def board_fate(board, name):
    for r in range(11, 31):
        if board.get((r, 2)) == name:
            return board.get((r, 5), "")
    return ""


def main():
    xlsx = Path(sys.argv[1] if len(sys.argv) > 1 else "Werewolves.xlsx").resolve()
    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        roles = run_static(xlsx, workdir)
        run_game(xlsx, roles, workdir)
        run_hunter(xlsx, workdir)
    print(f"all good — {CHECKS['passed']} checks passed")


if __name__ == "__main__":
    main()
