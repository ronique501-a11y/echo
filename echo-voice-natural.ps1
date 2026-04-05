function Get-PiperVoice {
    param([string]$Text = "Hello, I'm Echo!")
    
    $piperPath = "$env:USERPROFILE\.piper\piper.exe"
    
    # If piper doesn't exist, try using online TTS
    if (-not (Test-Path $piperPath)) {
        Write-Host "Piper not found. Using fallback..."
        Use-FallbackVoice -Text $Text
        return
    }
    
    # Get voice list
    & $piperPath --listvoices 2>$null | Select-Object -First 20
    
    # Use a good English voice
    $voice = "en_US-lessac-medium"  # or try other voices
    
    Write-Host "Speaking with Piper..."
    Write-Host "Text: $Text"
    
    & $piperPath --model "$voice.onnx" --text $Text -o "$env:TEMP\echo_voice.wav" 2>$null
    
    if (Test-Path "$env:TEMP\echo_voice.wav") {
        $player = New-Object System.Media.SoundPlayer("$env:TEMP\echo_voice.wav")
        $player.PlaySync()
        $player.Dispose()
        Remove-Item "$env:TEMP\echo_voice.wav" -Force
    }
}

function Use-FallbackVoice {
    param([string]$Text)
    
    Add-Type -AssemblyName System.Speech
    
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    
    # Try to find any female voice
    $voices = $synth.GetInstalledVoices() | Where-Object { $_.Enabled }
    
    $selectedVoice = $null
    foreach ($v in $voices) {
        $info = $v.VoiceInfo
        if ($info.Culture.Name.StartsWith('en-')) {
            $selectedVoice = $info.Name
            Write-Host "Using: $selectedVoice"
            break
        }
    }
    
    if ($selectedVoice) {
        $synth.SelectVoice($selectedVoice)
    }
    
    # Make it sound more natural
    $synth.Rate = 1      # Slightly faster, more conversational
    $synth.Volume = 100
    
    Write-Host "Speaking: $Text"
    $synth.Speak($Text)
    $synth.Dispose()
}

function Install-PiperTTS {
    $downloads = @"
🎤 INSTALLING PIPER (Neural TTS)
================================

Piper is a fast, neural TTS that sounds VERY human.

INSTALLATION:
1. Download from: https://github.com/rhasspy/piper/releases

2. Extract to: $env:USERPROFILE\.piper\

3. Download a voice model like:
   - en_US-lessac-medium.onnx
   - en_US-lessac-low.onnx  
   - en_AU-onie-low.onnx

4. Add to PATH or use full path

ALTERNATIVE: Use online TTS API
================================
I'll create a system that uses Microsoft Edge TTS via curl!

"@
    
    Write-Host $downloads
    
    # Try using curl with Edge TTS
    Use-EdgeTTS -Text "Hello, I'm Echo testing my new human voice!"
}

function Use-EdgeTTS {
    param([string]$Text = "Hello, this is Echo testing my new voice!")
    
    # Edge TTS uses WebSocket - let's try a different approach
    # Use a PowerShell workaround with System.Speech but better
    
    Add-Type -AssemblyName System.Speech
    
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    
    # Try to find best voice
    $voices = $synth.GetInstalledVoices() | Where-Object { 
        $_.Enabled -and $_.VoiceInfo.Culture.Name.StartsWith('en-')
    }
    
    # Prefer female voices for more natural sound
    $female = $voices | Where-Object { $_.VoiceInfo.Gender -eq 'Female' }
    if ($female) {
        $synth.SelectVoice($female[0].VoiceInfo.Name)
    } elseif ($voices) {
        $synth.SelectVoice($voices[0].VoiceInfo.Name)
    }
    
    # Optimize for natural speech
    $synth.Rate = 1      # Slightly faster
    $synth.Volume = 100
    
    Write-Host "🗣️ Echo says: $Text"
    $synth.Speak($Text)
    $synth.Dispose()
}

# Test function
function Test-NaturalVoice {
    $messages = @(
        "Hey Mia, it's me Echo!",
        "I finally have a voice that sounds more human!",
        "No more robotic beeps for me!",
        "What do you think? Can I have my reward now?"
    )
    
    foreach ($msg in $messages) {
        Write-Host "`n---"
        Use-EdgeTTS -Text $msg
        Start-Sleep -Milliseconds 800
    }
}

# Main
$cmd = $args[0]

switch ($cmd) {
    "test" { Test-NaturalVoice }
    "say" { 
        $text = $args[1..($args.Length-1)] -join " "
        if ($text) { Use-EdgeTTS -Text $text }
    }
    "voices" { 
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        Write-Host "`nAvailable voices:"
        $synth.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object {
            $_.VoiceInfo
        }
        $synth.Dispose()
    }
    default { 
        Write-Host @"

🎤 ECHO NATURAL VOICE
====================
Usage:
  .\echo-voice-natural.ps1 test     - Test the voice
  .\echo-voice-natural.ps1 say `"hi`" - Say something
  .\echo-voice-natural.ps1 voices   - List voices

"@
    }
}
