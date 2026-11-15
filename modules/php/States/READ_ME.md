# Server-Side State Classes (`modules/php/States/`)

Each file in this directory defines a state class in the `Bga\Games\BUUUUUUUS\States` namespace (replacing the legacy `states.inc.php` file).

## State Classes

| State ID | Class | Type | Purpose |
| :-: | :--- | :--- | :--- |
| **11** | `ActiveBus.php` | `ACTIVE_PLAYER` | Main turn entry state. Calculates stuck/end-of-round conditions (`getArgs`, `actTriggerEnd`) and processes full turn drafts atomically via `actConfirmTurn($actionsJson)`. |
| **12** | `WaitingRoom.php` | `ACTIVE_PLAYER` | Waiting Room boarding validation, Baby boarding priority, and zombie fallback. |
| **13** | `TravelersHand.php` | `ACTIVE_PLAYER` | Hand passenger boarding state and zombie fallback. |
| **14** | `Penalty.php` | `ACTIVE_PLAYER` | Penalty discard state when no passengers boarded during a turn. |
| **15** | `RefillHand.php` | `ACTIVE_PLAYER` | Hand refill state (up to 2 buses from Garage and 7 passengers from Waiting Room). |
| **16** | `CorrupterSwap.php` | `ACTIVE_PLAYER` | Corrupter ability card swap resolution. |
| **17** | `DrunkardChoice.php` | `ACTIVE_PLAYER` | Drunkard departure victim selection resolution. |
| **90** | `NextPlayer.php` | `GAME` | End-of-turn cleanup: compacts Waiting Room columns down to Row 4, refills Waiting Room and Garage from bottom to top, applies Baby priority, and checks Round End conditions. |
| **95** | `EndScore.php` | `GAME` | End-of-round scoring calculation (including Lovers pairs and Night Buses bonus), Round 2 setup, or transition to final game end (`99`). |
