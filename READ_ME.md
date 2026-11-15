# BUUUUUUUS - Board Game Arena (BGA) Implementation

## 1. Project Overview
This repository contains the official Board Game Arena (BGA) implementation of the card game **BUUUUUUUS**.  
It is built on the **Modern BGA Framework** using **PHP 8.2+ (Namespaced Class-based States)** on the server side and **JavaScript ES Modules (ESM)** with an interactive **Client-Side Turn Draft System (`TurnDraftManager`)** on the client side.

- **Developer**: Erickbond `<perickpor@hotmail.com>`

---

## 2. Technologies Used

| Layer | Technology | Role in Project |
| :--- | :--- | :--- |
| **Server-Side** | **PHP 8.2+** (Strict Types, Namespaces, Attributes) | Authoritative game rules, atomic turn confirmation (`actConfirmTurn`), deck & card management, statistics, and real-time notifications (`$this->bga->notify`). |
| **Client-Side** | **JavaScript (ES Modules / ESM)** | Interactive board rendering, client-side turn drafting (`TurnDraftManager`), full **Undo / Reset Turn** support, live DOM state evaluation, and animation promises. |
| **Styling** | **CSS3** (CSS Grid, Flexbox, Spritesheets) | Responsive layout (`buu_` namespace prefix), 2x4 Waiting Room grid, 1x4 Garage queue, expandable bus passenger stacks, and mobile adaptations. |
| **Database** | **MySQL / InnoDB** (`dbmodel.sql`) | Custom `card` table storing buses and passengers across all game zones, plus `player` and `stack` tables. |

---

## 3. Complete Project Structure & Where to Find Everything

```text
buuuuuuus/
├── dbmodel.sql                        # Database schema (card, stack, player_unhappy_points)
├── gameinfos.inc.php                  # BGA metadata (player counts, colors, studio config)
├── material.inc.php                   # Game constants (colors, passenger abilities, capacities)
├── stats.json                         # Table and player statistics definitions
├── buuuuuuus.css                      # All game styling and sprite positioning (buu_ prefix)
├── READ_ME.md                         # Main project documentation (this file)
├── img/                               # Game art assets (buses.png, passengers.png, background)
└── modules/
    ├── js/
    │   ├── READ_ME.md                 # Client-side JS architecture guide
    │   ├── Game.js                    # Main BGA client class, DOM rendering, selectability & notifications
    │   ├── TurnDraftManager.js        # Client-side Turn Draft engine (Undo, Reset, DOM replay, payload)
    │   └── States/
    │       ├── READ_ME.md             # Client state controllers guide
    │       ├── ActiveBus.js           # Primary interactive turn controller (Bus, Boarding, Abilities, Refill)
    │       ├── WaitingRoom.js         # Legacy/fallback state handler for Waiting Room boarding
    │       ├── TravelersHand.js       # Legacy/fallback state handler for Hand boarding
    │       ├── CorrupterSwap.js       # Legacy/fallback state handler for Corrupter swaps
    │       ├── DrunkardChoice.js      # Legacy/fallback state handler for Drunkard victim selection
    │       ├── Penalty.js             # Legacy/fallback state handler for Penalty discard
    │       └── RefillHand.js          # Legacy/fallback state handler for Hand refill
    └── php/
        ├── READ_ME.md                 # Server-side PHP architecture guide
        ├── Game.php                   # Main Table class, setupNewGame, getAllDatas, bus departure & Baby priority
        ├── Managers/
        │   ├── READ_ME.md             # Data managers guide
        │   ├── CardManager.php        # Database CRUD, shuffling, picking, and moving cards
        │   └── StackManager.php       # Resolution stack helper
        ├── Objects/
        │   ├── READ_ME.md             # Domain objects guide
        │   └── Card.php               # Typed Card model (id, type, type_arg, location, location_arg)
        └── States/
            ├── READ_ME.md             # Server state machine guide
            ├── ActiveBus.php          # Main turn state (ID 11) & atomic actConfirmTurn processor
            ├── WaitingRoom.php        # Waiting Room state (ID 12)
            ├── TravelersHand.php      # Hand boarding state (ID 13)
            ├── Penalty.php            # Penalty state (ID 14)
            ├── RefillHand.php         # Hand refill state (ID 15)
            ├── CorrupterSwap.php      # Corrupter ability state (ID 16)
            ├── DrunkardChoice.js.php  # Drunkard ability state (ID 17)
            ├── NextPlayer.php         # End-of-turn cleanup, queue sliding, refilling & round-end check (ID 90)
            └── EndScore.php           # End-of-round scoring, Night Buses bonus & Round 2 setup (ID 95)
```

### Quick Lookup Guide ("Where do I find...?")
- **Turn Draft, Undo & Reset Turn logic:** `modules/js/TurnDraftManager.js`
- **Which cards are selectable at each step of a turn:** `refreshTurnSelectability()` in `modules/js/Game.js`
- **Card clicks during a player's turn:** `onCardClick()` in `modules/js/States/ActiveBus.js`
- **Server-side execution of a confirmed turn:** `actConfirmTurn()` in `modules/php/States/ActiveBus.php`
- **Waiting Room & Garage sliding and refilling between turns:** `onEnteringState()` in `modules/php/States/NextPlayer.php` and `applyBabyPriority()` / `slideAndRefillGarage()` in `modules/php/Game.php`
- **Round-end detection & extra turns:** `getArgs()` / `actTriggerEnd()` in `modules/php/States/ActiveBus.php` and `NextPlayer.php`
- **Round scoring & Night Buses calculation:** `onEnteringState()` in `modules/php/States/EndScore.php`

---

## 4. Core System Architecture: Client-Side Turn Draft (`TurnDraftManager`)

To provide a fast, modern, and forgiving user experience on BGA, an entire player turn is drafted locally on the client inside the `ActiveBus` state (ID 11) before committing to the server:

1. **Chronological Draft Recording (`TurnDraftManager.js`):**
   - As the active player clicks cards, each micro-action is recorded in `this.turnDraft`:
     - `busAction`: `{ type: 'select_bus' | 'use_star', busId, starId }`
     - `boardWaitingRoom`: `[cardId, ...]`
     - `boardHand`: `[cardId, ...]` and `boardHandBusMap`: `{ [cardId]: targetBusId }`
     - `corrupterSwaps`: `[{ handCardId, targetCardId, targetBusId, afterWrCount, afterHandCount }, ...]`
     - `drunkardVictims`: `[cardId, ...]`
     - `penaltyCardId`: `cardId | null`
     - `refillCardIds`: `[cardId, ...]`
2. **Idempotent DOM Replay (`restoreAllDomCards` + `updateVisuals`):**
   - Before every visual update, `restoreAllDomCards()` returns all moved DOM cards to their start-of-turn containers (`dataset.originalParent`, `dataset.originalGridColumn`, `dataset.originalGridRow`).
   - Then `updateVisuals()` replays the recorded actions in exact chronological order, evaluating bus departures, Lover stalls, and Drunkard victim selection across all affected buses (`candidateBusIds`), and updates live player counters.
   - This makes **Undo** (single step back) and **Reset Turn** (full turn restart) 100% deterministic.
3. **Atomic Server Confirmation (`ActiveBus::actConfirmTurn`):**
   - Once `isTurnComplete()` is satisfied, the **Confirm Turn** button appears.
   - Clicking **Confirm Turn** sends the JSON payload to `ActiveBus::actConfirmTurn($actionsJson)` in PHP, which validates and executes every step in sequence, emits notifications for all players/spectators, and transitions to `NextPlayer` (ID 90).

---

## 5. Game Rules & Mechanics Reference

### Components & Encoding (`type_arg = color * 10 + arg`)
- **Colors (`floor(type_arg / 10)`):** `1` = Blue, `2` = Red, `3` = Green, `4` = Yellow.
- **Bus Deck (16 cards, `type = 'bus'`):**
  - Per color: 1x Capacity 3, 2x Capacity 4, 1x Capacity 5 (`type_arg % 10` = capacity).
- **Passenger Deck (56 cards, `type = 'passenger'`):**
  - Per color (14 cards):
    - `0` **Anonymous** (5x, cap 1): No special skill.
    - `1` **The Surfer** (1x, cap 2): Occupies 2 spaces; requires at least 2 free seats.
    - `2` **The Lovers** (2x, cap 1): Travel in pairs. If a bus reaches full capacity with an odd number of Lovers (and no General), the bus **stalls**.
    - `3` **The General** (1x, cap 1): Forces the bus to depart immediately upon boarding. Any unpaired Lover on that bus is sent to *Unhappies*.
    - `4` **The Star** (1x, cap 1): At the start of your turn, can call a matching-color bus from the *Garage* or any player's *Departed Buses* to the platform and board it.
    - `5` **The Drunkard** (1x, cap 1): When a bus containing a Drunkard departs, the active player must choose 2 passengers on that bus to go to *Unhappies*.
    - `6` **The Backpacker** (1x, cap 1): Wild color; can board any bus regardless of color.
    - `7` **The Corrupter** (1x, cap 1): Immediately upon boarding, allows swapping 1 passenger from your hand with any passenger in the *Waiting Room* or inside a bus on the *Platform* (must match bus color).
    - `8` **The Baby** (1x, cap 1):
      - **In Waiting Room:** Moves to the front of its column (Row 4). When playable in the color of the active bus, **must board the bus first** before any other playable passenger in the Waiting Room.
      - **In Hand:** On your turn during the Hand Boarding phase, can board **any bus of its color on the platform**, even if it is not the active bus.

### Turn Flow
1. **Select / Place Active Bus:** Play a bus from hand to the platform, select a non-stalled bus on the platform, or use a *Star* from hand.
2. **Waiting Room Boarding (Mandatory):** All eligible passengers at the front (Row 4) of Columns 1 and 2 must board the active bus (with *Baby* priority first).
3. **Hand Boarding (Optional):** Play eligible passengers from your hand onto the active bus (or play a *Baby* from your hand onto any matching-color bus on the platform). Multiple buses can depart in the same turn.
4. **Penalty:** If you did not use a *Star* and **0 passengers boarded** any bus during your turn, you must discard 1 card from your hand to your *Unhappies* zone.
5. **Refill Hand:** Draw buses (from the bottom of the *Garage*, Row 4) up to **2 buses**, and passengers (from anywhere in the *Waiting Room*) up to **7 passengers**. *(Skipped if your hand is completely empty, as the round ends immediately).*
6. **End of Turn (`NextPlayer`):** Remaining cards in the *Waiting Room* and *Garage* slide down toward Row 4 without gaps, empty slots are refilled from the decks from bottom to top, and *Babies* in the *Waiting Room* advance to Row 4.

### Round End & Scoring (2 Rounds)
- **Round End Conditions:**
  1. **Empty Hand (Immediate):** As soon as a player finishes their turn actions with **0 cards in hand**, the round ends immediately (even if another player had previously triggered the last-turn countdown).
  2. **Blocked Player + Empty Garage (1 Extra Turn for Others):** If the *Bus Garage* (and bus deck) is empty and a player at the start of their turn can neither place a bus nor have any passenger board (`ne peut ni poser un Bus ni faire embarquer un Voyageur`), they show their hand and every other player gets 1 final turn.
- **Scoring (`EndScore.php`):**
  - **+1 pt** per transported Passenger.
  - **+4 pts** bonus per pair of same-color Lovers transported.
  - **-1 pt** per card in *Unhappies*.
  - **-1 pt** per Passenger remaining in hand.
  - **-Capacity pts** per Bus remaining in hand.
  - **Night Buses (+1 pt):** If a player finishes the round with **0 cards in hand**, they gain +1 pt for every passenger still sitting on buses on the platform.
