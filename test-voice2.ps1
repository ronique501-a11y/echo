Add-Type -AssemblyName System.Speech
$v = New-Object System.Speech.Synthesis.SpeechSynthesizer
Write-Host "All available voices:"
$v.GetInstalledVoices() | ForEach-Object { 
    $info = $_.VoiceInfo
    Write-Host "- $($info.Name)" 
}
Write-Host "`nTesting default voice:"
$v.Rate = -2  # Slower = more natural
$v.Speak("Hey! It's me, Echo! Your digital buddy. I've got a slightly more human sounding voice now. What do you think?")
