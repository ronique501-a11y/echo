Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class PInvoke {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);
    public static IntPtr HWND_TOPMOST = new IntPtr(-1);
    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_NOMOVE = 0x0002;
}
"@

$script:posX = 200
$script:posY = 400
$script:vx = 2
$script:vy = 1.5
$script:direction = 1

$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = "None"
$form.WindowState = "Normal"
$form.BackColor = [System.Drawing.Color]::Black
$form.TransparencyKey = [System.Drawing.Color]::Black
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.Size = New-Object System.Drawing.Size(100, 120)
$form.Location = New-Object System.Drawing.Point($script:posX, $script:posY)
$form.Width = 100
$form.Height = 120

[void][PInvoke]::SetWindowPos($form.Handle, [PInvoke]::HWND_TOPMOST, 0, 0, 0, 0, [PInvoke]::SWP_NOSIZE -bor [PInvoke]::SWP_NOMOVE)

$picture = New-Object System.Windows.Forms.PictureBox
$picture.Size = New-Object System.Drawing.Size(100, 120)
$picture.Location = New-Object System.Drawing.Point(0, 0)

function Draw-Echo {
    $bmp = New-Object System.Drawing.Bitmap(100, 120)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 255, 200))), 25, 0, 50, 50)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 22, 33, 62))), 30, 45, 40, 50)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 22, 33, 62))), 15, 48, 10, 30)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 22, 33, 62))), 75, 48, 10, 30)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 52, 96))), 30, 90, 15, 25)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 52, 96))), 55, 90, 15, 25)
    
    $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 255, 200))), 33, 15, 12, 14)
    $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 255, 200))), 55, 15, 12, 14)
    $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 10, 10))), 36, 19, 5, 6)
    $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 10, 10))), 58, 19, 5, 6)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 10, 10))), 42, 35, 16, 8)
    
    $g.Dispose()
    return $bmp
}

$picture.Image = Draw-Echo
$form.Controls.Add($picture)

$script:dragging = $false

$form.Add_MouseDown({
    $script:dragging = $true
})

$form.Add_MouseUp({
    $script:dragging = $false
})

$form.Add_MouseMove({
    if ($script:dragging) {
        $script:posX = $form.Left
        $script:posY = $form.Top
    }
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 50

$timer.Add_Tick({
    if (-not $script:dragging) {
        $screenW = [PInvoke]::GetSystemMetrics(0)
        $screenH = [PInvoke]::GetSystemMetrics(1)
        
        $script:posX += $script:vx * $script:direction
        $script:posY += $script:vy
        
        if ($script:posX -le 0 -or $script:posX -ge ($screenW - 100)) {
            $script:direction *= -1
            $script:vx = [Math]::Abs($script:vx) * $script:direction
        }
        
        if ($script:posY -le 0 -or $script:posY -ge ($screenH - 120)) {
            $script:vy *= -1
        }
        
        $form.Location = New-Object System.Drawing.Point([int]$script:posX, [int]$script:posY)
    }
})

$timer.Start()
$form.Visible = $true

[System.Windows.Forms.Application]::Run($form)
