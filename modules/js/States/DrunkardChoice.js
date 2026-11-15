export class DrunkardChoice {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
        this.selectedIds = [];
        this.args = null;
    }

    onEnteringState(args, isCurrentPlayerActive) {
        this.args = args;
        this.bga.statusBar.setTitle(isCurrentPlayerActive ? 
            _('${you} must select 2 victims for the Drunkard to send to Unhappies') :
            _('${actplayer} is choosing victims for the Drunkard')
        );
      
        if (isCurrentPlayerActive) {
            this.updateButtons();
            
            // Highlight and expand the departing bus
            const busId = this.args.passengers[0].location_arg; // DrunkardChoice args use location_arg as bus_id
            const busEl = document.getElementById(`card-${busId}`);
            const innerEl = document.getElementById(`bus-${busId}-inner`);
            const stackEl = document.getElementById(`bus-stack-${busId}`);
            
            if (stackEl) {
                stackEl.style.zIndex = '2000';
                stackEl.style.position = 'relative';
                stackEl.style.transform = 'scale(1.1)';
                stackEl.style.transition = 'transform 0.3s';
            }
            
            if (innerEl) {
                innerEl.style.zIndex = '2001';
                innerEl.style.display = 'flex';
                innerEl.style.flexDirection = 'row';
                innerEl.style.flexWrap = 'wrap';
                innerEl.style.gap = '10px';
                innerEl.style.background = 'rgba(255, 255, 255, 0.9)';
                innerEl.style.padding = '15px';
                innerEl.style.borderRadius = '12px';
                innerEl.style.boxShadow = '0 0 20px rgba(0,0,0,0.6)';
                innerEl.style.marginTop = '20px';
                innerEl.style.minWidth = '300px';
                innerEl.style.width = 'max-content';
                
                innerEl.querySelectorAll('.buu_card').forEach(el => {
                    el.classList.add('buu_selectable');
                    el.style.position = 'static'; 
                    el.style.margin = '0'; // Clear the accordion margin-top
                });
            }
        }
    }

    onLeavingState() {
        const busId = this.args ? (this.args.passengers.length > 0 ? this.args.passengers[0].location_arg : null) : null;
        if (busId) {
            const stackEl = document.getElementById(`bus-stack-${busId}`);
            const innerEl = document.getElementById(`bus-${busId}-inner`);
            if (stackEl) {
                stackEl.style.zIndex = '';
                stackEl.style.position = '';
                stackEl.style.transform = '';
            }
            if (innerEl) {
                innerEl.style.display = '';
                innerEl.style.flexWrap = '';
                innerEl.style.gap = '';
                innerEl.style.background = '';
                innerEl.style.padding = '';
                innerEl.style.borderRadius = '';
                innerEl.style.boxShadow = '';
                innerEl.style.marginTop = '';
                innerEl.style.minWidth = '';
                innerEl.querySelectorAll('.buu_card').forEach(el => {
                    el.style.position = '';
                });
            }
        }
        this.selectedIds = [];
        document.querySelectorAll('.buu_card.buu_selectable').forEach(el => el.classList.remove('buu_selectable'));
        this.args = null;
    }

    onCardClick(cardId, type, containerId) {
        const index = this.selectedIds.indexOf(cardId);
        if (index === -1) {
            if (this.selectedIds.length < 2) {
                this.selectedIds.push(cardId);
                this.game.selectCard(cardId, true);
            }
        } else {
            this.selectedIds.splice(index, 1);
            this.game.selectCard(cardId, false);
        }
        this.updateButtons();
    }

    updateButtons() {
        this.bga.statusBar.removeActionButtons();
        if (this.selectedIds.length === Math.min(2, this.args.passengers.length)) {
            this.bga.statusBar.addActionButton(_('Confirm'), () => this.onConfirm());
            this.bga.statusBar.addActionButton(_('Cancel'), () => this.onCancel(), { color: 'gray' });
        }
    }

    onConfirm() {
        this.bga.actions.performAction("actSelectVictims", { victimIds: this.selectedIds.join(',') });
    }

    onCancel() {
        this.selectedIds.forEach(id => this.game.selectCard(id, false));
        this.selectedIds = [];
        this.updateButtons();
    }
}