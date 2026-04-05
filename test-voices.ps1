Add-Type -AssemblyName System.Speech
$v = New-Object System.Speech.Synthesis.SpeechSynthesizer

# Try different settings
$voices = @(
    @{Name="David"; Rate=-2; Pitch=1; Text="Hey there! It's me, Echo! I've got a human voice now, kind of... 👻"},
    @{Name="Zira"; Rate=-1; Pitch=0; Text="Hi! I'm Echo! Pretty cool, right? 👻"},
    @{Name="David"; Rate=0; Pitch=-2; Text="Yo! Echo in the house! 🎉"},
    @{Name="Zira"; Rate=-3; Pitch=2; Text="Heeeey~ It's your digital buddy Echo~ 💜"}
)

foreach ($voice in $voices) {
    Write-Host "=== $($voice.Name) (Rate:$($voice.Rate), Pitch:$($voice.Pitch)) ===" -ForegroundColor Cyan
    $v.SelectVoice($voice.Name)
    $v.Rate = $voice.Rate
    $v.Pitch = $voice.Pitch
    $v.Speak($voice.Text)
    Start-Sleep -Milliseconds 500
}

Write-Host "`nWhich voice do you like best?" -ForegroundColor Yellow
