Write-Host "Testing..."
Add-Type -AssemblyName System.Speech
Write-Host "System.Speech loaded"
$r = New-Object System.Speech.Recognition.SpeechRecognitionEngine
Write-Host "Speech recognition engine created"
$r.SetInputToDefaultAudioDevice()
Write-Host "Input set to default audio device"
Write-Host "Ready to listen"
