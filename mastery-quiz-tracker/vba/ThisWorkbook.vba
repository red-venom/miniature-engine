'==============================================================================
' ThisWorkbook - puts back three kinds of accidental change on the year sheets
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
'
' Manual install (only if Excel ever strips the macros): double-click
' ThisWorkbook in the project tree and paste this file into it.
'==============================================================================
Option Explicit

Private Sub Workbook_SheetChange(ByVal Sh As Object, ByVal Target As Range)
    Dim yearName As String, lo As ListObject, hit As Range, msg As String, undone As Boolean

    yearName = YearOfSheet(Sh)
    If Len(yearName) = 0 Then Exit Sub
    Set lo = YearTable(yearName)
    If lo Is Nothing Then Exit Sub
    If lo.DataBodyRange Is Nothing Then Exit Sub
    Set hit = Application.Intersect(Target, lo.DataBodyRange)
    If hit Is Nothing Then Exit Sub
    msg = ChangeProblem(lo, hit)
    If Len(msg) = 0 Then Exit Sub

    On Error Resume Next
    Application.EnableEvents = False
    Application.Undo
    undone = (Err.Number = 0)
    Application.EnableEvents = True
    On Error GoTo 0
    If undone Then
        MsgBox msg & vbCrLf & vbCrLf & "Excel has put the cells back as they were.", vbExclamation, _
               "Change undone"
    Else
        MsgBox msg & vbCrLf & vbCrLf & "Excel could not undo the change, so please put the cells " & _
               "back by hand.", vbExclamation, "Please check this change"
    End If
End Sub
