Attribute VB_Name = "modImport"
'==============================================================================
' Update students from a new "All Students" export from the MIS
'
' Students are matched by UPN (or by name when a UPN is missing). Their
' details and class are updated, new students are added to their year group,
' and anyone no longer in the export is listed - never deleted. Scores are
' never touched. A summary is shown before anything changes, and the details
' go to the "Update Report" sheet.
'==============================================================================
Option Explicit

Private Const REPORT_SHEET As String = "Update Report"
Private Const FORCE_DISABLE_MACROS As Long = 3   ' msoAutomationSecurityForceDisable

Private Type Pupil
    UPN As String
    LastName As String
    FirstName As String
    YearName As String
    Sex As String
    SEN As String
    PP As String
    Att As Variant
    KS2 As Variant
    ClassName As String
End Type

Private mPupils() As Pupil
Private mCount As Long
Private mHaveAtt As Boolean
Private mHaveKS2 As Boolean
Private mHaveSex As Boolean
Private mHaveSEN As Boolean
Private mHavePP As Boolean
Private mDuplicates As Long

'==============================================================================
' Entry point (button on the Start sheet)
'==============================================================================
Public Sub UpdateStudentsFromExport()
    Dim path As Variant, data As Variant, msg As String
    Dim plan As Collection, summary As String, backup As String

#If Mac Then
    path = Application.GetOpenFilename()
#Else
    path = Application.GetOpenFilename( _
        "Excel or CSV files (*.xlsx;*.xlsm;*.xls;*.csv),*.xlsx;*.xlsm;*.xls;*.csv", , _
        "Choose the All Students export from the MIS")
#End If
    If VarType(path) = vbBoolean Then Exit Sub
    If StrComp(CStr(path), ThisWorkbook.FullName, vbTextCompare) = 0 Then
        MsgBox "Choose the student export, not this tracker.", vbExclamation, "Update students"
        Exit Sub
    End If

    msg = ReadExport(CStr(path), data)
    If Len(msg) > 0 Then
        MsgBox "Excel could not open that file: " & msg, vbExclamation, "Update students"
        Exit Sub
    End If

    msg = ReadPupils(data)
    If Len(msg) > 0 Then
        MsgBox msg, vbExclamation, "Update students"
        Exit Sub
    End If
    If mCount = 0 Then
        MsgBox "The export has no students in Years 7 to 11.", vbExclamation, "Update students"
        Exit Sub
    End If

    Set plan = New Collection
    summary = BuildPlan(plan)
    backup = BackupPath()
    msg = "Update students from " & FileNameOf(CStr(path)) & "?" & vbCrLf & vbCrLf & summary & vbCrLf & _
          "Scores are never changed. Students who are not in the export stay in the tracker " & _
          "and are listed on the Update Report sheet." & vbCrLf & vbCrLf
    If Len(backup) > 0 Then
        msg = msg & "A backup copy is saved next to this file first."
    Else
        msg = msg & "If you need to go back, use the file's version history."
    End If
    If MsgBox(msg, vbQuestion + vbYesNo, "Update students") <> vbYes Then Exit Sub

    If Len(backup) > 0 Then
        On Error Resume Next
        ThisWorkbook.SaveCopyAs backup
        If Err.Number <> 0 Then
            msg = Err.Description
            On Error GoTo 0
            If MsgBox("The backup copy could not be saved (" & msg & ")." & vbCrLf & vbCrLf & _
                      "Update the students anyway?", vbExclamation + vbYesNo + vbDefaultButton2, _
                      "Update students") <> vbYes Then Exit Sub
        End If
        On Error GoTo 0
    End If
    If ApplyPlan(plan, CStr(path)) Then
        SyncDashboard
        MsgBox "Students updated. The Update Report sheet lists every change.", vbInformation, "Update students"
    End If
End Sub

Private Function ReadExport(ByVal path As String, ByRef data As Variant) As String
    ' Reads the first sheet of the export into data; returns "" or the reason it failed.
    ' An export that is already open is read as it is and left open. Any other file
    ' is opened read-only with its macros and events switched off, then closed.
    Dim wb As Workbook, src As Workbook, security As Long, events As Boolean, opened As Boolean

    For Each wb In Application.Workbooks
        If StrComp(wb.FullName, path, vbTextCompare) = 0 Then
            Set src = wb
            Exit For
        End If
    Next wb
    events = Application.EnableEvents
    Application.ScreenUpdating = False
    On Error GoTo Fail
    If src Is Nothing Then
        Application.EnableEvents = False
        security = SwapMacroSecurity(FORCE_DISABLE_MACROS)
        Set src = Workbooks.Open(Filename:=path, ReadOnly:=True, UpdateLinks:=0, AddToMru:=False)
        opened = True
    End If
    data = src.Worksheets(1).UsedRange.Value
Done:
    On Error Resume Next
    If opened Then src.Close SaveChanges:=False
    SwapMacroSecurity security
    Application.EnableEvents = events
    Application.ScreenUpdating = True
    Exit Function
Fail:
    ReadExport = Err.Description
    Resume Done
End Function

Private Function SwapMacroSecurity(ByVal level As Long) As Long
    ' Sets the security level for files opened by code and returns the old one
    ' (0 = leave it as it is, or this version of Excel has no such setting).
    On Error Resume Next
    SwapMacroSecurity = Application.AutomationSecurity
    If level <> 0 Then Application.AutomationSecurity = level
End Function

Public Function FileNameOf(ByVal path As String) As String
    ' The last part of a path or a web address (Dir$ fails on web addresses).
    FileNameOf = Mid$(path, InStrRev(Replace(path, "\", "/"), "/") + 1)
End Function

'==============================================================================
' Read the export
'==============================================================================
Private Function ReadPupils(ByRef data As Variant) As String
    Dim hdr As Long, r As Long, lastRow As Long
    Dim cUPN As Long, cLast As Long, cFirst As Long, cYear As Long, cAtt As Long
    Dim cPP As Long, cSEN As Long, cClass As Long, cSex As Long, cMaths As Long, cRead As Long
    Dim p As Pupil, blank As Pupil, missing As String, mathsVal As Variant, readVal As Variant

    mCount = 0
    Erase mPupils
    If Not IsArray(data) Then
        ReadPupils = "The first sheet of that file is empty."
        Exit Function
    End If
    lastRow = UBound(data, 1)
    For r = 1 To IIf(lastRow < 15, lastRow, 15)
        If HeaderCol(data, r, "upn") > 0 And HeaderCol(data, r, "*last name*|*surname*") > 0 Then
            hdr = r
            Exit For
        End If
    Next r
    If hdr = 0 Then
        ReadPupils = "That file does not look like a student export: no row has both " & _
                     "a UPN and a Preferred Last name heading."
        Exit Function
    End If

    cUPN = HeaderCol(data, hdr, "upn")
    cLast = HeaderCol(data, hdr, "*last name*|*surname*")
    cFirst = HeaderCol(data, hdr, "*first name*|*forename*")
    cYear = HeaderCol(data, hdr, "year group*|year")
    cClass = HeaderCol(data, hdr, "*class*|*teaching group*")
    cAtt = HeaderCol(data, hdr, "*attendance*|att*%*")
    cPP = HeaderCol(data, hdr, "pp*|*pupil premium*|*deprivation*")
    cSEN = HeaderCol(data, hdr, "sen*")
    cSex = HeaderCol(data, hdr, "sex*|gender*")
    cMaths = HeaderCol(data, hdr, "ks2 maths*")
    cRead = HeaderCol(data, hdr, "ks2 reading*")

    If cFirst = 0 Then missing = missing & vbCrLf & "  Preferred First name"
    If cYear = 0 Then missing = missing & vbCrLf & "  Year Group Name"
    If cClass = 0 Then missing = missing & vbCrLf & "  Science-Class-Group Description"
    If Len(missing) > 0 Then
        ReadPupils = "The export is missing these columns:" & missing
        Exit Function
    End If
    mHaveAtt = (cAtt > 0)
    mHaveKS2 = (cMaths > 0 Or cRead > 0)
    mHaveSex = (cSex > 0)
    mHaveSEN = (cSEN > 0)
    mHavePP = (cPP > 0)

    ReDim mPupils(1 To lastRow)
    For r = hdr + 1 To lastRow
        p = blank
        p.YearName = YearFromText(data(r, cYear))
        p.LastName = TextOf(data(r, cLast))
        p.FirstName = TextOf(data(r, cFirst))
        If Len(p.YearName) > 0 And Len(p.LastName) > 0 And LCase$(Left$(p.LastName, 6)) <> "count:" Then
            p.UPN = TextOf(data(r, cUPN))
            p.ClassName = TextOf(data(r, cClass))
            If mHaveSex Then p.Sex = UCase$(TextOf(data(r, cSex)))
            If mHaveSEN Then p.SEN = UCase$(TextOf(data(r, cSEN)))
            If mHavePP Then p.PP = PPFlag(data(r, cPP))
            If mHaveAtt Then p.Att = NumOrEmpty(data(r, cAtt)) Else p.Att = Empty
            If mHaveKS2 Then
                mathsVal = Empty
                readVal = Empty
                If cMaths > 0 Then mathsVal = data(r, cMaths)
                If cRead > 0 Then readVal = data(r, cRead)
                p.KS2 = AvgKS2(mathsVal, readVal)
            End If
            mCount = mCount + 1
            mPupils(mCount) = p
        End If
    Next r
End Function

Private Function HeaderCol(ByRef data As Variant, ByVal r As Long, ByVal patterns As String) As Long
    ' First column whose heading matches one of the |-separated Like patterns (any case).
    Dim c As Long, h As String, pat As Variant
    For c = LBound(data, 2) To UBound(data, 2)
        h = LCase$(Trim$(TextOf(data(r, c))))
        If Len(h) > 0 Then
            For Each pat In Split(patterns, "|")
                If h Like CStr(pat) Then
                    HeaderCol = c
                    Exit Function
                End If
            Next pat
        End If
    Next c
End Function

Private Function TextOf(ByVal v As Variant) As String
    If IsError(v) Or IsEmpty(v) Or IsNull(v) Then Exit Function
    TextOf = Trim$(CStr(v))
End Function

Private Function YearFromText(ByVal v As Variant) As String
    Dim s As String, i As Long, digits As String
    s = TextOf(v)
    For i = 1 To Len(s)
        If Mid$(s, i, 1) Like "#" Then digits = digits & Mid$(s, i, 1)
    Next i
    If Len(digits) = 0 Or Len(digits) > 2 Then Exit Function
    If CLng(digits) >= 7 And CLng(digits) <= 11 Then YearFromText = "Year " & CLng(digits)
End Function

Private Function NumOrEmpty(ByVal v As Variant) As Variant
    NumOrEmpty = Empty
    If IsError(v) Or IsEmpty(v) Or IsNull(v) Then Exit Function
    If VarType(v) = vbString Then
        If Len(Trim$(v)) = 0 Then Exit Function
    End If
    If IsNumeric(v) Then NumOrEmpty = CDbl(v)
End Function

Private Function AvgKS2(ByVal maths As Variant, ByVal reading As Variant) As Variant
    ' Same rule as the generator: the mean of the scaled scores that exist.
    Dim a As Variant, b As Variant
    a = NumOrEmpty(maths)
    b = NumOrEmpty(reading)
    If IsEmpty(a) And IsEmpty(b) Then
        AvgKS2 = "No Data"
    ElseIf IsEmpty(a) Then
        AvgKS2 = b
    ElseIf IsEmpty(b) Then
        AvgKS2 = a
    Else
        AvgKS2 = (a + b) / 2
    End If
End Function

Private Function PPFlag(ByVal v As Variant) As String
    Dim s As String
    s = UCase$(TextOf(v))
    Select Case s
        Case "YES", "Y", "TRUE", "1"
            PPFlag = "Y"
        Case "NO", "N", "FALSE", "0"
            PPFlag = "N"
        Case Else
            PPFlag = s
    End Select
End Function

'==============================================================================
' Plan: work out every change before touching the workbook
'==============================================================================
Private Function BuildPlan(ByVal plan As Collection) As String
    ' plan items: "U|year|row|pupil" (update) or "N|year|0|pupil" (new) or "M|year|row|0" (missing)
    Dim y As Variant, lo As ListObject, rowCount As Long, r As Long, i As Long
    Dim byUPN As Collection, byName As Collection, seen As Collection, matched() As Boolean
    Dim upn As String, hit As Long, nNew As Long, nMoved As Long, nMissing As Long, nSame As Long
    Dim summaryLine As String, dup As Boolean

    mDuplicates = 0
    Set seen = New Collection
    For Each y In YearNames()
        Set lo = YearTable(CStr(y))
        rowCount = lo.ListRows.Count
        Set byUPN = New Collection
        Set byName = New Collection
        If rowCount > 0 Then ReDim matched(1 To rowCount) Else ReDim matched(0 To 0)
        For r = 1 To rowCount
            upn = UCase$(TextOf(TableValue(lo, r, "UPN")))
            If Len(upn) = 0 And Len(TextOf(TableValue(lo, r, "Preferred Last name"))) = 0 And _
               Len(TextOf(TableValue(lo, r, "Preferred First name"))) = 0 Then
                matched(r) = True                ' an empty row, not a student
            Else
                If Len(upn) > 0 Then KeepFirst byUPN, "U" & upn, r
                KeepFirst byName, NameKey(TextOf(TableValue(lo, r, "Preferred Last name")), _
                                           TextOf(TableValue(lo, r, "Preferred First name"))), r
            End If
        Next r

        nNew = 0
        nMoved = 0
        nMissing = 0
        nSame = 0
        For i = 1 To mCount
            dup = False
            If Len(mPupils(i).UPN) > 0 Then
                ' A UPN belongs to one student: a second row with it in the export is ignored.
                dup = (FindKey(seen, "U" & UCase$(mPupils(i).UPN)) > 0)
                If Not dup And mPupils(i).YearName = CStr(y) Then KeepFirst seen, "U" & UCase$(mPupils(i).UPN), i
                If dup And mPupils(i).YearName = CStr(y) Then mDuplicates = mDuplicates + 1
            End If
            If mPupils(i).YearName = CStr(y) And Not dup Then
                hit = 0
                If Len(mPupils(i).UPN) > 0 Then hit = FindKey(byUPN, "U" & UCase$(mPupils(i).UPN))
                If hit = 0 Then
                    hit = FindKey(byName, NameKey(mPupils(i).LastName, mPupils(i).FirstName))
                    If hit > 0 Then
                        upn = TextOf(TableValue(lo, hit, "UPN"))
                        If Len(upn) > 0 And Len(mPupils(i).UPN) > 0 And _
                           StrComp(upn, mPupils(i).UPN, vbTextCompare) <> 0 Then hit = 0
                    End If
                End If
                If hit > 0 Then
                    If matched(hit) Then hit = 0
                End If
                If hit > 0 Then
                    matched(hit) = True
                    plan.Add "U|" & y & "|" & hit & "|" & i
                    If StrComp(TextOf(TableValue(lo, hit, "Class")), mPupils(i).ClassName, vbTextCompare) <> 0 Then
                        nMoved = nMoved + 1
                    Else
                        nSame = nSame + 1
                    End If
                Else
                    plan.Add "N|" & y & "|0|" & i
                    nNew = nNew + 1
                End If
            End If
        Next i
        For r = 1 To rowCount
            If Not matched(r) Then
                plan.Add "M|" & y & "|" & r & "|0"
                nMissing = nMissing + 1
            End If
        Next r
        summaryLine = y & ": " & nNew & " new, " & nMoved & " class changes, " & nMissing & " not in the export"
        BuildPlan = BuildPlan & summaryLine & vbCrLf
    Next y
    If mDuplicates > 0 Then
        BuildPlan = BuildPlan & mDuplicates & " rows in the export repeat a UPN and are ignored." & vbCrLf
    End If
End Function

Private Sub KeepFirst(ByVal col As Collection, ByVal key As String, ByVal value As Long)
    On Error Resume Next
    col.Add value, key
    On Error GoTo 0
End Sub

Private Function FindKey(ByVal col As Collection, ByVal key As String) As Long
    On Error Resume Next
    FindKey = col(key)
    If Err.Number <> 0 Then FindKey = 0
    On Error GoTo 0
End Function

Private Function NameKey(ByVal lastName As String, ByVal firstName As String) As String
    NameKey = "N" & UCase$(Trim$(lastName)) & "|" & UCase$(Trim$(firstName))
End Function

Private Function TableValue(ByVal lo As ListObject, ByVal r As Long, ByVal colName As String) As Variant
    TableValue = lo.ListColumns(colName).DataBodyRange.Cells(r, 1).Value
End Function

'==============================================================================
' Apply the plan and write the report
'==============================================================================
Private Function ApplyPlan(ByVal plan As Collection, ByVal sourcePath As String) As Boolean
    Dim item As Variant, parts() As String, lo As ListObject, lr As ListRow
    Dim calc As Long, events As Boolean, y As Variant
    Dim moves As Collection, added As Collection, gone As Collection, p As Pupil, oldClass As String

    Set moves = New Collection
    Set added = New Collection
    Set gone = New Collection
    calc = Application.Calculation
    events = Application.EnableEvents
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual
    On Error GoTo Fail

    For Each y In YearNames()
        ClearTableFilters YearTable(CStr(y))
    Next y
    ' Updates and "missing" rows first: their row numbers were taken before any row was added.
    For Each item In plan
        parts = Split(CStr(item), "|")
        Set lo = YearTable(parts(1))
        Select Case parts(0)
            Case "U"
                Set lr = lo.ListRows(CLng(parts(2)))
                p = mPupils(CLng(parts(3)))
                oldClass = TextOf(FieldOf(lr, "Class"))
                If StrComp(oldClass, p.ClassName, vbTextCompare) <> 0 Then
                    moves.Add Array(parts(1), p.LastName & ", " & p.FirstName, p.UPN, oldClass, p.ClassName)
                End If
                WritePupil lr, p
            Case "M"
                Set lr = lo.ListRows(CLng(parts(2)))
                gone.Add Array(parts(1), TextOf(FieldOf(lr, "Preferred Last name")) & ", " & _
                               TextOf(FieldOf(lr, "Preferred First name")), TextOf(FieldOf(lr, "UPN")), _
                               TextOf(FieldOf(lr, "Class")), "")
        End Select
    Next item
    For Each item In plan
        parts = Split(CStr(item), "|")
        If parts(0) = "N" Then
            Set lo = YearTable(parts(1))
            p = mPupils(CLng(parts(3)))
            Set lr = BlankRow(lo)                ' the empty row of a year with no students yet
            If lr Is Nothing Then Set lr = lo.ListRows.Add
            WritePupil lr, p
            added.Add Array(parts(1), p.LastName & ", " & p.FirstName, p.UPN, p.ClassName, "")
        End If
    Next item
    For Each y In YearNames()
        SortByName YearTable(CStr(y))
    Next y
    WriteReport sourcePath, moves, added, gone

    Application.Calculation = calc
    Application.EnableEvents = events
    Application.ScreenUpdating = True
    ApplyPlan = True
    Exit Function
Fail:
    Application.Calculation = calc
    Application.EnableEvents = events
    Application.ScreenUpdating = True
    MsgBox "The update stopped part-way: " & Err.Description & vbCrLf & _
           "Check the year sheets, or go back to the backup / version history.", vbCritical, "Update students"
End Function

Private Function BlankRow(ByVal lo As ListObject) As ListRow
    ' First row with no UPN, no name and no numbers in it.
    Dim lr As ListRow
    For Each lr In lo.ListRows
        If Len(TextOf(FieldOf(lr, "UPN"))) = 0 And Len(TextOf(FieldOf(lr, "Preferred Last name"))) = 0 And _
           Len(TextOf(FieldOf(lr, "Preferred First name"))) = 0 Then
            If Application.WorksheetFunction.Count(lr.Range) = 0 Then
                Set BlankRow = lr
                Exit Function
            End If
        End If
    Next lr
End Function

Private Sub WritePupil(ByVal lr As ListRow, ByRef p As Pupil)
    If Len(p.UPN) > 0 Then SetCell lr, "UPN", p.UPN
    SetCell lr, "Preferred Last name", p.LastName
    SetCell lr, "Preferred First name", p.FirstName
    If mHaveSex Then SetCell lr, "Sex Code", p.Sex
    If mHaveSEN Then SetCell lr, "SEN Status Code", p.SEN
    If mHavePP Then SetCell lr, "PP Deprivation", p.PP
    If mHaveAtt Then SetCell lr, "Att%", p.Att
    If mHaveKS2 Then SetCell lr, "Avg KS2", p.KS2
    SetCell lr, "Class", p.ClassName
End Sub

Private Sub SetCell(ByVal lr As ListRow, ByVal colName As String, ByVal v As Variant)
    PutValue lr.Range.Cells(1, lr.Parent.ListColumns(colName).Index), v   ' "" clears the cell
End Sub

Private Sub SortByName(ByVal lo As ListObject)
    If lo.DataBodyRange Is Nothing Then Exit Sub
    With lo.Sort
        .SortFields.Clear
        .SortFields.Add Key:=lo.ListColumns("Preferred Last name").DataBodyRange, _
                        SortOn:=xlSortOnValues, Order:=xlAscending
        .SortFields.Add Key:=lo.ListColumns("Preferred First name").DataBodyRange, _
                        SortOn:=xlSortOnValues, Order:=xlAscending
        .Header = xlYes
        .MatchCase = False
        .Apply
    End With
End Sub

Private Function BackupPath() As String
    Dim folder As String, base As String
    folder = ThisWorkbook.Path
    If Len(folder) = 0 Or LCase$(Left$(folder, 4)) = "http" Then Exit Function
    base = ThisWorkbook.Name
    If InStrRev(base, ".") > 0 Then base = Left$(base, InStrRev(base, ".") - 1)
    BackupPath = folder & Application.PathSeparator & base & " (backup " & _
                 Format$(Now, "yyyy-mm-dd hhmm") & ").xlsm"
End Function

Private Sub WriteReport(ByVal sourcePath As String, ByVal moves As Collection, _
                        ByVal added As Collection, ByVal gone As Collection)
    Dim ws As Worksheet, r As Long
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(REPORT_SHEET)
    On Error GoTo 0
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        ws.Name = REPORT_SHEET
    End If
    ws.Cells.Clear
    ws.Range("A1").Value = "Student update report"
    ws.Range("A1").Font.Size = 14
    ws.Range("A1").Font.Bold = True
    ws.Range("A2").Value = "From " & FileNameOf(sourcePath) & " on " & Format$(Now, "dd/mm/yyyy hh:mm")
    r = 4
    r = ReportSection(ws, r, "Class changes", Array("Year group", "Student", "UPN", "From", "To"), moves)
    r = ReportSection(ws, r, "New students added", Array("Year group", "Student", "UPN", "Class", ""), added)
    r = ReportSection(ws, r, "Not in the export (kept - delete the row yourself if the student has left)", _
                      Array("Year group", "Student", "UPN", "Class", ""), gone)
    ws.Columns("A:E").AutoFit
End Sub

Private Function ReportSection(ByVal ws As Worksheet, ByVal r As Long, ByVal title As String, _
                               ByVal headers As Variant, ByVal records As Collection) As Long
    Dim item As Variant, c As Long
    ws.Cells(r, 1).Value = title & " (" & records.Count & ")"
    ws.Cells(r, 1).Font.Bold = True
    r = r + 1
    For c = 0 To UBound(headers)
        ws.Cells(r, c + 1).Value = headers(c)
        ws.Cells(r, c + 1).Font.Bold = True
    Next c
    r = r + 1
    For Each item In records
        For c = 0 To UBound(item)
            ws.Cells(r, c + 1).NumberFormat = "@"
            ws.Cells(r, c + 1).Value = item(c)
        Next c
        r = r + 1
    Next item
    ReportSection = r + 1
End Function
