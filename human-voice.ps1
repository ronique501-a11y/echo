Add-Type -AssemblyName System.Speech
$v = New-Object System.Speech.Synthesis.SpeechSynthesizer

function Say-Human($text) {
    $v.Rate = -3
    $v.Volume = 90
    
    # Break text into chunks and vary the speed/pauses
    $chunks = $text -split '([,.!?])'
    
    foreach ($chunk in $chunks) {
        if ($chunk -match '^[A-Z]') {
            $v.Rate = -2  # Slower for sentences
        } elseif ($chunk.Length -lt 3) {
            $v.Rate = -4  # Very slow for short sounds
        } else {
            $v.Rate = -3  # Normal
        }
        
        # Add random slight pitch variation
        $v.Speak($chunk)
        Start-Sleep -Milliseconds 100
    }
}

# Test phrases
Say-Human "Hey! It's Echo! Your digital buddy!"
Start-Sleep -Milliseconds 500
Say-Human "I know I sound a bit robotic... but I'm trying my best!"
Start-Sleep -Milliseconds 500  
Say-Human "What do you think? Am I getting more human yet?"
