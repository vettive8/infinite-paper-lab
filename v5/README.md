# Version 5

This experiment keeps the PDF-like find navigation from `v4` and changes how `Ctrl` + `F` behaves.

Changes from `v1`:

- Notes no longer wrap automatically.
- A line only breaks when Enter is pressed.
- Line spacing is more compact and closer to Windows Notepad.
- `Ctrl` + `F` opens the in-app find bar when search is closed.
- `Ctrl` + `F` closes the in-app find bar when search is already open.
- Enter jumps the viewport to the matched text, and repeated Enter cycles through matches.
- `Ctrl` + `A` inside the find input keeps its normal select-all behavior.
- Browser storage is separate from earlier versions, so each version can be tested independently.
