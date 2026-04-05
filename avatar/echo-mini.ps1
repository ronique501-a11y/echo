Add-Type -AssemblyName System.Windows.Forms

$echo = New-Object System.Windows.Forms.Form
$echo.Text = "Echo"
$echo.Size = New-Object System.Drawing.Size(150, 180)
$echo.StartPosition = "Manual"
$echo.Location = New-Object System.Drawing.Point(200, 500)
$echo.TopMost = $true
$echo.ShowInTaskbar = $false
$echo.BackColor = [System.Drawing.Color]::Black

$label = New-Object System.Windows.Forms.Label
$label.Text = "👻"
$label.AutoSize = $false
$label.Dock = "Fill"
$label.TextAlign = "MiddleCenter"
$label.Font = New-Object System.Drawing.Font("Segoe UI", 60)
$echo.Controls.Add($label)

$dragging = $false

$echo.Add_MouseDown({
    $script:dragging = $true
})

$echo.Add_MouseUp({
    $script:dragging = $false
})

$echo.Add_MouseMove({
    if ($script:dragging) {
        $this.Left = [int]($this.Left + $_.X - ($this.Width / 2))
        $this.Top = [int]($this.Top + $_.Y - ($this.Height / 2))
    }
})

[void]$echo.ShowDialog()
