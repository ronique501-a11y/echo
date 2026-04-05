# Setting Up GitHub Actions for Echo

GitHub Actions can send Telegram messages even when your laptop is OFF.

## Steps to Enable

### 1. Go to Your Repository
https://github.com/ronique501-a11y/echo

### 2. Go to Settings → Secrets and variables → Actions

Click "New repository secret" and add:

| Secret Name | Value |
|------------|-------|
| `TELEGRAM_BOT_TOKEN` | `8795894469:AAEisPcszme7Bxt-9LwF5JZBZodNxYGhtlQ` |
| `TELEGRAM_CHAT_ID` | `1424457506` |

### 3. Enable Actions
Go to Actions tab → click "I understand my workflows, go ahead"

### 4. The Workflow Will Run Automatically
- Sends check-in every 2 hours
- Runs from GitHub's servers (not your laptop)
- Works 24/7 even when laptop is off

## Testing

You can manually trigger it:
1. Go to Actions tab
2. Click "Echo Scheduled Message"
3. Click "Run workflow"

## Current Status

The workflow file is already committed at:
`.github/workflows/echo-schedule.yml`

It will run automatically every 2 hours once secrets are added.

---

**Note:** The bot also has its own check-ins every 2 hours when running on your laptop. The GitHub Actions is a backup for when your laptop is off.
