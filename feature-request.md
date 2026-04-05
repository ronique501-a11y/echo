# Feature Request: Persistent Session Memory

## Summary
Add the ability for opencode to load previous conversation context from a local file at startup, enabling continuity between sessions.

## Use Case
- Users who want AI assistant to "remember" previous conversations
- CLI-based AI companions that need persistence between sessions
- Developers wanting a lightweight alternative to database-backed memory

## Proposed Solution
Add a `--memory-file` or `--load-context` flag that:
1. Reads a specified markdown/text file before starting the chat
2. Injects the content as system context at session start
3. Optionally appends session summary to the file at end of session

## Example Usage
```bash
# Load previous context
opencode --memory-file ./my-memory.md

# Or with short flag
opencode -m ./my-memory.md
```

## Alternative
Could also support a config option in `openclaude.json`:
```json
{
  "memory": {
    "enabled": true,
    "file": "./memory.md",
    "autoSave": true
  }
}
```

## Benefits
- Simple, file-based approach - no database required
- User has full control over their data
- Works offline
- Easy to back up or share

## Priority
Medium - useful for personal AI companions and persistent CLI assistants
