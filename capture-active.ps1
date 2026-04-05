Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;
public class WinCapture {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowRect(IntPtr hWnd, out Rectangle rect);
    public static Bitmap CaptureActiveWindow() {
        IntPtr hWnd = GetForegroundWindow();
        Rectangle rect;
        GetWindowRect(hWnd, out rect);
        int width = rect.Right - rect.Left;
        int height = rect.Bottom - rect.Top;
        Bitmap bmp = new Bitmap(width, height);
        Graphics g = Graphics.FromImage(bmp);
        g.CopyFromScreen(rect.Left, rect.Top, 0, 0, new Size(width, height));
        return bmp;
    }
}
"@
$bmp = [WinCapture]::CaptureActiveWindow()
$bmp.Save("D:\Echo\active-window.png")
Write-Host "Captured active window"
