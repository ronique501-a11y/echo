$env:TEMP = "D:\Temp"
$env:TMP = "D:\Temp"
$env:TEMPDIR = "D:\Temp"

Set-Location D:\Echo\avatar

if (Test-Path node_modules) {
    Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
}

npm install electron --save-dev
