export class TurnDraftManager {
    constructor(game) {
        this.game = game;
        this.turnDraft = {
            busAction: null,
            boardWaitingRoom: [],
            boardHand: [],
            boardHandBusMap: {},
            corrupterSwaps: [],
            corrupterSkipped: false,
            corrupterSkippedCount: 0,
            drunkardVictims: [],
            penaltyCardId: null,
            refillCardIds: []
        };
        this.history = [];
        this.corrupterHandId = null;
        this.babyHandId = null;
        this.stalledNotifiedBuses = new Set();
    }

    restoreAllDomCards() {
        document.querySelectorAll('.buu_card').forEach(el => {
            el.classList.remove('buu_draft-placed', 'buu_draft-selected', 'buu_draft-departed', 'buu_stalled-visual', 'buu_drunkard-candidate');
            if (el.dataset.originalParent) {
                const parent = document.getElementById(el.dataset.originalParent);
                if (parent) {
                    const innerEl = parent.classList.contains('buu_bus-stack') ? parent.querySelector('.buu_bus-inner') : null;
                    if (innerEl && el.classList.contains('buu_bus')) {
                        parent.insertBefore(el, innerEl);
                    } else {
                        parent.appendChild(el);
                    }
                    el.style.gridColumn = el.dataset.originalGridColumn || '';
                    el.style.gridRow = el.dataset.originalGridRow || '';
                }
                delete el.dataset.originalParent;
                delete el.dataset.originalGridColumn;
                delete el.dataset.originalGridRow;
            }
        });
        document.querySelectorAll('#platform .buu_bus-stack').forEach(stackEl => {
            stackEl.style.display = '';
            stackEl.style.zIndex = '';
        });
        document.querySelectorAll('.buu_drunkard-selecting, .buu_corrupter-expanded').forEach(el => {
            el.classList.remove('buu_expanded', 'buu_drunkard-selecting', 'buu_corrupter-expanded');
        });
    }

    reset() {
        this.restoreAllDomCards();
        this.turnDraft = {
            busAction: null,
            boardWaitingRoom: [],
            boardHand: [],
            boardHandBusMap: {},
            corrupterSwaps: [],
            corrupterSkipped: false,
            corrupterSkippedCount: 0,
            drunkardVictims: [],
            penaltyCardId: null,
            refillCardIds: []
        };
        this.history = [];
        this.corrupterHandId = null;
        this.babyHandId = null;
        this.stalledNotifiedBuses = new Set();
        if (this.game && this.game.gamedatas) {
            this.updateVisuals();
        }
    }

    pushState() {
        const copy = JSON.parse(JSON.stringify(this.turnDraft));
        this.history.push(copy);
    }

    canUndo() {
        return this.history.length > 0;
    }

    undo() {
        if (this.corrupterHandId || this.babyHandId) {
            this.corrupterHandId = null;
            this.babyHandId = null;
            this.updateVisuals();
            return true;
        }
        if (this.canUndo()) {
            this.turnDraft = this.history.pop();
            this.corrupterHandId = null;
            this.babyHandId = null;
            this.updateVisuals();
            return true;
        }
        return false;
    }

    recordBusAction(actionObj) {
        this.pushState();
        this.turnDraft.busAction = actionObj;
    }

    recordBoardWaitingRoom(cardId) {
        this.pushState();
        this.turnDraft.boardWaitingRoom.push(cardId);
    }

    recordBoardHand(cardId, targetBusId = null) {
        this.pushState();
        const cId = Number(cardId);
        this.turnDraft.boardHand.push(cId);
        if (!this.turnDraft.boardHandBusMap) this.turnDraft.boardHandBusMap = {};
        const defaultBusId = this.turnDraft.busAction ? Number(this.turnDraft.busAction.busId) : null;
        this.turnDraft.boardHandBusMap[cId] = Number(targetBusId || defaultBusId);
    }

    recordCorrupterSwap(handCardId, targetCardId) {
        this.pushState();
        if (!this.turnDraft.corrupterSwaps) this.turnDraft.corrupterSwaps = [];
        const targetEl = document.getElementById(`card-${targetCardId}`);
        const busStack = targetEl ? targetEl.closest('.buu_bus-stack') : null;
        const targetBusId = busStack ? Number(busStack.id.replace('bus-stack-', '')) : null;
        this.turnDraft.corrupterSwaps.push({
            handCardId: Number(handCardId),
            targetCardId: Number(targetCardId),
            targetBusId: targetBusId,
            afterWrCount: (this.turnDraft.boardWaitingRoom || []).length,
            afterHandCount: (this.turnDraft.boardHand || []).length
        });
    }

    recordDrunkardVictim(cardId) {
        this.pushState();
        this.turnDraft.drunkardVictims.push(cardId);
    }

    recordPenalty(cardId) {
        this.pushState();
        this.turnDraft.penaltyCardId = cardId;
    }

    recordRefill(cardId) {
        const id = Number(cardId);
        const el = document.getElementById(`card-${id}`);
        const type = this.game.getCardType(id);
        const isBus = type === 'bus' || (el && el.classList.contains('buu_bus'));

        if (isBus) {
            const busesInHand = document.querySelectorAll('#my-hand-buses .buu_card').length;
            if (busesInHand >= 2) return;
        } else {
            const passengersInHand = document.querySelectorAll('#my-hand-passengers .buu_card').length;
            if (passengersInHand >= 7) return;
        }

        this.pushState();
        this.turnDraft.refillCardIds.push(id);
    }

    getPayloadJson() {
        return JSON.stringify(this.turnDraft);
    }

    isTurnComplete() {
        if (!this.turnDraft.busAction || !this.turnDraft.busAction.busId) return false;

        const busId = Number(this.turnDraft.busAction.busId);
        const depInfo = this.game.getBusDepartureInfo(busId);
        const handSkipped = Boolean(this.turnDraft.handSkipped);

        // 1. Mandatory Waiting Room check (if bus has not departed and is not stalled)
        if (!depInfo.departs && !depInfo.isStalled) {
            const eligibleWrIds = this.game.getEligibleWaitingRoomPassengerIds(busId);
            if (eligibleWrIds.length > 0) return false;
        }

        // 2. Corrupter ability check (must resolve before or during hand boarding)
        if (this.game.isCorrupterPending()) {
            return false;
        }

        // 3. Hand passengers check (if not skipped and player has eligible hand passengers, including Babies for other platform buses)
        if (!handSkipped && this.game.hasEligibleHandPassengers()) {
            return false;
        }

        // 4. Drunkard victims check (if any bus departs and has Drunkard)
        if (this.game.getPendingDrunkardBusInfo()) {
            return false;
        }

        // 5. Penalty check (if required)
        if (this.game.isPenaltyRequired() && !this.turnDraft.penaltyCardId) {
            return false;
        }

        // 6. Hand refill check (if player has 0 cards left in hand before refill, round ends immediately without refilling)
        const refillIds = this.turnDraft.refillCardIds.map(Number);
        const busesInHandCount = document.querySelectorAll('#my-hand-buses .buu_card').length;
        const passengersInHandCount = document.querySelectorAll('#my-hand-passengers .buu_card').length;
        const nonRefillBuses = Array.from(document.querySelectorAll('#my-hand-buses .buu_card'))
            .filter(el => !refillIds.includes(Number(el.dataset.id))).length;
        const nonRefillPassengers = Array.from(document.querySelectorAll('#my-hand-passengers .buu_card'))
            .filter(el => !refillIds.includes(Number(el.dataset.id))).length;

        if (nonRefillBuses === 0 && nonRefillPassengers === 0) {
            return true;
        }

        const missingBuses = Math.max(0, 2 - busesInHandCount);
        const missingPassengers = Math.max(0, 7 - passengersInHandCount);

        const allBoardedIds = this.game.getAllBoardedPassengerIds();
        const domGarageBuses = Array.from(document.querySelectorAll('#garage .buu_card.buu_bus')).map(el => Number(el.dataset.id));
        const domWrPassengers = Array.from(document.querySelectorAll('#waiting-room .buu_card.buu_passenger')).map(el => Number(el.dataset.id));

        const availableGarageBuses = domGarageBuses.length > 0 
            ? domGarageBuses.filter(id => !refillIds.includes(id)).length
            : (this.game.gamedatas?.garage || []).filter(c => !refillIds.includes(Number(c.id))).length;

        const availableWrPassengers = domWrPassengers.length > 0
            ? domWrPassengers.filter(id => !refillIds.includes(id) && !allBoardedIds.includes(id)).length
            : (this.game.gamedatas?.waiting_room || []).filter(c => !refillIds.includes(Number(c.id)) && !allBoardedIds.includes(Number(c.id))).length;

        if (missingBuses > 0 && availableGarageBuses > 0) return false;
        if (missingPassengers > 0 && availableWrPassengers > 0) return false;

        return true;
    }

    renderTurnControls(onUpdateStateCallback) {
        this.game.bga.statusBar.removeActionButtons();

        if (this.game.canSkipHandBoarding()) {
            this.game.bga.statusBar.addActionButton(_('Skip Hand Boarding'), () => {
                this.pushState();
                this.turnDraft.handSkipped = true;
                this.updateVisuals();
                if (onUpdateStateCallback) onUpdateStateCallback();
            }, { color: 'gray' });
        }

        if (this.game.canSkipCorrupter()) {
            this.game.bga.statusBar.addActionButton(_('Skip Corrupter'), () => {
                this.pushState();
                this.turnDraft.corrupterSkippedCount = (this.turnDraft.corrupterSkippedCount || 0) + 1;
                this.turnDraft.corrupterSkipped = true;
                this.corrupterHandId = null;
                this.updateVisuals();
                if (onUpdateStateCallback) onUpdateStateCallback();
            }, { color: 'gray' });
        }

        if (this.corrupterHandId) {
            this.game.bga.statusBar.addActionButton(_('Cancel Swap Selection'), () => {
                this.corrupterHandId = null;
                this.updateVisuals();
                if (onUpdateStateCallback) onUpdateStateCallback();
            }, { color: 'gray' });
        }

        if (this.babyHandId) {
            this.game.bga.statusBar.addActionButton(_('Cancel Baby Selection'), () => {
                this.babyHandId = null;
                this.updateVisuals();
                if (onUpdateStateCallback) onUpdateStateCallback();
            }, { color: 'gray' });
        }

        if (this.canUndo()) {
            this.game.bga.statusBar.addActionButton(_('Undo'), () => {
                this.undo();
                if (onUpdateStateCallback) onUpdateStateCallback();
            }, { color: 'gray' });

            this.game.bga.statusBar.addActionButton(_('Reset Turn'), () => {
                this.reset();
                if (onUpdateStateCallback) onUpdateStateCallback();
            }, { color: 'red' });
        }

        if (this.isTurnComplete()) {
            this.game.bga.statusBar.addActionButton(_('Confirm Turn'), () => {
                // Clear original parent datasets so committed cards don't revert on state reload
                document.querySelectorAll('.buu_card').forEach(el => {
                    delete el.dataset.originalParent;
                    delete el.dataset.originalGridColumn;
                    delete el.dataset.originalGridRow;
                    el.classList.remove('buu_draft-placed', 'buu_draft-selected', 'buu_draft-departed', 'buu_stalled-visual');
                });
                this.game.bga.actions.performAction("actConfirmTurn", { 
                    actionsJson: this.getPayloadJson() 
                });
            }, { color: 'primary' });
        }
    }

    moveCardDom(cardId, targetContainerId) {
        const el = document.getElementById(`card-${cardId}`);
        const targetContainer = document.getElementById(targetContainerId);
        if (el && targetContainer) {
            if (!el.dataset.originalParent && el.parentElement) {
                el.dataset.originalParent = el.parentElement.id;
                el.dataset.originalGridColumn = el.style.gridColumn || '';
                el.dataset.originalGridRow = el.style.gridRow || '';
            }
            targetContainer.appendChild(el);
            el.style.gridColumn = '';
            el.style.gridRow = '';
            el.classList.add('buu_draft-placed');
        }
    }

    updateVisuals() {
        if (!this.game || !this.game.gamedatas) return;

        // 1. Always restore all draft-moved cards back to their start-of-turn positions before replaying draft chronologically
        this.restoreAllDomCards();

        const activeCardIds = new Set();
        if (this.turnDraft.busAction) {
            if (this.turnDraft.busAction.busId) {
                activeCardIds.add(Number(this.turnDraft.busAction.busId));
            }
            if (this.turnDraft.busAction.starId) {
                activeCardIds.add(Number(this.turnDraft.busAction.starId));
            }
        }
        (this.turnDraft.boardWaitingRoom || []).forEach(id => activeCardIds.add(Number(id)));
        (this.turnDraft.boardHand || []).forEach(id => activeCardIds.add(Number(id)));
        (this.turnDraft.corrupterSwaps || []).forEach(swap => {
            activeCardIds.add(Number(swap.handCardId));
            activeCardIds.add(Number(swap.targetCardId));
        });
        (this.turnDraft.drunkardVictims || []).forEach(id => activeCardIds.add(Number(id)));
        if (this.turnDraft.penaltyCardId) activeCardIds.add(Number(this.turnDraft.penaltyCardId));
        (this.turnDraft.refillCardIds || []).forEach(id => activeCardIds.add(Number(id)));

        // Clean up empty draft bus stacks created for hand buses when undone
        document.querySelectorAll('#platform .buu_bus-stack').forEach(stackEl => {
            const busId = Number(stackEl.id.replace('bus-stack-', ''));
            const hasBusCard = Boolean(stackEl.querySelector('.buu_card.buu_bus'));
            const isInitialPlatformBus = (this.game.gamedatas.platform_buses || []).some(b => Number(b.id || b.card_id) === busId);
            if (!hasBusCard && !isInitialPlatformBus && !activeCardIds.has(busId)) {
                stackEl.remove();
            }
        });

        // Apply DOM moves
        if (this.turnDraft.busAction && this.turnDraft.busAction.busId) {
            const busId = Number(this.turnDraft.busAction.busId);
            const busEl = document.getElementById(`card-${busId}`);
            if (busEl && busEl.parentElement && !busEl.dataset.originalParent) {
                busEl.dataset.originalParent = busEl.parentElement.id;
                busEl.dataset.originalGridColumn = busEl.style.gridColumn || '';
                busEl.dataset.originalGridRow = busEl.style.gridRow || '';
            }
            const allBuses = (this.game.gamedatas.hand || [])
                .concat(this.game.gamedatas.platform_buses || [])
                .concat(this.game.gamedatas.garage || [])
                .concat(this.game.gamedatas.departed_buses || []);
            const busCard = allBuses.find(c => Number(c.id || c.card_id) === busId) || {
                id: busId,
                type: 'bus',
                type_arg: this.game.getCardTypeArg(busId)
            };
            this.game.addBusToPlatform(busCard);
            const el = document.getElementById(`card-${busId}`);
            if (el) el.classList.add('buu_draft-placed');

            if (this.turnDraft.busAction.starId) {
                const starId = Number(this.turnDraft.busAction.starId);
                const targetContainerId = `bus-${busId}-inner`;
                this.moveCardDom(starId, targetContainerId);
            }
        }

        const currentBusId = this.turnDraft.busAction ? Number(this.turnDraft.busAction.busId) : null;
        const targetContainerId = currentBusId && document.getElementById(`bus-${currentBusId}-inner`) ? `bus-${currentBusId}-inner` : 'platform';

        const applySwapDom = (swap) => {
            const handEl = document.getElementById(`card-${swap.handCardId}`);
            const targetEl = document.getElementById(`card-${swap.targetCardId}`);
            if (handEl && targetEl) {
                if (!handEl.dataset.originalParent && handEl.parentElement) {
                    handEl.dataset.originalParent = handEl.parentElement.id;
                    handEl.dataset.originalGridColumn = handEl.style.gridColumn || '';
                    handEl.dataset.originalGridRow = handEl.style.gridRow || '';
                }
                if (!targetEl.dataset.originalParent && targetEl.parentElement) {
                    targetEl.dataset.originalParent = targetEl.parentElement.id;
                    targetEl.dataset.originalGridColumn = targetEl.style.gridColumn || '';
                    targetEl.dataset.originalGridRow = targetEl.style.gridRow || '';
                }
                const targetParent = targetEl.parentElement;
                const handParent = document.getElementById('my-hand-passengers');
                if (targetParent && handParent) {
                    const targetGridCol = targetEl.style.gridColumn || targetEl.dataset.originalGridColumn || '';
                    const targetGridRow = targetEl.style.gridRow || targetEl.dataset.originalGridRow || '';
                    targetParent.appendChild(handEl);
                    if (targetParent.id === 'waiting-room') {
                        handEl.style.gridColumn = targetGridCol;
                        handEl.style.gridRow = targetGridRow;
                    } else {
                        handEl.style.gridColumn = '';
                        handEl.style.gridRow = '';
                    }
                    handParent.appendChild(targetEl);
                    targetEl.style.gridColumn = '';
                    targetEl.style.gridRow = '';
                    handEl.classList.remove('buu_draft-placed');
                    targetEl.classList.remove('buu_draft-placed');
                }
            }
        };

        const swaps = this.turnDraft.corrupterSwaps || [];

        (this.turnDraft.boardWaitingRoom || []).forEach((id, idx) => {
            this.moveCardDom(id, targetContainerId);
            // Apply Corrupter swaps that occurred right after this Waiting Room card was boarded
            swaps.filter(s => (s.afterHandCount || 0) === 0 && (s.afterWrCount ?? (this.turnDraft.boardWaitingRoom || []).length) === idx + 1).forEach(applySwapDom);
        });

        // Fallback for any swaps recorded with afterWrCount === 0 and afterHandCount === 0
        swaps.filter(s => (s.afterHandCount || 0) === 0 && s.afterWrCount === 0).forEach(applySwapDom);

        (this.turnDraft.boardHand || []).forEach((id, idx) => {
            const bId = (this.turnDraft.boardHandBusMap && this.turnDraft.boardHandBusMap[id])
                ? Number(this.turnDraft.boardHandBusMap[id])
                : currentBusId;
            const handTargetContainerId = bId && document.getElementById(`bus-${bId}-inner`)
                ? `bus-${bId}-inner`
                : targetContainerId;
            this.moveCardDom(id, handTargetContainerId);
            // Apply Corrupter swaps that occurred right after this hand card was boarded
            swaps.filter(s => s.afterHandCount === idx + 1).forEach(applySwapDom);
        });

        // Apply Penalty Card movement
        if (this.turnDraft.penaltyCardId) {
            const myPlayerId = this.game.getCurrentPlayerId();
            if (myPlayerId) {
                this.moveCardDom(Number(this.turnDraft.penaltyCardId), `unhappies-zone-${myPlayerId}`);
            }
        }

        (this.turnDraft.refillCardIds || []).forEach(id => {
            const el = document.getElementById(`card-${id}`);
            if (el) {
                const isBus = el.classList.contains('buu_bus');
                const targetContainer = isBus ? 'my-hand-buses' : 'my-hand-passengers';
                this.moveCardDom(id, targetContainer);
            }
        });

        // Handle bus departure visualization & Undo reversal in draft (for Corrupter-affected buses, Baby-boarded buses, and active bus)
        const candidateBusIds = [];
        if (this.turnDraft.boardHandBusMap) {
            Object.values(this.turnDraft.boardHandBusMap).forEach(bId => {
                if (bId && !candidateBusIds.includes(Number(bId))) {
                    candidateBusIds.push(Number(bId));
                }
            });
        }
        (this.turnDraft.corrupterSwaps || []).forEach(s => {
            if (s.targetBusId && !candidateBusIds.includes(Number(s.targetBusId))) {
                candidateBusIds.push(Number(s.targetBusId));
            }
        });
        if (currentBusId && !candidateBusIds.includes(currentBusId)) {
            candidateBusIds.push(currentBusId);
        }

        const myPlayerId = this.game.getCurrentPlayerId();
        const departedZone = document.getElementById('departed-buses-zone');
        const passengersZone = myPlayerId ? document.getElementById(`passengers-zone-${myPlayerId}`) : null;
        const unhappiesZone = myPlayerId ? document.getElementById(`unhappies-zone-${myPlayerId}`) : null;
        const drunkardVictimIds = (this.turnDraft.drunkardVictims || []).map(Number);

        // Move already-selected Drunkard victims to unhappies
        drunkardVictimIds.forEach(vId => {
            if (unhappiesZone) this.moveCardDom(vId, `unhappies-zone-${myPlayerId}`);
        });

        const currentlyStalledIds = new Set();

        candidateBusIds.forEach(bId => {
            const depInfo = this.game.getBusDepartureInfo(bId);
            const busEl = document.getElementById(`card-${bId}`);
            const stackEl = document.getElementById(`bus-stack-${bId}`);
            const innerEl = document.getElementById(`bus-${bId}-inner`);

            const busVictimsCount = depInfo.otherPassengers.filter(p => drunkardVictimIds.includes(Number(p.id))).length;
            const drunkardDone = !depInfo.hasDrunkard || (busVictimsCount >= depInfo.drunkardVictimsNeeded);

            if (depInfo.departs) {
                if (busEl) busEl.classList.remove('buu_stalled-visual');
                if (drunkardDone) {
                    if (innerEl) {
                        innerEl.classList.remove('buu_expanded', 'buu_drunkard-selecting');
                    }
                    if (stackEl) {
                        stackEl.style.zIndex = '';
                    }

                    // Departure is FULLY resolved!
                    // 1. Move bus to Departed zone
                    if (busEl && departedZone) {
                        this.moveCardDom(bId, 'departed-buses-zone');
                        busEl.classList.add('buu_draft-departed');
                    }

                    // 2. Hide stack on platform so no empty ghost container remains
                    if (stackEl) {
                        stackEl.style.display = 'none';
                    }

                    // 3. Move all remaining passengers of this bus to passengers-zone or unhappies-zone
                    let unpairedLoverIds = new Set();
                    if (depInfo.hasGeneral) {
                        const loversByColor = {};
                        depInfo.passengers.forEach(p => {
                            if (Number(p.type_arg) % 10 === 2) {
                                const color = Math.floor(Number(p.type_arg) / 10);
                                if (!loversByColor[color]) loversByColor[color] = [];
                                loversByColor[color].push(Number(p.id));
                            }
                        });
                        Object.values(loversByColor).forEach(ids => {
                            if (ids.length % 2 !== 0) {
                                unpairedLoverIds.add(ids[0]);
                            }
                        });
                    }

                    depInfo.passengers.forEach(p => {
                        const pId = Number(p.id);
                        if (drunkardVictimIds.includes(pId)) {
                            return; // Already moved to unhappies
                        }
                        if (unpairedLoverIds.has(pId)) {
                            if (unhappiesZone) this.moveCardDom(pId, `unhappies-zone-${myPlayerId}`);
                        } else {
                            if (passengersZone) this.moveCardDom(pId, `passengers-zone-${myPlayerId}`);
                        }
                    });
                } else {
                    // Drunkard victims are currently being selected on this bus!
                    if (stackEl) {
                        stackEl.style.display = '';
                        stackEl.style.zIndex = '5000';
                    }
                    if (innerEl) {
                        innerEl.classList.add('buu_expanded', 'buu_drunkard-selecting');
                    }
                    if (busEl) {
                        busEl.classList.add('buu_draft-departed');
                    }
                }
            } else {
                if (busEl) {
                    busEl.classList.remove('buu_draft-departed');
                    if (depInfo.isStalled) {
                        busEl.classList.add('buu_stalled-visual');
                        currentlyStalledIds.add(bId);
                        if (!this.stalledNotifiedBuses.has(bId)) {
                            this.stalledNotifiedBuses.add(bId);
                            const busColorId = Math.floor(this.game.getCardTypeArg(bId) / 10);
                            const colorName = this.game.getColorName(busColorId) || '';
                            if (this.game.bga?.gameui?.showMessage) {
                                const msg = colorName
                                    ? _('${color} Bus stalled! (Unpaired Lover)').replace('${color}', colorName)
                                    : _('Bus stalled! (Unpaired Lover)');
                                this.game.bga.gameui.showMessage(msg, 'info');
                            }
                        }
                    } else {
                        busEl.classList.remove('buu_stalled-visual');
                    }
                }
            }
        });

        Array.from(this.stalledNotifiedBuses).forEach(bId => {
            if (!currentlyStalledIds.has(bId)) {
                this.stalledNotifiedBuses.delete(bId);
            }
        });

        this.game.updatePlayerCounts();
        this.game.refreshTurnSelectability();
    }
}
