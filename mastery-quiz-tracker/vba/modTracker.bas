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
    gStartYear = YearOfSheet(ActiveSheet)
    If Len(gStartYear) = 0 Then gStartYear = "Year 7"
    frmTests.Show
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
Public Function YearNames() As Variant
    YearNames = Split(YEAR_LIST, "|")
End Function

Public Function YearSheet(ByVal yearName As String) As Worksheet
    Select Case yearName
        Case "Year 7": Set YearSheet = shY7
        Case "Year 8": Set YearSheet = shY8
        Case "Year 9": Set YearSheet = shY9
        Case "Year 10": Set YearSheet = shY10
        Case "Year 11": Set YearSheet = shY11
    End Select
End Function

Public Function YearTable(ByVal yearName As String) As ListObject
    Dim ws As Worksheet
    Set ws = YearSheet(yearName)
    If ws Is Nothing Then Exit Function
    On Error Resume Next
    Set YearTable = ws.ListObjects("tblY" & Mid$(yearName, 6))
    If YearTable Is Nothing And ws.ListObjects.Count > 0 Then Set YearTable = ws.ListObjects(1)
    On Error GoTo 0
End Function

Public Function YearOfSheet(ByVal sh As Object) As String
    Dim y As Variant
    For Each y In YearNames()
        If YearSheet(CStr(y)) Is sh Then
            YearOfSheet = CStr(y)
            Exit Function
        End If
    Next y
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
    CleanText = Trim$(s)
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

    before = RegisterInputs(lr)
    state = PauseApp()
    On Error GoTo Fail
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
