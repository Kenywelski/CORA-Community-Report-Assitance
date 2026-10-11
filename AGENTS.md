# Architecture rules

- Resident desktop navigation keeps its collapse state within BottomNav and synchronizes the page offset through its data attribute; this keeps all resident pages aligned without per-page layout changes.- Voice reporting transcribes and organizes speech in the voice-report function without storing audio; submission still goes through the normal report insert so validation, routing and status tracking stay in one path.
