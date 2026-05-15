# Version 7

This experiment keeps the live tab sync from `v6` and adds selecting and moving note blocks.

Changes from `v1`:

- Notes no longer wrap automatically.
- A line only breaks when Enter is pressed.
- Line spacing is more compact and closer to Windows Notepad.
- `Ctrl` + `F` opens the in-app find bar when search is closed.
- `Ctrl` + `F` closes the in-app find bar when search is already open.
- Enter jumps the viewport to the matched text, and repeated Enter cycles through matches.
- `Ctrl` + `A` inside the find input keeps its normal select-all behavior.
- Multiple tabs of `v7` update notes in real time on the same browser/computer.
- Each tab keeps its own view position, so moving around in one tab does not move the others.
- Hold the right mouse button and drag to select note blocks.
- Right-click a note to select just that note.
- Hold the left mouse button on a selected note and drag to move the selected notes.
- Browser storage is separate from earlier versions, so each version can be tested independently.
