export class CorrupterSwap {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
        this.selectedHandId = null;
        this.selectedTargetId = null;
        this.args = null;
    }

    onEnteringState(args, isCurrentPlayerActive) {
        this.args = args;
        this.updateTitle(isCurrentPlayerActive);
      
        if (isCurrentPlayerActive) {
            this.updateButtons();
            this.refreshSelectability();
        }
    }

    updateTitle(isCurrentPlayerActive) {
        if (!isCurrentPlayerActive) {
            this.bga.statusBar.setTitle(_('${actplayer} is using a Corrupter'));
            return;
        }

        if (!this.selectedHandId) {
            this.bga.statusBar.setTitle(_('${you} may select a passenger from your hand to swap'));
        } else if (!this.selectedTargetId) {
            this.bga.statusBar.setTitle(_('${you} must select a target passenger from Waiting Room or a matching Bus'));
        } else {
            this.bga.statusBar.setTitle(_('${you} have selected the cards. Click Confirm to swap.'));
        }
    }

    refreshSelectability() {
        this.game.setSelectable('any', false);
        
        // Hand passengers are ALWAYS selectable to allow changing mind
        this.game.setSelectable('passenger', true, 'my-hand-passengers');

        if (this.selectedHandId) {
            this.game.selectCard(this.selectedHandId, true);
            
            const handTypeArg = this.game.getCardTypeArg(this.selectedHandId);
            const handColor = Math.floor(handTypeArg / 10);
            const handAbility = handTypeArg % 10;

            // 1. All passengers in Waiting Room (any color)
            document.querySelectorAll('#waiting-room .buu_card').forEach(el => {
                if (el.dataset.id != this.args.corrupterId) {
                    el.classList.add('buu_selectable');
                }
            });

            // 2. Passengers in buses if color matches
            document.querySelectorAll('.buu_bus-inner .buu_card').forEach(el => {
                const cardId = el.dataset.id;
                if (cardId == this.args.corrupterId) return; // (not themselves)

                // Find the bus this passenger is in
                const busStack = el.closest('.buu_bus-stack');
                if (busStack) {
                    const busId = busStack.id.replace('bus-stack-', '');
                    const busTypeArg = this.game.getCardTypeArg(busId);
                    const busColor = Math.floor(busTypeArg / 10);

                    if (handColor === busColor || handAbility === 6) {
                        el.classList.add('buu_selectable');
                    }
                }
            });
        }
    }

    onLeavingState() {
        this.game.setSelectable('any', false);
        this.selectedHandId = null;
        this.selectedTargetId = null;
        this.args = null;
    }

    onCardClick(cardId, type, containerId) {
        if (type !== 'passenger') return;

        if (containerId === 'my-hand-passengers') {
            // If clicking another hand card, change selection
            if (this.selectedHandId === cardId) {
                // Deselect if same
                this.selectedHandId = null;
                this.selectedTargetId = null;
                this.game.selectCard(cardId, false);
            } else {
                // Change selection
                if (this.selectedHandId) {
                    this.game.selectCard(this.selectedHandId, false);
                }
                if (this.selectedTargetId) {
                    this.game.selectCard(this.selectedTargetId, false);
                }
                this.selectedHandId = cardId;
                this.selectedTargetId = null; // Reset target when hand card changes
                this.game.selectCard(cardId, true);
            }
            this.refreshSelectability();
            this.updateTitle(true);
            this.updateButtons();
            return;
        }

        if (!this.selectedHandId) return; // Cannot select target without hand card

        // Selecting target
        const el = document.getElementById(`card-${cardId}`);
        if (el && el.classList.contains('buu_selectable')) {
            if (this.selectedTargetId === cardId) {
                this.selectedTargetId = null;
                this.game.selectCard(cardId, false);
            } else {
                if (this.selectedTargetId) {
                    this.game.selectCard(this.selectedTargetId, false);
                }
                this.selectedTargetId = cardId;
                this.game.selectCard(cardId, true);
            }
            this.updateTitle(true);
            this.updateButtons();
        }
    }

    updateButtons() {
        this.bga.statusBar.removeActionButtons();
        if (this.selectedHandId && this.selectedTargetId) {
            this.bga.statusBar.addActionButton(_('Confirm'), () => this.onConfirm());
            this.bga.statusBar.addActionButton(_('Cancel'), () => this.onCancel(), { color: 'gray' });
        } else {
            this.bga.statusBar.addActionButton(_('Skip'), () => this.onSkip(), { color: 'gray' });
        }
    }

    onConfirm() {
        this.bga.actions.performAction("actSwap", { handCardId: this.selectedHandId, targetCardId: this.selectedTargetId });
    }

    onSkip() {
        this.bga.actions.performAction("actSkip");
    }

    onCancel() {
        if (this.selectedTargetId) this.game.selectCard(this.selectedTargetId, false);
        if (this.selectedHandId) this.game.selectCard(this.selectedHandId, false);
        this.selectedHandId = null;
        this.selectedTargetId = null;
        this.refreshSelectability();
        this.updateButtons();
        this.updateTitle(true);
    }
}