# Client-Side JavaScript (`modules/js/`)

This directory contains the client-side ES Modules (ESM) responsible for rendering the board, managing the interactive turn draft, and synchronizing notifications from the server.

## Files in this Directory

- **`Game.js`**:
  - Main game controller registered with the BGA framework.
  - Builds the DOM layout (`#my-hand-passengers`, `#my-hand-buses`, `#waiting-room`, `#platform`, `#garage`, `#departed-buses-zone`, and per-player `#passengers-zone-X` / `#unhappies-zone-X`).
  - Evaluates card eligibility and selectability at every sub-phase of a turn (`refreshTurnSelectability()`, `getEligibleWaitingRoomPassengerIds()`, `getEligibleBusesForHandCard()`, `getBusDepartureInfo()`).
  - Handles all real-time server notifications (`notif_*`) and keeps `this.gamedatas` synchronized with the live DOM.
- **`TurnDraftManager.js`**:
  - Manages the local draft state (`this.turnDraft`) and action history stack (`this.history`) during the active player's turn.
  - Provides `undo()`, `reset()`, `isTurnComplete()`, `renderTurnControls()`, and `updateVisuals()` (which calls `restoreAllDomCards()` before replaying draft moves chronologically).
- **`States/`**:
  - Client-side state handlers registered in `Game.constructor()`. See `States/READ_ME.md` for details.
