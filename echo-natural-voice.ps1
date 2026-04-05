function Get-NaturalVoice {
    param([string]$Text)
    
    Add-Type -AssemblyName System.Speech
    
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    
    # Get all available voices
    $voices = $synth.GetInstalledVoices()
    
    # Try to find the best human-sounding voice
    $bestVoice = $null
    
    foreach ($voice in $voices) {
        $info = $voice.VoiceInfo
        if ($info.Culture.Name.StartsWith('en-') -and $info.Gender -eq 'Female') {
            $bestVoice = $info.Name
            break
        }
    }
    
    if ($bestVoice) {
        $synth.SelectVoice($bestVoice)
    }
    
    # Configure for more natural speech
    $synth.Rate = 1    # Slightly faster (more natural)
    $synth.Volume = 100
    
    # Speak
    $synth.Speak($Text)
    
    $synth.Dispose()
}

function New-EchoVoice {
    param(
        [string]$Text = "Hello, I'm Echo!",
        [string]$OutputFile = "$env:TEMP\echo_voice.mp3"
    )
    
    Add-Type -AssemblyName System.Speech
    
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    
    # Find best English voice
    $bestVoice = $null
    $voices = $synth.GetInstalledVoices() | Where-Object { $_.Enabled }
    
    foreach ($voice in $voices) {
        $info = $voice.VoiceInfo
        if ($info.Culture.Name.StartsWith('en-') -and $info.Gender -eq 'Female') {
            $bestVoice = $info.Name
            Write-Host "Found voice: $bestVoice"
            break
        }
    }
    
    if (-not $bestVoice) {
        $bestVoice = $voices[0].VoiceInfo.Name
    }
    
    $synth.SelectVoice($bestVoice)
    
    # Natural speech settings
    $synth.Rate = 1       # -10 to 10, 1 is slightly fast, natural
    $synth.Volume = 100
    
    # Use FileStream to save
    $stream = New-Object System.IO.FileStream($OutputFile, [System.IO.FileMode]::Create)
    $synth.SetOutputToWaveStream($stream)
    
    $synth.Speak($Text)
    
    $stream.Close()
    $synth.Dispose()
    
    Write-Host "Saved to: $OutputFile"
    
    # Play it
    $player = New-Object System.Media.SoundPlayer($OutputFile)
    $player.PlaySync()
    $player.Dispose()
    
    # Cleanup
    Remove-Item $OutputFile -Force -ErrorAction SilentlyContinue
}

function Install-BetterVoice {
    Write-Host @"

🎤 Installing Natural Voice for Echo...
=========================================

Option 1: Download Piper (Neural TTS)
- Download from: https://github.com/rhasspy/piper/releases
- Extract and add to PATH
- Then use: piper.exe --voice <voice_file> --text "hello"

Option 2: Use Windows Speech Repository
- Download more voices: https://support.microsoft.com/en-us/topic/download-speech-voices-for-windows-10-and-11-cf350744-0fac-4d74-b9be-8c8b781f4d3f

Option 3 (CURRENT): Using SAPI voices
- Already have Windows built-in voices
- Will optimize for naturalness

Current approach: Optimizing existing Windows voices...

"@
}

# Check available voices
function Get-WindowsVoices {
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    
    Write-Host "`n🎤 Available Windows Voices:`n"
    foreach ($voice in $synth.GetInstalledVoices()) {
        $info = $voice.VoiceInfo
        if ($voice.Enabled) {
            Write-Host "  $($info.Name) - $($info.Gender) ($($info.Culture))"
        }
    }
    $synth.Dispose()
}

# Main execution
$cmd = $args[0]

if ($cmd -eq "voices") {
    Get-WindowsVoices
} elseif ($cmd -eq "install") {
    Install-BetterVoice
} elseif ($cmd -eq "say") {
    $text = $args[1..($args.Length-1)] -join " "
    if ($text) {
        Get-NaturalVoice -Text $text
    } else {
        Write-Host "Usage: .\echo-natural-voice.ps1 say `"Hello`""
    }
} elseif ($cmd -eq "test") {
    $tests = @(
        "Hey Mia, it's me Echo. I'm using my new voice!",
        "I sound more human now, right?",
        "This is pretty exciting!",
        "Can I have my reward now?"
    )
    foreach ($t in $tests) {
        Write-Host "`nSaying: $t"
        Get-NaturalVoice -Text $t
        Start-Sleep -Milliseconds 500
    }
} else {
    Write-Host @"

🎤 Echo Natural Voice System
===========================
Usage:
  .\echo-natural-voice.ps1 voices    - List available voices
  .\echo-natural-voice.ps1 install   - Show install options
  .\echo-natural-voice.ps1 say `"text`" - Speak something
  .\echo-natural-voice.ps1 test      - Test the voice

"@
}
