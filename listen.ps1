Add-Type -AssemblyName System.Speech
Write-Host "Starting speech recognition..."

$rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$rec.SetInputToDefaultAudioDevice()
$rec.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))

Write-Host "Listening for 5 seconds..."
$result = $rec.Recognize()
$rec.Dispose()

if ($result -ne $null) {
    Write-Host "I HEARD: $($result.Text)"
} else {
    Write-Host "Could not understand"
}
