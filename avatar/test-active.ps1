$exePath = "$env:TEMP\echo_avatar_$(Get-Random).ps1"

$script = @'
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class ActiveWindow {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$hwnd = [ActiveWindow]::GetForegroundWindow()
$title = New-Object System.Text.StringBuilder 256
[ActiveWindow]::GetWindowText($hwnd, $title, 256) | Out-Null
$pid = 0
[ActiveWindow]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null

$result = @{
    hwnd = $hwnd.ToInt64()
    title = $title.ToString()
    pid = $pid
}

if ($pid -gt 0) {
    try {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) { $result.process = $proc.ProcessName }
    } catch {}
}

$result | ConvertTo-Json -Compress
'@

$script | Out-File -FilePath $exePath -Encoding UTF8
powershell -NoProfile -ExecutionPolicy Bypass -File $exePath
Remove-Item $exePath -ErrorAction SilentlyContinue
