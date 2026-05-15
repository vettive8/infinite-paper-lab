# Version 8.1.1

This experiment keeps `v8.1` safe, migrates its notes into a separate board, and adds pasted screenshots/images.

Changes from `v1`:

- Notes no longer wrap automatically.
- A line only breaks when Enter is pressed.
- Line spacing is more compact and closer to Windows Notepad.
- `Ctrl` + `F` opens the in-app find bar when search is closed.
- `Ctrl` + `F` closes the in-app find bar when search is already open.
- Enter jumps the viewport to the matched text, and repeated Enter cycles through matches.
- `Ctrl` + `A` inside the find input keeps its normal select-all behavior.
- Multiple tabs of `v8.1` update notes in real time on the same browser/computer.
- Each tab keeps its own view position, so moving around in one tab does not move the others.
- Hold the right mouse button and drag to select note blocks.
- Right-click a note to select just that note.
- Hold the left mouse button on a selected note and drag to move the selected notes.
- While dragging, selected notes snap to nearby note edges and centers.
- Paste a screenshot or image with `Ctrl` + `V` to add it to the visible board.
- Pasted images can be selected with right-drag and moved with selected notes.
- Press `Delete` or `Backspace` to remove selected notes/images.
- Press `Ctrl` + `Z` to undo the latest pasted image or selected-item deletion.
- On first open, this version copies existing `v8.1` notes into `v8.1.1` storage if `v8.1.1` is empty.
- Browser storage is separate from earlier versions, so each version can be tested independently.
