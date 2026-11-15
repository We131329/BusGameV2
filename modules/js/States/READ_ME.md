# Client-Side State Controllers (`modules/js/States/`)

This directory contains the JavaScript state classes registered with `this.bga.states.register()` in `Game.js`.

## Files in this Directory

- **`ActiveBus.js`**:
  - **Primary Turn Controller:** Handles the entire interactive turn flow on the client in coordination with `TurnDraftManager.js`.
  - Routes card clicks (`onCardClick`) across all turn sub-phases:
    1. Initial Bus Selection or *Star* ability activation.
    2. *Drunkard* victim selection on departing buses.
    3. *Corrupter* hand-to-board card swaps.
    4. *Penalty* card discard when no passengers boarded.
    5. *Baby* target bus selection (when 2+ matching buses are on the platform).
    6. *Waiting Room* mandatory boarding, *Hand* optional boarding, and *Garage* / *Waiting Room* hand refilling.
- **`WaitingRoom.js`**, **`TravelersHand.js`**, **`CorrupterSwap.js`**, **`DrunkardChoice.js`**, **`Penalty.js`**, **`RefillHand.js`**:
  - Individual state controllers supporting direct server-state transitions and legacy/fallback state entries.
