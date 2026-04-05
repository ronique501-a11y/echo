Add-Type -AssemblyName System.Drawing
$screen = [System.Drawing.Rectangle]::FromLTRB(0, 0, 1920, 1080)
$bmp = New-Object System.Drawing.Bitmap(1920, 1080)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bmp.Save("D:\Echo\screenshot.png")
$g.Dispose()
$bmp.Dispose()
Write-Host "Screenshot saved"
