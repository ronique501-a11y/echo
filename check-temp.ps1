$tempFolder = "C:\Users\rk\AppData\Local\Temp"
if (Test-Path $tempFolder) {
    Get-ChildItem $tempFolder -ErrorAction SilentlyContinue | 
    Sort-Object Length -Descending | 
    Select-Object -First 10 Name, @{N='SizeMB';E={[math]::Round($_.Length/1MB,2)}}
}

Write-Host "`nTotal Temp Size:"
Get-ChildItem $tempFolder -Recurse -ErrorAction SilentlyContinue | 
Measure-Object -Property Length -Sum | 
Select-Object @{N='TotalMB';E={[math]::Round($_.Sum/1MB,2)}}
