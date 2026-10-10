# Architecture rules

- Resident desktop navigation keeps its collapse state within BottomNav and synchronizes the page offset through its data attribute; this keeps all resident pages aligned without per-page layout changes.