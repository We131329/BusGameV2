export class RefillHand {
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
            this.updateButtons();
            this.updateSelectable();
        }
    }

    updateSelectable() {
        const selectedBuses = this.selectedIds.filter(id => this.game.getCardType(id) === 'bus').length;
        const selectedPassengers = this.selectedIds.filter(id => this.game.getCardType(id) === 'passenger').length;

        const neededBuses = (this.args?.missingBuses || 0) - selectedBuses;
        const neededPassengers = (this.args?.missingPassengers || 0) - selectedPassengers;

        this.game.setSelectable('bus', neededBuses > 0, 'garage');
        this.game.setSelectable('passenger', neededPassengers > 0, 'waiting-room');
    }

    updateTitle(isCurrentPlayerActive) {
        if (!isCurrentPlayerActive) {
            this.bga.statusBar.setTitle(_('${actplayer} is refilling hand'));
            return;
        }

        const selectedBuses = this.selectedIds.filter(id => this.game.getCardType(id) === 'bus').length;
        const selectedPassengers = this.selectedIds.filter(id => this.game.getCardType(id) === 'passenger').length;

        const neededBuses = (this.args?.missingBuses || 0) - selectedBuses;
        const neededPassengers = (this.args?.missingPassengers || 0) - selectedPassengers;

        let msg = _('${you} must refill your hand: ');
        let requirements = [];
        if (neededBuses > 0) requirements.push(_('${n} more bus(es)').replace('${n}', neededBuses));
        if (neededPassengers > 0) requirements.push(_('${n} more passenger(s)').replace('${n}', neededPassengers));
        
        if (requirements.length === 0) {
            msg = _('${you} have selected all required cards. Click Confirm.');
        } else {
            msg += requirements.join(' ' + _('and') + ' ');
        }

        this.bga.statusBar.setTitle(msg);
    }

    onLeavingState() {
        this.game.setSelectable('any', false);
        this.selectedIds = [];
        this.args = null;
    }

    onCardClick(cardId) {
        const index = this.selectedIds.indexOf(cardId);
        const type = this.game.getCardType(cardId);

        if (index === -1) {
            // Check limits before selecting
            const currentCount = this.selectedIds.filter(id => this.game.getCardType(id) === type).length;
            const limit = type === 'bus' ? (this.args?.missingBuses || 0) : (this.args?.missingPassengers || 0);

            if (limit > 0 && currentCount < limit) {
                this.selectedIds.push(cardId);
                this.game.selectCard(cardId, true);
            }
        } else {
            this.selectedIds.splice(index, 1);
            this.game.selectCard(cardId, false);
        }
        this.updateSelectable();
        this.updateTitle(true);
        this.updateButtons();
    }

    updateButtons() {
        this.bga.statusBar.removeActionButtons();
        
        const selectedBuses = this.selectedIds.filter(id => this.game.getCardType(id) === 'bus').length;
        const selectedPassengers = this.selectedIds.filter(id => this.game.getCardType(id) === 'passenger').length;
        
        const isComplete = selectedBuses === (this.args?.missingBuses || 0) && selectedPassengers === (this.args?.missingPassengers || 0);

        this.bga.statusBar.addActionButton(_('Confirm'), () => this.onConfirm(), { 
            color: isComplete ? 'primary' : 'secondary',
            disabled: !isComplete 
        });

        if (this.selectedIds.length > 0) {
            this.bga.statusBar.addActionButton(_('Cancel'), () => this.onCancel(), { color: 'gray' });
        }
    }

    onConfirm() {
        this.bga.actions.performAction("actRefill", { cardIds: this.selectedIds.join(',') });
    }

    onCancel() {
        this.selectedIds.forEach(id => this.game.selectCard(id, false));
        this.selectedIds = [];
        this.updateSelectable();
        this.updateTitle(true);
        this.updateButtons();
    }
}
