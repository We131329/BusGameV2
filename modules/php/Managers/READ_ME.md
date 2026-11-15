# Server-Side Managers (`modules/php/Managers/`)

This directory contains data access and state-stack managers under the `Bga\Games\BUUUUUUUS\Managers` namespace.

## Files in this Directory

- **`CardManager.php`**:
  - Manages all database operations on the `card` table.
  - Methods: `createCards()`, `getCardsInLocation()`, `moveCard()`, `shuffle()`, `getCard()`, and `pickCard()`.
  - Returns typed `Bga\Games\BUUUUUUUS\Objects\Card` instances.
- **`StackManager.php`**:
  - Helper utility for pushing, peeking, popping, and clearing resolution atoms in the `stack` table.
