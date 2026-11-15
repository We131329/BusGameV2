# Server-Side PHP (`modules/php/`)

This directory contains the server-side PHP 8.2+ implementation using the `Bga\Games\BUUUUUUUS` namespace.

## Contents

- **`Game.php`**:
  - Main BGA `Table` subclass.
  - Initializes game state labels, statistics, and deck creation in `setupNewGame()`.
  - Provides `getAllDatas()` for client initialization and page refreshes.
  - Implements core rule helpers: `applyBabyPriority()`, `isBusStalled()`, `getBoardingError()`, `boardPassenger()`, `getBusOccupancy()`, `checkBusDeparture()`, `departBus()`, and `slideAndRefillGarage()`.
- **`Managers/`**:
  - Database and stack managers (`CardManager.php`, `StackManager.php`). See `Managers/READ_ME.md`.
- **`Objects/`**:
  - Typed data models (`Card.php`). See `Objects/READ_ME.md`.
- **`States/`**:
  - Class-based BGA state machine definitions. See `States/READ_ME.md`.
