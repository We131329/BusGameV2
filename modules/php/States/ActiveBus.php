<?php

declare(strict_types=1);

namespace Bga\Games\BUUUUUUUS\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\BUUUUUUUS\Game;

class ActiveBus extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: 11,
            type: StateType::ACTIVE_PLAYER,
        );
    }

    public function onEnteringState(int $activePlayerId)
    {
        // ActiveBus UI handles both normal turns and End Round / Skip Turn button when stuck
    }

    public function getArgs(): array
    {
        $playerId = (int) $this->game->getActivePlayerId();
        $handCards = $this->game->cards->getCardsInLocation('hand', $playerId);
        
        $handBuses = array_filter($handCards, fn($c) => $c->type === 'bus');
        $handStars = array_filter($handCards, fn($c) => $c->type === 'passenger' && $c->type_arg % 10 === PASSENGER_STAR);
        $hasGeneral = !empty(array_filter($handCards, fn($c) => $c->type === 'passenger' && $c->type_arg % 10 === PASSENGER_GENERAL));

        $platformBuses = $this->game->cards->getCardsInLocation('platform');
        
        // Potential buses to call with Star: Garage, Departed
        $garageBuses = $this->game->cards->getCardsInLocation('garage');
        $departedBuses = $this->game->cards->getCardsInLocation('departed_buses');

        // A platform bus is "productive" if it's not stalled
        $productivePlatformBuses = array_filter($platformBuses, fn($b) => !$this->game->isBusStalled($b->id));
        
        // Check if any passenger can board from hand or WR front row to ANY non-stalled bus
        $handPassengers = array_filter($handCards, fn($c) => $c->type === 'passenger');
        $wrPassengers = $this->game->cards->getCardsInLocation('waiting_room');
        $frontWrPassengers = [];
        for ($col = 1; $col <= 2; $col++) {
            $maxRow = 0;
            $frontCard = null;
            foreach ($wrPassengers as $p) {
                $c = (int) floor($p->location_arg / 10);
                $r = (int) ($p->location_arg % 10);
                if ($c === $col && $r > $maxRow) {
                    $maxRow = $r;
                    $frontCard = $p;
                }
            }
            if ($frontCard) {
                $frontWrPassengers[] = $frontCard;
            }
        }
        
        $canBoard = false;
        foreach ($productivePlatformBuses as $bus) {
            foreach ($handPassengers as $p) {
                if ($this->game->getBoardingError($bus->id, $p->id) === null) {
                    $canBoard = true; break 2;
                }
            }
            foreach ($frontWrPassengers as $p) {
                if ($this->game->getBoardingError($bus->id, $p->id) === null) {
                    $canBoard = true; break 2;
                }
            }
        }

        // --- STAR ABILITY CHECK ---
        // A player is NOT stuck if they can use a Star to bring a new bus
        $canUseStarProductively = false;
        if (!empty($handStars)) {
            $allCallables = array_merge($garageBuses, $departedBuses);
            foreach ($handStars as $star) {
                $starColor = (int) floor($star->type_arg / 10);
                foreach ($allCallables as $bus) {
                    $busColor = (int) floor($bus->type_arg / 10);
                    if ($starColor === $busColor) {
                        $canUseStarProductively = true;
                        break 2;
                    }
                }
            }
        }

        $garageEmpty = empty($garageBuses) && (int)$this->game->getUniqueValueFromDB("SELECT COUNT(*) FROM card WHERE card_type='bus' AND card_location='deck'") === 0;
        $roundEndTriggered = (int) $this->game->getGameStateValue('round_end_trigger') !== 0;

        // Condition for being stuck: 
        // 1. No buses in hand to play.
        // 2. AND No passenger (hand/WR) can board ANY bus on the platform.
        // 3. AND Cannot use a Star to bring a matching bus.
        $isStuck = empty($handBuses) && !$canBoard && !$canUseStarProductively;
        
        // If stuck and either garage is empty OR round end is already triggered, allow skip/trigger
        $canTriggerEnd = $isStuck && ($garageEmpty || $roundEndTriggered);

        // Safety fallback: if no buses exist anywhere, player is definitely stuck
        if (empty($handBuses) && empty($platformBuses)) {
            $canTriggerEnd = true;
        }

        return [
            "handBuses" => array_values($handBuses),
            "platformBuses" => array_values($platformBuses),
            "handStars" => array_values($handStars),
            "garageBuses" => array_values($garageBuses),
            "departedBuses" => array_values($departedBuses),
            "hasGeneral" => $hasGeneral,
            "isStuck" => $isStuck,
            "canTriggerEnd" => $canTriggerEnd,
            "roundEndTriggeredBy" => (int) $this->game->getGameStateValue('round_end_trigger'),
        ];
    }    

    #[PossibleAction]
    public function actTriggerEnd()
    {
        $args = $this->getArgs();
        if (!$args['canTriggerEnd']) {
            throw new UserException(clienttranslate("You can still take actions"));
        }

        $playerId = (int) $this->game->getActivePlayerId();
        $playerCount = (int) $this->game->getPlayersNumber();
        
        $currentTrigger = (int) $this->game->getGameStateValue('round_end_trigger');
        if ($currentTrigger === 0) {
            $this->game->setGameStateValue('round_end_trigger', $playerId);
            $this->game->setGameStateValue('remaining_turns', $playerCount - 1);

            $this->bga->notify->all("roundEndTriggered", clienttranslate('${player_name} cannot play and the Garage is empty! One last turn for everyone else.'), [
                "player_id" => $playerId,
                "player_name" => $this->game->getPlayerNameById($playerId),
                "hand" => $this->game->cards->getCardsInLocation('hand', $playerId),
            ]);
        } else {
            $this->bga->notify->all("message", clienttranslate('${player_name} also skips their turn as they have no valid moves.'), [
                "player_id" => $playerId,
                "player_name" => $this->game->getPlayerNameById($playerId),
            ]);
        }

        return NextPlayer::class;
    }

    #[PossibleAction]
    public function actUseStar(int $starId, int $busId)
    {
        $playerId = (int) $this->game->getActivePlayerId();
        
        // 1. Verify player has the Star in hand
        $star = $this->game->cards->getCardsInLocation('hand', $playerId);
        $star = array_filter($star, fn($c) => $c->id === $starId && $c->type_arg % 10 === PASSENGER_STAR);
        if (empty($star)) {
             throw new UserException(clienttranslate("You don't have a Star in hand"));
        }
        $star = reset($star);
        $starColor = (int) floor($star->type_arg / 10);
        
        // 2. Verify bus is in Garage or Departed Buses
        $sql = "SELECT * FROM card WHERE card_id = $busId";
        $bus = $this->game->getObjectFromDB($sql);
        if (!$bus || $bus['card_type'] !== 'bus') {
             throw new UserException(clienttranslate("Selected card is not a bus"));
        }
        
        $busColor = (int) floor((int)$bus['card_type_arg'] / 10);
        if ($busColor !== $starColor) {
             throw new UserException(clienttranslate("The Star can only call a bus of the same color"));
        }

        $validLocations = ['garage', 'departed_buses'];
        if (!in_array($bus['card_location'], $validLocations)) {
             throw new UserException(clienttranslate("You can only call a bus from the Garage or Departed buses"));
        }
        
        // 3. Move bus to Platform
        $platformCount = (int) $this->game->getUniqueValueFromDB("SELECT COUNT(*) FROM card WHERE card_location = 'platform'");
        $this->game->cards->moveCard($busId, 'platform', $platformCount + 1);
        
        // 4. Move Star to inside the bus
        $this->game->cards->moveCard($starId, 'in_bus', $busId);
        
        // 5. Set as active bus
        $this->game->setGameStateValue('active_bus_id', $busId);
        $this->game->setGameStateValue('boarding_happened', 1); // Star has boarded! Avoid penalty.

        $this->game->bga->playerStats->inc('star_abilities_activated', 1, $playerId);

        $this->bga->notify->all("starUsed", clienttranslate('${player_name} uses a Star to activate a bus!'), [
            "player_id" => $playerId,
            "player_name" => $this->game->getPlayerNameById($playerId),
            "star_id" => $starId,
            "star_data" => $this->game->cards->getCard($starId),
            "bus_id" => $busId,
            "bus_data" => $this->game->cards->getCard($busId),
            "from_location" => $bus['card_location'],
        ]);
        
        return WaitingRoom::class;
    }

    #[PossibleAction]
    public function actSkipStar()
    {
        return ActiveBus::class;
    }

    #[PossibleAction]
    public function actSelectBus(int $cardId)
    {
        $playerId = (int) $this->game->getActivePlayerId();
        
        $handCards = $this->game->cards->getCardsInLocation('hand', $playerId);
        $hasGeneral = !empty(array_filter($handCards, fn($c) => $c->type === 'passenger' && $c->type_arg % 10 === PASSENGER_GENERAL));

        // Check if card is in hand or platform
        $sql = "SELECT * FROM card WHERE card_id = $cardId";
        $cardRow = $this->game->getObjectFromDB($sql);
        if (!$cardRow) {
            throw new UserException(clienttranslate("Card not found"));
        }
        
        if ($cardRow['card_type'] !== 'bus') {
            throw new UserException(clienttranslate("Selected card is not a bus"));
        }
        
        if ($cardRow['card_location'] === 'hand' && (int)$cardRow['card_location_arg'] !== $playerId) {
            throw new UserException(clienttranslate("This bus is not in your hand"));
        }
        
        if ($cardRow['card_location'] !== 'hand' && $cardRow['card_location'] !== 'platform') {
             throw new UserException(clienttranslate("This bus is not available"));
        }

        if ($cardRow['card_location'] === 'platform' && $this->game->isBusStalled($cardId)) {
             throw new UserException(clienttranslate("This bus is stalled and cannot be selected"));
        }

        // If it was in hand, move it to platform
        if ($cardRow['card_location'] === 'hand') {
            $platformCount = (int) $this->game->getUniqueValueFromDB("SELECT COUNT(*) FROM card WHERE card_location = 'platform'");
            $this->game->cards->moveCard($cardId, 'platform', $platformCount + 1);
            $card = $this->game->cards->getCard($cardId);
            
            $this->bga->notify->all("busPlaced", clienttranslate('${player_name} places a bus on the platform'), [
                "player_id" => $playerId,
                "player_name" => $this->game->getPlayerNameById($playerId),
                "card_id" => $cardId,
                "bus_data" => $card, // Formatted Card object
            ]);
        } else {
            $this->bga->notify->all("busSelected", clienttranslate('${player_name} selects a bus from the platform'), [
                "player_id" => $playerId,
                "player_name" => $this->game->getPlayerNameById($playerId),
                "card_id" => $cardId,
            ]);
        }

        $this->game->setGameStateValue('active_bus_id', $cardId);
        $this->game->setGameStateValue('boarding_happened', 0); // Reset for this turn

        return WaitingRoom::class;
    }

    #[PossibleAction]
    public function actConfirmTurn(string $actionsJson)
    {
        $playerId = (int) $this->game->getActivePlayerId();
        $payload = json_decode($actionsJson, true);
        if (!$payload || !is_array($payload)) {
            throw new UserException(clienttranslate("Invalid turn data payload"));
        }

        // 1. Bus Action
        $busAction = $payload['busAction'] ?? null;
        if ($busAction) {
            $type = $busAction['type'] ?? '';
            if ($type === 'trigger_end') {
                return $this->actTriggerEnd();
            } elseif ($type === 'use_star') {
                $starId = (int) ($busAction['starId'] ?? 0);
                $busId = (int) ($busAction['busId'] ?? 0);
                $this->actUseStar($starId, $busId);
            } elseif ($type === 'select_bus') {
                $busId = (int) ($busAction['busId'] ?? 0);
                $this->actSelectBus($busId);
            }
        }

        $activeBusId = (int) $this->game->getGameStateValue('active_bus_id');

        // Helper to execute Corrupter swaps at their chronological point in the turn
        $corrupterSwaps = $payload['corrupterSwaps'] ?? [];
        $boardWR = $payload['boardWaitingRoom'] ?? [];
        $wrTotal = is_array($boardWR) ? count($boardWR) : 0;
        $candidateBusIds = [];

        $executeSwaps = function (int $afterWrCount, int $afterHandCount) use ($corrupterSwaps, $playerId, $activeBusId, $wrTotal, &$candidateBusIds) {
            if (empty($corrupterSwaps) || !is_array($corrupterSwaps)) {
                return;
            }
            foreach ($corrupterSwaps as $swap) {
                $swapWr = isset($swap['afterWrCount']) ? (int)$swap['afterWrCount'] : $wrTotal;
                $swapHand = (int)($swap['afterHandCount'] ?? 0);
                if ($swapWr !== $afterWrCount || $swapHand !== $afterHandCount) {
                    continue;
                }
                $handCardId = (int)($swap['handCardId'] ?? 0);
                $targetCardId = (int)($swap['targetCardId'] ?? 0);
                if ($handCardId > 0 && $targetCardId > 0) {
                    $targetCard = $this->game->cards->getCard($targetCardId);
                    if ($targetCard) {
                        $targetLoc = $targetCard->location;
                        $targetLocArg = (int)$targetCard->location_arg;
                        $this->game->cards->moveCard($handCardId, $targetLoc, $targetLocArg);
                        $this->game->cards->moveCard($targetCardId, 'hand', $playerId);
                        $this->bga->notify->all("corrupterSwap", clienttranslate('${player_name} uses a Corrupter to swap cards!'), [
                            "player_id" => $playerId,
                            "player_name" => $this->game->getPlayerNameById($playerId),
                            "hand_card_id" => $handCardId,
                            "hand_card_data" => $this->game->cards->getCard($handCardId),
                            "target_card_id" => $targetCardId,
                            "target_card_data" => $this->game->cards->getCard($targetCardId),
                        ]);
                        if ($targetLoc === 'in_bus' && $targetLocArg > 0 && !in_array($targetLocArg, $candidateBusIds, true)) {
                            $candidateBusIds[] = $targetLocArg;
                        }
                    }
                }
            }
        };

        // 2. Board Passengers from Waiting Room (and any Corrupter Swaps triggered immediately after each WR passenger)
        if (!empty($boardWR) && is_array($boardWR)) {
            foreach (array_values($boardWR) as $wrIdx => $pId) {
                $pId = (int)$pId;
                $this->game->boardPassenger($activeBusId, $pId);
                $card = $this->game->cards->getCard($pId);
                $this->bga->notify->all("passengerBoarded", clienttranslate('${player_name} boards a passenger from Waiting Room'), [
                    "player_id" => $playerId,
                    "player_name" => $this->game->getPlayerNameById($playerId),
                    "passenger_id" => $pId,
                    "passenger_data" => $card,
                    "bus_id" => $activeBusId,
                ]);
                $executeSwaps($wrIdx + 1, 0);
            }
            $this->game->setGameStateValue('boarding_happened', 1);
        }

        // 3. Board Passengers from Hand (and any Corrupter Swaps triggered from Hand boarding)
        $boardHand = $payload['boardHand'] ?? [];
        $boardHandBusMap = $payload['boardHandBusMap'] ?? [];
        if (!empty($boardHand) && is_array($boardHand)) {
            foreach (array_values($boardHand) as $idx => $pId) {
                $pId = (int)$pId;
                $pCardPre = $this->game->cards->getCard($pId);
                $targetBusId = $activeBusId;
                if (is_array($boardHandBusMap) && !empty($boardHandBusMap[$pId])) {
                    $requestedBusId = (int)$boardHandBusMap[$pId];
                    if ($pCardPre && ($pCardPre->type_arg % 10) === PASSENGER_BABY) {
                        $targetBusId = $requestedBusId;
                    }
                }
                $this->game->boardPassenger($targetBusId, $pId);
                $card = $this->game->cards->getCard($pId);
                $this->bga->notify->all("passengerPlayed", clienttranslate('${player_name} plays a passenger from hand'), [
                    "player_id" => $playerId,
                    "player_name" => $this->game->getPlayerNameById($playerId),
                    "passenger_id" => $pId,
                    "passenger_data" => $card,
                    "bus_id" => $targetBusId,
                ]);
                if ($targetBusId > 0 && !in_array($targetBusId, $candidateBusIds, true)) {
                    $candidateBusIds[] = $targetBusId;
                }
                $executeSwaps($wrTotal, $idx + 1);
            }
            $this->game->setGameStateValue('boarding_happened', 1);
        }

        // 5. Drunkard Victims & Departure Check across all affected buses (Baby-boarded buses, Corrupter-swapped buses, and Active Bus)
        if ($activeBusId > 0 && !in_array($activeBusId, $candidateBusIds, true)) {
            $candidateBusIds[] = $activeBusId;
        }
        $drunkardVictims = array_map('intval', (array)($payload['drunkardVictims'] ?? []));
        foreach ($candidateBusIds as $bId) {
            if ($bId <= 0) continue;
            $departState = $this->game->checkBusDeparture($bId);
            if ($departState === 'drunkard') {
                $busPassengers = $this->game->cards->getCardsInLocation('in_bus', $bId);
                $busPassengerIds = array_map(fn($p) => (int)$p->id, array_values($busPassengers));
                $busVictimIds = array_values(array_intersect($drunkardVictims, $busPassengerIds));
                foreach ($busVictimIds as $vId) {
                    $this->game->cards->moveCard($vId, 'unhappies', $playerId);
                }
                $remaining = $this->game->cards->getCardsInLocation('in_bus', $bId);
                foreach ($remaining as $r) {
                    $this->game->cards->moveCard($r->id, 'passengers', $playerId);
                    $this->game->bga->playerStats->inc('passengers_departed', 1, $playerId);
                }
                $this->game->cards->moveCard($bId, 'departed_buses', $playerId);

                // --- RE-ARRANGE PLATFORM ---
                $platformBuses = $this->game->cards->getCardsInLocation('platform');
                foreach ($platformBuses as $index => $bus) {
                    $this->game->cards->moveCard($bus->id, 'platform', $index + 1);
                }

                $this->bga->notify->all("drunkardVictimsSelected", clienttranslate('${player_name} chooses victims for the Drunkard!'), [
                    "player_id" => $playerId,
                    "player_name" => $this->game->getPlayerNameById($playerId),
                    "victim_ids" => $busVictimIds,
                    "passenger_ids" => array_map(fn($p) => $p->id, array_values($remaining)),
                    "bus_id" => $bId,
                    "platform_buses" => array_values($this->game->cards->getCardsInLocation('platform')),
                ]);
            }
        }

        // 6. Penalty Check
        $boardingHappened = (int) $this->game->getGameStateValue('boarding_happened');
        if (!$boardingHappened) {
            $penaltyCardId = (int) ($payload['penaltyCardId'] ?? 0);
            if ($penaltyCardId > 0) {
                $this->game->cards->moveCard($penaltyCardId, 'unhappies', $playerId);
                Game::DbQuery("UPDATE player SET player_unhappy_points = player_unhappy_points + 1 WHERE player_id = $playerId");
                $penaltyCard = $this->game->cards->getCard($penaltyCardId);
                $this->bga->notify->all("penaltyTaken", clienttranslate('${player_name} takes a penalty and moves a card to Unhappies'), [
                    "player_id" => $playerId,
                    "player_name" => $this->game->getPlayerNameById($playerId),
                    "card_id" => $penaltyCardId,
                    "card_data" => $penaltyCard,
                    "new_unhappy_points" => $this->game->getUniqueValueFromDB("SELECT player_unhappy_points FROM player WHERE player_id = $playerId"),
                ]);
            }
        }

        // 7. Refill Hand Cards (skipped if player emptied their hand, since round ends immediately!)
        $currentHand = $this->game->cards->getCardsInLocation('hand', $playerId);
        $refillCardIds = $payload['refillCardIds'] ?? [];
        if (!empty($currentHand) && !empty($refillCardIds) && is_array($refillCardIds)) {
            $ids = array_map('intval', $refillCardIds);

            $currentBusCount = count(array_filter($currentHand, fn($c) => $c->type === 'bus'));
            $currentPassCount = count(array_filter($currentHand, fn($c) => $c->type === 'passenger'));

            $validIds = [];
            foreach ($ids as $cardId) {
                $card = $this->game->cards->getCard($cardId);
                if (!$card) continue;
                if ($card->type === 'bus' && $card->location === 'garage') {
                    if ($currentBusCount < 2) {
                        $this->game->cards->moveCard($cardId, 'hand', $playerId);
                        $currentBusCount++;
                        $validIds[] = $cardId;
                    }
                } else if ($card->type === 'passenger' && $card->location === 'waiting_room') {
                    if ($currentPassCount < 7) {
                        $this->game->cards->moveCard($cardId, 'hand', $playerId);
                        $currentPassCount++;
                        $validIds[] = $cardId;
                    }
                }
            }
            if (!empty($validIds)) {
                $this->bga->notify->all("handRefilled", clienttranslate('${player_name} refills hand with ${count} cards'), [
                    "player_id" => $playerId,
                    "player_name" => $this->game->getPlayerNameById($playerId),
                    "count" => count($validIds),
                    "card_ids" => $validIds,
                ]);
            }
        }

        return NextPlayer::class;
    }

    function zombie(int $playerId) {
        $args = $this->getArgs();
        if (!empty($args['handBuses'])) {
            return $this->actSelectBus($args['handBuses'][0]->id);
        } elseif (!empty($args['platformBuses'])) {
            return $this->actSelectBus($args['platformBuses'][0]->id);
        }
        return NextPlayer::class;
    }
}
