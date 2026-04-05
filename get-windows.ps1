Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -First 15 Name, MainWindowTitle
