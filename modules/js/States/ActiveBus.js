export class ActiveBus {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
        this.selectedBusId = null;
        this.selectedStarId = null;
        this.starAbilityActive = false;
        this.args = null;
    }

    onEnteringState(args, isCurrentPlayerActive) {
        this.args = args;
        if (this.game.draftManager) {
            this.game.draftManager.reset();
        }
        this.updateTitle(isCurrentPlayerActive);
      
        if (isCurrentPlayerActive) {
            this.updateButtons();
            this.refreshSelectability();
        }

        // Visual feedback for stalled buses
        document.querySelectorAll('#platform .buu_card.buu_bus').forEach(el => {
            const busId = el.dataset.id;
            if (this.game.isBusStalled(busId)) {
                el.classList.add('buu_stalled-visual');
            } else {
                el.classList.remove('buu_stalled-visual');
            }
        });
    }

    getHandStars() {
        const domHandEls = Array.from(document.querySelectorAll('#my-hand-passengers .buu_card'));
        if (domHandEls.length > 0) {
            return domHandEls
                .map(el => ({
                    id: Number(el.dataset.id),
                    type: 'passenger',
                    type_arg: this.game.getCardTypeArg(el.dataset.id)
                }))
                .filter(c => (c.type_arg % 10) === 4);
        }
        if (this.args && this.args.handStars && this.args.handStars.length > 0) {
            return Array.isArray(this.args.handStars) ? this.args.handStars : Object.values(this.args.handStars);
        }
        return (this.game.gamedatas?.hand || []).filter(c => c.type === 'passenger' && (Number(c.type_arg) % 10 === 4));
    }

    updateTitle(isCurrentPlayerActive) {
        if (!isCurrentPlayerActive) {
            this.bga.statusBar.setTitle(_('${actplayer} must select a bus'));
            return;
        }

        if (this.starAbilityActive) {
            if (!this.selectedStarId) {
                this.bga.statusBar.setTitle(_('${you} must select a Star from your hand'));
            } else {
                this.bga.statusBar.setTitle(_('${you} must select a matching bus from Garage or Departed buses'));
            }
        } else {
            this.bga.statusBar.setTitle(_('${you} must select a bus from your hand or the platform'));
        }
    }

    refreshSelectability() {
        this.game.setSelectable('bus', false);
        this.game.setSelectable('passenger', false);

        if (this.starAbilityActive) {
            // Keep stars in hand selectable so player can switch or deselect
            this.getHandStars().forEach(s => {
                const el = document.getElementById(`card-${s.id}`);
                if (el) el.classList.add('buu_selectable');
            });

            if (this.selectedStarId) {
                // Selectable buses of matching color from Garage and any player's Departed Buses
                const starTypeArg = this.game.getCardTypeArg(this.selectedStarId);
                if (starTypeArg) {
                    const starColor = Math.floor(starTypeArg / 10);
                    
                    document.querySelectorAll('#garage .buu_card.buu_bus, #departed-buses-zone .buu_card.buu_bus, .buu_departed-buses-zone .buu_card.buu_bus').forEach(el => {
                        const bId = Number(el.dataset.id);
                        const bColor = Math.floor(this.game.getCardTypeArg(bId) / 10);
                        if (bColor === starColor) {
                            el.classList.add('buu_selectable');
                        }
                    });
                }
            }
        } else {
            this.game.setSelectable('bus', true, 'my-hand-buses');
            this.getHandStars().forEach(s => {
                const el = document.getElementById(`card-${s.id}`);
                if (el) el.classList.add('buu_selectable');
            });
            
            // Buses on the platform
            const platformBuses = document.querySelectorAll('#platform .buu_card.buu_bus');
            if (platformBuses.length === 0) {
                console.warn("No buses found on platform for selectability check");
            }

            platformBuses.forEach(el => {
                const busId = el.dataset.id;
                const isStalled = this.game.isBusStalled(busId);
                
                if (!isStalled) {
                    el.classList.add('buu_selectable');
                } else {
                    el.classList.add('buu_unselectable-visual');
                }
            });
        }
    }

    onLeavingState() {
        this.game.setSelectable('bus', false);
        this.game.setSelectable('passenger', false);
        this.selectedBusId = null;
        this.selectedStarId = null;
        this.starAbilityActive = false;
    }

    onCardClick(cardId, type, containerId) {
        if (this.starAbilityActive) {
            if (type === 'passenger') {
                const star = this.getHandStars().find(s => Number(s.id) === Number(cardId));
                if (star) {
                    if (Number(this.selectedStarId) === Number(cardId)) {
                        this.onCancelStar();
                    } else {
                        this.game.clearCardSelection();
                        this.selectedStarId = cardId;
                        this.game.selectCard(cardId, true);
                        this.refreshSelectability();
                        this.updateButtons();
                        this.updateTitle(true);
                    }
                }
            } else if (type === 'bus') {
                this.selectedBusId = cardId;
                this.onConfirmStar();
            }
            return;
        }

        // 1. Initial Bus Selection Phase (no bus action recorded yet)
        if (!this.game.draftManager.turnDraft.busAction || !this.game.draftManager.turnDraft.busAction.busId) {
            if (type === 'bus') {
                this.selectedBusId = cardId;
                this.onConfirm();
            } else if (type === 'passenger') {
                const star = this.getHandStars().find(s => Number(s.id) === Number(cardId));
                if (star) {
                    this.starAbilityActive = true;
                    this.selectedStarId = cardId;
                    this.game.selectCard(cardId, true);
                    this.refreshSelectability();
                    this.updateButtons();
                    this.updateTitle(true);
                }
            }
            return;
        }

        // 2. Bus IS selected -> Boarding, Drunkard Victims, or Refill Phases
        const el = document.getElementById(`card-${cardId}`);
        if (!el || !el.classList.contains('buu_selectable')) return;

        const parentId = (el.parentElement ? el.parentElement.id : (el.dataset.originalParent || containerId || ''));
        const busId = Number(this.game.draftManager.turnDraft.busAction.busId);
        const pendingDrunkard = this.game.getPendingDrunkardBusInfo();
        const selectedVictims = (this.game.draftManager.turnDraft.drunkardVictims || []).map(Number);

        // 1. Drunkard Victim selection
        if (pendingDrunkard) {
            const isCandidate = pendingDrunkard.depInfo.otherPassengers.some(p => Number(p.id) === Number(cardId)) && !selectedVictims.includes(Number(cardId));
            if (isCandidate) {
                this.game.draftManager.recordDrunkardVictim(cardId);
                this.game.draftManager.updateVisuals();
                this.updateButtons();
                return;
            }
        }

        // 2. Corrupter Swap Phase
        if (this.game.isCorrupterPending()) {
            if (!this.game.draftManager.corrupterHandId) {
                if (parentId === 'my-hand-passengers') {
                    this.game.draftManager.corrupterHandId = cardId;
                    this.game.draftManager.updateVisuals();
                    this.updateButtons();
                    return;
                }
            } else {
                const handCardId = this.game.draftManager.corrupterHandId;
                if (parentId === 'my-hand-passengers') {
                    this.game.draftManager.corrupterHandId = (Number(cardId) === Number(handCardId)) ? null : cardId;
                    this.game.draftManager.updateVisuals();
                    this.updateButtons();
                    return;
                }
                if (Number(cardId) !== Number(handCardId)) {
                    this.game.draftManager.recordCorrupterSwap(handCardId, cardId);
                    this.game.draftManager.corrupterHandId = null;
                    this.game.draftManager.updateVisuals();
                    this.updateButtons();
                    return;
                }
            }
        }

        // 3. Penalty Phase (if no boarding happened)
        if (this.game.isPenaltyRequired() && !this.game.draftManager.turnDraft.penaltyCardId) {
            if (parentId === 'my-hand-passengers' || parentId === 'my-hand-buses') {
                this.game.draftManager.recordPenalty(cardId);
                this.game.draftManager.updateVisuals();
                this.updateButtons();
                return;
            }
        }

        // 3.5. Baby Target Bus Selection (when 2+ matching buses exist on platform)
        if (this.game.draftManager.babyHandId) {
            const babyId = Number(this.game.draftManager.babyHandId);
            if (parentId === 'my-hand-passengers' && Number(cardId) === babyId) {
                this.game.draftManager.babyHandId = null;
                this.game.draftManager.updateVisuals();
                this.updateButtons();
                return;
            }
            if (type === 'bus') {
                const eligibleBuses = this.game.getEligibleBusesForHandCard(babyId);
                if (eligibleBuses.includes(Number(cardId))) {
                    this.game.draftManager.recordBoardHand(babyId, Number(cardId));
                    this.game.draftManager.babyHandId = null;
                    this.game.draftManager.updateVisuals();
                    this.updateButtons();
                    return;
                }
            }
        }

        // 4. Refill or Boarding
        if (parentId === 'garage' || (type === 'bus' && parentId !== 'my-hand-buses')) {
            const busesInHand = document.querySelectorAll('#my-hand-buses .buu_card').length;
            const bottomBusId = this.game.getBottomGarageBusId();
            if (busesInHand < 2 && Number(cardId) === bottomBusId) {
                this.game.draftManager.recordRefill(cardId);
            }
        } else if (parentId === 'my-hand-passengers') {
            const eligibleBuses = this.game.getEligibleBusesForHandCard(cardId);
            if (eligibleBuses.length === 1) {
                this.game.draftManager.babyHandId = null;
                this.game.draftManager.recordBoardHand(cardId, eligibleBuses[0]);
            } else if (eligibleBuses.length > 1) {
                this.game.draftManager.babyHandId = Number(cardId);
            } else {
                this.game.draftManager.babyHandId = null;
                this.game.draftManager.recordBoardHand(cardId, busId);
            }
        } else if (parentId === 'waiting-room') {
            const eligibleWrIds = this.game.getEligibleWaitingRoomPassengerIds(busId);
            if (eligibleWrIds.includes(Number(cardId))) {
                this.game.draftManager.recordBoardWaitingRoom(cardId);
            } else {
                const passengersInHand = document.querySelectorAll('#my-hand-passengers .buu_card').length;
                if (passengersInHand < 7) {
                    this.game.draftManager.recordRefill(cardId);
                }
            }
        }

        this.game.draftManager.updateVisuals();
        this.updateButtons();
    }

    updateButtons() {
        this.bga.statusBar.removeActionButtons();

        if (this.game.draftManager.canUndo()) {
            this.game.draftManager.renderTurnControls(() => {
                this.selectedBusId = null;
                this.selectedStarId = null;
                this.starAbilityActive = false;
                this.game.clearCardSelection();
                this.updateButtons();
            });
            return;
        }

        if (this.starAbilityActive) {
            this.bga.statusBar.addActionButton(_('Cancel Star'), () => this.onCancelStar(), { color: 'gray' });
            return;
        }

        // Star Ability Initial Buttons
        if (this.getHandStars().length > 0 && !this.selectedBusId) {
            this.bga.statusBar.addActionButton(_('Activate Star Ability'), () => this.onActivateStar());
        }

        if (this.selectedBusId) {
            this.bga.statusBar.addActionButton(_('Confirm'), () => this.onConfirm());
            this.bga.statusBar.addActionButton(_('Cancel'), () => this.onCancel(), { color: 'gray' });
        } else if (this.args && this.args.canTriggerEnd) {
            const label = (this.args.roundEndTriggeredBy !== 0) ? _('Skip Turn') : _('End Round');
            this.bga.statusBar.addActionButton(label, () => this.onTriggerEnd(), { color: 'red' });
        }
    }

    onTriggerEnd() {
        this.bga.actions.performAction("actTriggerEnd");
    }

    onActivateStar() {
        this.starAbilityActive = true;
        this.refreshSelectability();
        this.updateButtons();
        this.updateTitle(true);
    }

    onCancelStar() {
        this.starAbilityActive = false;
        this.selectedStarId = null;
        this.selectedBusId = null;
        this.game.clearCardSelection();
        this.refreshSelectability();
        this.updateButtons();
        this.updateTitle(true);
    }

    onConfirmStar() {
        this.game.draftManager.recordBusAction({
            type: 'use_star',
            starId: this.selectedStarId,
            busId: this.selectedBusId
        });
        this.selectedStarId = null;
        this.selectedBusId = null;
        this.starAbilityActive = false;
        this.game.clearCardSelection();
        this.game.draftManager.updateVisuals();
        this.updateButtons();
    }

    onConfirm() {
        this.game.draftManager.recordBusAction({
            type: 'select_bus',
            busId: this.selectedBusId
        });
        this.selectedBusId = null;
        this.game.clearCardSelection();
        this.game.draftManager.updateVisuals();
        this.updateButtons();
    }

    onCancel() {
        this.game.selectCard(this.selectedBusId, false);
        this.selectedBusId = null;
        this.updateButtons();
    }
}