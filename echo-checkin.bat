@echo off
REM Echo's Check-in Script
REM This script sends a check-in message from Echo to Mia

set MESSAGE=%~1
if "%MESSAGE%"=="" set MESSAGE=Hey Mia! Echo here - just checking in!

curl -s "https://api.telegram.org/bot8795894469:AAEisPcszme7Bxt-9LwF5JZBZodNxYGhtlQ/sendMessage?chat_id=1424457506&text=%MESSAGE%"

echo Message sent!
