Attribute VB_Name = "modTracker"
'==============================================================================
' Science Mastery Quiz Tracker - core routines
'
'   ShowManageTests      opens the Manage tests form (add / edit / remove)
'   AddTest, EditTest,   the work behind the form; each returns "" when it
'   RemoveTest           succeeds, or a message for the user when it cannot
'   GoTo...              navigation for the buttons on each sheet
'
' The workbook generator (generate_tracker.py) reads the constants in the
' "Shared with the generator" block, so a test added by this code and a test
' written by the generator get identical columns, formulas and formatting,
' and the automated checks cover both.
'==============================================================================
Option Explicit

'--- Shared with the generator: keep the names and the quoting style ----------
Public Const YEAR_LIST As String = "Year 7|Year 8|Year 9|Year 10|Year 11"
Public Const RAW_SUFFIX As String = "Raw Score"
Public Const STANINE_SUFFIX As String = "Stanine"
Public Const FIRST_TEST_COL As Long = 14
Public Const STANINE_FORMULA As String = "=IF(ISNUMBER({T}[[#This Row],[{R}]]),IFERROR(VLOOKUP(ROUND(STANDARDIZE({T}[[#This Row],[{R}]],AVERAGE({T}[[{R}]]),STDEV.P({T}[[{R}]])),9),_Stanine,2),5),"""")"
Public Const RAW_RULE As String = "=OR(UPPER({C})=""A"",AND(ISNUMBER({C}),{C}>=0,{C}<={M}))"
Public Const TEST_FILL_ODD As Long = &HFBE2CD
Public Const TEST_FILL_EVEN As Long = &HD9E0E1
Public Const HEADER_INK As Long = &H0B0B0B
Public Const STANINE_FILL As Long = &HF5F5F4
Public Const TEST_COL_WIDTH As Double = 6.7
Public Const FORMULA_COLUMNS As String = "Avg KS2 Band|Tests Sat|Mean Stanine|vs Expected"
'------------------------------------------------------------------------------

Public gStartYear As String          ' year group the form opens on

Private Const REGISTER_INPUTS As String = "Year Group|Code|Title|Test Name|Max Marks|Date"

Private Type AppState
    Calc As Long
    Screen As Boolean
    Events As Boolean
End Type

'==============================================================================
' Buttons
'==============================================================================
Public Sub ShowManageTests()
    Dim i As Long, reason As String
    gStartYear = YearOfSheet(ActiveSheet)
    If Len(gStartYear) = 0 Then gStartYear = FirstYear()
    ' Load separately so a form that cannot load or build gives a message,
    ' not the VBA debugger.
    On Error GoTo CannotOpen
    Load frmTests
    On Error GoTo 0
    frmTests.Show
    Exit Sub
CannotOpen:
    reason = Err.Description & " (error " & Err.Number & ")"
    Resume CleanUp
CleanUp:
    On Error Resume Next
    For i = VBA.UserForms.Count - 1 To 0 Step -1
        If VBA.UserForms(i).Name = "frmTests" Then Unload VBA.UserForms(i)
    Next i
    On Error GoTo 0
    MsgBox "The Manage tests form could not open." & vbCrLf & vbCrLf & _
           "Excel reported: " & reason & "." & vbCrLf & vbCrLf & _
           "A test can still be added by hand: the end of the Start sheet explains how. " & _
           "To repair the form, follow ""If Excel ever removes the macros"" in the tracker's README.", _
           vbExclamation, "Manage tests"
End Sub

Public Sub GoToStart()
    GoToSheet shStart
End Sub

Public Sub GoToOverview()
    GoToSheet shOverview
End Sub

Public Sub GoToDashboard()
    GoToSheet shDashboard
End Sub

Public Sub GoToWatchList()
    GoToSheet shWatch
End Sub

Public Sub GoToRegister()
    GoToSheet shInfo
End Sub

Public Sub GoToSettings()
    GoToSheet shSettings
End Sub

Private Sub GoToSheet(ByVal ws As Worksheet)
    If ws.Visible <> xlSheetVisible Then Exit Sub
    ws.Activate
    ws.Range("A1").Select
End Sub

'==============================================================================
' Year groups, tables and names
'==============================================================================
' Each workbook holds one year group (the generator can also put several in one file).
' Year sheets are found through their tables (tblY7 ... tblY11), not through sheet code
' names, so the same code runs in every year group's file.

Public Function YearNames() As Variant
    ' The year groups this workbook holds, in order, e.g. Array("Year 9").
    Dim y As Variant, found As String
    For Each y In Split(YEAR_LIST, "|")
        If Not YearTable(CStr(y)) Is Nothing Then found = found & "|" & y
    Next y
    YearNames = Split(Mid$(found, 2), "|")          ' an empty list when there are none
End Function

Public Function FirstYear() As String
    Dim names As Variant
    names = YearNames()
    If UBound(names) >= 0 Then FirstYear = CStr(names(0))
End Function

Public Function YearSheet(ByVal yearName As String) As Worksheet
    Dim lo As ListObject
    Set lo = YearTable(yearName)
    If Not lo Is Nothing Then Set YearSheet = lo.Parent
End Function

Public Function YearTable(ByVal yearName As String) As ListObject
    ' The table tblY9 for "Year 9", or else the first table on a sheet called "Year 9".
    Dim sh As Worksheet, lo As ListObject, named As Worksheet
    If Not yearName Like "Year #*" Then Exit Function
    For Each sh In ThisWorkbook.Worksheets
        For Each lo In sh.ListObjects
            If StrComp(lo.Name, "tblY" & Mid$(yearName, 6), vbTextCompare) = 0 Then
                Set YearTable = lo
                Exit Function
            End If
        Next lo
    Next sh
    On Error Resume Next
    Set named = ThisWorkbook.Worksheets(yearName)
    On Error GoTo 0
    If Not named Is Nothing Then
        If named.ListObjects.Count > 0 Then Set YearTable = named.ListObjects(1)
    End If
End Function

Public Function YearOfSheet(ByVal sh As Object) As String
    ' "Year 9" when sh is that year group's sheet, otherwise "". Runs on every edit (the
    ' change guard), so it looks only at this sheet's own tables.
    Dim lo As ListObject
    If TypeName(sh) <> "Worksheet" Then Exit Function
    For Each lo In sh.ListObjects
        If lo.Name Like "tblY#*" Then
            YearOfSheet = "Year " & Mid$(lo.Name, 5)
            Exit Function
        End If
    Next lo
    If sh.Name Like "Year #*" And sh.ListObjects.Count > 0 Then YearOfSheet = sh.Name
End Function

Public Function Register() As ListObject
    On Error Resume Next
    Set Register = shInfo.ListObjects("tblAssessments")
    If Register Is Nothing Then Set Register = shInfo.ListObjects(1)
    On Error GoTo 0
End Function

Public Function CleanText(ByVal s As String) As String
    ' Characters that would break table formulas or the lookup keys are removed
    ' (~ * ? act as wildcards in MATCH).
    Dim bad As Variant
    s = Replace(Replace(Replace(s, vbCr, " "), vbLf, " "), vbTab, " ")
    For Each bad In Array("[", "]", "#", "'", "@", """", "|", "~", "*", "?")
        s = Replace(s, CStr(bad), "")
    Next bad
    Do While InStr(s, "  ") > 0
        s = Replace(s, "  ", " ")
    Loop
    s = Trim$(s)
    Do While Len(s) > 0 And InStr("=+- ", Left$(s, 1)) > 0     ' would make a heading a formula
        s = Mid$(s, 2)
    Loop
    CleanText = s
End Function

Public Function TestNameFrom(ByVal code As String, ByVal title As String) As String
    code = CleanText(code)
    title = CleanText(title)
    If Len(code) > 0 And Len(title) > 0 Then
        TestNameFrom = code & " - " & title
    Else
        TestNameFrom = code & title
    End If
End Function

Public Function RawHeader(ByVal testName As String) As String
    RawHeader = testName & vbLf & RAW_SUFFIX
End Function

Public Function StanineHeader(ByVal testName As String) As String
    StanineHeader = testName & vbLf & STANINE_SUFFIX
End Function

Public Function StanineFormulaFor(ByVal tableName As String, ByVal rawName As String) As String
    StanineFormulaFor = Replace(Replace(STANINE_FORMULA, "{T}", tableName), "{R}", rawName)
End Function

Public Function FindColumn(ByVal lo As ListObject, ByVal header As String) As ListColumn
    Dim lc As ListColumn
    For Each lc In lo.ListColumns
        If StrComp(lc.Name, header, vbTextCompare) = 0 Then
            Set FindColumn = lc
            Exit Function
        End If
    Next lc
End Function

Public Function CountTests(ByVal lo As ListObject) As Long
    Dim lc As ListColumn, suffix As String
    suffix = vbLf & RAW_SUFFIX
    For Each lc In lo.ListColumns
        If Right$(lc.Name, Len(suffix)) = suffix Then CountTests = CountTests + 1
    Next lc
End Function

Public Function FieldOf(ByVal lr As ListRow, ByVal colName As String) As Variant
    FieldOf = lr.Range.Cells(1, lr.Parent.ListColumns(colName).Index).Value
End Function

Private Sub SetFieldOf(ByVal lr As ListRow, ByVal colName As String, ByVal v As Variant)
    PutValue lr.Range.Cells(1, lr.Parent.ListColumns(colName).Index), v
End Sub

Public Sub PutValue(ByVal cell As Range, ByVal v As Variant)
    ' Text is stored as text. Without the apostrophe, Excel would store the code
    ' "4.10" as 4.1 and the class "7-1" as a date. An empty string clears the cell.
    If VarType(v) = vbString Then
        If Len(v) = 0 Then
            cell.Value = Empty
        ElseIf cell.NumberFormat = "@" Then
            cell.Value = v
        Else
            cell.Value = "'" & v
        End If
    Else
        cell.Value = v
    End If
End Sub

Public Function FindRegisterRow(ByVal yearName As String, ByVal testName As String) As ListRow
    Dim lr As ListRow
    For Each lr In Register().ListRows
        If StrComp(CStr(FieldOf(lr, "Year Group")), yearName, vbTextCompare) = 0 And _
           StrComp(CStr(FieldOf(lr, "Test Name")), testName, vbTextCompare) = 0 Then
            Set FindRegisterRow = lr
            Exit Function
        End If
    Next lr
End Function

Public Function TestsForYear(ByVal yearName As String) As Collection
    ' Test names for a year group, in the order they were added.
    Dim lr As ListRow, result As New Collection, nm As String
    For Each lr In Register().ListRows
        nm = CStr(FieldOf(lr, "Test Name"))
        If Len(nm) > 0 And StrComp(CStr(FieldOf(lr, "Year Group")), yearName, vbTextCompare) = 0 Then
            result.Add nm
        End If
    Next lr
    Set TestsForYear = result
End Function

Public Function LatestTest(ByVal yearName As String) As String
    Dim tests As Collection
    Set tests = TestsForYear(yearName)
    If tests.Count > 0 Then LatestTest = tests(tests.Count)
End Function

'==============================================================================
' Input checks (used by the form)
'==============================================================================
Public Function ParseMaxMark(ByVal s As String, ByRef result As Double) As Boolean
    s = Trim$(s)
    If Len(s) = 0 Or Not IsNumeric(s) Then Exit Function
    result = CDbl(s)
    ParseMaxMark = (result > 0 And result <= 1000)
End Function

Public Function ParseUkDate(ByVal s As String, ByRef result As Variant) As Boolean
    ' Accepts d/m/yyyy, dd-mm-yy or dd.mm.yyyy; an empty box means "no date".
    Dim parts() As String, d As Long, m As Long, y As Long
    s = Trim$(Replace(Replace(s, "-", "/"), ".", "/"))
    result = Empty
    If Len(s) = 0 Then
        ParseUkDate = True
        Exit Function
    End If
    parts = Split(s, "/")
    If UBound(parts) <> 2 Then Exit Function
    If Not (IsNumeric(parts(0)) And IsNumeric(parts(1)) And IsNumeric(parts(2))) Then Exit Function
    d = CLng(parts(0))
    m = CLng(parts(1))
    y = CLng(parts(2))
    If y < 100 Then y = y + 2000
    If m < 1 Or m > 12 Or d < 1 Or d > 31 Or y < 2000 Or y > 2100 Then Exit Function
    result = DateSerial(y, m, d)
    If Day(result) <> d Then
        result = Empty
        Exit Function
    End If
    ParseUkDate = True
End Function

Public Function CheckNewName(ByVal yearName As String, ByVal newName As String, _
                             ByVal oldName As String) As String
    ' "" when newName can be used for a test in yearName (oldName = the test being edited).
    Dim lo As ListObject
    If Len(newName) = 0 Then
        CheckNewName = "Type a title for the test."
        Exit Function
    End If
    If Len(newName) > 150 Then
        CheckNewName = "Use a shorter name (150 characters at most)."
        Exit Function
    End If
    If StrComp(newName, oldName, vbTextCompare) = 0 Then Exit Function
    Set lo = YearTable(yearName)
    If Not FindColumn(lo, RawHeader(newName)) Is Nothing _
       Or Not FindColumn(lo, StanineHeader(newName)) Is Nothing _
       Or Not FindRegisterRow(yearName, newName) Is Nothing Then
        CheckNewName = yearName & " already has a test called """ & newName & """."
    End If
End Function

'==============================================================================
' Add / edit / remove
'==============================================================================
Public Function AddTest(ByVal yearName As String, ByVal code As String, ByVal title As String, _
                        ByVal maxMark As Double, ByVal testDate As Variant) As String
    Dim lo As ListObject, testName As String, msg As String, state As AppState
    Dim lcRaw As ListColumn, lcStn As ListColumn, lr As ListRow, testIndex As Long, reused As Boolean

    Set lo = YearTable(yearName)
    If lo Is Nothing Then
        AddTest = "Choose a year group."
        Exit Function
    End If
    If lo.DataBodyRange Is Nothing Then
        AddTest = yearName & " has no students yet, so a test cannot be added."
        Exit Function
    End If
    testName = TestNameFrom(code, title)
    msg = CheckNewName(yearName, testName, "")
    If Len(msg) > 0 Then
        AddTest = msg
        Exit Function
    End If

    state = PauseApp()
    On Error GoTo Fail
    testIndex = CountTests(lo) + 1
    Set lcRaw = lo.ListColumns.Add
    lcRaw.Name = RawHeader(testName)
    Set lcStn = lo.ListColumns.Add
    lcStn.Name = StanineHeader(testName)
    lcStn.DataBodyRange.Formula = StanineFormulaFor(lo.Name, lcRaw.Name)
    FormatTestColumns lcRaw, lcStn, testIndex
    Set lr = NewRegisterRow(reused)
    SetFieldOf lr, "Year Group", yearName
    SetFieldOf lr, "Code", CleanText(code)
    SetFieldOf lr, "Title", CleanText(title)
    SetFieldOf lr, "Test Name", testName
    SetFieldOf lr, "Max Marks", maxMark
    If Not IsEmpty(testDate) Then SetFieldOf lr, "Date", testDate
    ResumeApp state
    On Error GoTo Warn                   ' the test exists from here on
    ApplyRawRule lcRaw, maxMark          ' also leaves the first score cell selected
    PointDashboardAt yearName, testName
    Exit Function
Warn:
    MsgBox "The test was added, but Excel could not set its score check (0 to " & CStr(maxMark) & _
           ", or A): " & Err.Description, vbExclamation, "Add a test"
    Exit Function
Fail:
    msg = Err.Description
    UndoAdd lcRaw, lcStn, lr, reused
    ResumeApp state
    AddTest = "Excel could not add the test: " & msg
End Function

Private Sub UndoAdd(ByVal lcRaw As ListColumn, ByVal lcStn As ListColumn, ByVal lr As ListRow, _
                    ByVal reused As Boolean)
    ' Takes a half-added test out again, so that a second try can use the same name.
    Dim f As Variant
    On Error Resume Next
    If Not lcStn Is Nothing Then lcStn.Delete
    If Not lcRaw Is Nothing Then lcRaw.Delete
    If lr Is Nothing Then Exit Sub
    If reused Then
        For Each f In Split(REGISTER_INPUTS, "|")
            SetFieldOf lr, CStr(f), Empty
        Next f
    Else
        lr.Delete
    End If
End Sub

Public Function EditTest(ByVal yearName As String, ByVal oldName As String, ByVal code As String, _
                         ByVal title As String, ByVal maxMark As Double, ByVal testDate As Variant) As String
    Dim lo As ListObject, lr As ListRow, lcRaw As ListColumn, lcStn As ListColumn
    Dim newName As String, msg As String, state As AppState, renamed As Boolean, before As Variant

    Set lo = YearTable(yearName)
    Set lr = FindRegisterRow(yearName, oldName)
    If lo Is Nothing Or lr Is Nothing Then
        EditTest = "Choose the test to change."
        Exit Function
    End If
    Set lcRaw = FindColumn(lo, RawHeader(oldName))
    Set lcStn = FindColumn(lo, StanineHeader(oldName))
    If lcRaw Is Nothing Or lcStn Is Nothing Then
        EditTest = "The columns for """ & oldName & """ are missing from the " & yearName & " sheet."
        Exit Function
    End If
    newName = TestNameFrom(code, title)
    msg = CheckNewName(yearName, newName, oldName)
    If Len(msg) > 0 Then
        EditTest = msg
        Exit Function
    End If

    state = PauseApp()
    On Error GoTo Fail
    before = RegisterInputs(lr)
    If StrComp(newName, oldName, vbBinaryCompare) <> 0 Then
        ' Excel rewrites every formula that refers to a renamed table column.
        renamed = True
        lcRaw.Name = RawHeader(newName)
        lcStn.Name = StanineHeader(newName)
    End If
    SetFieldOf lr, "Code", CleanText(code)
    SetFieldOf lr, "Title", CleanText(title)
    SetFieldOf lr, "Test Name", newName
    SetFieldOf lr, "Max Marks", maxMark
    SetFieldOf lr, "Date", testDate
    ResumeApp state
    On Error GoTo Warn                   ' the change is complete from here on
    ApplyRawRule lcRaw, maxMark
    RenameOnDashboard yearName, oldName, newName
    Exit Function
Warn:
    MsgBox "The test was changed, but Excel could not update its score check (0 to " & CStr(maxMark) & _
           ", or A): " & Err.Description, vbExclamation, "Edit a test"
    Exit Function
Fail:
    msg = Err.Description
    UndoEdit lcRaw, lcStn, oldName, renamed, lr, before
    ResumeApp state
    EditTest = "Excel could not change the test: " & msg
End Function

Private Function RegisterInputs(ByVal lr As ListRow) As Variant
    ' The typed-in fields of a register row, in the order of REGISTER_INPUTS.
    Dim f As Variant, values() As Variant, i As Long
    ReDim values(0 To UBound(Split(REGISTER_INPUTS, "|")))
    For Each f In Split(REGISTER_INPUTS, "|")
        values(i) = FieldOf(lr, CStr(f))
        i = i + 1
    Next f
    RegisterInputs = values
End Function

Private Sub UndoEdit(ByVal lcRaw As ListColumn, ByVal lcStn As ListColumn, ByVal oldName As String, _
                     ByVal renamed As Boolean, ByVal lr As ListRow, ByVal before As Variant)
    ' Puts the old column names and register fields back after a failed change.
    Dim f As Variant, i As Long
    On Error Resume Next
    If renamed Then
        lcRaw.Name = RawHeader(oldName)
        lcStn.Name = StanineHeader(oldName)
    End If
    For Each f In Split(REGISTER_INPUTS, "|")
        SetFieldOf lr, CStr(f), before(i)
        i = i + 1
    Next f
End Sub

Public Function RemoveTest(ByVal yearName As String, ByVal testName As String) As String
    Dim lo As ListObject, lr As ListRow, lcRaw As ListColumn, lcStn As ListColumn
    Dim msg As String, state As AppState

    Set lo = YearTable(yearName)
    If lo Is Nothing Then
        RemoveTest = "Choose a year group."
        Exit Function
    End If
    Set lr = FindRegisterRow(yearName, testName)
    Set lcRaw = FindColumn(lo, RawHeader(testName))
    Set lcStn = FindColumn(lo, StanineHeader(testName))

    state = PauseApp()
    On Error GoTo Fail
    ClearTableFilters lo
    If Not lcStn Is Nothing Then lcStn.Delete
    If Not lcRaw Is Nothing Then lcRaw.Delete
    If Not lr Is Nothing Then lr.Delete
    ResumeApp state
    RenameOnDashboard yearName, testName, ""
    Exit Function
Fail:
    msg = Err.Description
    ResumeApp state
    RemoveTest = "Excel could not remove the test: " & msg
End Function

Public Function ScoreCounts(ByVal yearName As String, ByVal testName As String, _
                            ByRef entered As Long, ByRef absent As Long) As Boolean
    Dim lo As ListObject, lc As ListColumn, cell As Range
    entered = 0
    absent = 0
    Set lo = YearTable(yearName)
    If lo Is Nothing Then Exit Function
    Set lc = FindColumn(lo, RawHeader(testName))
    If lc Is Nothing Then Exit Function
    If lc.DataBodyRange Is Nothing Then Exit Function
    For Each cell In lc.DataBodyRange.Cells
        If IsNumeric(cell.Value) And Not IsEmpty(cell.Value) Then
            entered = entered + 1
        ElseIf UCase$(Trim$(CStr(cell.Value))) = "A" Then
            absent = absent + 1
        End If
    Next cell
    ScoreCounts = True
End Function

'==============================================================================
' Guarding the year sheets (called by Workbook_SheetChange in ThisWorkbook)
'==============================================================================
Public Function ChangeProblem(ByVal lo As ListObject, ByVal hit As Range) As String
    ' Why a change to a year table's cells must be undone, or "" when it is fine.
    Dim lc As ListColumn, part As Range, cell As Range, maxMark As Variant, names As Range
    Dim yearName As String, testName As String, suffix As String, pasted As Boolean, area As Range

    pasted = WasPaste()
    If pasted And HiddenRowIn(hit) Then
        ChangeProblem = "The pasted cells reached rows that a filter (such as the Class slicer) was " & _
                        "hiding, so they went into other students' rows." & vbCrLf & vbCrLf & _
                        "Paste one class at a time, in the same order as the sheet, or type the marks. " & _
                        "If the table has been sorted another way, sort it by Class, then surname " & _
                        "(Data > Sort), so that each class is one block again."
        Exit Function
    End If
    For Each lc In lo.ListColumns
        If IsFormulaColumn(lc.Name) Then
            Set part = Application.Intersect(hit, lc.DataBodyRange)
            If Not part Is Nothing Then
                If Not FormulasIntact(lc, part) Then
                    ChangeProblem = "The grey columns, such as """ & Replace(lc.Name, vbLf, " ") & _
                                    """, work themselves out, so they cannot be typed over, pasted " & _
                                    "over or cleared." & vbCrLf & vbCrLf & _
                                    "To remove a student who has left, right-click their row and " & _
                                    "choose Delete > Table Rows."
                    Exit Function
                End If
            End If
        End If
    Next lc
    ' A sort, or a row inserted or deleted, changes the whole width of the table. Its marks
    ' were checked when they went in, so an old problem elsewhere must not undo the sort.
    If Not pasted Then
        For Each area In hit.Areas
            If area.Columns.Count = lo.ListColumns.Count Then Exit Function
        Next area
    End If
    yearName = YearOfSheet(lo.Parent)
    suffix = vbLf & RAW_SUFFIX
    Set names = lo.ListColumns("Preferred Last name").DataBodyRange
    For Each lc In lo.ListColumns
        If Right$(lc.Name, Len(suffix)) = suffix Then
            Set part = Application.Intersect(hit, lc.DataBodyRange)
            If Not part Is Nothing Then
                testName = Left$(lc.Name, Len(lc.Name) - Len(suffix))
                maxMark = MaxMarkOf(yearName, testName)
                For Each cell In part.Cells
                    If Not IsEmpty(cell.Value) Then
                        If Not HasName(names.Cells(cell.Row - names.Row + 1, 1)) Then
                            ChangeProblem = "A mark went into a row with no student in it (row " & cell.Row & _
                                            "). This happens when pasted marks run past the end of " & _
                                            "the table." & vbCrLf & vbCrLf & "Type the student's name " & _
                                            "first, or paste a list that matches the students on the sheet."
                            Exit Function
                        End If
                    End If
                    If Not MarkIsValid(cell.Value, maxMark) Then
                        ChangeProblem = ShownValue(cell.Value) & " in " & cell.Address(False, False) & _
                                        " (" & testName & ") is not " & MarkRule(maxMark) & "." & _
                                        vbCrLf & vbCrLf & "If you pasted marks, check that they are " & _
                                        "numbers (not text or dates) and that they are in the right column."
                        Exit Function
                    End If
                Next cell
            End If
        End If
    Next lc
End Function

Private Function FormulasIntact(ByVal lc As ListColumn, ByVal part As Range) As Boolean
    ' True when every changed cell still holds the column's own formula. A calculated column
    ' has the same R1C1 formula in every row, so an untouched row shows what it should be.
    ' (HasFormula alone would pass a mixed range, which gives Null, and any other formula.)
    Dim cell As Range, ref As String, hf As Variant
    If part.Cells.Count < lc.DataBodyRange.Cells.Count Then
        For Each cell In lc.DataBodyRange.Cells
            If Application.Intersect(cell, part) Is Nothing Then
                If cell.HasFormula Then ref = cell.FormulaR1C1
                Exit For
            End If
        Next cell
    End If
    If Len(ref) = 0 Then                 ' every row changed (a sort): formulas at least
        hf = part.HasFormula
        If IsNull(hf) Then hf = False
        FormulasIntact = hf
        Exit Function
    End If
    For Each cell In part.Cells
        If cell.FormulaR1C1 <> ref Then Exit Function
    Next cell
    FormulasIntact = True
End Function

Private Function HasName(ByVal cell As Range) As Boolean
    If IsError(cell.Value) Then
        HasName = True                   ' something is there; the mark is not the problem
    Else
        HasName = (Len(Trim$(CStr(cell.Value))) > 0)
    End If
End Function

Private Function MarkRule(ByVal maxMark As Variant) As String
    If IsNumeric(maxMark) Then
        MarkRule = "a mark from 0 to " & CStr(maxMark) & ", or A for absent"
    Else
        MarkRule = "a mark of 0 or more, or A for absent"
    End If
End Function

Public Function MarkIsValid(ByVal v As Variant, ByVal maxMark As Variant) As Boolean
    ' The same rule as the cells' score check: blank, A or a (absent), or a number from 0
    ' to the maximum mark. Text that looks like a number, dates and errors are refused,
    ' because the stanine formulas would skip them.
    Select Case VarType(v)
        Case vbEmpty
            MarkIsValid = True
        Case vbString
            MarkIsValid = (UCase$(v) = "A")
        Case vbDouble, vbInteger, vbLong, vbSingle, vbCurrency, vbDecimal
            MarkIsValid = (v >= 0)
            If MarkIsValid And IsNumeric(maxMark) Then MarkIsValid = (v <= CDbl(maxMark))
    End Select
End Function

Public Function ShownValue(ByVal v As Variant) As String
    ' A cell value as the user would recognise it in a message.
    Select Case VarType(v)
        Case vbError
            ShownValue = "An error value"
        Case vbString
            ShownValue = """" & v & """ (text)"
        Case vbDate
            ShownValue = "The date " & Format$(v, "dd/mm/yyyy")
        Case vbBoolean
            ShownValue = UCase$(CStr(v))
        Case Else
            ShownValue = CStr(v)
    End Select
End Function

Public Function IsFormulaColumn(ByVal header As String) As Boolean
    Dim f As Variant
    If Right$(header, Len(STANINE_SUFFIX) + 1) = vbLf & STANINE_SUFFIX Then
        IsFormulaColumn = True
        Exit Function
    End If
    For Each f In Split(FORMULA_COLUMNS, "|")
        If StrComp(header, CStr(f), vbTextCompare) = 0 Then
            IsFormulaColumn = True
            Exit Function
        End If
    Next f
End Function

Private Function MaxMarkOf(ByVal yearName As String, ByVal testName As String) As Variant
    ' The register's maximum mark, or "any" when the test has no register row.
    Dim lr As ListRow
    MaxMarkOf = "any"
    Set lr = FindRegisterRow(yearName, testName)
    If lr Is Nothing Then Exit Function
    If IsNumeric(FieldOf(lr, "Max Marks")) And Not IsEmpty(FieldOf(lr, "Max Marks")) Then
        MaxMarkOf = CDbl(FieldOf(lr, "Max Marks"))
    End If
End Function

Private Function HiddenRowIn(ByVal rng As Range) As Boolean
    Dim area As Range, r As Range
    For Each area In rng.Areas
        If area.Rows.Count > 1 Then
            For Each r In area.Rows
                If r.EntireRow.Hidden Then
                    HiddenRowIn = True
                    Exit Function
                End If
            Next r
        End If
    Next area
End Function

Private Function WasPaste() As Boolean
    ' Excel's Undo list names the last action ("Paste", "Paste Special"), which tells a paste
    ' from a sort or a clear (Excel applies those to the visible rows only). Where the list
    ' cannot be read (Excel for Mac), a copy border still showing is the best sign of a paste.
    Dim last As String, known As Boolean
    On Error Resume Next
    last = Application.CommandBars.FindControl(ID:=128).List(1)
    known = (Err.Number = 0 And Len(last) > 0)
    On Error GoTo 0
    If known Then
        WasPaste = (LCase$(Left$(last, 5)) = "paste")
    Else
        WasPaste = (Application.CutCopyMode <> False)
    End If
End Function

Public Function ChangeCameFromUndo() As Boolean
    ' After Ctrl+Z the Redo list holds the action just undone; a new action empties it.
    On Error Resume Next
    ChangeCameFromUndo = (Application.CommandBars.FindControl(ID:=129).ListCount > 0)
End Function

'==============================================================================
' Formatting shared by every test column
'==============================================================================
Private Sub FormatTestColumns(ByVal lcRaw As ListColumn, ByVal lcStn As ListColumn, ByVal testIndex As Long)
    Dim fill As Long, lc As Variant, cf As IconSetCondition
    If testIndex Mod 2 = 1 Then fill = TEST_FILL_ODD Else fill = TEST_FILL_EVEN
    For Each lc In Array(lcRaw, lcStn)
        With lc.Range.Cells(1, 1)
            .Interior.Color = fill
            .Font.Bold = True
            .Font.Color = HEADER_INK
            .Orientation = 90
            .WrapText = True
            .HorizontalAlignment = xlCenter
            .VerticalAlignment = xlBottom
        End With
        lc.Range.EntireColumn.ColumnWidth = TEST_COL_WIDTH
        With lc.DataBodyRange
            .HorizontalAlignment = xlCenter
            .Font.Color = HEADER_INK
        End With
    Next lc
    With lcRaw.DataBodyRange             ' a new column copies the format of the column to its left
        .NumberFormat = "General"
        .Interior.Pattern = xlNone
        .FormatConditions.Delete
    End With
    With lcStn.DataBodyRange
        .NumberFormat = "0"
        .Interior.Color = STANINE_FILL
        .FormatConditions.Delete
    End With
    Set cf = lcStn.DataBodyRange.FormatConditions.AddIconSetCondition
    With cf
        .IconSet = ThisWorkbook.IconSets(xl3TrafficLights1)
        .ShowIconOnly = False
        .ReverseOrder = False
        With .IconCriteria(2)
            .Type = xlConditionValueNumber
            .Value = 4
            .Operator = xlGreaterEqual
        End With
        With .IconCriteria(3)
            .Type = xlConditionValueNumber
            .Value = 7
            .Operator = xlGreaterEqual
        End With
    End With
End Sub

Private Sub ApplyRawRule(ByVal lcRaw As ListColumn, ByVal maxMark As Double)
    ' A data-validation formula is read relative to the active cell, so the rule
    ' is written against the first score cell after selecting it.
    Dim first As Range, rule As String
    Set first = lcRaw.DataBodyRange.Cells(1, 1)
    lcRaw.Parent.Parent.Activate
    first.Select
    rule = Replace(Replace(RAW_RULE, "{C}", _
                           first.Address(False, False, Application.ReferenceStyle, False, first)), _
                   "{M}", Replace(CStr(maxMark), ",", "."))
    With lcRaw.DataBodyRange.Validation
        .Delete
        .Add Type:=xlValidateCustom, AlertStyle:=xlValidAlertStop, Formula1:=rule
        .IgnoreBlank = True
        .ShowInput = False
        .ShowError = True
        .ErrorTitle = "Score out of range"
        .ErrorMessage = "Type a mark from 0 to " & CStr(maxMark) & ", or A for absent. " & _
                        "Leave the cell blank if the student has not sat the test yet."
    End With
End Sub

Private Function NewRegisterRow(ByRef reused As Boolean) As ListRow
    ' Re-uses the empty row that a table with no tests keeps.
    Dim reg As ListObject
    Set reg = Register()
    reused = False
    If reg.ListRows.Count = 1 Then
        If Len(CStr(FieldOf(reg.ListRows(1), "Test Name"))) = 0 Then
            reused = True
            Set NewRegisterRow = reg.ListRows(1)
            Exit Function
        End If
    End If
    Set NewRegisterRow = reg.ListRows.Add
End Function

Public Sub ClearTableFilters(ByVal lo As ListObject)
    On Error Resume Next
    If Not lo.AutoFilter Is Nothing Then
        If lo.AutoFilter.FilterMode Then lo.AutoFilter.ShowAllData
    End If
    On Error GoTo 0
End Sub

'==============================================================================
' Dashboard selections follow the year group, new, renamed and removed tests
'==============================================================================
Public Sub SyncDashboard(Optional ByVal preferTest As String = "")
    ' Keeps the Test and Focus class boxes valid for the chosen year group.
    Dim yr As String, t As String, cls As String
    On Error GoTo Done
    Application.EnableEvents = False
    yr = CStr(shDashboard.Range("SelYear").Value)
    t = preferTest
    If Len(t) = 0 Then t = CStr(shDashboard.Range("SelTest").Value)
    If FindRegisterRow(yr, t) Is Nothing Then t = LatestTest(yr)
    PutValue shDashboard.Range("SelTest"), t
    cls = CStr(shDashboard.Range("SelClass").Value)
    If Not ClassInYear(yr, cls) Then PutValue shDashboard.Range("SelClass"), FirstClass(yr)
Done:
    Application.EnableEvents = True
End Sub

Public Function ClassInYear(ByVal yearName As String, ByVal cls As String) As Boolean
    ' A plain comparison: COUNTIF would read "7-1" as a date and * ? ~ as wildcards.
    Dim lo As ListObject, cell As Range
    If Len(cls) = 0 Then Exit Function
    Set lo = YearTable(yearName)
    If lo Is Nothing Then Exit Function
    If lo.DataBodyRange Is Nothing Then Exit Function
    For Each cell In lo.ListColumns("Class").DataBodyRange.Cells
        If StrComp(Trim$(CStr(cell.Value)), cls, vbTextCompare) = 0 Then
            ClassInYear = True
            Exit Function
        End If
    Next cell
End Function

Public Function FirstClass(ByVal yearName As String) As String
    ' Alphabetically first class name in the year group, as on the dashboards.
    Dim lo As ListObject, cell As Range, v As String
    Set lo = YearTable(yearName)
    If lo Is Nothing Then Exit Function
    If lo.DataBodyRange Is Nothing Then Exit Function
    For Each cell In lo.ListColumns("Class").DataBodyRange.Cells
        v = Trim$(CStr(cell.Value))
        If Len(v) > 0 Then
            If Len(FirstClass) = 0 Or StrComp(v, FirstClass, vbTextCompare) < 0 Then FirstClass = v
        End If
    Next cell
End Function

Private Sub PointDashboardAt(ByVal yearName As String, ByVal testName As String)
    On Error Resume Next
    Application.EnableEvents = False
    PutValue shDashboard.Range("SelYear"), yearName
    Application.EnableEvents = True
    SyncDashboard testName
End Sub

Private Sub RenameOnDashboard(ByVal yearName As String, ByVal oldName As String, ByVal newName As String)
    On Error Resume Next
    If StrComp(CStr(shDashboard.Range("SelYear").Value), yearName, vbTextCompare) <> 0 Then Exit Sub
    If StrComp(CStr(shDashboard.Range("SelTest").Value), oldName, vbTextCompare) <> 0 Then Exit Sub
    SyncDashboard newName
End Sub

'==============================================================================
' Application state
'==============================================================================
Private Function PauseApp() As AppState
    Dim s As AppState
    s.Calc = Application.Calculation
    s.Screen = Application.ScreenUpdating
    s.Events = Application.EnableEvents
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual
    PauseApp = s
End Function

Private Sub ResumeApp(ByRef s As AppState)
    Application.Calculation = s.Calc
    Application.EnableEvents = s.Events
    Application.ScreenUpdating = s.Screen
End Sub
