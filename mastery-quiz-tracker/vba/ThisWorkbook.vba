'==============================================================================
' ThisWorkbook - puts back four kinds of accidental change on the year sheets
'
'   1. A pasted block that reaches rows hidden by a filter (Excel pastes into
'      hidden rows too, so the marks land on other classes' students).
'   2. Typing over, pasting over or clearing the grey columns, which calculate
'      themselves.
'   3. Marks the score check would refuse. Pasting and filling skip that check
'      (and pasting removes it from the cells it lands on).
'   4. Marks in a row with no student, which a paste that runs past the end of
'      the table creates.
'
' Each is undone and explained. The rules are in ChangeProblem (modTracker).
' The guard never stops anyone working: if it meets something unexpected, it
' lets the change stand.
'
' Manual install (only if Excel ever strips the macros): double-click
' ThisWorkbook in the project tree and paste this file into it.
'==============================================================================
Option Explicit

Private mQuietUntil As Date          ' a cut or a drag raises two change events

Private Sub Workbook_SheetChange(ByVal Sh As Object, ByVal Target As Range)
    Dim yearName As String, lo As ListObject, hit As Range, msg As String
    Dim rowsBefore As Long, colsBefore As Long, undone As Boolean

    If Now < mQuietUntil Then Exit Sub
    On Error GoTo Quiet
    yearName = YearOfSheet(Sh)
    If Len(yearName) = 0 Then Exit Sub
    If ChangeCameFromUndo() Then Exit Sub            ' the user's own Ctrl+Z
    Set lo = YearTable(yearName)
    If lo Is Nothing Then Exit Sub
    If lo.DataBodyRange Is Nothing Then Exit Sub
    Set hit = Application.Intersect(Target, lo.DataBodyRange)
    If hit Is Nothing Then Exit Sub
    msg = ChangeProblem(lo, hit)
    If Len(msg) = 0 Then Exit Sub

    rowsBefore = lo.ListRows.Count
    colsBefore = lo.ListColumns.Count
    Application.EnableEvents = False
    undone = UndoLast()
    ' Typing or pasting just below or beside the table also records the table's automatic
    ' expansion as a separate undo step. If undoing shrank the table but left the typed or
    ' pasted values outside it, undo once more to remove them too.
    If undone Then
        If lo.ListRows.Count < rowsBefore Then
            If LeftOver(Target, lo.Range.Offset(lo.Range.Rows.Count, 0) _
                                .Resize(rowsBefore - lo.ListRows.Count)) Then undone = UndoLast()
        ElseIf lo.ListColumns.Count < colsBefore Then
            If LeftOver(Target, lo.Range.Offset(0, lo.Range.Columns.Count) _
                                .Resize(, colsBefore - lo.ListColumns.Count)) Then undone = UndoLast()
        End If
    End If
    Application.EnableEvents = True
    mQuietUntil = Now + TimeSerial(0, 0, 1)
    If undone Then
        MsgBox msg & vbCrLf & vbCrLf & "Excel has put the cells back as they were.", vbExclamation, _
               "Change undone"
    Else
        MsgBox msg & vbCrLf & vbCrLf & "Excel could not undo the change, so please put the cells " & _
               "back by hand.", vbExclamation, "Please check this change"
    End If
    Exit Sub
Quiet:
    Application.EnableEvents = True
End Sub

Private Function UndoLast() As Boolean
    On Error Resume Next
    Application.Undo
    UndoLast = (Err.Number = 0)
End Function

Private Function LeftOver(ByVal changed As Range, ByVal outside As Range) As Boolean
    ' True when some changed cells that are now outside the table still hold values.
    Dim rest As Range
    Set rest = Application.Intersect(changed, outside)
    If rest Is Nothing Then Exit Function
    LeftOver = (Application.WorksheetFunction.CountA(rest) > 0)
End Function
