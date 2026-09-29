'==============================================================================
' frmTests - the "Manage tests" form (UserForm code)
'
' The controls are created in UserForm_Initialize instead of being drawn in
' the form designer, so the whole form is plain, reviewable text and the
' designer surface is empty. Events from the created controls arrive through
' the WithEvents variables below.
'
' Manual install (only if Excel ever strips the macros): Insert > UserForm,
' set its (Name) to frmTests, then paste this file into the form's code.
'==============================================================================
Option Explicit

Private Const FORM_FONT As String = "Segoe UI"
Private Const INK_MUTED As Long = &H4E5152
Private Const INK_ERROR As Long = &H3B3BD0
Private Const INK_OK As Long = &H6300&
Private Const LEFT_LABEL As Single = 12
Private Const LEFT_FIELD As Single = 132
Private Const ROW_GAP As Single = 27

Private WithEvents mpTabs As MSForms.MultiPage
Private WithEvents cboAddYear As MSForms.ComboBox
Private WithEvents txtAddCode As MSForms.TextBox
Private WithEvents txtAddTitle As MSForms.TextBox
Private txtAddMax As MSForms.TextBox
Private txtAddDate As MSForms.TextBox
Private lblPreview As MSForms.Label
Private lblAddMsg As MSForms.Label
Private WithEvents btnAdd As MSForms.CommandButton
Private WithEvents btnAddClose As MSForms.CommandButton

Private WithEvents cboEditYear As MSForms.ComboBox
Private WithEvents cboEditTest As MSForms.ComboBox
Private txtEditCode As MSForms.TextBox
Private txtEditTitle As MSForms.TextBox
Private txtEditMax As MSForms.TextBox
Private txtEditDate As MSForms.TextBox
Private lblEditInfo As MSForms.Label
Private lblEditMsg As MSForms.Label
Private WithEvents btnSave As MSForms.CommandButton
Private WithEvents btnRemove As MSForms.CommandButton
Private WithEvents btnEditClose As MSForms.CommandButton

Private mReady As Boolean

'==============================================================================
' Build
'==============================================================================
Private Sub UserForm_Initialize()
    Dim y As Variant, startYear As String

    Me.Caption = "Manage tests"
    Me.Width = 404
    Me.Height = 334
    Set mpTabs = AddCtl(Me, "Forms.MultiPage.1", "mpTabs", 6, 6, Me.InsideWidth - 12, Me.InsideHeight - 12)
    Do While mpTabs.Pages.Count < 2
        mpTabs.Pages.Add
    Loop
    mpTabs.Pages(0).Caption = "Add a test"
    mpTabs.Pages(1).Caption = "Edit or remove a test"
    mpTabs.Font.Name = FORM_FONT
    mpTabs.Font.Size = 9

    BuildAddPage mpTabs.Pages(0)
    BuildEditPage mpTabs.Pages(1)

    For Each y In YearNames()
        cboAddYear.AddItem CStr(y)
        cboEditYear.AddItem CStr(y)
    Next y
    startYear = gStartYear
    If Len(startYear) = 0 Then startYear = "Year 7"
    cboAddYear.Value = startYear
    cboEditYear.Value = startYear
    txtAddDate.Text = Format$(Date, "dd\/mm\/yyyy")

    mReady = True
    mpTabs.Value = 0
    UpdatePreview
    FillTests ""
    SetDefaultButtons
End Sub

Private Sub BuildAddPage(ByVal pg As Object)
    Dim t As Single
    t = 12
    AddLabel pg, "lblAddYear", "Year group", LEFT_LABEL, t + 2, 110
    Set cboAddYear = AddCombo(pg, "cboAddYear", LEFT_FIELD, t, 120)
    t = t + ROW_GAP
    AddLabel pg, "lblAddCode", "Test code (optional)", LEFT_LABEL, t + 2, 118
    Set txtAddCode = AddText(pg, "txtAddCode", LEFT_FIELD, t, 70, 20)
    AddLabel pg, "lblAddCodeHint", "for example 4C09", LEFT_FIELD + 78, t + 2, 150, , True
    t = t + ROW_GAP
    AddLabel pg, "lblAddTitle", "Test title", LEFT_LABEL, t + 2, 110
    Set txtAddTitle = AddText(pg, "txtAddTitle", LEFT_FIELD, t, 230, 120)
    t = t + ROW_GAP
    AddLabel pg, "lblAddMax", "Maximum mark", LEFT_LABEL, t + 2, 110
    Set txtAddMax = AddText(pg, "txtAddMax", LEFT_FIELD, t, 50, 6)
    t = t + ROW_GAP
    AddLabel pg, "lblAddDate", "Date set (optional)", LEFT_LABEL, t + 2, 118
    Set txtAddDate = AddText(pg, "txtAddDate", LEFT_FIELD, t, 80, 10)
    AddLabel pg, "lblAddDateHint", "dd/mm/yyyy", LEFT_FIELD + 88, t + 2, 120, , True
    t = t + ROW_GAP + 4
    AddLabel(pg, "lblAddCols", "New columns", LEFT_LABEL, t, 110).Font.Bold = True
    Set lblPreview = AddLabel(pg, "lblPreview", "", LEFT_LABEL, t + 15, 350, 30, True)
    Set lblAddMsg = AddLabel(pg, "lblAddMsg", "", LEFT_LABEL, t + 48, 350, 28)
    Set btnAdd = AddButton(pg, "btnAdd", "Add test", 174, 226, 90)
    Set btnAddClose = AddButton(pg, "btnAddClose", "Close", 272, 226, 90)
End Sub

Private Sub BuildEditPage(ByVal pg As Object)
    Dim t As Single
    t = 12
    AddLabel pg, "lblEditYear", "Year group", LEFT_LABEL, t + 2, 110
    Set cboEditYear = AddCombo(pg, "cboEditYear", LEFT_FIELD, t, 120)
    t = t + ROW_GAP
    AddLabel pg, "lblEditTest", "Test", LEFT_LABEL, t + 2, 110
    Set cboEditTest = AddCombo(pg, "cboEditTest", LEFT_FIELD, t, 230)
    t = t + ROW_GAP
    AddLabel pg, "lblEditCode", "Test code (optional)", LEFT_LABEL, t + 2, 118
    Set txtEditCode = AddText(pg, "txtEditCode", LEFT_FIELD, t, 70, 20)
    t = t + ROW_GAP
    AddLabel pg, "lblEditTitle", "Test title", LEFT_LABEL, t + 2, 110
    Set txtEditTitle = AddText(pg, "txtEditTitle", LEFT_FIELD, t, 230, 120)
    t = t + ROW_GAP
    AddLabel pg, "lblEditMax", "Maximum mark", LEFT_LABEL, t + 2, 110
    Set txtEditMax = AddText(pg, "txtEditMax", LEFT_FIELD, t, 50, 6)
    t = t + ROW_GAP
    AddLabel pg, "lblEditDate", "Date set (optional)", LEFT_LABEL, t + 2, 118
    Set txtEditDate = AddText(pg, "txtEditDate", LEFT_FIELD, t, 80, 10)
    t = t + ROW_GAP
    Set lblEditInfo = AddLabel(pg, "lblEditInfo", "", LEFT_LABEL, t, 350, 15, True)
    Set lblEditMsg = AddLabel(pg, "lblEditMsg", "", LEFT_LABEL, t + 16, 350, 28)
    Set btnSave = AddButton(pg, "btnSave", "Save changes", 76, 226, 90)
    Set btnRemove = AddButton(pg, "btnRemove", "Remove test", 174, 226, 90)
    Set btnEditClose = AddButton(pg, "btnEditClose", "Close", 272, 226, 90)
End Sub

Private Function AddCtl(ByVal host As Object, ByVal progId As String, ByVal ctlName As String, _
                        ByVal l As Single, ByVal t As Single, ByVal w As Single, ByVal h As Single) As MSForms.Control
    Dim c As MSForms.Control
    Set c = host.Controls.Add(progId, ctlName, True)
    c.Left = l
    c.Top = t
    c.Width = w
    c.Height = h
    Set AddCtl = c
End Function

Private Function AddLabel(ByVal pg As Object, ByVal ctlName As String, ByVal cap As String, _
                          ByVal l As Single, ByVal t As Single, ByVal w As Single, _
                          Optional ByVal h As Single = 15, Optional ByVal muted As Boolean = False) As MSForms.Label
    Dim lb As MSForms.Label
    Set lb = AddCtl(pg, "Forms.Label.1", ctlName, l, t, w, h)
    lb.Caption = cap
    lb.WordWrap = True
    lb.Font.Name = FORM_FONT
    lb.Font.Size = 9
    If muted Then lb.ForeColor = INK_MUTED
    Set AddLabel = lb
End Function

Private Function AddText(ByVal pg As Object, ByVal ctlName As String, ByVal l As Single, _
                         ByVal t As Single, ByVal w As Single, ByVal maxLen As Long) As MSForms.TextBox
    Dim tb As MSForms.TextBox
    Set tb = AddCtl(pg, "Forms.TextBox.1", ctlName, l, t, w, 19)
    tb.MaxLength = maxLen
    tb.Font.Name = FORM_FONT
    tb.Font.Size = 9
    Set AddText = tb
End Function

Private Function AddCombo(ByVal pg As Object, ByVal ctlName As String, ByVal l As Single, _
                          ByVal t As Single, ByVal w As Single) As MSForms.ComboBox
    Dim cb As MSForms.ComboBox
    Set cb = AddCtl(pg, "Forms.ComboBox.1", ctlName, l, t, w, 19)
    cb.Style = fmStyleDropDownList
    cb.Font.Name = FORM_FONT
    cb.Font.Size = 9
    Set AddCombo = cb
End Function

Private Function AddButton(ByVal pg As Object, ByVal ctlName As String, ByVal cap As String, _
                           ByVal l As Single, ByVal t As Single, ByVal w As Single) As MSForms.CommandButton
    Dim b As MSForms.CommandButton
    Set b = AddCtl(pg, "Forms.CommandButton.1", ctlName, l, t, w, 24)
    b.Caption = cap
    b.Font.Name = FORM_FONT
    b.Font.Size = 9
    Set AddButton = b
End Function

Private Sub SetDefaultButtons()
    ' Enter presses the main button of the visible page; Esc closes the form.
    Dim onAdd As Boolean
    onAdd = (mpTabs.Value = 0)
    mpTabs.Pages(0).Controls("btnAdd").Default = False
    mpTabs.Pages(1).Controls("btnSave").Default = False
    mpTabs.Pages(0).Controls("btnAddClose").Cancel = False
    mpTabs.Pages(1).Controls("btnEditClose").Cancel = False
    If onAdd Then
        mpTabs.Pages(0).Controls("btnAdd").Default = True
        mpTabs.Pages(0).Controls("btnAddClose").Cancel = True
    Else
        mpTabs.Pages(1).Controls("btnSave").Default = True
        mpTabs.Pages(1).Controls("btnEditClose").Cancel = True
    End If
End Sub

Private Function ComboText(ByVal cb As MSForms.ComboBox) As String
    ' An empty list leaves Value as Null, which CStr cannot convert.
    ComboText = "" & cb.Value
End Function

Private Sub ShowMessage(ByVal lbl As MSForms.Label, ByVal msg As String, Optional ByVal good As Boolean = False)
    If good Then lbl.ForeColor = INK_OK Else lbl.ForeColor = INK_ERROR
    lbl.Caption = msg
End Sub

'==============================================================================
' Add a test
'==============================================================================
Private Sub mpTabs_Change()
    If Not mReady Then Exit Sub
    SetDefaultButtons
End Sub

Private Sub cboAddYear_Change()
    UpdatePreview
End Sub

Private Sub txtAddCode_Change()
    UpdatePreview
End Sub

Private Sub txtAddTitle_Change()
    UpdatePreview
End Sub

Private Sub UpdatePreview()
    Dim nm As String
    If Not mReady Then Exit Sub
    nm = TestNameFrom(txtAddCode.Text, txtAddTitle.Text)
    If Len(nm) = 0 Then
        lblPreview.Caption = "Type a title to see the two column headings."
    Else
        lblPreview.Caption = """" & nm & " / " & RAW_SUFFIX & """ and """ & nm & " / " & _
                             STANINE_SUFFIX & """ at the right-hand end of the " & _
                             ComboText(cboAddYear) & " table."
    End If
    lblAddMsg.Caption = ""
End Sub

Private Sub btnAdd_Click()
    Dim yr As String, nm As String, maxMark As Double, testDate As Variant, msg As String

    yr = ComboText(cboAddYear)
    nm = TestNameFrom(txtAddCode.Text, txtAddTitle.Text)
    If Len(yr) = 0 Then
        ShowMessage lblAddMsg, "Choose a year group."
        Exit Sub
    End If
    If Len(CleanText(txtAddTitle.Text)) = 0 Then
        ShowMessage lblAddMsg, "Type a title for the test."
        txtAddTitle.SetFocus
        Exit Sub
    End If
    If Not ParseMaxMark(txtAddMax.Text, maxMark) Then
        ShowMessage lblAddMsg, "Type the maximum mark as a number, for example 35."
        txtAddMax.SetFocus
        Exit Sub
    End If
    If Not ParseUkDate(txtAddDate.Text, testDate) Then
        ShowMessage lblAddMsg, "Type the date as dd/mm/yyyy, or leave the box empty."
        txtAddDate.SetFocus
        Exit Sub
    End If

    msg = AddTest(yr, txtAddCode.Text, txtAddTitle.Text, maxMark, testDate)
    If Len(msg) > 0 Then
        ShowMessage lblAddMsg, msg
        Exit Sub
    End If
    MsgBox """" & nm & """ is now on the " & yr & " sheet." & vbCrLf & vbCrLf & _
           "Type each student's mark in its Raw Score column (A = absent). The stanines, " & _
           "the register and the dashboards update by themselves.", vbInformation, "Test added"
    Unload Me
End Sub

Private Sub btnAddClose_Click()
    Unload Me
End Sub

'==============================================================================
' Edit or remove a test
'==============================================================================
Private Sub cboEditYear_Change()
    If Not mReady Then Exit Sub
    FillTests ""
End Sub

Private Sub cboEditTest_Change()
    If Not mReady Then Exit Sub
    LoadTest
End Sub

Private Sub FillTests(ByVal selectName As String)
    Dim t As Variant, tests As Collection, i As Long

    mReady = False
    cboEditTest.Clear
    Set tests = TestsForYear(ComboText(cboEditYear))
    For Each t In tests
        cboEditTest.AddItem CStr(t)
    Next t
    mReady = True
    If tests.Count = 0 Then
        ClearEditFields
        lblEditInfo.Caption = "There are no tests for " & ComboText(cboEditYear) & " yet."
        Exit Sub
    End If
    For i = 0 To cboEditTest.ListCount - 1
        If StrComp(cboEditTest.List(i), selectName, vbTextCompare) = 0 Then
            cboEditTest.ListIndex = i
            Exit Sub
        End If
    Next i
    cboEditTest.ListIndex = cboEditTest.ListCount - 1
End Sub

Private Sub ClearEditFields()
    txtEditCode.Text = ""
    txtEditTitle.Text = ""
    txtEditMax.Text = ""
    txtEditDate.Text = ""
    lblEditMsg.Caption = ""
End Sub

Private Sub LoadTest()
    Dim lr As ListRow, d As Variant, entered As Long, absent As Long
    Dim yr As String, nm As String

    yr = ComboText(cboEditYear)
    nm = ComboText(cboEditTest)
    lblEditMsg.Caption = ""
    Set lr = FindRegisterRow(yr, nm)
    If lr Is Nothing Then
        ClearEditFields
        Exit Sub
    End If
    txtEditCode.Text = CStr(FieldOf(lr, "Code"))
    txtEditTitle.Text = CStr(FieldOf(lr, "Title"))
    If Len(txtEditCode.Text) = 0 And Len(txtEditTitle.Text) = 0 Then txtEditTitle.Text = nm
    txtEditMax.Text = CStr(FieldOf(lr, "Max Marks"))
    d = FieldOf(lr, "Date")
    If IsDate(d) Then
        txtEditDate.Text = Format$(d, "dd\/mm\/yyyy")
    Else
        txtEditDate.Text = ""
    End If
    If ScoreCounts(yr, nm, entered, absent) Then
        lblEditInfo.Caption = entered & " scores entered and " & absent & " marked absent so far."
    Else
        lblEditInfo.Caption = "The columns for this test are missing from the " & yr & " sheet."
    End If
End Sub

Private Sub btnSave_Click()
    Dim yr As String, oldName As String, newName As String
    Dim maxMark As Double, testDate As Variant, msg As String

    yr = ComboText(cboEditYear)
    oldName = ComboText(cboEditTest)
    If Len(oldName) = 0 Then
        ShowMessage lblEditMsg, "Choose the test to change."
        Exit Sub
    End If
    If Len(CleanText(txtEditTitle.Text)) = 0 And Len(CleanText(txtEditCode.Text)) = 0 Then
        ShowMessage lblEditMsg, "Type a title for the test."
        Exit Sub
    End If
    If Not ParseMaxMark(txtEditMax.Text, maxMark) Then
        ShowMessage lblEditMsg, "Type the maximum mark as a number, for example 35."
        Exit Sub
    End If
    If Not ParseUkDate(txtEditDate.Text, testDate) Then
        ShowMessage lblEditMsg, "Type the date as dd/mm/yyyy, or leave the box empty."
        Exit Sub
    End If
    newName = TestNameFrom(txtEditCode.Text, txtEditTitle.Text)
    msg = EditTest(yr, oldName, txtEditCode.Text, txtEditTitle.Text, maxMark, testDate)
    If Len(msg) > 0 Then
        ShowMessage lblEditMsg, msg
        Exit Sub
    End If
    FillTests newName
    ShowMessage lblEditMsg, "Saved.", True
End Sub

Private Sub btnRemove_Click()
    Dim yr As String, nm As String, entered As Long, absent As Long, msg As String

    yr = ComboText(cboEditYear)
    nm = ComboText(cboEditTest)
    If Len(nm) = 0 Then
        ShowMessage lblEditMsg, "Choose the test to remove."
        Exit Sub
    End If
    ScoreCounts yr, nm, entered, absent
    If MsgBox("Remove """ & nm & """ from " & yr & "?" & vbCrLf & vbCrLf & _
              "This deletes its two columns, including " & entered & " scores and " & absent & _
              " absences, and its row in the register. Undo cannot bring them back.", _
              vbExclamation + vbYesNo + vbDefaultButton2, "Remove test") <> vbYes Then Exit Sub
    msg = RemoveTest(yr, nm)
    If Len(msg) > 0 Then
        ShowMessage lblEditMsg, msg
        Exit Sub
    End If
    FillTests ""
    ShowMessage lblEditMsg, """" & nm & """ was removed.", True
End Sub

Private Sub btnEditClose_Click()
    Unload Me
End Sub
