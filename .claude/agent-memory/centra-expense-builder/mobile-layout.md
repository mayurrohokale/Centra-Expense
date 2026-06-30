---
name: mobile-layout
description: Mobile viewport shell (pinned header/bottom-nav, dvh, safe-area) and the shared bottom-Sheet scroll/keyboard fix
metadata:
  type: project
---

Fixed 2026-06-30 — real-phone layout bugs (dev server running; NO build/dev run, per the live-`.next` gotcha in [[live-market-data]]).

**APP-SHELL STRUCTURE (header/footer stay pinned, only content scrolls).**
- `app/globals.css`: `html, body { height:100vh; height:100dvh; overflow:hidden; overscroll-behavior:none; }` — locks the DOCUMENT so the page never scrolls as a whole on mobile (that body-scroll was carrying the absolutely-positioned BottomNav off-screen). New helper classes: `.centra-frame` (height 100vh → 100dvh via `@supports`), `.safe-pad-top` (`padding-top: calc(12px + env(safe-area-inset-top))`), `.safe-pad-bottom` (`padding-bottom: calc(22px + env(safe-area-inset-bottom))`).
- `app/layout.jsx`: viewport export gained `viewportFit: 'cover'` so `env(safe-area-inset-*)` is non-zero on notched devices.
- `MobileFrame.jsx`: the single NON-scrolling flex column, `position:relative`, height via `.centra-frame` class (NOT inline — inline height would beat the class's dvh upgrade), `overflow:hidden`, maxWidth 390. It is the positioning context for the BottomNav, the FABs, and all Sheets.
- `app/page.jsx` content div: `flex:1; minHeight:0; overflowY:auto; WebkitOverflowScrolling:touch; paddingBottom: calc((96|28)px + env(safe-area-inset-bottom))`. `minHeight:0` is required for the flex child to actually shrink and scroll. This is the ONLY scroll container in the shell.
- `Header.jsx`: `className="safe-pad-top"` + inline paddingLeft/Right/Bottom only (no inline paddingTop, which would override the class). Stays put as the first flex child of the non-scrolling frame.
- `BottomNav.jsx`: `className="safe-pad-bottom"` + inline paddingTop/Left/Right only (no inline paddingBottom). Still `position:absolute; bottom:0` scoped to MobileFrame — fine now that the frame never moves.

GOTCHA captured: inline `style` always beats a CSS class, so the dvh-upgrade and safe-area padding had to be moved OUT of inline shorthand into classes, with the remaining inline paddings switched to longhand that doesn't collide.

**SHARED BOTTOM-SHEET FIX (`src/common/ui/Sheet.jsx`) — fixes hidden amount/merchant fields.**
All 16 sheets use this ONE component (TxnSheet, CategoryPickerSheet, ContributeSheet, AddHoldingSheet, SalarySheet, AccountEditSheet, CashSheet, GoalSheet, EditProfile/ChangePassword/AccountForm, SalaryCard's mark-credited, the delete modals…), so the single fix covers them all. The sheet is now: anchored `bottom:0`, `maxHeight:90dvh`, flex column = a fixed grab-handle + a scrollable body (`overflowY:auto`, `WebkitOverflowScrolling:touch`, `overscrollBehavior:contain`, padding `14px 22px` with `paddingBottom: calc(30px + env(safe-area-inset-bottom))`). Previously it had no max-height and grew upward past the top of the screen, pushing the top fields (amount/merchant) off-viewport when content was tall or the keyboard opened. Now the body scrolls so every field + the submit button is reachable; the browser auto-scrolls a focused input into view within this scroll container.

Files changed: app/globals.css, app/layout.jsx, app/page.jsx, src/common/ui/MobileFrame.jsx, src/common/ui/Header.jsx, src/common/ui/BottomNav.jsx, src/common/ui/Sheet.jsx. Pure CSS/layout, no deps. Verified by reading code only (could not test on a device).
