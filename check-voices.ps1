Add-Type -AssemblyName System.Speech
$v = New-Object System.Speech.Synthesis.SpeechSynthesizer
$v.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo } | Select-Object Name, Gender, Culture
