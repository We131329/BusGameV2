/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * BUUUUUUUUS implementation : © Erickbond <perickpor@hotmail.com>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 * 
 * In this file, you are describing the logic of your user interface, in Javascript language.
 *
 */


import { TurnDraftManager } from './TurnDraftManager.js';
import { ActiveBus } from './States/ActiveBus.js';
import { WaitingRoom } from './States/WaitingRoom.js';
import { TravelersHand } from './States/TravelersHand.js';
import { Penalty } from './States/Penalty.js';
import { CorrupterSwap } from './States/CorrupterSwap.js';
import { DrunkardChoice } from './States/DrunkardChoice.js';
import { RefillHand } from './States/RefillHand.js';

export class Game {
    constructor(bga) {
        this.bga = bga;
        this.draftManager = new TurnDraftManager(this);

        // Declare the State classes
        this.activeBus = new ActiveBus(this, bga);
        this.bga.states.register('ActiveBus', this.activeBus);

        this.waitingRoom = new WaitingRoom(this, bga);
        this.bga.states.register('WaitingRoom', this.waitingRoom);

        this.travelersHand = new TravelersHand(this, bga);
        this.bga.states.register('TravelersHand', this.travelersHand);

        this.penalty = new Penalty(this, bga);
        this.bga.states.register('Penalty', this.penalty);

        this.refillHand = new RefillHand(this, bga);
        this.bga.states.register('RefillHand', this.refillHand);

        this.drunkardChoice = new DrunkardChoice(this, bga);
        this.bga.states.register('DrunkardChoice', this.drunkardChoice);

        this.corrupterSwap = new CorrupterSwap(this, bga);
        this.bga.states.register('CorrupterSwap', this.corrupterSwap);
    }

    getCurrentPlayerId() {
        if (this.bga.players && typeof this.bga.players.getCurrentPlayerId === 'function') {
            return this.bga.players.getCurrentPlayerId();
        }
        if (this.bga.players && typeof this.bga.players.getActivePlayerId === 'function') {
            return this.bga.players.getActivePlayerId();
        }
        return this.bga.player_id || (this.gamedatas ? this.gamedatas.current_player_id : null);
    }

    clearDraftDataset(el) {
        if (!el) return;
        delete el.dataset.originalParent;
        delete el.dataset.originalGridColumn;
        delete el.dataset.originalGridRow;
        el.classList.remove('buu_draft-placed', 'buu_draft-selected', 'buu_draft-departed');
    }

    updatePlayerCounts() {
        if (!this.gamedatas || !this.gamedatas.players) return;
        Object.keys(this.gamedatas.players).forEach(pId => {
            const passengersZone = document.getElementById(`passengers-zone-${pId}`);
            const unhappiesZone = document.getElementById(`unhappies-zone-${pId}`);
            const passCounter = document.getElementById(`passengers-counter-${pId}`);
            const unhappyCounter = document.getElementById(`unhappy-counter-${pId}`);

            if (passCounter && passengersZone) {
                passCounter.textContent = String(passengersZone.querySelectorAll('.buu_card').length);
            }
            if (unhappyCounter && unhappiesZone) {
                unhappyCounter.textContent = String(unhappiesZone.querySelectorAll('.buu_card').length);
            }
        });
    }

    getAllBoardedPassengerIds() {
        const ids = [
            ...(this.draftManager?.turnDraft?.boardWaitingRoom || []).map(Number),
            ...(this.draftManager?.turnDraft?.boardHand || []).map(Number)
        ];
        if (this.draftManager?.turnDraft?.busAction?.type === 'use_star' && this.draftManager?.turnDraft?.busAction?.starId) {
            ids.push(Number(this.draftManager.turnDraft.busAction.starId));
        }
        return ids;
    }

    getBusOccupancy(busId) {
        const busIdNum = Number(busId);
        let busCapacity = 0;
        const busEl = document.getElementById(`card-${busIdNum}`);
        if (busEl) {
            const attr = busEl.getAttribute('data-type-arg') || busEl.dataset.typeArg;
            if (attr) busCapacity = parseInt(attr, 10) % 10;
        }
        if (!busCapacity) {
            const allCards = [
                ...(this.gamedatas?.hand || []),
                ...(this.gamedatas?.platform_buses || []),
                ...(this.gamedatas?.garage || []),
                ...(this.gamedatas?.departed_buses || [])
            ];
            const busCard = allCards.find(c => Number(c.id || c.card_id) === busIdNum);
            if (busCard) {
                const busTypeArg = Number(busCard.type_arg || busCard.card_type_arg || 0);
                busCapacity = busTypeArg % 10;
            }
        }

        const passengers = this.getPassengersInBus(busIdNum);
        let currentOccupancy = 0;
        passengers.forEach(p => {
            const ability = this.getCardTypeArg(p.id) % 10;
            const cap = (this.gamedatas?.passenger_types && this.gamedatas?.passenger_types[ability]) ? this.gamedatas.passenger_types[ability].capacity : 1;
            currentOccupancy += cap;
        });

        return { 
            occupancy: currentOccupancy, 
            capacity: busCapacity, 
            isFull: busCapacity > 0 && currentOccupancy >= busCapacity,
            valueOf() { return this.occupancy; }
        };
    }

    getPassengersInBus(busId) {
        const busIdNum = Number(busId);
        const activeBusId = Number(this.draftManager?.turnDraft?.busAction?.busId || 0);
        const list = [];
        const seenIds = new Set();

        const addPassengerById = (id) => {
            const idNum = Number(id);
            if (!idNum || seenIds.has(idNum)) return;
            seenIds.add(idNum);
            const typeArg = this.getCardTypeArg(idNum);
            list.push({
                id: idNum,
                type: 'passenger',
                type_arg: typeArg,
                card_type_arg: typeArg
            });
        };

        // 1. Initial platform passengers from gamedatas for this bus
        (this.gamedatas?.platform_passengers || []).forEach(p => {
            if (Number(p.location_arg || p.card_location_arg) === busIdNum) {
                addPassengerById(p.id || p.card_id);
            }
        });

        // 2. Also include any card that started this turn in #bus-X-inner in DOM (in case gamedatas wasn't refreshed)
        document.querySelectorAll('.buu_card.buu_passenger').forEach(el => {
            const origParent = el.dataset.originalParent || (el.parentElement ? el.parentElement.id : '');
            if (origParent === `bus-${busIdNum}-inner`) {
                addPassengerById(el.dataset.id || el.id.replace('card-', ''));
            }
        });

        // 3. Replay Draft boarded cards and Corrupter swaps in exact chronological order
        if (busIdNum === activeBusId && this.draftManager?.turnDraft?.busAction?.type === 'use_star' && this.draftManager?.turnDraft?.busAction?.starId) {
            addPassengerById(Number(this.draftManager.turnDraft.busAction.starId));
        }

        const swaps = this.draftManager?.turnDraft?.corrupterSwaps || [];
        const applySwapToList = (swap) => {
            const handId = Number(swap.handCardId);
            const targetId = Number(swap.targetCardId);
            const targetIdx = list.findIndex(p => Number(p.id) === targetId);
            if (targetIdx !== -1 || Number(swap.targetBusId) === busIdNum) {
                if (targetIdx !== -1) {
                    list.splice(targetIdx, 1);
                }
                seenIds.delete(targetId);
                if (handId && !seenIds.has(handId)) {
                    seenIds.add(handId);
                    const typeArg = this.getCardTypeArg(handId);
                    list.push({
                        id: handId,
                        type: 'passenger',
                        type_arg: typeArg,
                        card_type_arg: typeArg
                    });
                }
            }
        };

        const wrList = (this.draftManager?.turnDraft?.boardWaitingRoom || []).map(Number);
        wrList.forEach((cId, idx) => {
            if (busIdNum === activeBusId) {
                addPassengerById(cId);
            }
            swaps.filter(s => (s.afterHandCount || 0) === 0 && (s.afterWrCount ?? wrList.length) === idx + 1).forEach(applySwapToList);
        });

        swaps.filter(s => (s.afterHandCount || 0) === 0 && s.afterWrCount === 0).forEach(applySwapToList);

        const handBusMap = this.draftManager?.turnDraft?.boardHandBusMap || {};
        (this.draftManager?.turnDraft?.boardHand || []).forEach((cId, idx) => {
            const targetBusId = Number(handBusMap[cId] || activeBusId);
            if (targetBusId === busIdNum) {
                addPassengerById(cId);
            }
            swaps.filter(s => s.afterHandCount === idx + 1).forEach(applySwapToList);
        });

        return list;
    }

    getPendingDrunkardBusInfo() {
        if (!this.draftManager?.turnDraft?.busAction?.busId) return null;
        const activeBusId = Number(this.draftManager.turnDraft.busAction.busId);
        const candidateBusIds = [];
        if (this.draftManager.turnDraft.boardHandBusMap) {
            Object.values(this.draftManager.turnDraft.boardHandBusMap).forEach(bId => {
                if (bId && !candidateBusIds.includes(Number(bId))) {
                    candidateBusIds.push(Number(bId));
                }
            });
        }
        (this.draftManager.turnDraft.corrupterSwaps || []).forEach(s => {
            if (s.targetBusId && !candidateBusIds.includes(Number(s.targetBusId))) {
                candidateBusIds.push(Number(s.targetBusId));
            }
        });
        if (activeBusId && !candidateBusIds.includes(activeBusId)) {
            candidateBusIds.push(activeBusId);
        }

        const selectedVictimIds = (this.draftManager.turnDraft.drunkardVictims || []).map(Number);
        for (const bId of candidateBusIds) {
            const depInfo = this.getBusDepartureInfo(bId);
            if (depInfo.departs && depInfo.hasDrunkard) {
                const busVictimsCount = depInfo.otherPassengers.filter(p => selectedVictimIds.includes(Number(p.id))).length;
                if (busVictimsCount < depInfo.drunkardVictimsNeeded) {
                    return { busId: bId, depInfo, busVictimsCount };
                }
            }
        }
        return null;
    }

    getBusDepartureInfo(busId) {
        const busIdNum = Number(busId);
        const { occupancy, capacity, isFull } = this.getBusOccupancy(busIdNum);
        const passengers = this.getPassengersInBus(busIdNum);
        
        const hasGeneral = passengers.some(p => (this.getCardTypeArg(p.id) % 10) === 3);
        const loverCount = passengers.filter(p => (this.getCardTypeArg(p.id) % 10) === 2).length;
        const isStalled = !hasGeneral && isFull && (loverCount % 2 !== 0);
        const departs = !isStalled && (isFull || hasGeneral);
        
        const hasDrunkard = passengers.some(p => (this.getCardTypeArg(p.id) % 10) === 5);
        const otherPassengers = passengers;
        const drunkardVictimsNeeded = (departs && hasDrunkard) ? Math.min(2, otherPassengers.length) : 0;
        
        return {
            occupancy,
            capacity,
            isFull,
            passengers,
            hasGeneral,
            isStalled,
            departs,
            hasDrunkard,
            otherPassengers,
            drunkardVictimsNeeded
        };
    }

    getPlatformBusIds() {
        const domBusIds = Array.from(document.querySelectorAll('#platform .buu_card.buu_bus'))
            .map(el => Number(el.dataset.id))
            .filter(Boolean);
        if (domBusIds.length > 0) {
            return domBusIds;
        }
        const ids = (this.gamedatas?.platform_buses || []).map(b => Number(b.id || b.card_id));
        const activeBusId = Number(this.draftManager?.turnDraft?.busAction?.busId || 0);
        if (activeBusId && !ids.includes(activeBusId)) {
            ids.push(activeBusId);
        }
        return ids;
    }

    getEligibleBusesForHandCard(cardId) {
        if (!this.draftManager?.turnDraft?.busAction?.busId) return [];
        const cId = Number(cardId);
        const allBoardedIds = this.getAllBoardedPassengerIds();
        const refillIds = (this.draftManager?.turnDraft?.refillCardIds || []).map(Number);
        if (allBoardedIds.includes(cId) || refillIds.includes(cId)) return [];

        const cTypeArg = this.getCardTypeArg(cId);
        if (!cTypeArg) return [];
        const cardColor = Math.floor(cTypeArg / 10);
        const ability = cTypeArg % 10;
        const cap = (this.gamedatas?.passenger_types && this.gamedatas.passenger_types[ability])
            ? this.gamedatas.passenger_types[ability].capacity
            : 1;

        const activeBusId = Number(this.draftManager.turnDraft.busAction.busId);

        // Baby (ability 8) can board ANY bus of its color on the platform during your turn
        if (ability === 8) {
            const platformBusIds = this.getPlatformBusIds();
            return platformBusIds.filter(bId => {
                const bDepInfo = this.getBusDepartureInfo(bId);
                if (bDepInfo.departs || bDepInfo.isStalled) return false;
                const bTypeArg = this.getCardTypeArg(bId);
                const bColor = Math.floor(bTypeArg / 10);
                return bColor === cardColor && (bDepInfo.occupancy + cap <= bDepInfo.capacity);
            });
        }

        // All other passengers can only board the active bus
        const depInfo = this.getBusDepartureInfo(activeBusId);
        if (depInfo.departs || depInfo.isStalled) return [];
        const busTypeArg = this.getCardTypeArg(activeBusId);
        const busColor = Math.floor(busTypeArg / 10);
        const busCapacity = busTypeArg % 10;
        if ((cardColor === busColor || ability === 6) && (depInfo.occupancy + cap <= busCapacity)) {
            return [activeBusId];
        }
        return [];
    }

    hasEligibleHandPassengers() {
        if (!this.draftManager?.turnDraft?.busAction || !this.draftManager?.turnDraft?.busAction?.busId) return false;
        const refillIds = (this.draftManager?.turnDraft?.refillCardIds || []).map(Number);
        if (refillIds.length > 0) return false;

        const domHandEls = Array.from(document.querySelectorAll('#my-hand-passengers .buu_card'));
        if (domHandEls.length > 0) {
            return domHandEls.some(el => this.getEligibleBusesForHandCard(Number(el.dataset.id)).length > 0);
        }

        const handPassengers = (this.gamedatas.hand || []).filter(c => c.type === 'passenger');
        return handPassengers.some(card => this.getEligibleBusesForHandCard(Number(card.id)).length > 0);
    }

    canSkipHandBoarding() {
        if (!this.draftManager?.turnDraft?.busAction || this.draftManager?.turnDraft?.handSkipped) return false;
        if (this.isCorrupterPending()) return false;
        if (this.getPendingDrunkardBusInfo()) return false;
        
        const busId = Number(this.draftManager.turnDraft.busAction.busId);
        const depInfo = this.getBusDepartureInfo(busId);
        if (!depInfo.departs && !depInfo.isStalled) {
            const eligibleWrIds = this.getEligibleWaitingRoomPassengerIds(busId);
            if (eligibleWrIds.length > 0) return false;
        }

        return this.hasEligibleHandPassengers();
    }

    getBoardedCorruptersCount() {
        const allBoardedIds = this.getAllBoardedPassengerIds();
        let count = 0;
        allBoardedIds.forEach(id => {
            const typeArg = this.getCardTypeArg(id);
            if (typeArg % 10 === 7) {
                count++;
            }
        });
        return count;
    }

    isCorrupterPending() {
        if (!this.draftManager?.turnDraft?.busAction) return false;
        const count = this.getBoardedCorruptersCount();
        const swapsDone = (this.draftManager.turnDraft.corrupterSwaps || []).length;
        const skippedCount = Number(this.draftManager.turnDraft.corrupterSkippedCount || (this.draftManager.turnDraft.corrupterSkipped ? 1 : 0));
        return count > (swapsDone + skippedCount);
    }

    getActiveCorrupterId() {
        const allBoardedIds = this.getAllBoardedPassengerIds();
        const corrupterIds = allBoardedIds.filter(id => (this.getCardTypeArg(id) % 10) === 7);
        const swapsDone = (this.draftManager?.turnDraft?.corrupterSwaps || []).length;
        const skippedCount = Number(this.draftManager?.turnDraft?.corrupterSkippedCount || (this.draftManager?.turnDraft?.corrupterSkipped ? 1 : 0));
        const idx = swapsDone + skippedCount;
        return corrupterIds[idx] !== undefined ? Number(corrupterIds[idx]) : null;
    }

    canSkipCorrupter() {
        return this.isCorrupterPending();
    }

    isPenaltyRequired() {
        if (!this.draftManager?.turnDraft?.busAction || !this.draftManager?.turnDraft?.busAction?.busId) return false;
        const isStar = this.draftManager.turnDraft.busAction.type === 'use_star';
        if (isStar) return false;

        const boardWR = this.draftManager.turnDraft.boardWaitingRoom || [];
        const boardHand = this.draftManager.turnDraft.boardHand || [];
        if (boardWR.length > 0 || boardHand.length > 0) return false;

        const busId = Number(this.draftManager.turnDraft.busAction.busId);
        const eligibleWrIds = this.getEligibleWaitingRoomPassengerIds(busId);
        if (eligibleWrIds.length > 0) return false;

        const handSkipped = Boolean(this.draftManager.turnDraft.handSkipped);
        const hasHand = this.hasEligibleHandPassengers();
        if (!handSkipped && hasHand) return false;

        const refillIds = (this.draftManager.turnDraft.refillCardIds || []).map(Number);
        const handBuses = Array.from(document.querySelectorAll('#my-hand-buses .buu_card.buu_bus'))
            .filter(el => !refillIds.includes(Number(el.dataset.id))).length;
        const handPassengers = Array.from(document.querySelectorAll('#my-hand-passengers .buu_card.buu_passenger'))
            .filter(el => !refillIds.includes(Number(el.dataset.id))).length;
        return (handBuses + handPassengers) > 0;
    }

    getBottomGarageBusId() {
        const refillIds = (this.draftManager?.turnDraft?.refillCardIds || []).map(Number);
        const garageEls = Array.from(document.querySelectorAll('#garage .buu_card.buu_bus'))
            .filter(el => !refillIds.includes(Number(el.dataset.id)));
        if (garageEls.length === 0) return null;

        let bottomEl = garageEls[0];
        let maxRow = parseInt(bottomEl.style.gridRow || bottomEl.dataset.originalGridRow || '0', 10);

        garageEls.forEach((el, idx) => {
            const row = parseInt(el.style.gridRow || el.dataset.originalGridRow || String(idx + 1), 10);
            if (row >= maxRow) {
                maxRow = row;
                bottomEl = el;
            }
        });

        return Number(bottomEl.dataset.id);
    }

    getEligibleWaitingRoomPassengerIds(busId) {
        if (
            (this.draftManager?.turnDraft?.boardHand || []).length > 0 ||
            this.draftManager?.turnDraft?.handSkipped ||
            this.draftManager?.turnDraft?.penaltyCardId ||
            (this.draftManager?.turnDraft?.refillCardIds || []).length > 0
        ) {
            return [];
        }

        const busEl = document.getElementById(`card-${busId}`);
        let busColor = 0;
        let busCapacity = 0;
        if (busEl) {
            const bTypeArg = parseInt(busEl.dataset.typeArg || '0', 10);
            busColor = Math.floor(bTypeArg / 10);
            busCapacity = bTypeArg % 10;
        } else {
            const allCards = [
                ...(this.gamedatas?.hand || []),
                ...(this.gamedatas?.platform_buses || []),
                ...(this.gamedatas?.garage || []),
                ...(this.gamedatas?.departed_buses || [])
            ];
            const busCard = allCards.find(c => Number(c.id || c.card_id) === Number(busId));
            if (!busCard) return [];
            const busTypeArg = Number(busCard.type_arg || busCard.card_type_arg || 0);
            busColor = Math.floor(busTypeArg / 10);
            busCapacity = busTypeArg % 10;
        }

        const { occupancy } = this.getBusOccupancy(busId);
        const allBoardedIds = this.getAllBoardedPassengerIds();
        const eligibleIds = [];

        // Check front card of column 1 and column 2 from live DOM in #waiting-room
        for (let col = 1; col <= 2; col++) {
            let frontCardEl = null;
            let frontRow = 0;

            document.querySelectorAll('#waiting-room .buu_card').forEach(el => {
                const elCol = parseInt(el.style.gridColumn || '0', 10);
                const elRow = parseInt(el.style.gridRow || '0', 10);
                if (elCol === col && elRow > frontRow) {
                    frontRow = elRow;
                    frontCardEl = el;
                }
            });

            if (frontCardEl) {
                const cardId = Number(frontCardEl.dataset.id);
                if (!allBoardedIds.includes(cardId)) {
                    const typeArg = parseInt(frontCardEl.dataset.typeArg || '0', 10);
                    const cardColor = Math.floor(typeArg / 10);
                    const ability = typeArg % 10;
                    const cap = (this.gamedatas?.passenger_types && this.gamedatas?.passenger_types[ability])
                        ? this.gamedatas.passenger_types[ability].capacity
                        : 1;

                    if ((cardColor === busColor || ability === 6) && (occupancy + cap <= busCapacity)) {
                        eligibleIds.push(cardId);
                    }
                }
            } else {
                // Fallback to gamedatas if DOM gridColumn not set
                let frontCard = null;
                for (let row = 4; row >= 1; row--) {
                    const pos = col * 10 + row;
                    const card = (this.gamedatas?.waiting_room || []).find(c => Number(c.location_arg) === pos);
                    if (card) {
                        frontCard = card;
                        break;
                    }
                }
                if (frontCard && !allBoardedIds.includes(Number(frontCard.id))) {
                    const cardColor = Math.floor(Number(frontCard.type_arg) / 10);
                    const ability = Number(frontCard.type_arg) % 10;
                    const cap = (this.gamedatas?.passenger_types && this.gamedatas?.passenger_types[ability]) ? this.gamedatas.passenger_types[ability].capacity : 1;
                    if ((cardColor === busColor || ability === 6) && (occupancy + cap <= busCapacity)) {
                        eligibleIds.push(Number(frontCard.id));
                    }
                }
            }
        }

        // Baby Rule: If any playable passenger in the Waiting Room is a Baby (ability 8), it MUST board first!
        const babyIds = eligibleIds.filter(id => (this.getCardTypeArg(id) % 10) === 8);
        if (babyIds.length > 0) {
            return babyIds;
        }
        return eligibleIds;
    }

    refreshTurnSelectability() {
        if (!this.gamedatas) return;

        const isActive = (this.bga.players && typeof this.bga.players.isCurrentPlayerActive === 'function')
            ? this.bga.players.isCurrentPlayerActive()
            : (typeof this.bga.isCurrentPlayerActive === 'function' ? this.bga.isCurrentPlayerActive() : true);
        if (!isActive) return;

        // Reset selectability of all cards
        document.querySelectorAll('.buu_card').forEach(el => {
            el.classList.remove('buu_selectable', 'buu_unselectable-visual', 'buu_selected', 'buu_drunkard-candidate');
            if (!el.dataset.originalParent) {
                el.classList.remove('buu_draft-placed');
            }
        });
        document.querySelectorAll('.buu_corrupter-expanded').forEach(innerEl => {
            innerEl.classList.remove('buu_expanded', 'buu_corrupter-expanded');
            if (innerEl.parentElement) innerEl.parentElement.style.zIndex = '';
        });

        // 1. Initial Bus Selection Phase
        if (!this.draftManager.turnDraft.busAction || !this.draftManager.turnDraft.busAction.busId) {
            this.bga.statusBar.setTitle(_('${you} must select a bus from your hand or the platform'));
            document.querySelectorAll('#my-hand-buses .buu_card.buu_bus').forEach(el => el.classList.add('buu_selectable'));
            document.querySelectorAll('#my-hand-passengers .buu_card.buu_passenger').forEach(el => {
                if ((this.getCardTypeArg(el.dataset.id) % 10) === 4) {
                    el.classList.add('buu_selectable');
                }
            });
            document.querySelectorAll('#platform .buu_card.buu_bus').forEach(el => {
                const busId = Number(el.dataset.id);
                if (!this.isBusStalled(busId)) {
                    el.classList.add('buu_selectable');
                } else {
                    el.classList.add('buu_unselectable-visual');
                }
            });
            return;
        }

        // 2. Bus is selected in draft
        const busId = Number(this.draftManager.turnDraft.busAction.busId);
        const depInfo = this.getBusDepartureInfo(busId);
        const allBoardedIds = this.getAllBoardedPassengerIds();

        // 3. Corrupter Ability Phase (executes immediately when a Corrupter boards, even between Waiting Room passengers)
        if (this.isCorrupterPending()) {
            if (!this.draftManager.corrupterHandId) {
                this.bga.statusBar.setTitle(_('${you}: Corrupter ability! Select a passenger from your hand to swap (or click Skip Corrupter)'));
                document.querySelectorAll('#my-hand-passengers .buu_card').forEach(el => {
                    el.classList.add('buu_selectable');
                });
                return;
            } else {
                this.bga.statusBar.setTitle(_('${you}: Select a target passenger from Waiting Room or a matching Bus to swap with'));
                const handCardId = Number(this.draftManager.corrupterHandId);
                const handCardTypeArg = this.getCardTypeArg(handCardId);
                const handCardColor = Math.floor(handCardTypeArg / 10);
                const handCardAbility = handCardTypeArg % 10;

                // Keep hand passengers selectable so player can change selection
                document.querySelectorAll('#my-hand-passengers .buu_card').forEach(el => {
                    el.classList.add('buu_selectable');
                    if (Number(el.dataset.id) === handCardId) {
                        el.classList.add('buu_selected');
                    }
                });

                // Waiting Room passengers (any color)
                document.querySelectorAll('#waiting-room .buu_card').forEach(el => {
                    el.classList.add('buu_selectable');
                });

                // Passengers inside buses on Platform (must match bus color or be Backpacker, excluding active Corrupter itself)
                const activeCorrupterId = this.getActiveCorrupterId();
                document.querySelectorAll('#platform .buu_bus-inner .buu_card').forEach(pEl => {
                    const pId = Number(pEl.dataset.id);
                    if (pId === activeCorrupterId) return;
                    const busStack = pEl.closest('.buu_bus-stack');
                    if (busStack) {
                        const bId = Number(busStack.id.replace('bus-stack-', ''));
                        const bTypeArg = this.getCardTypeArg(bId);
                        const bColor = Math.floor(bTypeArg / 10);
                        if (handCardColor === bColor || handCardAbility === 6) {
                            pEl.classList.add('buu_selectable');
                            const innerEl = pEl.closest('.buu_bus-inner');
                            if (innerEl && !innerEl.classList.contains('buu_expanded')) {
                                innerEl.classList.add('buu_expanded', 'buu_corrupter-expanded');
                                busStack.style.zIndex = '5000';
                            }
                        }
                    }
                });
                return;
            }
        }

        // 3.5. Drunkard Victims Selection Phase (if a bus just departed with a Drunkard, e.g., via Corrupter or boarding)
        const pendingDrunkard = this.getPendingDrunkardBusInfo();
        const selectedVictimIds = (this.draftManager.turnDraft.drunkardVictims || []).map(Number);
        if (pendingDrunkard) {
            const needed = pendingDrunkard.depInfo.drunkardVictimsNeeded - (pendingDrunkard.busVictimsCount ?? selectedVictimIds.length);
            if (needed === 1) {
                this.bga.statusBar.setTitle(_('${you} must select 1 more victim for the Drunkard to send to Unhappies'));
            } else {
                this.bga.statusBar.setTitle(_('${you} must select 2 victims for the Drunkard to send to Unhappies'));
            }

            pendingDrunkard.depInfo.otherPassengers.forEach(p => {
                const pId = Number(p.id);
                if (!selectedVictimIds.includes(pId)) {
                    const el = document.getElementById(`card-${pId}`);
                    if (el) el.classList.add('buu_selectable', 'buu_draft-placed', 'buu_drunkard-candidate');
                }
            });
            return;
        }

        // 4. Mandatory Waiting Room check (if bus has not departed and is not stalled)
        if (!depInfo.departs && !depInfo.isStalled) {
            const eligibleWaitingRoomCardIds = this.getEligibleWaitingRoomPassengerIds(busId);
            if (eligibleWaitingRoomCardIds.length > 0) {
                const hasBabyFirst = eligibleWaitingRoomCardIds.some(id => (this.getCardTypeArg(id) % 10) === 8);
                if (hasBabyFirst) {
                    this.bga.statusBar.setTitle(_('${you} must select the Baby from the Waiting Room first'));
                } else {
                    this.bga.statusBar.setTitle(_('${you} must select all eligible passengers from the Waiting Room'));
                }
                eligibleWaitingRoomCardIds.forEach(id => {
                    const el = document.getElementById(`card-${id}`);
                    if (el) el.classList.add('buu_selectable');
                });
                return;
            }
        }

        // 5. Hand Passengers Phase (if not skipped and not already refilling; Babies can board any matching bus on platform)
        const handSkipped = Boolean(this.draftManager.turnDraft.handSkipped);
        const refillIds = (this.draftManager.turnDraft.refillCardIds || []).map(Number);
        if (!handSkipped && refillIds.length === 0) {
            if (this.draftManager.babyHandId) {
                const babyId = Number(this.draftManager.babyHandId);
                const eligibleBuses = this.getEligibleBusesForHandCard(babyId);
                if (eligibleBuses.length > 0) {
                    this.bga.statusBar.setTitle(_('${you}: Select which matching bus on the platform the Baby should board'));
                    document.querySelectorAll('#my-hand-passengers .buu_card').forEach(el => {
                        const cId = Number(el.dataset.id);
                        if (this.getEligibleBusesForHandCard(cId).length > 0) {
                            el.classList.add('buu_selectable');
                        }
                        if (cId === babyId) {
                            el.classList.add('buu_selected');
                        }
                    });
                    eligibleBuses.forEach(bId => {
                        const bEl = document.getElementById(`card-${bId}`);
                        if (bEl) bEl.classList.add('buu_selectable');
                    });
                    return;
                } else {
                    this.draftManager.babyHandId = null;
                }
            }

            let eligibleCount = 0;
            document.querySelectorAll('#my-hand-passengers .buu_card').forEach(el => {
                const cId = Number(el.dataset.id);
                const eligibleBuses = this.getEligibleBusesForHandCard(cId);
                if (eligibleBuses.length > 0) {
                    el.classList.add('buu_selectable');
                    eligibleCount++;
                }
            });

            if (eligibleCount > 0) {
                this.bga.statusBar.setTitle(_('${you} may select passengers from your Hand to board the bus (or click Skip)'));
                return;
            }
        }

        // 7. Penalty Phase (if no boarding happened)
        if (this.isPenaltyRequired() && !this.draftManager.turnDraft.penaltyCardId) {
            this.bga.statusBar.setTitle(_('${you} had no passengers board this turn! Select 1 card from your hand to discard to Unhappies as a penalty'));
            document.querySelectorAll('#my-hand-passengers .buu_card').forEach(el => el.classList.add('buu_selectable'));
            document.querySelectorAll('#my-hand-buses .buu_card').forEach(el => el.classList.add('buu_selectable'));
            return;
        }

        // 8. Hand Refill Phase
        const busesInHandCount = document.querySelectorAll('#my-hand-buses .buu_card').length;
        const passengersInHandCount = document.querySelectorAll('#my-hand-passengers .buu_card').length;
        const nonRefillBuses = Array.from(document.querySelectorAll('#my-hand-buses .buu_card'))
            .filter(el => !refillIds.includes(Number(el.dataset.id))).length;
        const nonRefillPassengers = Array.from(document.querySelectorAll('#my-hand-passengers .buu_card'))
            .filter(el => !refillIds.includes(Number(el.dataset.id))).length;

        if (nonRefillBuses === 0 && nonRefillPassengers === 0) {
            this.bga.statusBar.setTitle(_('${you} have no more cards in hand! Confirm turn to end the round immediately.'));
            return;
        }

        const missingBuses = Math.max(0, 2 - busesInHandCount);
        const missingPassengers = Math.max(0, 7 - passengersInHandCount);

        const domGarageBuses = Array.from(document.querySelectorAll('#garage .buu_card.buu_bus')).map(el => Number(el.dataset.id));
        const domWrPassengers = Array.from(document.querySelectorAll('#waiting-room .buu_card.buu_passenger')).map(el => Number(el.dataset.id));

        const availableGarageBuses = domGarageBuses.length > 0 
            ? domGarageBuses.filter(id => !refillIds.includes(id)).length
            : (this.gamedatas?.garage || []).filter(c => !refillIds.includes(Number(c.id))).length;

        const availableWrPassengers = domWrPassengers.length > 0
            ? domWrPassengers.filter(id => !refillIds.includes(id) && !allBoardedIds.includes(id)).length
            : (this.gamedatas?.waiting_room || []).filter(c => !refillIds.includes(Number(c.id)) && !allBoardedIds.includes(Number(c.id))).length;

        const canRefillBus = missingBuses > 0 && availableGarageBuses > 0;
        const canRefillPassenger = missingPassengers > 0 && availableWrPassengers > 0;

        const busColorId = Math.floor(this.getCardTypeArg(busId) / 10);
        const busColorName = this.getColorName(busColorId) || '';
        const stalledPrefix = depInfo.isStalled
            ? _('${color} Bus stalled (unpaired Lover)! ').replace('${color}', busColorName)
            : '';

        if (canRefillBus || canRefillPassenger) {
            this.bga.statusBar.setTitle(stalledPrefix + _('${you} may select cards from Garage or Waiting Room to refill your hand'));
            
            if (canRefillBus) {
                const bottomBusId = this.getBottomGarageBusId();
                document.querySelectorAll('#garage .buu_card.buu_bus').forEach(el => {
                    const id = Number(el.dataset.id);
                    if (id === bottomBusId && !refillIds.includes(id)) {
                        el.classList.add('buu_selectable');
                    } else {
                        el.classList.add('buu_unselectable-visual');
                    }
                });
            }
            if (canRefillPassenger) {
                document.querySelectorAll('#waiting-room .buu_card.buu_passenger').forEach(el => {
                    const id = Number(el.dataset.id);
                    if (!refillIds.includes(id) && !allBoardedIds.includes(id)) el.classList.add('buu_selectable');
                });
            }
            return;
        }

        // 9. Completed state
        if (depInfo.isStalled) {
            this.bga.statusBar.setTitle(_('${you}: ${color} Bus is full but stalled by an unpaired Lover! Confirm turn when ready.').replace('${color}', busColorName));
        } else {
            this.bga.statusBar.setTitle(_('${you} have completed your turn actions. Confirm turn when ready.'));
        }
    }

    setup( gamedatas ) {
        this.gamedatas = gamedatas;

        // Main game area
        this.bga.gameArea.getElement().insertAdjacentHTML('beforeend', `
            <div id="bus-game-container">
                <div id="top-side">
                    <h3>My Hand</h3>
                    <div id="hand-container" class="buu_hand-container">
                        <div id="my-hand-passengers" class="buu_hand-zone"></div>
                        <div id="my-hand-buses" class="buu_hand-zone"></div>
                    </div>
                </div>
                <div id="bottom-layout">
                    <div id="left-side">
                        <h3>Waiting Room</h3>
                        <div id="waiting-room"></div>
                    </div>
                    <div id="center-side">
                        <h3>Platform</h3>
                        <div id="platform"></div>
                    </div>
                    <div id="right-side">
                        <h3>Garage</h3>
                        <div id="garage"></div>
                    </div>
                </div>
            </div>
            <div id="player-tables"></div>
        `);
        
        // Shared Departed Buses zone
        document.getElementById('player-tables').insertAdjacentHTML('beforeend', `
            <div id="departed-buses-container" class="buu_player-table">
                <div class="buu_player-zones">
                    <div class="buu_zone">
                        <h5>Departed Buses</h5>
                        <div id="departed-buses-zone" class="buu_card-zone buu_departed-buses-zone"></div>
                    </div>
                </div>
            </div>
        `);

        // Setting up player panels and hidden card zones
        Object.values(gamedatas.players).forEach(player => {
            this.bga.playerPanels.getElement(player.id).insertAdjacentHTML('beforeend', `
                <div class="buu_player-panel-stats">
                    <div class="buu_stat-row">
                        <i class="fa fa-male"></i> Passenger: <span id="passengers-counter-${player.id}">${player.passengers_count}</span>
                        <br/>
                        <i class="fa fa-frown-o"></i> Unhappy: <span id="unhappy-counter-${player.id}">${player.unhappies_count}</span>
                    </div>
                </div>
            `);

            document.getElementById('player-tables').insertAdjacentHTML('beforeend', `
                <div id="player-table-${player.id}" class="buu_player-table hide-zone">
                    <div class="buu_player-zones">
                        <div class="buu_zone hide-zone">
                            <h5>Passengers</h5>
                            <div id="passengers-zone-${player.id}" class="buu_card-zone"></div>
                        </div>
                        <div class="buu_zone hide-zone">
                            <h5>Unhappies</h5>
                            <div id="unhappies-zone-${player.id}" class="buu_card-zone"></div>
                        </div>
                    </div>
                </div>
            `);
        });
        
        // Render initial cards
        this.renderCards(gamedatas);

        // Setup help button
        this.setupHelp();

        // Setup game notifications
        this.setupNotifications();

        this.setupTooltips();

    }

    setupTooltips() {
        // Tooltips for passenger types
        Object.entries(this.gamedatas.passenger_types).forEach(([type, data]) => {
            const nodes = document.querySelectorAll(`.buu_card.buu_passenger.buu_arg-${type}`);
            nodes.forEach(node => {
                this.bga.gameui.addTooltip(node.id, `<b>${data.name}</b><br/>${data.description}`, '');
            });
        });
        
        // Tooltips for buses
        const buses = document.querySelectorAll('.buu_card.buu_bus');
        buses.forEach(node => {
            const classList = Array.from(node.classList);
            const argClass = classList.find(c => c.startsWith('buu_arg-'));
            if (argClass) {
                const cap = argClass.split('-')[1];
                this.bga.gameui.addTooltip(node.id, `<b>Bus</b><br/>Capacity: ${cap} passengers`, '');
            }
        });
    }

    setupHelp() {
        this.bga.gameArea.getElement().insertAdjacentHTML('beforeend', `
            <div id="help-button">?</div>
        `);
        
        document.getElementById('help-button').addEventListener('click', () => {
            this.showHelp();
        });
    }

    showHelp() {
        const dialog = new ebg.popindialog();
        dialog.create('bgaHelpDialog');
        dialog.setTitle(_("Passenger Abilities"));
        dialog.setContent(this.getHelpHtml());
        dialog.show();
        
        const underlayId = 'popin_bgaHelpDialog_underlay';
        if (document.getElementById(underlayId)) {
            document.getElementById(underlayId).addEventListener('click', () => dialog.hide());
        }
    }

    getHelpHtml() {
        return `
            <div class="buu_help-content">
                <ul>
                    <li><span class="buu_help-ability-name">${_("Anonymous")}</span>: ${_("No special skill.")}</li>
                    <li><span class="buu_help-ability-name">${_("Surfer")}</span>: ${_("Needs at least 2 empty spaces to board.")}</li>
                    <li><span class="buu_help-ability-name">${_("Lovers")}</span>: ${_("Always travel in pairs. If a bus reaches its max capacity with only one lover on board, the bus 'stalls' until the partner joins.")}</li>
                    <li><span class="buu_help-ability-name">${_("General")}</span>: ${_("Forces the bus to depart immediately. If a Lover is alone on the bus, they go to the Unhappies (a pair stays safe)!")}</li>
                    <li><span class="buu_help-ability-name">${_("Star")}</span>: ${_("At the start of your turn, you can call a bus from the Garage or another player's departed buses.")}</li>
                    <li><span class="buu_help-ability-name">${_("Drunkard")}</span>: ${_("When the bus departs, he sends 2 other passengers from that bus to the Unhappies.")}</li>
                    <li><span class="buu_help-ability-name">${_("Backpacker")}</span>: ${_("Wild color. Can board any bus.")}</li>
                    <li><span class="buu_help-ability-name">${_("Corrupter")}</span>: ${_("When boarding, you can swap a card from your hand with one in the Waiting Room or on the Platform.")}</li>
                    <li><span class="buu_help-ability-name">${_("Baby")}</span>: ${_("Gets priority in the Waiting Room (moves to Row 4 and must board first before other Waiting Room passengers). From your hand on your turn, can board any bus of its color on the platform, even if it is not the active bus.")}</li>
                </ul>
                
                <h3>${_("Scoring")}</h3>
                <ul>
                    <li>${_("+1 point per Passenger successfully transported.")}</li>
                    <li>${_("-1 point per Passenger in the Unhappies or still in hand.")}</li>
                    <li>${_("-Capacity points per Bus card remaining in hand.")}</li>
                    <li>${_("+4 points per pair of same-color Lovers.")}</li>
                </ul>
            </div>
        `;
    }

    renderCards(gamedatas) {
        // Garage (sorted by location_arg 1 to 4)
        const sortedGarage = [...gamedatas.garage].sort((a, b) => (a.location_arg || a.card_location_arg) - (b.location_arg || b.card_location_arg));
        sortedGarage.forEach(card => this.createCardElement(card, 'garage', card.location_arg || card.card_location_arg));

        // Waiting Room
        gamedatas.waiting_room.forEach(card => {
            this.createCardElement(card, 'waiting-room', card.location_arg);
        });

        // Hand
        gamedatas.hand.forEach(card => {
            const containerId = card.type === 'bus' ? 'my-hand-buses' : 'my-hand-passengers';
            this.createCardElement(card, containerId);
        });

        // Platform
        gamedatas.platform_buses.forEach(bus => {
            this.addBusToPlatform(bus);
            
            const passengers = gamedatas.platform_passengers.filter(p => p.location_arg == bus.id);
            passengers.forEach(p => this.createCardElement(p, `bus-${bus.id}-inner`));
        });

        // Other zones
        gamedatas.passengers_zone.forEach(card => this.createCardElement(card, `passengers-zone-${card.location_arg}`));
        gamedatas.unhappies_zone.forEach(card => this.createCardElement(card, `unhappies-zone-${card.location_arg}`));
        gamedatas.departed_buses.forEach(card => this.createCardElement(card, 'departed-buses-zone'));
    }

    addBusToPlatform(bus) {
        const id = bus.id || bus.card_id;
        
        // 1. Ensure stack wrapper exists
        let stackEl = document.getElementById(`bus-stack-${id}`);
        if (!stackEl) {
            document.getElementById('platform').insertAdjacentHTML('beforeend', `
                <div id="bus-stack-${id}" class="buu_bus-stack">
                    <button id="bus-toggle-${id}" class="buu_bus-toggle-btn"><i class="fa fa-expand"></i></button>
                    <div id="bus-${id}-inner" class="buu_bus-inner"></div>
                </div>
            `);
            stackEl = document.getElementById(`bus-stack-${id}`);
            
            const toggleBtn = document.getElementById(`bus-toggle-${id}`);
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleBusStack(id);
                });
            }
        }

        const innerEl = document.getElementById(`bus-${id}-inner`);

        // 2. Move or create card
        let el = document.getElementById(`card-${id}`);
        if (el) {
            // Move existing element (e.g. from hand)
            el.classList.remove('buu_selected', 'buu_selectable', 'buu_unselectable-visual');
            const orderEl = el.querySelector('.buu_card-selection-order');
            if (orderEl) orderEl.textContent = '';
            
            stackEl.insertBefore(el, innerEl);
            el.style.gridColumn = '';
            el.style.gridRow = '';
        } else {
            // Create new element
            this.createCardElement(bus, `bus-stack-${id}`);
            el = document.getElementById(`card-${id}`);
            stackEl.insertBefore(el, innerEl);
        }
    }

    toggleBusStack(busId) {
        const inner = document.getElementById(`bus-${busId}-inner`);
        const stack = document.getElementById(`bus-stack-${busId}`);
        if (inner) {
            inner.classList.toggle('buu_expanded');
            const isExpanded = inner.classList.contains('buu_expanded');
            
            if (stack) {
                stack.style.zIndex = isExpanded ? '5000' : '';
            }

            const btn = document.querySelector(`#bus-stack-${busId} .buu_bus-toggle-btn i`);
            if (btn) {
                btn.classList.toggle('fa-expand', !isExpanded);
                btn.classList.toggle('fa-compress', isExpanded);
            }
        }
    }

    createCardElement(card, containerId, position = null) {
        // Robust handling of both object (type, type_arg) and raw row (card_type, card_type_arg)
        const type = card.type || card.card_type;
        const typeArg = card.type_arg !== undefined ? card.type_arg : card.card_type_arg;
        const cardId = card.id || card.card_id;
        const locationArg = card.location_arg !== undefined ? card.location_arg : card.card_location_arg;

        if (type === undefined || typeArg === undefined) {
            console.error("Invalid card data for creation:", card);
            return;
        }

        const colorClass = `buu_color-${Math.floor(typeArg / 10)}`;
        const typeClass = `buu_${type}`;
        const arg = typeArg % 10;
        
        let content = '';
        if (type === 'bus') {
            content = `Cap: ${arg}`;
        } else {
            const abilityName = this.getAbilityName(arg);
            content = abilityName;
        }

        let style = '';
        if (containerId === 'waiting-room') {
            const pos = position || locationArg;
            const col = Math.floor(pos / 10);
            const row = pos % 10;
            style = `style="grid-column: ${col}; grid-row: ${row};"`;
        } else if (containerId === 'garage') {
            const pos = Number(position || locationArg || 0);
            if (pos >= 1 && pos <= 4) {
                style = `style="grid-column: 1; grid-row: ${pos};"`;
            }
        }

        const html = `
            <div id="card-${cardId}" class="buu_card ${typeClass} ${colorClass} buu_arg-${arg}" data-id="${cardId}" data-type="${type}" data-type-arg="${typeArg}" ${style}>
                <div class="buu_card-selection-order"></div>
            </div>
        `;

        const container = document.getElementById(containerId);
        if (container) {
            container.insertAdjacentHTML('beforeend', html);
            const el = document.getElementById(`card-${cardId}`);
            el.addEventListener('click', () => this.onCardClick(cardId));
        }
    }

    getAbilityName(abilityId) {
        const names = ['Anon', 'Surfer', 'Lovers', 'General', 'Star', 'Drunkard', 'Backpacker', 'Corrupter', 'Baby'];
        return names[abilityId] || 'Anon';
    }

    getColorName(colorId) {
        const names = { 1: _('Blue'), 2: _('Red'), 3: _('Green'), 4: _('Yellow'), 5: _('Purple'), 6: _('Black') };
        return names[colorId] || '';
    }

    onCardClick(cardId) {
        const el = document.getElementById(`card-${cardId}`);
        if (!el.classList.contains('buu_selectable')) return;

        const type = el.dataset.type;
        const containerId = el.parentElement.id;

        const activeState = this.bga.states.getCurrentPlayerStateClass();
        if (activeState && activeState.onCardClick) {
            activeState.onCardClick(cardId, type, containerId);
        }
    }

    setSelectable(type, selectable, containerId = null) {
        if (containerId === 'garage' && selectable) {
            const bottomBusId = this.getBottomGarageBusId();
            document.querySelectorAll('#garage .buu_card').forEach(el => {
                el.classList.remove('buu_selectable', 'buu_unselectable-visual');
                if (bottomBusId !== null && Number(el.dataset.id) === bottomBusId) {
                    el.classList.add('buu_selectable');
                } else {
                    el.classList.add('buu_unselectable-visual');
                }
            });
            return;
        }

        const selector = containerId ? `#${containerId} .buu_card` : '.buu_card';
        document.querySelectorAll(selector).forEach(el => {
            if (type === 'any' || el.dataset.type === type) {
                el.classList.toggle('buu_selectable', selectable);
                if (!selectable) {
                    el.classList.remove('buu_unselectable-visual');
                }
            }
        });
    }

    selectCard(cardId, selected, order = null) {
        const el = document.getElementById(`card-${cardId}`);
        if (!el) return;
        el.classList.toggle('buu_selected', selected);
        
        // If it's a bus on the platform, toggle class on its stack container
        const stack = el.closest('.buu_bus-stack');
        if (stack) {
            stack.classList.toggle('buu_selected-stack', selected);
        }

        const orderEl = el.querySelector('.buu_card-selection-order');
        if (orderEl) {
            orderEl.textContent = order ? order : '';
        }
    }

    clearCardSelection() {
        document.querySelectorAll('.buu_card.buu_selected').forEach(el => {
            el.classList.remove('buu_selected');
            const orderEl = el.querySelector('.buu_card-selection-order');
            if (orderEl) orderEl.textContent = '';
        });
        document.querySelectorAll('.buu_bus-stack.buu_selected-stack').forEach(el => {
            el.classList.remove('buu_selected-stack');
        });
    }

    getCardType(cardId) {
        const el = document.getElementById(`card-${cardId}`);
        if (el && el.dataset.type) {
            return el.dataset.type;
        }

        const allCards = [
            ...this.gamedatas.hand,
            ...this.gamedatas.garage,
            ...this.gamedatas.waiting_room,
            ...this.gamedatas.platform_buses,
            ...this.gamedatas.platform_passengers,
            ...this.gamedatas.passengers_zone,
            ...this.gamedatas.unhappies_zone,
            ...this.gamedatas.departed_buses
        ];
        const card = allCards.find(c => c.id == cardId);
        return card ? (card.type || card.card_type) : 'passenger';
    }

    getCardTypeArg(cardId) {
        const idNum = Number(cardId);
        const el = document.getElementById(`card-${idNum}`);
        if (el) {
            const attr = el.getAttribute('data-type-arg') || el.dataset.typeArg;
            if (attr !== null && attr !== undefined && attr !== '') {
                return parseInt(attr, 10);
            }
        }

        const allCards = [
            ...(this.gamedatas?.hand || []),
            ...(this.gamedatas?.garage || []),
            ...(this.gamedatas?.waiting_room || []),
            ...(this.gamedatas?.platform_buses || []),
            ...(this.gamedatas?.platform_passengers || []),
            ...(this.gamedatas?.passengers_zone || []),
            ...(this.gamedatas?.unhappies_zone || []),
            ...(this.gamedatas?.departed_buses || [])
        ];
        const card = allCards.find(c => Number(c.id || c.card_id) === idNum);
        return card ? parseInt(card.type_arg || card.card_type_arg || 0, 10) : 0;
    }

    isBusStalled(busId) {
        const busOcc = this.getBusOccupancy(busId);
        if (!busOcc || !busOcc.isFull) return false;

        const passengers = this.getPassengersInBus(busId);
        const hasGeneral = passengers.some(p => (this.getCardTypeArg(p.id) % 10) === 3);
        const loverCount = passengers.filter(p => (this.getCardTypeArg(p.id) % 10) === 2).length;

        return !hasGeneral && (loverCount % 2 !== 0);
    }

    setupNotifications() {
        this.bga.notifications.setupPromiseNotifications({
            busDeparted: 1000,
            passengerToUnhappies: 1000,
            busStalled: 1000,
            busPlaced: 1000,
            busSelected: 1000,
            passengerBoarded: 1000,
            passengerPlayed: 1000,
            garageRefilled: 1000,
            starUsed: 1000,
            babiesPrioritized: 1000,
            waitingRoomRefilled: 1000,
            waitingRoomSlid: 1000,
            handRefilled: 1000,
            corrupterSwap: 1000,
            drunkardVictimsSelected: 1000,
            penaltyTaken: 1000,
            roundEndTriggered: 1500,
            scoring: 3000,
            newRound: 1000,
            newHand: 1000,
        });
    }

    notif_roundEndTriggered(args) {
        const handCards = args.hand ? Object.values(args.hand) : [];
        const descriptions = handCards.map(c => {
            const typeArg = Number(c.type_arg ?? c.card_type_arg ?? 0);
            const colorName = this.getColorName(Math.floor(typeArg / 10));
            const abilityName = this.getAbilityName(typeArg % 10);
            return `${colorName} ${abilityName}`;
        });
        const handText = descriptions.length > 0 ? descriptions.join(', ') : _('Empty');
        const msg = _('${player_name} shows hand (${cards}) and triggers the last turn of the round!')
            .replace('${player_name}', args.player_name || '')
            .replace('${cards}', handText);
        this.bga.gameui.showMessage(msg, 'info');
    }

    notif_penaltyTaken(args) {
        const playerId = args.player_id;
        const cardId = args.card_id;
        let el = document.getElementById(`card-${cardId}`);
        
        if (!el && args.card_data) {
            this.createCardElement(args.card_data, `unhappies-zone-${playerId}`);
            el = document.getElementById(`card-${cardId}`);
        } else if (el) {
            this.selectCard(cardId, false);
            const targetZone = document.getElementById(`unhappies-zone-${playerId}`);
            if (targetZone) targetZone.appendChild(el);
            el.style.gridColumn = '';
            el.style.gridRow = '';
        }
        this.clearDraftDataset(el);

        this.updatePlayerCounts();
        this.bga.sounds.play('move');
    }

    notif_drunkardVictimsSelected(args) {
        const playerId = args.player_id;
        if (this.gamedatas?.platform_passengers) {
            this.gamedatas.platform_passengers = this.gamedatas.platform_passengers.filter(
                p => Number(p.location_arg || p.card_location_arg) !== Number(args.bus_id)
            );
        }
        
        // 1. Move victims to Unhappies
        (args.victim_ids || []).forEach(vId => {
            const el = document.getElementById(`card-${vId}`);
            if (el) {
                this.selectCard(vId, false);
                this.clearDraftDataset(el);
                const unhappiesZone = document.getElementById(`unhappies-zone-${playerId}`);
                if (unhappiesZone) unhappiesZone.appendChild(el);
            }
        });

        // 2. Move rest of passengers to DashBoard (passengers zone)
        if (args.passenger_ids) {
            args.passenger_ids.forEach(pId => {
                const pEl = document.getElementById(`card-${pId}`);
                if (pEl) {
                    this.clearDraftDataset(pEl);
                    const passZone = document.getElementById(`passengers-zone-${playerId}`);
                    if (passZone) passZone.appendChild(pEl);
                }
            });
        }
        const busInner = document.getElementById(`bus-${args.bus_id}-inner`);
        if (busInner) {
            const passengers = busInner.querySelectorAll('.buu_card');
            passengers.forEach(pEl => {
                this.clearDraftDataset(pEl);
                const passZone = document.getElementById(`passengers-zone-${playerId}`);
                if (passZone) passZone.appendChild(pEl);
            });
        }
        this.updatePlayerCounts();

        // 3. Move bus to Departed
        const busEl = document.getElementById(`card-${args.bus_id}`);
        if (busEl) {
            this.clearDraftDataset(busEl);
            const depZone = document.getElementById('departed-buses-zone');
            if (depZone) depZone.appendChild(busEl);
            busEl.classList.remove('buu_selected', 'buu_selectable', 'buu_stalled-visual', 'buu_draft-placed', 'buu_draft-selected', 'buu_draft-departed', 'buu_unselectable-visual');
        }
        if (this.gamedatas) {
            if (!this.gamedatas.departed_buses) this.gamedatas.departed_buses = [];
            const bIdNum = Number(args.bus_id);
            if (!this.gamedatas.departed_buses.some(b => Number(b.id || b.card_id) === bIdNum)) {
                this.gamedatas.departed_buses.push({
                    id: bIdNum,
                    type: 'bus',
                    type_arg: this.getCardTypeArg(bIdNum),
                    location: 'departed_buses',
                    location_arg: Number(playerId)
                });
            }
        }

        // 4. Cleanup stack and toggle
        const toggleEl = document.getElementById(`bus-toggle-${args.bus_id}`);
        if (toggleEl) toggleEl.remove();

        const stackEl = document.getElementById(`bus-stack-${args.bus_id}`);
        if (stackEl) stackEl.remove();

        const innerEl = document.getElementById(`bus-${args.bus_id}-inner`);
        if (innerEl) innerEl.remove();

        // 5. Re-arrange remaining buses in platform
        if (args.platform_buses) {
            if (this.gamedatas) {
                this.gamedatas.platform_buses = args.platform_buses;
            }
            args.platform_buses.forEach(bus => {
                const sEl = document.getElementById(`bus-stack-${bus.id}`);
                if (sEl) {
                    document.getElementById('platform').appendChild(sEl);
                }
            });
        }

        this.bga.sounds.play('move');
    }

    notif_corrupterSwap(args) {
        const isMe = args.player_id == this.bga.players.getCurrentPlayerId();
        
        let handEl = document.getElementById(`card-${args.hand_card_id}`);
        let targetEl = document.getElementById(`card-${args.target_card_id}`);

        // 1. Ensure elements exist
        if (!handEl && args.hand_card_data) {
            this.createCardElement(args.hand_card_data, 'center-side');
            handEl = document.getElementById(`card-${args.hand_card_id}`);
        }
        if (!targetEl && args.target_card_data) {
            this.createCardElement(args.target_card_data, 'center-side');
            targetEl = document.getElementById(`card-${args.target_card_id}`);
        }

        const newLoc = args.hand_card_data ? (args.hand_card_data.location || args.hand_card_data.card_location) : null;
        const newLocArg = args.hand_card_data ? Number(args.hand_card_data.location_arg ?? args.hand_card_data.card_location_arg ?? 0) : 0;

        if (this.gamedatas?.platform_passengers) {
            this.gamedatas.platform_passengers = this.gamedatas.platform_passengers.filter(
                p => Number(p.id || p.card_id) !== Number(args.target_card_id)
            );
            if (newLoc === 'in_bus' && newLocArg > 0 && args.hand_card_data) {
                this.gamedatas.platform_passengers.push(args.hand_card_data);
            }
        }
        if (this.gamedatas?.waiting_room) {
            this.gamedatas.waiting_room = this.gamedatas.waiting_room.filter(
                c => Number(c.id || c.card_id) !== Number(args.target_card_id)
            );
            if (newLoc === 'waiting_room' && args.hand_card_data) {
                this.gamedatas.waiting_room.push(args.hand_card_data);
            }
        }

        this.selectCard(args.hand_card_id, false);
        this.selectCard(args.target_card_id, false);

        // 2. Move hand card to target location using authoritative server data (safe even if draft already moved it)
        if (handEl) {
            if (newLoc === 'waiting_room') {
                const wrContainer = document.getElementById('waiting-room');
                if (wrContainer) wrContainer.appendChild(handEl);
                const col = Math.floor(newLocArg / 10);
                const row = newLocArg % 10;
                handEl.style.gridColumn = col ? String(col) : '';
                handEl.style.gridRow = row ? String(row) : '';
            } else if (newLoc === 'in_bus' && newLocArg > 0) {
                const busInner = document.getElementById(`bus-${newLocArg}-inner`);
                if (busInner) busInner.appendChild(handEl);
                handEl.style.gridColumn = '';
                handEl.style.gridRow = '';
            } else if (targetEl && targetEl.parentElement) {
                const targetParent = targetEl.parentElement;
                const targetStyle = targetEl.getAttribute('style');
                targetParent.appendChild(handEl);
                if (targetStyle) {
                    handEl.setAttribute('style', targetStyle);
                } else {
                    handEl.style.gridColumn = '';
                    handEl.style.gridRow = '';
                }
            }
        }

        // 3. Target card moves to hand (or removed if not me)
        if (targetEl) {
            if (isMe) {
                const type = this.getCardType(args.target_card_id);
                const containerId = type === 'bus' ? 'my-hand-buses' : 'my-hand-passengers';
                document.getElementById(containerId).appendChild(targetEl);
                targetEl.style.gridColumn = '';
                targetEl.style.gridRow = '';
            } else {
                targetEl.remove();
            }
        }

        this.clearDraftDataset(handEl);
        this.clearDraftDataset(targetEl);
        this.bga.sounds.play('move');
    }

    notif_busPlaced(args) {
        if (this.gamedatas && args.bus_data) {
            const bId = Number(args.bus_data.id || args.bus_data.card_id);
            if (this.gamedatas.garage) {
                this.gamedatas.garage = this.gamedatas.garage.filter(b => Number(b.id || b.card_id) !== bId);
            }
            if (this.gamedatas.departed_buses) {
                this.gamedatas.departed_buses = this.gamedatas.departed_buses.filter(b => Number(b.id || b.card_id) !== bId);
            }
            if (!this.gamedatas.platform_buses) this.gamedatas.platform_buses = [];
            if (!this.gamedatas.platform_buses.some(b => Number(b.id || b.card_id) === bId)) {
                this.gamedatas.platform_buses.push(args.bus_data);
            }
        }
        if (this.gamedatas && args.star_data) {
            if (!this.gamedatas.platform_passengers) this.gamedatas.platform_passengers = [];
            const sId = Number(args.star_data.id || args.star_data.card_id);
            if (!this.gamedatas.platform_passengers.some(p => Number(p.id || p.card_id) === sId)) {
                this.gamedatas.platform_passengers.push(args.star_data);
            }
        }
        this.addBusToPlatform(args.bus_data);
        const busId = args.bus_data ? (args.bus_data.id || args.bus_data.card_id) : args.card_id;
        this.clearDraftDataset(document.getElementById(`card-${busId}`));
        this.bga.sounds.play('move');
    }

    notif_busSelected(args) {
        // Just a visual highlight or log
        this.bga.sounds.play('move');
    }

    notif_passengerBoarded(args) {
        if (this.gamedatas?.waiting_room) {
            this.gamedatas.waiting_room = this.gamedatas.waiting_room.filter(c => Number(c.id) !== Number(args.passenger_id));
        }
        if (this.gamedatas?.platform_passengers && args.passenger_data) {
            this.gamedatas.platform_passengers.push(args.passenger_data);
        }
        this.handleBoarding(args.bus_id, [args.passenger_id]);
    }

    notif_passengerPlayed(args) {
        const pId = args.passenger_id;
        if (this.gamedatas?.platform_passengers && args.passenger_data) {
            this.gamedatas.platform_passengers.push(args.passenger_data);
        }
        let pEl = document.getElementById(`card-${pId}`);
        if (!pEl) {
            // Passenger was in someone else's hand, need to create it
            this.createCardElement(args.passenger_data, 'center-side'); // Temporary container
            pEl = document.getElementById(`card-${pId}`);
        }
        this.handleBoarding(args.bus_id, [pId]);
    }

    notif_busDeparted(args) {
        const playerId = args.player_id;
        const busId = args.bus_id;
        if (this.gamedatas?.platform_passengers) {
            this.gamedatas.platform_passengers = this.gamedatas.platform_passengers.filter(
                p => Number(p.location_arg || p.card_location_arg) !== Number(busId)
            );
        }
        const busEl = document.getElementById(`card-${busId}`);
        const stackEl = document.getElementById(`bus-stack-${busId}`);
        const toggleEl = document.getElementById(`bus-toggle-${busId}`);

        // 1. Move passengers out of the stack FIRST
        args.passenger_ids.forEach(pId => {
            const pEl = document.getElementById(`card-${pId}`);
            if (pEl) {
                this.clearDraftDataset(pEl);
                const passZone = document.getElementById(`passengers-zone-${playerId}`);
                if (passZone) passZone.appendChild(pEl);
                pEl.classList.remove('buu_selected', 'buu_selectable', 'buu_unselectable-visual');
            }
        });
        this.updatePlayerCounts();

        // 2. Move bus to Departed
        if (busEl) {
            this.clearDraftDataset(busEl);
            const depZone = document.getElementById('departed-buses-zone');
            if (depZone) depZone.appendChild(busEl);
            busEl.classList.remove('buu_selected', 'buu_selectable', 'buu_stalled-visual', 'buu_draft-placed', 'buu_draft-selected', 'buu_draft-departed', 'buu_unselectable-visual');
        }
        if (this.gamedatas) {
            if (!this.gamedatas.departed_buses) this.gamedatas.departed_buses = [];
            const bIdNum = Number(busId);
            if (!this.gamedatas.departed_buses.some(b => Number(b.id || b.card_id) === bIdNum)) {
                this.gamedatas.departed_buses.push({
                    id: bIdNum,
                    type: 'bus',
                    type_arg: this.getCardTypeArg(bIdNum),
                    location: 'departed_buses',
                    location_arg: Number(playerId)
                });
            }
        }

        // 3. Cleanup stack and toggle
        if (toggleEl) {
            toggleEl.remove();
        }

        if (stackEl) {
            stackEl.remove();
        }

        const innerEl = document.getElementById(`bus-${busId}-inner`);
        if (innerEl) innerEl.remove();

        // 4. Re-arrange remaining buses in platform
        if (args.platform_buses) {
            if (this.gamedatas) {
                this.gamedatas.platform_buses = args.platform_buses;
            }
            args.platform_buses.forEach(bus => {
                const sEl = document.getElementById(`bus-stack-${bus.id}`);
                if (sEl) {
                    document.getElementById('platform').appendChild(sEl);
                }
            });
        }

        this.bga.sounds.play('move');
    }

    notif_passengerToUnhappies(args) {
        const pEl = document.getElementById(`card-${args.passenger_id}`);
        if (pEl) {
            const unhappiesZone = document.getElementById(`unhappies-zone-${args.player_id}`);
            if (unhappiesZone) unhappiesZone.appendChild(pEl);
        }
        this.updatePlayerCounts();
        this.bga.sounds.play('move');
    }

    notif_busStalled(args) {
        const busColorId = args && args.bus_id ? Math.floor(this.getCardTypeArg(args.bus_id) / 10) : 0;
        const colorName = this.getColorName(busColorId);
        const msg = colorName
            ? _('${color} Bus stalled! A Lover is missing their partner.').replace('${color}', colorName)
            : _('Bus stalls! A Lover is missing their partner.');
        this.bga.gameui.showMessage(msg, 'info');
    }

    notif_garageRefilled(args) {
        if (args.garage) {
            if (this.gamedatas) this.gamedatas.garage = args.garage;
            document.getElementById('garage').innerHTML = '';
            args.garage.sort((a, b) => (a.location_arg || a.card_location_arg) - (b.location_arg || b.card_location_arg));
            args.garage.forEach(bus => {
                this.createCardElement(bus, 'garage', bus.location_arg || bus.card_location_arg);
            });
        } else if (args.newBuses) {
            args.newBuses.forEach(bus => {
                this.createCardElement(bus, 'garage', bus.location_arg || bus.card_location_arg);
            });
        }

        const activeState = this.bga.states.getCurrentPlayerStateName();
        if (activeState === 'RefillHand' && this.bga.players.isActive()) {
            this.setSelectable('bus', true, 'garage');
        }
        this.bga.sounds.play('move');
    }

    notif_starUsed(args) {
        const isMe = args.player_id == this.bga.players.getCurrentPlayerId();
        
        if (this.gamedatas && args.bus_data) {
            const bId = Number(args.bus_data.id || args.bus_data.card_id);
            if (this.gamedatas.garage) {
                this.gamedatas.garage = this.gamedatas.garage.filter(b => Number(b.id || b.card_id) !== bId);
            }
            if (this.gamedatas.departed_buses) {
                this.gamedatas.departed_buses = this.gamedatas.departed_buses.filter(b => Number(b.id || b.card_id) !== bId);
            }
            if (!this.gamedatas.platform_buses) this.gamedatas.platform_buses = [];
            if (!this.gamedatas.platform_buses.some(b => Number(b.id || b.card_id) === bId)) {
                this.gamedatas.platform_buses.push(args.bus_data);
            }
        }
        if (this.gamedatas && args.star_data) {
            if (!this.gamedatas.platform_passengers) this.gamedatas.platform_passengers = [];
            const sId = Number(args.star_data.id || args.star_data.card_id);
            if (!this.gamedatas.platform_passengers.some(p => Number(p.id || p.card_id) === sId)) {
                this.gamedatas.platform_passengers.push(args.star_data);
            }
        }

        // 1. Add bus to platform (handles existing or new)
        this.addBusToPlatform(args.bus_data);
        this.clearDraftDataset(document.getElementById(`card-${args.bus_id}`));
        
        const innerEl = document.getElementById(`bus-${args.bus_id}-inner`);

        // 2. Handle Star card movement into the bus
        let starEl = document.getElementById(`card-${args.star_id}`);
        if (!starEl) {
            // If it's not me, create the star card (since it was hidden in hand)
            this.createCardElement(args.star_data, `bus-${args.bus_id}-inner`);
            starEl = document.getElementById(`card-${args.star_id}`);
        }

        if (starEl) {
            this.selectCard(args.star_id, false);
            this.clearDraftDataset(starEl);
            starEl.classList.remove('buu_selected', 'buu_selectable', 'buu_unselectable-visual');
            starEl.style.gridColumn = '';
            starEl.style.gridRow = '';
            innerEl.appendChild(starEl);
        }
        
        this.bga.sounds.play('move');
    }

    notif_handRefilled(args) {
        const isMe = args.player_id == this.bga.players.getCurrentPlayerId();
        
        args.card_ids.forEach(cardId => {
            if (this.gamedatas?.waiting_room) {
                this.gamedatas.waiting_room = this.gamedatas.waiting_room.filter(c => Number(c.id || c.card_id) !== Number(cardId));
            }
            if (this.gamedatas?.garage) {
                this.gamedatas.garage = this.gamedatas.garage.filter(c => Number(c.id || c.card_id) !== Number(cardId));
            }
            const el = document.getElementById(`card-${cardId}`);
            if (el) {
                this.selectCard(cardId, false);
                this.clearDraftDataset(el);
                el.classList.remove('buu_selected', 'buu_selectable', 'buu_unselectable-visual');

                if (isMe) {
                    const type = this.getCardType(cardId);
                    const containerId = type === 'bus' ? 'my-hand-buses' : 'my-hand-passengers';
                    document.getElementById(containerId).appendChild(el);
                    el.style.gridColumn = '';
                    el.style.gridRow = '';
                } else {
                    el.remove();
                }
            }
        });
        this.bga.sounds.play('move');
    }

    syncWaitingRoomDom(waitingRoomCards) {
        if (!Array.isArray(waitingRoomCards)) return;
        if (this.gamedatas) {
            this.gamedatas.waiting_room = waitingRoomCards;
        }
        const wrContainer = document.getElementById('waiting-room');
        waitingRoomCards.forEach(card => {
            const cardId = card.id || card.card_id;
            const locArg = Number(card.location_arg !== undefined ? card.location_arg : card.card_location_arg);
            let el = document.getElementById(`card-${cardId}`);
            if (!el) {
                this.createCardElement(card, 'waiting-room', locArg);
                el = document.getElementById(`card-${cardId}`);
            }
            if (el) {
                this.selectCard(cardId, false);
                this.clearDraftDataset(el);
                el.classList.remove('buu_selected', 'buu_selectable', 'buu_unselectable-visual');
                if (wrContainer && el.parentElement !== wrContainer) {
                    wrContainer.appendChild(el);
                }
                const col = Math.floor(locArg / 10);
                const row = locArg % 10;
                el.style.gridColumn = String(col);
                el.style.gridRow = String(row);
            }
        });
    }

    notif_babiesPrioritized(args) {
        if (args.waitingRoom) {
            this.syncWaitingRoomDom(args.waitingRoom);
        }
        this.bga.sounds.play('move');
    }

    notif_waitingRoomSlid(args) {
        if (args.waitingRoom) {
            this.syncWaitingRoomDom(args.waitingRoom);
        }
        this.bga.sounds.play('move');
    }

    notif_waitingRoomRefilled(args) {
        if (args.waitingRoom) {
            this.syncWaitingRoomDom(args.waitingRoom);
        } else if (args.newCards) {
            if (this.gamedatas) {
                if (!this.gamedatas.waiting_room) this.gamedatas.waiting_room = [];
                this.gamedatas.waiting_room.push(...args.newCards);
            }
            args.newCards.forEach(card => {
                const cardId = card.id || card.card_id;
                if (!document.getElementById(`card-${cardId}`)) {
                    this.createCardElement(card, 'waiting-room', card.location_arg);
                }
            });
        }

        // If current player is refilling hand, mark these new passengers as selectable
        const activeState = this.bga.states.getCurrentPlayerStateName();
        if (activeState === 'RefillHand' && this.bga.players.isActive()) {
            this.setSelectable('passenger', true, 'waiting-room');
        }
        this.bga.sounds.play('move');
    }

    handleBoarding(busId, passengerIds) {
        const busEl = document.getElementById(`card-${busId}`);
        if (busEl) {
            let inner = document.getElementById(`bus-${busId}-inner`);
            if (!inner) {
                const stack = busEl.parentElement;
                stack.insertAdjacentHTML('beforeend', `<div id="bus-${busId}-inner" class="buu_bus-inner"></div>`);
                inner = document.getElementById(`bus-${busId}-inner`);
            }
            passengerIds.forEach(pId => {
                const pEl = document.getElementById(`card-${pId}`);
                if (pEl) {
                    this.selectCard(pId, false);
                    this.clearDraftDataset(pEl);
                    pEl.classList.remove('buu_selected', 'buu_selectable', 'buu_unselectable-visual');
                    pEl.style.gridColumn = '';
                    pEl.style.gridRow = '';
                    inner.appendChild(pEl);
                }
            });
            this.bga.sounds.play('move');
        }
    }

    clearBoard() {
        // Clear card zones
        document.getElementById('my-hand-buses').innerHTML = '';
        document.getElementById('my-hand-passengers').innerHTML = '';
        document.getElementById('waiting-room').innerHTML = '';
        document.getElementById('platform').innerHTML = '';
        
        const departedBusesZone = document.getElementById('departed-buses-zone');
        if (departedBusesZone) departedBusesZone.innerHTML = '';

        // Clear player boards for all players
        Object.keys(this.gamedatas.players).forEach(pId => {
            const passengersZone = document.getElementById(`passengers-zone-${pId}`);
            if (passengersZone) passengersZone.innerHTML = '';
            
            const unhappiesZone = document.getElementById(`unhappies-zone-${pId}`);
            if (unhappiesZone) unhappiesZone.innerHTML = '';
            
            const unhappyCounter = document.getElementById(`unhappy-counter-${pId}`);
            if (unhappyCounter) unhappyCounter.textContent = '0';
        });
        
        // Also remove any residual card elements floating in the DOM
        document.querySelectorAll('.buu_card').forEach(el => el.remove());

        if (this.gamedatas) {
            this.gamedatas.platform_buses = [];
            this.gamedatas.platform_passengers = [];
            this.gamedatas.passengers_zone = [];
            this.gamedatas.unhappies_zone = [];
            this.gamedatas.departed_buses = [];
        }
        this.updatePlayerCounts();
    }

    notif_scoring(args) {
        // Update the score counters in the BGA top panel
        Object.keys(args.new_scores).forEach(pId => {
            const scoreCounter = this.bga.playerPanels.getScoreCounter(pId);
            if (scoreCounter) {
                scoreCounter.toValue(args.new_scores[pId]);
            }
        });

        // Show a custom popup dialog summarizing the points
        const dialog = new ebg.popindialog();
        dialog.create('roundScoringDialog');
        dialog.setTitle(_("Round Scoring Details"));
        
        let html = `<div class="buu_scoring-popup">`;
        
        Object.keys(args.scores).forEach(pId => {
            const playerDetails = args.scores[pId];
            const playerName = this.gamedatas.players[pId].name;
            const playerColor = this.gamedatas.players[pId].color;
            
            html += `
                <div class="buu_player-scoring-block" style="border-left: 5px solid #${playerColor}; margin-bottom: 15px; padding-left: 10px;">
                    <h4 style="margin-top: 0; margin-bottom: 5px; color: #${playerColor};">${playerName}</h4>
                    <table class="buu_scoring-table" style="width: 100%; text-align: left; border-collapse: collapse;">
                        <tr><td>${_("Passengers Transported (+1 pt)")}:</td><td style="text-align: right; font-weight: bold; color: green;">+${playerDetails.passengers}</td></tr>
                        <tr><td>${_("Lovers Pairs Bonus (+4 pts)")}:</td><td style="text-align: right; font-weight: bold; color: green;">+${playerDetails.lovers_bonus}</td></tr>
                        <tr><td>${_("Night Buses (+1 pt/pass on platform)")}:</td><td style="text-align: right; font-weight: bold; color: green;">+${playerDetails.night_buses}</td></tr>
                        <tr><td>${_("Unhappy Passengers (-1 pt)")}:</td><td style="text-align: right; font-weight: bold; color: red;">${playerDetails.unhappies}</td></tr>
                        <tr><td>${_("Passengers in Hand (-1 pt)")}:</td><td style="text-align: right; font-weight: bold; color: red;">${playerDetails.hand_passengers}</td></tr>
                        <tr><td>${_("Buses in Hand (-capacity)")}:</td><td style="text-align: right; font-weight: bold; color: red;">${playerDetails.hand_buses}</td></tr>
                        <tr style="border-top: 1px solid #ccc; font-weight: bold;"><td>${_("Round Total")}:</td><td style="text-align: right; font-size: 16px;">${playerDetails.total >= 0 ? '+' : ''}${playerDetails.total}</td></tr>
                    </table>
                </div>
            `;
        });
        
        html += `</div>`;
        dialog.setContent(html);
        dialog.show();

        const underlayId = 'popin_roundScoringDialog_underlay';
        if (document.getElementById(underlayId)) {
            document.getElementById(underlayId).addEventListener('click', () => dialog.hide());
        }
    }

    notif_newRound(args) {
        this.clearBoard();
        if (this.gamedatas) {
            this.gamedatas.garage = args.garage || [];
            this.gamedatas.waiting_room = args.waiting_room || [];
        }
        
        // Render garage
        (args.garage || []).forEach(card => this.createCardElement(card, 'garage', card.location_arg || card.card_location_arg));
        
        // Render waiting room
        (args.waiting_room || []).forEach(card => {
            this.createCardElement(card, 'waiting-room', card.location_arg);
        });
    }

    notif_newHand(args) {
        // Clear any old hand elements just in case
        document.getElementById('my-hand-buses').innerHTML = '';
        document.getElementById('my-hand-passengers').innerHTML = '';
        if (this.gamedatas) {
            this.gamedatas.hand = args.hand || [];
        }
        
        // Render new hand
        (args.hand || []).forEach(card => {
            const containerId = card.type === 'bus' ? 'my-hand-buses' : 'my-hand-passengers';
            this.createCardElement(card, containerId);
        });

        this.setupTooltips();
        if (this.draftManager) {
            this.draftManager.reset();
        }
        if (this.activeBus) {
            this.activeBus.updateButtons();
        }
    }
}