# Server-Side Domain Objects (`modules/php/Objects/`)

This directory contains typed PHP value objects under the `Bga\Games\BUUUUUUUS\Objects` namespace.

## Files in this Directory

- **`Card.php`**:
  - Represents a single Bus or Passenger card row from the `card` table.
  - Properties: `id` (`int`), `type` (`'bus' | 'passenger'`), `type_arg` (`int`), `location` (`string`), `location_arg` (`int`), `owner` (`?int`).
  - Helper methods:
    - `getColor()`: returns `floor($this->type_arg / 10)` (`1..4`).
    - `getArg()`: returns `$this->type_arg % 10` (bus capacity `3..5` or passenger ability `0..8`).
