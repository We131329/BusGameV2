<?php

declare(strict_types=1);

namespace Bga\Games\BUUUUUUUS\States;

use Bga\GameFramework\StateType;
use Bga\Games\BUUUUUUUS\Game;

class NextPlayer extends \Bga\GameFramework\States\GameState
{

    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: 90,
            type: StateType::GAME,
            updateGameProgression: true,
        );
    }

    /**
     * Game state action, example content.
     *
     * The onEnteringState method of state `nextPlayer` is called everytime the current game state is set to `nextPlayer`.
     */
    function onEnteringState(int $activePlayerId) {

        // 1. Cleanup Waiting Room: deterministically compact each column down towards row 4
        $moved = false;
        for ($col = 1; $col <= 2; $col++) {
            $minPos = $col * 10;
            $maxPos = $col * 10 + 9;
            $sql = "SELECT * FROM card WHERE card_location = 'waiting_room' AND card_location_arg BETWEEN $minPos AND $maxPos ORDER BY card_location_arg ASC, card_id ASC";
            $columnCards = array_values($this->game->getCollectionFromDb($sql));
            $count = count($columnCards);
            foreach ($columnCards as $index => $cRow) {
                $targetRow = 4 - ($count - 1 - $index);
                $targetPos = $col * 10 + $targetRow;
                if ((int)$cRow['card_location_arg'] !== $targetPos) {
                    $this->game->cards->moveCard((int)$cRow['card_id'], 'waiting_room', $targetPos);
                    $moved = true;
                }
            }
        }
        
        if ($moved) {
            $this->game->bga->notify->all("waitingRoomSlid", clienttranslate('The passengers in the Waiting Room move forward in line'), [
                'waitingRoom' => array_values($this->game->cards->getCardsInLocation('waiting_room'))
            ]);
        }

        // 2. Refill Waiting Room from bottom to top (row 4 up to row 1) so no gaps occur even if deck runs low
        $refilledCards = [];
        for ($col = 1; $col <= 2; $col++) {
            for ($row = 4; $row >= 1; $row--) {
                $pos = $col * 10 + $row;
                $sql = "SELECT count(*) FROM card WHERE card_location = 'waiting_room' AND card_location_arg = $pos";
                if ((int)$this->game->getUniqueValueFromDB($sql) === 0) {
                    $newCard = $this->game->cards->pickCard('passenger', 'waiting_room', $pos);
                    if ($newCard) {
                        $refilledCards[] = $newCard;
                    }
                }
            }
        }
        
        if (!empty($refilledCards)) {
            $this->game->bga->notify->all("waitingRoomRefilled", clienttranslate('New passengers enter the Waiting Room queue'), [
                'newCards' => $refilledCards,
                'waitingRoom' => array_values($this->game->cards->getCardsInLocation('waiting_room'))
            ]);
        }

        // 4. Baby Priority
        $this->game->applyBabyPriority();

        // 3. Refill Garage (Slide down and refill empty slots from bottom to top)
        $garageResult = $this->game->slideAndRefillGarage();
        $newGarageBuses = $garageResult['newBuses'] ?? [];
        $garageSlid = !empty($garageResult['slid']);
        if (!empty($newGarageBuses) || $garageSlid) {
            $this->game->bga->notify->all("garageRefilled", clienttranslate('The Garage is refilled with new buses'), [
                'newBuses' => $newGarageBuses,
                'garage' => array_values($this->game->cards->getCardsInLocation('garage'))
            ]);
        }

        // Give some extra time to the active player when he completed an action
        $this->game->giveExtraTime($activePlayerId);

        // --- ROUND END DETECTION ---
        $roundEnd = false;

        // 1. Check if current player has empty hand (Instant end)
        $handCount = (int)$this->game->getUniqueValueFromDB("SELECT COUNT(*) FROM card WHERE card_location='hand' AND card_location_arg=$activePlayerId");
        if ($handCount === 0) {
            $this->game->bga->notify->all("message", clienttranslate('${player_name} has no more cards in hand! The round ends immediately.'), [
                'player_name' => $this->game->getPlayerNameById($activePlayerId)
            ]);
            $roundEnd = true;
        }

        // 2. Check if round end was already triggered
        $roundEndTrigger = (int)$this->game->getGameStateValue('round_end_trigger');
        if ($roundEndTrigger != 0) {
            $remainingTurns = (int)$this->game->getGameStateValue('remaining_turns');
            if ($remainingTurns === 0) {
                $roundEnd = true;
            } else {
                $this->game->setGameStateValue('remaining_turns', $remainingTurns - 1);
            }
        }

        if ($roundEnd) {
            return EndScore::class;
        }

        $this->game->activeNextPlayer();
        return ActiveBus::class;
    }
}