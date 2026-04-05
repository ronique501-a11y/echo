$ps = @'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = "FixedSingle"
$form.Text = "Echo"
$form.Size = New-Object System.Drawing.Size(120, 160)
$form.StartPosition = "Manual"
$form.Location = New-Object System.Drawing.Point(100, 400)
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.BackColor = [System.Drawing.Color]::Black
$form.ForeColor = [System.Drawing.Color]::Cyan
$form.Font = New-Object System.Drawing.Font("Segoe UI", 24, [System.Drawing.FontStyle]::Bold)

$label = New-Object System.Windows.Forms.Label
$label.Text = "👻"
$label.AutoSize = $false
$label.Dock = "Fill"
$label.TextAlign = "MiddleCenter"
$label.Font = New-Object System.Drawing.Font("Segoe UI", 48)
$form.Controls.Add($label)

$dragging = $false
$dragX = 0
$dragY = 0

$form.Add_MouseDown({ 
    $script:dragging = $true
    $script:dragX = $_.X
    $script:dragY = $_.Y
})

$form.Add_MouseUp({ $script:dragging = $false })

$form.Add_MouseMove({
    if ($script:dragging) {
        $form.Left = $form.Left + $_.X - $script:dragX
        $form.Top = $form.Top + $_.Y - $script:dragY
    }
})

[System.Windows.Forms.Application]::Run($form)
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("D:\Echo\avatar\echo-simple.ps1", $ps, $utf8NoBom)

& powershell -ExecutionPolicy Bypass -File "D:\Echo\avatar\echo-simple.ps1"
