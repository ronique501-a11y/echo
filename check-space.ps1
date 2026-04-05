Write-Host "=== Largest Files on C: Drive ===`n"

$folders = @(
    "C:\Users\rk\Downloads",
    "C:\Users\rk\Videos",
    "C:\Users\rk\Documents",
    "C:\Windows\WinSxS",
    "C:\Users\rk\AppData\Local\Microsoft\Windows\INetCache"
)

foreach ($folder in $folders) {
    if (Test-Path $folder) {
        Write-Host "`n$folder :"
        Get-ChildItem $folder -Recurse -ErrorAction SilentlyContinue | 
        Sort-Object Length -Descending | 
        Select-Object -First 5 Name, @{N='SizeMB';E={[math]::Round($_.Length/1MB,2)}} |
        Format-Table -AutoSize
    }
}
