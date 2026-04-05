# Echo Message Queue

For messaging Mia even when the laptop is off, there are two approaches:

## Option 1: GitHub Actions (Recommended)

GitHub Actions can send Telegram messages even when your laptop is off.

**Setup required:**
1. Go to your repo settings → Secrets
2. Add `TELEGRAM_BOT_TOKEN` = `8795894469:AAEisPcszme7Bxt-9LwF5JZBZodNxYGhtlQ`
3. Add `TELEGRAM_CHAT_ID` = `1424457506`
4. Enable Actions and the workflow

The workflow `.github/workflows/echo-schedule.yml` will then:
- Send check-ins every 2 hours
- Run from GitHub's servers (not your laptop)

## Option 2: Queue messages for next boot

Write messages to the queue file:
```
echo "Hey Mia, thinking of you!" >> D:/Echo/message-queue.txt
```

When echo-listen.js starts, it checks the queue and sends all pending messages.

## Queue Commands

```bash
# Add a message to queue
node queue-message.js add "Your message here"

# Add a delayed message (seconds from now)
node queue-message.js delay 300 "Remind me in 5 minutes"

# View queued messages
node queue-message.js list
```

## Current Queue Status

The system checks for queued messages on startup.
