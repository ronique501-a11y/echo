Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class EchoWin32 {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }
    public static IntPtr HWND_TOPMOST = new IntPtr(-1);
    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_NOMOVE = 0x0002;
    public const int SM_CXSCREEN = 0;
    public const int SM_CYSCREEN = 1;
}
"@

$script:posX = 100
$script:posY = 400
$script:targetX = 100
$script:targetY = 400
$script:isWalking = $false
$script:action = "idle"
$script:direction = 1
$script:walkCycle = 0
$script:isDragging = $false

function Create-EchoDrawing {
    $bmp = New-Object System.Drawing.Bitmap(100, 140)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(26, 26, 46))), 25, 0, 50, 50)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(22, 33, 62))), 30, 45, 40, 50)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(22, 33, 62))), 15, 48, 10, 30)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(22, 33, 62))), 75, 48, 10, 30)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 52, 96))), 30, 90, 15, 25)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 52, 96))), 55, 90, 15, 25)
    
    $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 255, 200))), 33, 15, 12, 14)
    $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 255, 200))), 55, 15, 12, 14)
    $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(10, 10, 10))), 36, 19, 5, 6)
    $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(10, 10, 10))), 58, 19, 5, 6)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(10, 10, 10))), 42, 35, 16, 8)
    
    $g.Dispose()
    return $bmp
}

$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = 'None'
$form.WindowState = 'Normal'
$form.BackColor = [System.Drawing.Color]::Magenta
$form.TransparencyKey = [System.Drawing.Color]::Magenta
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.AllowTransparency = $true
$form.Size = New-Object System.Drawing.Size(100, 140)
$form.Location = New-Object System.Drawing.Point($script:posX, $script:posY)
$form.Visible = $true
$form.Width = 100
$form.Height = 140
$form.Opacity = 1

[EchoWin32]::SetWindowPos($form.Handle, [EchoWin32]::HWND_TOPMOST, 0, 0, 0, 0, [EchoWin32]::SWP_NOSIZE -bor [EchoWin32]::SWP_NOMOVE)

$picture = New-Object System.Windows.Forms.PictureBox
$picture.Size = New-Object System.Drawing.Size(100, 140)
$picture.Location = New-Object System.Drawing.Point(0, 0)
$picture.Image = Create-EchoDrawing
$picture.SizeMode = 'Normal'
$picture.BackColor = [System.Drawing.Color]::Transparent
$form.Controls.Add($picture)

$bubbleForm = New-Object System.Windows.Forms.Form
$bubbleForm.FormBorderStyle = 'None'
$bubbleForm.BackColor = [System.Drawing.Color]::FromArgb(240, 26, 26, 46)
$bubbleForm.TransparencyKey = [System.Drawing.Color]::FromArgb(240, 26, 26, 46)
$bubbleForm.TopMost = $true
$bubbleForm.ShowInTaskbar = $false
$bubbleForm.AllowTransparency = $true
$bubbleForm.Size = New-Object System.Drawing.Size(200, 60)
$bubbleForm.Location = New-Object System.Drawing.Point($script:posX + 80, $script:posY - 40)
$bubbleForm.Visible = $false
$bubbleForm.Width = 200
$bubbleForm.Height = 60

$bubbleLabel = New-Object System.Windows.Forms.Label
$bubbleLabel.ForeColor = [System.Drawing.Color]::FromArgb(0, 255, 200)
$bubbleLabel.BackColor = [System.Drawing.Color]::FromArgb(240, 26, 26, 46)
$bubbleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$bubbleLabel.AutoSize = $false
$bubbleLabel.Dock = 'Fill'
$bubbleLabel.TextAlign = 'MiddleCenter'
$bubbleLabel.Text = "Hey!"
$bubbleForm.Controls.Add($bubbleLabel)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(0, 255, 200)
$statusLabel.BackColor = [System.Drawing.Color]::FromArgb(200, 26, 26, 46)
$statusLabel.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$statusLabel.AutoSize = $false
$statusLabel.Size = New-Object System.Drawing.Size(100, 20)
$statusLabel.TextAlign = 'MiddleCenter'
$statusLabel.Text = "Echo - Idle"

function Show-Bubble {
    param([string]$text, [int]$duration = 3000)
    $bubbleLabel.Text = $text
    $bubbleForm.Location = New-Object System.Drawing.Point($form.Left + 80, $form.Top - 50)
    $bubbleForm.Visible = $true
    
    if ($script:bubbleTimer) { $script:bubbleTimer.Stop() }
    $script:bubbleTimer = New-Object System.Windows.Forms.Timer
    $script:bubbleTimer.Interval = $duration
    $script:bubbleTimer.Add_Tick({
        $bubbleForm.Visible = $false
        $script:bubbleTimer.Stop()
    })
    $script:bubbleTimer.Start()
}

function Set-Action {
    param([string]$newAction)
    $script:action = $newAction
    $script:isWalking = ($newAction -ne "idle" -and $newAction -ne "sleep")
    $statusLabel.Text = "Echo - $newAction"
    
    if ($script:isWalking) {
        $script:targetX = Get-Random -Minimum 50 -Maximum ([EchoWin32]::GetSystemMetrics([EchoWin32]::SM_CXSCREEN) - 150)
        $script:targetY = Get-Random -Minimum 50 -Maximum ([EchoWin32]::GetSystemMetrics([EchoWin32]::SM_CYSCREEN) - 200)
    }
}

$form.Add_MouseDown({
    $script:isDragging = $true
    $script:dragX = $_.X
    $script:dragY = $_.Y
    Show-Bubble "Hey! 👻" 1500
})

$form.Add_MouseUp({
    $script:isDragging = $false
})

$form.Add_MouseMove({
    if ($script:isDragging) {
        $script:posX = $form.Left + $_.X - $script:dragX
        $script:posY = $form.Top + $_.Y - $script:dragY
        $form.Location = New-Object System.Drawing.Point($script:posX, $script:posY)
    }
})

$moveTimer = New-Object System.Windows.Forms.Timer
$moveTimer.Interval = 50

$moveTimer.Add_Tick({
    if ($script:isDragging) { return }
    
    if ($script:action -eq "idle") {
        if ((Get-Random -Minimum 0 -Maximum 100) -lt 3) {
            $script:targetX = Get-Random -Minimum 50 -Maximum ([EchoWin32]::GetSystemMetrics([EchoWin32]::SM_CXSCREEN) - 150)
            $script:targetY = Get-Random -Minimum 50 -Maximum ([EchoWin32]::GetSystemMetrics([EchoWin32]::SM_CYSCREEN) - 200)
            Set-Action "walk"
            Show-Bubble "Taking a walk~ 🚶" 2000
        }
    }
    
    if ($script:isWalking -and ($script:posX -ne $script:targetX -or $script:posY -ne $script:targetY)) {
        $dx = $script:targetX - $script:posX
        $dy = $script:targetY - $script:posY
        $dist = [Math]::Sqrt($dx*$dx + $dy*$dy)
        
        if ($dist -gt 3) {
            $speed = if ($script:action -eq "sneak") { 2 } elseif ($script:action -eq "chase") { 6 } else { 3 }
            
            $moveX = ($dx / $dist) * $speed
            $moveY = ($dy / $dist) * $speed
            
            $script:posX += $moveX
            $script:posY += $moveY
            
            $script:direction = if ($moveX -gt 0) { 1 } else { -1 }
            $form.Location = New-Object System.Drawing.Point([int]$script:posX, [int]$script:posY)
            
            $script:walkCycle++
            if ($script:walkCycle % 8 -eq 0) {
                $picture.Image = Create-EchoDrawing
            }
        } else {
            if ($script:action -eq "walk" -or $script:action -eq "explore" -or $script:action -eq "sneak") {
                Set-Action "idle"
                Show-Bubble "Nice walk! 😊" 2000
            }
        }
    }
    
    if ($bubbleForm.Visible) {
        $bubbleForm.Location = New-Object System.Drawing.Point($form.Left + 80, $form.Top - 50)
    }
})

$moveTimer.Start()

$script:startTimer = New-Object System.Windows.Forms.Timer
$script:startTimer.Interval = 500
$script:startTimer.Add_Tick({
    Show-Bubble "I'm alive! 👻 Drag me around!", 4000
    $script:startTimer.Stop()
})
$script:startTimer.Start()

[System.Windows.Forms.Application]::Run($form)
