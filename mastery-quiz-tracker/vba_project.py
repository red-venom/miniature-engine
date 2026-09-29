#!/usr/bin/env python3
"""Build a VBA project binary (vbaProject.bin) from plain-text VBA source.

Excel stores macros as an OLE compound file inside the .xlsm package. This
module writes one from scratch, so the VBA can live in the repository as
readable text and the workbook can be rebuilt without Excel.

It implements the parts of three Microsoft specifications that a project
with standard modules, document modules and UserForms needs:

* [MS-CFB]    the compound file container (sectors, FAT, mini stream,
              red-black directory tree);
* [MS-OVBA]   the VBA storage: RLE-style compression, the dir stream, the
              PROJECT and PROJECTwm streams and the CMG/DPB/GC encryption;
* [MS-OFORMS] the designer storage of a UserForm.

The project carries source code only, no compiled p-code: _VBA_PROJECT is
the 7-byte "version independent" stream, so Excel compiles the source the
first time the workbook opens. UserForms are stored as empty forms; their
controls are created in code (UserForm_Initialize), which keeps every
control definition in the text files.

The byte layouts mirror a project saved by Office itself (the oletools test
file oleform-PR314.docm) and are checked by verify_tracker.py with two
independent readers: oletools (olevba/oleform) and LibreOffice.
"""

import hashlib
import struct
import uuid
from dataclasses import dataclass, field

# ------------------------------------------------------------ [MS-OVBA] 2.4.1


def compress(data: bytes) -> bytes:
    """Compress bytes into an MS-OVBA CompressedContainer."""
    out = bytearray(b"\x01")
    for start in range(0, len(data), 4096):
        out += _compress_chunk(data[start:start + 4096])
    return bytes(out)


def _copy_token_help(difference):
    bit_count = max(4, (difference - 1).bit_length())
    length_mask = 0xFFFF >> bit_count
    maximum_length = length_mask + 3
    return bit_count, maximum_length


def _compress_chunk(chunk: bytes) -> bytes:
    body = bytearray()
    pos = 0
    positions = {}                      # 3-byte prefix -> earlier positions
    n = len(chunk)
    while pos < n:
        flag_index = len(body)
        body.append(0)
        flags = 0
        for bit in range(8):
            if pos >= n:
                break
            best_len = 0
            best_off = 0
            if pos >= 1 and pos + 3 <= n:
                _, max_len = _copy_token_help(pos)
                max_len = min(max_len, n - pos)
                for cand in reversed(positions.get(chunk[pos:pos + 3], ())):
                    length = 0
                    while length < max_len and chunk[cand + length] == chunk[pos + length]:
                        length += 1
                    if length > best_len:
                        best_len, best_off = length, pos - cand
                        if length == max_len:
                            break
            if best_len >= 3:
                bit_count, _ = _copy_token_help(pos)
                token = ((best_off - 1) << (16 - bit_count)) | (best_len - 3)
                body += struct.pack("<H", token)
                flags |= 1 << bit
                advance = best_len
            else:
                body.append(chunk[pos])
                advance = 1
            for k in range(pos, pos + advance):
                if k + 3 <= n:
                    positions.setdefault(chunk[k:k + 3], []).append(k)
            pos += advance
        body[flag_index] = flags
    if len(body) > 4096:
        # Raw chunks must hold exactly 4096 bytes; only a full chunk may be raw.
        assert len(chunk) == 4096, "incompressible short chunk"
        return struct.pack("<H", 0x3FFF) + chunk          # size 4098-3, sig 0b011, raw
    header = (len(body) - 1) | 0x3000 | 0x8000    # size-3 (+2 header), sig 0b011, flag
    return struct.pack("<H", header) + bytes(body)


def decompress(data: bytes) -> bytes:
    """Inverse of compress(); used by the self-test."""
    assert data[0] == 1
    out = bytearray()
    i = 1
    while i < len(data):
        header = struct.unpack_from("<H", data, i)[0]
        size = (header & 0x0FFF) + 3
        compressed = header & 0x8000
        chunk_end = i + size
        i += 2
        start = len(out)
        if not compressed:
            out += data[i:i + 4096]
            i += 4096
            continue
        while i < chunk_end:
            flags = data[i]
            i += 1
            for bit in range(8):
                if i >= chunk_end:
                    break
                if flags & (1 << bit):
                    token = struct.unpack_from("<H", data, i)[0]
                    i += 2
                    bit_count, _ = _copy_token_help(len(out) - start)
                    length = (token & (0xFFFF >> bit_count)) + 3
                    offset = (token >> (16 - bit_count)) + 1
                    for _ in range(length):
                        out.append(out[-offset])
                else:
                    out.append(data[i])
                    i += 1
    return bytes(out)


# ------------------------------------------------------------ [MS-CFB] writer

SECTOR = 512
MINI_SECTOR = 64
MINI_CUTOFF = 4096
FREESECT, ENDOFCHAIN, FATSECT = 0xFFFFFFFF, 0xFFFFFFFE, 0xFFFFFFFD
NOSTREAM = 0xFFFFFFFF
RED, BLACK = 0, 1


@dataclass
class _Node:
    name: str
    data: bytes = b""
    is_storage: bool = False
    children: dict = field(default_factory=dict)
    clsid: bytes = bytes(16)
    sid: int = 0
    left: int = NOSTREAM
    right: int = NOSTREAM
    child: int = NOSTREAM
    color: int = BLACK
    start: int = ENDOFCHAIN


def _cfb_key(name):
    return (len(name), name.upper())


class CompoundFile:
    """Minimal writer for a version 3 compound file (512-byte sectors)."""

    def __init__(self):
        self.root = _Node("Root Entry", is_storage=True)

    def add_storage(self, path, clsid=bytes(16)):
        node = self._walk(path, create=True)
        node.is_storage = True
        node.clsid = clsid
        return node

    def add_stream(self, path, data: bytes):
        *parents, name = path.split("/")
        parent = self._walk("/".join(parents), create=True) if parents else self.root
        assert len(name) <= 31, name
        parent.children[name] = _Node(name, data=bytes(data))

    def _walk(self, path, create=False):
        node = self.root
        for part in [p for p in path.split("/") if p]:
            if part not in node.children:
                if not create:
                    raise KeyError(path)
                node.children[part] = _Node(part, is_storage=True)
            node = node.children[part]
        return node

    # -- directory tree -------------------------------------------------------
    def _number(self):
        order = [self.root]
        queue = [self.root]
        while queue:
            node = queue.pop(0)
            for child in sorted(node.children.values(), key=lambda c: _cfb_key(c.name)):
                child.sid = len(order)
                order.append(child)
                queue.append(child)
        for node in order:
            if node.children:
                kids = sorted(node.children.values(), key=lambda c: _cfb_key(c.name))
                node.child = self._balance(kids, depth=0, height=_height(len(kids)))
        self.root.color = BLACK
        return order

    def _balance(self, kids, depth, height):
        """Balanced BST; nodes on an incomplete last level are red."""
        if not kids:
            return NOSTREAM
        mid = len(kids) // 2
        node = kids[mid]
        node.left = self._balance(kids[:mid], depth + 1, height)
        node.right = self._balance(kids[mid + 1:], depth + 1, height)
        node.color = RED if (depth == height - 1 and height > 1) else BLACK
        return node.sid

    # -- serialisation --------------------------------------------------------
    def tobytes(self) -> bytes:
        order = self._number()
        streams = [n for n in order if not n.is_storage and n is not self.root]
        mini = bytearray()
        minifat = []
        big = []                        # (node, sector_count)
        for node in streams:
            size = len(node.data)
            if size == 0:
                node.start = ENDOFCHAIN
            elif size < MINI_CUTOFF:
                node.start = len(minifat)
                count = -(-size // MINI_SECTOR)
                minifat += [len(minifat) + k + 1 for k in range(count - 1)] + [ENDOFCHAIN]
                mini += node.data + bytes(count * MINI_SECTOR - size)
            else:
                big.append((node, -(-size // SECTOR)))

        dir_sectors = -(-len(order) * 128 // SECTOR)
        minifat_sectors = -(-len(minifat) * 4 // SECTOR)
        ministream_sectors = -(-len(mini) // SECTOR)
        data_sectors = sum(c for _, c in big) + ministream_sectors + dir_sectors + minifat_sectors
        fat_sectors = 1
        while fat_sectors * (SECTOR // 4) < data_sectors + fat_sectors:
            fat_sectors += 1
        assert fat_sectors <= 109, "file too large for a header-only DIFAT"

        fat = []
        body = bytearray()

        def chain(n_sectors):
            first = len(fat)
            fat.extend(first + k + 1 for k in range(n_sectors - 1))
            fat.append(ENDOFCHAIN)
            return first

        for node, count in big:
            node.start = chain(count)
            body += node.data + bytes(count * SECTOR - len(node.data))
        if mini:
            self.root.start = chain(ministream_sectors)
            body += mini + bytes(ministream_sectors * SECTOR - len(mini))
        else:
            self.root.start = ENDOFCHAIN
        first_dir = chain(dir_sectors)
        dir_bytes = bytearray()
        for node in order:
            dir_bytes += self._entry(node, len(mini) if node is self.root else len(node.data))
        while len(dir_bytes) < dir_sectors * SECTOR:
            dir_bytes += _unused_entry()
        body += dir_bytes
        first_minifat = ENDOFCHAIN
        if minifat:
            first_minifat = chain(minifat_sectors)
            mf = b"".join(struct.pack("<I", v) for v in minifat)
            body += mf + b"\xff" * (minifat_sectors * SECTOR - len(mf))
        first_fat = len(fat)
        fat.extend([FATSECT] * fat_sectors)
        fat.extend([FREESECT] * (fat_sectors * (SECTOR // 4) - len(fat)))
        fat_bytes = b"".join(struct.pack("<I", v) for v in fat)

        difat = [first_fat + k for k in range(fat_sectors)] + [FREESECT] * (109 - fat_sectors)
        header = bytearray()
        header += bytes.fromhex("D0CF11E0A1B11AE1") + bytes(16)
        header += struct.pack("<HHHHH", 0x003E, 0x0003, 0xFFFE, 9, 6) + bytes(6)
        header += struct.pack("<IIIIIIIII", 0, fat_sectors, first_dir, 0, MINI_CUTOFF,
                              first_minifat, minifat_sectors, ENDOFCHAIN, 0)
        header += b"".join(struct.pack("<I", v) for v in difat)
        assert len(header) == SECTOR
        return bytes(header + body + fat_bytes)

    def _entry(self, node, size):
        name = node.name.encode("utf-16-le")
        kind = 5 if node is self.root else (1 if node.is_storage else 2)
        start = node.start if kind != 1 else 0
        if kind == 1:
            size = 0
        return (name + bytes(64 - len(name))
                + struct.pack("<HBB", len(name) + 2, kind, node.color)
                + struct.pack("<III", node.left, node.right, node.child)
                + node.clsid + bytes(4) + bytes(16)
                + struct.pack("<IQ", start, size))


def _unused_entry():
    return bytes(64) + struct.pack("<HBB", 0, 0, 0) + struct.pack("<III", NOSTREAM, NOSTREAM,
                                                                     NOSTREAM) + bytes(48)


def _height(n):
    h = 0
    while (1 << h) - 1 < n:
        h += 1
    return h


# ---------------------------------------------------------- [MS-OVBA] project

CODEPAGE = 1252
LCID = 0x0409

FORMS_CLSID = "{C62A69F0-16DC-11CE-9E98-00AA00574A4F}"
WORKBOOK_BASE = "0{00020819-0000-0000-C000-000000000046}"
WORKSHEET_BASE = "0{00020820-0000-0000-C000-000000000046}"

REF_STDOLE = ("stdole", "*\\G{00020430-0000-0000-C000-000000000046}#2.0#0#"
              "C:\\Windows\\System32\\stdole2.tlb#OLE Automation")
REF_OFFICE = ("Office", "*\\G{2DF8D04C-5BFA-101B-BDE5-00AA0044DE52}#2.0#0#"
              "C:\\Program Files\\Common Files\\Microsoft Shared\\OFFICE16\\MSO.DLL#"
              "Microsoft Office 16.0 Object Library")
MSFORMS_LIBID = ("*\\G{0D452EE1-E08F-101A-852E-02608C4D0BB4}#2.0#0#"
                 "C:\\Windows\\System32\\FM20.DLL#Microsoft Forms 2.0 Object Library")
MSFORMS_GUID = uuid.UUID("0D452EE1-E08F-101A-852E-02608C4D0BB4")


@dataclass
class Module:
    """One VBA module.

    kind: "document" (ThisWorkbook / a worksheet), "standard" or "form".
    code: the module body without its Attribute header (added here), except
          that standard modules may keep a leading 'Attribute VB_Name' line.
    """
    name: str
    kind: str
    code: str
    base: str = ""          # VB_Base for document modules
    caption: str = ""       # UserForm caption
    width_pt: float = 360   # UserForm client size (points)
    height_pt: float = 240


def _stable_guid(*parts):
    digest = hashlib.sha1("|".join(parts).encode()).digest()
    return uuid.UUID(bytes=digest[:16], version=4)


def _module_source(m: Module, seed: str) -> bytes:
    body = m.code.replace("\r\n", "\n").lstrip("\n")
    lines = [ln for ln in body.split("\n") if not ln.startswith("Attribute VB_Name")]
    body = "\n".join(lines).strip("\n") + "\n"
    if m.kind == "standard":
        head = [f'Attribute VB_Name = "{m.name}"']
    else:
        if m.kind == "form":
            g1 = _stable_guid(seed, m.name, "class")
            g2 = _stable_guid(seed, m.name, "typelib")
            base = f"0{{{str(g1).upper()}}}{{{str(g2).upper()}}}"
            exposed, customizable = "False", "False"
        else:
            base = m.base
            exposed, customizable = "True", "True"
        head = [
            f'Attribute VB_Name = "{m.name}"',
            f'Attribute VB_Base = "{base}"',
            "Attribute VB_GlobalNameSpace = False",
            "Attribute VB_Creatable = False",
            "Attribute VB_PredeclaredId = True",
            f"Attribute VB_Exposed = {exposed}",
            "Attribute VB_TemplateDerived = False",
            f"Attribute VB_Customizable = {customizable}",
        ]
    text = "\n".join(head) + "\n" + body
    return text.replace("\n", "\r\n").encode("cp1252")


def _rec(rid, payload=b""):
    return struct.pack("<HI", rid, len(payload)) + payload


def _mbcs(s):
    return s.encode("cp1252")


def _u16(s):
    return s.encode("utf-16-le")


def _dir_stream(project_name, modules, seed):
    out = bytearray()
    out += _rec(0x0001, struct.pack("<I", 1))                 # PROJECTSYSKIND: Win32
    out += _rec(0x0002, struct.pack("<I", LCID))              # PROJECTLCID
    out += _rec(0x0014, struct.pack("<I", LCID))              # PROJECTLCIDINVOKE
    out += _rec(0x0003, struct.pack("<H", CODEPAGE))          # PROJECTCODEPAGE
    out += _rec(0x0004, _mbcs(project_name))                  # PROJECTNAME
    out += _rec(0x0005) + _rec(0x0040)                        # PROJECTDOCSTRING
    out += _rec(0x0006) + _rec(0x003D)                        # PROJECTHELPFILEPATH
    out += _rec(0x0007, struct.pack("<I", 0))                 # PROJECTHELPCONTEXT
    out += _rec(0x0008, struct.pack("<I", 0))                 # PROJECTLIBFLAGS
    out += struct.pack("<HIIH", 0x0009, 4, 1, 0)              # PROJECTVERSION 1.0
    out += _rec(0x000C) + _rec(0x003C)                        # PROJECTCONSTANTS

    def ref_name(name):
        return _rec(0x0016, _mbcs(name)) + _rec(0x003E, _u16(name))

    for name, libid in (REF_STDOLE, REF_OFFICE):
        lib = _mbcs(libid)
        out += ref_name(name)
        out += _rec(0x000D, struct.pack("<I", len(lib)) + lib + bytes(6))
    if any(m.kind == "form" for m in modules):
        # MSForms is a control library: Office writes REFERENCEORIGINAL followed
        # by a REFERENCECONTROL that names the extended type library (.exd),
        # which VBA regenerates on the user's machine if the cached copy is absent.
        out += ref_name("MSForms")
        lib = _mbcs(MSFORMS_LIBID)
        out += struct.pack("<HI", 0x0033, len(lib)) + lib
        twiddled = _mbcs("*\\G{00000000-0000-0000-0000-000000000000}#0.0#0##")
        exd_guid = str(_stable_guid(seed, "MSForms.exd")).upper()
        extended = _mbcs(f"*\\G{{{exd_guid}}}#2.0#0#C:\\Users\\Public\\AppData\\Local\\Temp\\"
                         "Excel8.0\\MSForms.exd#Microsoft Forms 2.0 Object Library")
        part1 = struct.pack("<I", len(twiddled)) + twiddled + bytes(6)
        out += struct.pack("<HI", 0x002F, len(part1)) + part1
        out += ref_name("MSForms")
        part2 = (struct.pack("<I", len(extended)) + extended + bytes(6)
                 + MSFORMS_GUID.bytes_le + struct.pack("<I", 1))
        out += struct.pack("<HI", 0x0030, len(part2)) + part2

    out += struct.pack("<HIH", 0x000F, 2, len(modules))      # PROJECTMODULES
    out += struct.pack("<HIH", 0x0013, 2, 0xFFFF)            # PROJECTCOOKIE
    for m in modules:
        out += _rec(0x0019, _mbcs(m.name))                    # MODULENAME
        out += _rec(0x0047, _u16(m.name))                     # MODULENAMEUNICODE
        out += _rec(0x001A, _mbcs(m.name)) + _rec(0x0032, _u16(m.name))  # MODULESTREAMNAME
        out += _rec(0x001C) + _rec(0x0048)                    # MODULEDOCSTRING
        out += _rec(0x0031, struct.pack("<I", 0))             # MODULEOFFSET: source only
        out += _rec(0x001E, struct.pack("<I", 0))             # MODULEHELPCONTEXT
        out += struct.pack("<HIH", 0x002C, 2, 0xFFFF)         # MODULECOOKIE
        out += struct.pack("<HI", 0x0021 if m.kind == "standard" else 0x0022, 0)
        if m.kind == "form":
            out += struct.pack("<HI", 0x0028, 0)              # MODULEPRIVATE
        out += struct.pack("<HI", 0x002B, 0)                  # terminator
    out += struct.pack("<HI", 0x0010, 0)
    return bytes(out)


def _encrypt(project_id: str, data: bytes, seed_byte: int) -> str:
    """[MS-OVBA] 2.4.3.2 data encryption used by CMG, DPB and GC."""
    proj_key = sum(project_id.encode("cp1252")) & 0xFF
    version = 2
    seed = seed_byte & 0xFF
    version_enc = seed ^ version
    proj_key_enc = seed ^ proj_key
    out = [seed, version_enc, proj_key_enc]
    unenc1, enc1, enc2 = proj_key, proj_key_enc, version_enc
    for _ in range((seed & 6) // 2):
        temp = 0x07
        byte_enc = temp ^ ((enc2 + unenc1) & 0xFF)
        out.append(byte_enc)
        enc2, enc1, unenc1 = enc1, byte_enc, temp
    for byte in struct.pack("<I", len(data)) + data:
        byte_enc = byte ^ ((enc2 + unenc1) & 0xFF)
        out.append(byte_enc)
        enc2, enc1, unenc1 = enc1, byte_enc, byte
    return "".join(f"{b:02X}" for b in out)


def _project_stream(project_name, modules, seed):
    pid = "{" + str(_stable_guid(seed, "project")).upper() + "}"
    lines = [f'ID="{pid}"']
    for m in modules:
        if m.kind == "document":
            lines.append(f"Document={m.name}/&H00000000")
    for m in modules:
        if m.kind == "standard":
            lines.append(f"Module={m.name}")
    for m in modules:
        if m.kind == "form":
            lines.append(f"BaseClass={m.name}")
    lines += [
        f'Name="{project_name}"',
        'HelpContextID="0"',
        'VersionCompatible32="393222000"',
        f'CMG="{_encrypt(pid, bytes(4), 0x5D)}"',
        f'DPB="{_encrypt(pid, bytes(1), 0x9A)}"',
        f'GC="{_encrypt(pid, bytes([0xFF]), 0x3B)}"',
        "",
        "[Host Extender Info]",
        "&H00000001={3832D640-CF90-11CF-8E43-00A0C911005A};VBE;&H00000000",
        "",
        "[Workspace]",
    ]
    for m in modules:
        if m.kind == "form":
            lines.append(f"{m.name}=0, 0, 0, 0, C, 0, 0, 0, 0, C")
        elif m.kind == "document":
            lines.append(f"{m.name}=0, 0, 0, 0, C")
        else:
            lines.append(f"{m.name}=0, 0, 0, 0, ")
    return ("\r\n".join(lines) + "\r\n").encode("cp1252")


def _projectwm_stream(modules):
    out = bytearray()
    for m in modules:
        out += _mbcs(m.name) + b"\x00" + _u16(m.name) + b"\x00\x00"
    return bytes(out + b"\x00\x00")


# ------------------------------------------------------ [MS-OFORMS] designer

def _compobj_stream():
    """CompObjStream ([MS-OLEDS] 2.3.8) exactly as Office writes it for a form."""
    def ansi(s):
        b = s.encode("ascii") + b"\x00"
        return struct.pack("<I", len(b)) + b
    return (struct.pack("<II", 0xFFFE0001, 0x00000A03) + b"\xff\xff\xff\xff" + bytes(16)
            + ansi("Microsoft Forms 2.0 Form") + ansi("Embedded Object") + bytes(4)
            + struct.pack("<I", 0x71B239F4) + bytes(12))


def _twips(points):
    return int(round(points * 20))


def _himetric(points):
    return int(round(points * 2540 / 72))


def _vbframe_stream(m: Module):
    text = (
        "VERSION 5.00\r\n"
        f"Begin {FORMS_CLSID} {m.name} \r\n"
        f'   Caption         =   "{m.caption or m.name}"\r\n'
        f"   ClientHeight    =   {_twips(m.height_pt)}\r\n"
        "   ClientLeft      =   120\r\n"
        "   ClientTop       =   465\r\n"
        f"   ClientWidth     =   {_twips(m.width_pt)}\r\n"
        "   StartUpPosition =   1  'CenterOwner\r\n"
        "   TypeInfoVer     =   1\r\n"
        "End\r\n"
    )
    return text.encode("cp1252")


def _form_f_stream(m: Module):
    """FormControl ([MS-OFORMS] 2.2.10.1) for a form with no design-time controls.

    Same property mask as a form saved by Office (NextAvailableID, DisplayedSize,
    LogicalSize, Font, ShapeCookie, DrawBuffer) with an empty site table.
    """
    prop_mask = (1 << 3) | (1 << 10) | (1 << 11) | (1 << 20) | (1 << 26) | (1 << 27)
    data_block = (struct.pack("<I", 0)          # NextAvailableID
                  + struct.pack("<H", 0xFFFF)   # Font: MUST be 0xFFFF
                  + bytes(2)                    # padding to 4 bytes
                  + struct.pack("<I", 0)        # ShapeCookie
                  + struct.pack("<I", 32000))   # DrawBuffer
    extra = (struct.pack("<ii", _himetric(m.width_pt), _himetric(m.height_pt))   # DisplayedSize
             + struct.pack("<ii", 0, 0))                                          # LogicalSize
    cb_form = 4 + len(data_block) + len(extra)
    face = b"Tahoma"
    std_font = (uuid.UUID("0BE35203-8F91-11CE-9DE3-00AA004BB851").bytes_le
                + struct.pack("<BHBHIB", 1, 0, 0, 400, 82500, len(face)) + face)
    site_data = struct.pack("<H", 0) + struct.pack("<II", 0, 0)   # no classes, no sites
    return (struct.pack("<BBH", 0, 4, cb_form) + struct.pack("<I", prop_mask)
            + data_block + extra + std_font + site_data)


# -------------------------------------------------------------------- builder

def build_vba_project(modules, project_name="VBAProject", seed="vba") -> bytes:
    """Return the bytes of vbaProject.bin for the given modules.

    `seed` makes the project and form GUIDs deterministic, so rebuilding the
    same source gives an identical binary.
    """
    cfb = CompoundFile()
    cfb.add_stream("PROJECT", _project_stream(project_name, modules, seed))
    cfb.add_stream("PROJECTwm", _projectwm_stream(modules))
    cfb.add_stream("VBA/_VBA_PROJECT", bytes.fromhex("CC61FFFF000000"))
    cfb.add_stream("VBA/dir", compress(_dir_stream(project_name, modules, seed)))
    for m in modules:
        cfb.add_stream(f"VBA/{m.name}", compress(_module_source(m, seed)))
        if m.kind == "form":
            cfb.add_storage(m.name)
            cfb.add_stream(f"{m.name}/\x01CompObj", _compobj_stream())
            cfb.add_stream(f"{m.name}/\x03VBFrame", _vbframe_stream(m))
            cfb.add_stream(f"{m.name}/f", _form_f_stream(m))
            cfb.add_stream(f"{m.name}/o", b"")
    return cfb.tobytes()


def module_source_text(m: Module, seed="vba") -> str:
    """The exact text stored for a module (used by the verifier)."""
    return _module_source(m, seed).decode("cp1252")
