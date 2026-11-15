export class Penalty {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
        this.selectedId = null;
    }

    onEnteringState(args, isCurrentPlayerActive) {
        this.bga.statusBar.setTitle(isCurrentPlayerActive ? 
            _('${you} must select a card to move to Unhappies as a penalty') :
            _('${actplayer} must take a penalty')
        );
      
        if (isCurrentPlayerActive) {
            this.updateButtons();
            this.game.setSelectable('any', true, 'hand-container');
        }
    }

    onLeavingState() {
        this.game.setSelectable('any', false);
        this.selectedId = null;
    }

    onCardClick(cardId) {
        this.game.clearCardSelection();
        this.selectedId = cardId;
        this.game.selectCard(cardId, true);
        this.updateButtons();
    }

    updateButtons() {
        this.bga.statusBar.removeActionButtons();
        if (this.selectedId) {
            this.bga.statusBar.addActionButton(_('Confirm'), () => this.onConfirm());
            this.bga.statusBar.addActionButton(_('Cancel'), () => this.onCancel(), { color: 'gray' });
        }
    }

    onConfirm() {
        this.bga.actions.performAction("actChoosePenalty", { cardId: this.selectedId });
    }

    onCancel() {
        this.game.selectCard(this.selectedId, false);
        this.selectedId = null;
        this.updateButtons();
    }
}