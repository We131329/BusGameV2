export class TravelersHand {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
        this.selectedIds = [];
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
            this.bga.statusBar.setTitle(_('${actplayer} may play passengers from hand'));
            return;
        }

        const busCapacity = parseInt(this.args.bus.card_type_arg) % 10;
        let currentOccupancy = this.game.getBusOccupancy(this.args.bus.card_id);
        this.selectedIds.forEach(id => {
             const typeArg = this.game.getCardTypeArg(id);
             const ability = typeArg % 10;
             currentOccupancy += this.game.gamedatas.passenger_types[ability].capacity;
        });

        const remaining = busCapacity - currentOccupancy;
        if (remaining > 0) {
            this.bga.statusBar.setTitle(_('${you} may play passengers from your hand (remaining capacity: ${n})').replace('${n}', remaining));
        } else {
            this.bga.statusBar.setTitle(_('${you} cannot add more passengers. The bus is full.'));
        }
    }

    refreshSelectability() {
        const busColor = Math.floor(parseInt(this.args.bus.card_type_arg) / 10);
        const busCapacity = parseInt(this.args.bus.card_type_arg) % 10;
        let currentOccupancy = this.game.getBusOccupancy(this.args.bus.card_id);
        this.selectedIds.forEach(id => {
             const typeArg = this.game.getCardTypeArg(id);
             const ability = typeArg % 10;
             currentOccupancy += this.game.gamedatas.passenger_types[ability].capacity;
        });

        document.querySelectorAll('#my-hand-passengers .buu_card').forEach(el => {
            const cardId = el.dataset.id;
            const typeArg = this.game.getCardTypeArg(cardId);
            const cardColor = Math.floor(typeArg / 10);
            const ability = typeArg % 10;
            const cardCapacity = this.game.gamedatas.passenger_types[ability].capacity;

            el.classList.remove('buu_selectable', 'buu_unselectable-visual');
            
            // 1. Color check
            if (cardColor !== busColor && ability !== 6) {
                el.classList.add('buu_unselectable-visual');
            } 
            // 2. Capacity check (only if not already selected)
            else if (!this.selectedIds.includes(cardId) && (currentOccupancy + cardCapacity > busCapacity)) {
                el.classList.add('buu_unselectable-visual');
            }
            else {
                el.classList.add('buu_selectable');
            }
        });
    }

    onLeavingState() {
        this.game.setSelectable('passenger', false);
        this.selectedIds = [];
        document.querySelectorAll('.buu_unselectable-visual').forEach(el => el.classList.remove('buu_unselectable-visual'));
        this.args = null;
    }

    onCardClick(cardId, type, containerId) {
        if (type !== 'passenger' || containerId !== 'my-hand-passengers') return;
        
        const el = document.getElementById(`card-${cardId}`);
        if (!el || el.classList.contains('buu_unselectable-visual')) return;

        this.game.draftManager.recordBoardHand(cardId);
        this.game.draftManager.updateVisuals();
        this.refreshSelectability();
        this.updateButtons();
    }

    refreshSelectionOrder() {
        // Clear all previous orders in hand
        document.querySelectorAll('#my-hand-passengers .buu_card .buu_card-selection-order').forEach(el => el.textContent = '');

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

        if (this.selectedIds.length > 0) {
            this.bga.statusBar.addActionButton(_('Confirm'), () => this.onConfirm());
            this.bga.statusBar.addActionButton(_('Cancel'), () => this.onCancel(), { color: 'gray' });
        } else {
            this.bga.statusBar.addActionButton(_('Skip'), () => this.onSkip(), { color: 'gray' });
        }
    }

    onConfirm() {
        this.selectedIds.forEach(id => {
            this.game.draftManager.recordBoardHand(id);
        });
        this.game.draftManager.updateVisuals();
        this.selectedIds = [];
        this.refreshSelectability();
        this.updateButtons();
    }

    onSkip() {
        this.bga.actions.performAction("actSkip");
    }

    onCancel() {
        this.selectedIds.forEach(id => this.game.selectCard(id, false));
        this.selectedIds = [];
        this.refreshSelectability();
        this.updateTitle(true);
        this.updateButtons();
    }
}