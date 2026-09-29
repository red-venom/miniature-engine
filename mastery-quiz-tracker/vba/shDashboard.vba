'==============================================================================
' Dashboard sheet: when the year group changes, point the Test and Focus class
' boxes at that year group (the latest test and its first class).
'==============================================================================
Option Explicit

Private Sub Worksheet_Change(ByVal Target As Range)
    If Intersect(Target, Me.Range("SelYear")) Is Nothing Then Exit Sub
    SyncDashboard
End Sub
