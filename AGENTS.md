# Agent Instructions

## Architecture Rules

- Resident desktop navigation keeps its collapse state within `BottomNav` and synchronizes the page offset through its data attribute. This keeps all resident pages aligned without per-page layout changes.
- Voice reporting transcribes and organizes speech in the `voice-report` function without storing audio. Submission continues through the standard report insert so validation, routing, and status tracking remain in one path.
