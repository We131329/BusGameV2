export class WaitingRoom {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
        this.selectedIds = [];
        this.args = null;
    }

    onEnteringState(args, isCurrentPlayerActive) {
        this.args = args;
        this.updateTitle(isCurrentPlayerActive);
      
        if (isCurrentPlayerActive) {
            this.refreshSelectability();
            this.updateButtons();
        }
    }

    updateTitle(isCurrentPlayerActive) {
        if (!isCurrentPlayerActive) {
            this.bga.statusBar.setTitle(_('${actplayer} is boarding passengers'));
            return;
        }

        if (this.hasMandatorySelections()) {
            this.bga.statusBar.setTitle(_('${you} must select all eligible passengers from the Waiting Room'));
        } else if (this.selectedIds.length > 0) {
            this.bga.statusBar.setTitle(_('${you} have selected all mandatory passengers. You can confirm or add more if possible.'));
        } else {
            this.bga.statusBar.setTitle(_('${you} must select passengers from the Waiting Room to board'));
        }
    }

    hasMandatorySelections() {
        const busColor = Math.floor(parseInt(this.args.bus.card_type_arg) / 10);
        const busCapacity = parseInt(this.args.bus.card_type_arg) % 10;
        
        // Calculate current occupancy including selections
        let currentOccupancy = this.game.getBusOccupancy(this.args.bus.card_id);
        this.selectedIds.forEach(id => {
             const typeArg = this.game.getCardTypeArg(id);
             const ability = typeArg % 10;
             currentOccupancy += this.game.gamedatas.passenger_types[ability].capacity;
        });

        if (currentOccupancy >= busCapacity) return false;

        // Check columns for "front" cards that match color and fit
        for (let col = 1; col <= 2; col++) {
            // Find front card NOT in selectedIds
            let frontCard = null;
            for (let row = 4; row >= 1; row--) {
                const pos = col * 10 + row;
                const card = this.args.waitingRoom.find(c => c.location_arg == pos);
                if (!card) continue;
                if (this.selectedIds.includes(card.id)) continue;
                
                frontCard = card;
                break; // Found the front card that isn't selected
            }

            if (frontCard) {
                const cardColor = Math.floor(parseInt(frontCard.type_arg) / 10);
                const ability = parseInt(frontCard.type_arg) % 10;
                const capacity = this.game.gamedatas.passenger_types[ability].capacity;

                if ((cardColor === busColor || ability === 6) && (currentOccupancy + capacity <= busCapacity)) {
                    return true;
                }
            }
        }
        return false;
    }

    refreshSelectability() {
        const busColor = Math.floor(parseInt(this.args.bus.card_type_arg) / 10);
        
        // Reset all first
        document.querySelectorAll('#waiting-room .buu_card').forEach(el => {
            el.classList.add('buu_unselectable-visual');
            el.classList.remove('buu_selectable');
        });

        // For each column, find the chain of selectable cards
        for (let col = 1; col <= 2; col++) {
            for (let row = 4; row >= 1; row--) {
                const pos = col * 10 + row;
                const card = this.args.waitingRoom.find(c => c.location_arg == pos);
                if (!card) continue;

                const cardColor = Math.floor(parseInt(card.type_arg) / 10);
                const ability = parseInt(card.type_arg) % 10;
                const el = document.getElementById(`card-${card.id}`);

                // Color match OR Backpacker (6)
                if (cardColor === busColor || ability === 6) {
                    let hasUnselectedBelow = false;
                    for (let r = row + 1; r <= 4; r++) {
                        const belowPos = col * 10 + r;
                        const cardBelow = this.args.waitingRoom.find(c => c.location_arg == belowPos);
                        if (cardBelow && !this.selectedIds.includes(cardBelow.id)) {
                            hasUnselectedBelow = true;
                            break;
                        }
                    }

                    if (!hasUnselectedBelow) {
                        el.classList.remove('buu_unselectable-visual');
                        el.classList.add('buu_selectable');
                    } else {
                        break; 
                    }
                } else {
                    break;
                }
                
                if (!this.selectedIds.includes(card.id)) {
                    break;
                }
            }
        }
    }

    onLeavingState() {
        this.selectedIds = [];
        document.querySelectorAll('.buu_unselectable-visual').forEach(el => el.classList.remove('buu_unselectable-visual'));
        this.args = null;
    }

    onCardClick(cardId, type, containerId) {
        if (type !== 'passenger' || containerId !== 'waiting-room') return;
        
        const el = document.getElementById(`card-${cardId}`);
        if (!el || !el.classList.contains('buu_selectable')) return;

        this.game.draftManager.recordBoardWaitingRoom(cardId);
        this.game.draftManager.updateVisuals();
        this.refreshSelectability();
        this.updateButtons();
    }

    refreshSelectionOrder() {
        // Clear all previous orders
        document.querySelectorAll('.buu_card .buu_card-selection-order').forEach(el => el.textContent = '');
        
        this.selectedIds.forEach((id, idx) => {
            this.game.selectCard(id, true, idx + 1);
        });
    }

    updateButtons() {
        this.bga.statusBar.removeActionButtons();
        
        if (this.game.draftManager.canUndo()) {
            this.game.draftManager.renderTurnControls(() => {
                this.selectedIds = [];
                this.refreshSelectability();
                this.updateButtons();
                this.updateTitle(true);
            });
            return;
        }

        const mandatoryMissing = this.hasMandatorySelections();

        if (this.selectedIds.length > 0) {
            this.bga.statusBar.addActionButton(_('Confirm'), () => this.onConfirm(), { 
                color: 'blue',
                opacity: mandatoryMissing ? 0.5 : 1
            });
            this.bga.statusBar.addActionButton(_('Cancel'), () => this.onCancel(), { color: 'gray' });
        }
    }

    onConfirm() {
        if (this.hasMandatorySelections()) {
            this.bga.gameui.showMessage(_('You must select all eligible passengers before confirming'), 'error');
            return;
        }
        this.selectedIds.forEach(id => {
            this.game.draftManager.recordBoardWaitingRoom(id);
        });
        this.game.draftManager.updateVisuals();
        this.selectedIds = [];
        this.refreshSelectability();
        this.updateButtons();
    }

    onSkip() {
        // Skip is removed from UI but kept here for safety
        if (this.hasMandatorySelections()) {
            this.bga.gameui.showMessage(_('You cannot skip because there are eligible passengers to board'), 'error');
            return;
        }
        this.bga.actions.performAction("actSkip");
    }

    onCancel() {
        this.selectedIds.forEach(id => this.game.selectCard(id, false));
        this.selectedIds = [];
        this.refreshSelectability();
        this.updateButtons();
    }
}