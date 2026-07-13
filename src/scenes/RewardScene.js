class RewardScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RewardScene' });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a2a1a');

        const centerX = GameConfig.GAME_WIDTH / 2;

        this.add.text(centerX, 60, '보스 처치!', {
            fontSize: '28px', color: '#ffee88',
        }).setOrigin(0.5);

        this.add.text(centerX, 100, '무기 하나를 획득하세요', {
            fontSize: '14px', color: '#bbbbcc',
        }).setOrigin(0.5);

        const pool = ['strongLinear', 'piercing', 'spread', 'homing', 'orbit'];
        this.candidates = Phaser.Utils.Array.Shuffle(pool.slice()).slice(0, 3);

        this.selectedIndex = 0;
        this.cards = [];

        const cardW = GameConfig.GAME_WIDTH - 60;
        const cardH = 110;
        const startY = 190;

        for (let i = 0; i < this.candidates.length; i += 1) {
            const wid = this.candidates[i];
            const w = Weapons[wid];
            const y = startY + i * (cardH + 18);

            const bg = this.add.rectangle(centerX, y, cardW, cardH, 0x223322);
            const swatch = this.add.rectangle(centerX - cardW / 2 + 30, y, 26, 26, w.color);
            const nameText = this.add.text(
                centerX - cardW / 2 + 60, y - 34, w.name,
                { fontSize: '20px', color: '#ffffff' }
            );
            const descText = this.add.text(
                centerX - cardW / 2 + 60, y - 8, this.describe(w),
                { fontSize: '12px', color: '#aaaacc', lineSpacing: 4,
                  wordWrap: { width: cardW - 90 } }
            );

            this.cards.push({ bg, swatch, nameText, descText });
        }

        this.invText = this.add.text(
            centerX, GameConfig.GAME_HEIGHT - 60,
            '', { fontSize: '12px', color: '#888899', align: 'center' }
        ).setOrigin(0.5);

        this.add.text(
            centerX, GameConfig.GAME_HEIGHT - 26,
            'W/S 또는 ↑/↓ 선택 / Enter·Space 확정',
            { fontSize: '11px', color: '#666677' }
        ).setOrigin(0.5);

        const KC = Phaser.Input.Keyboard.KeyCodes;
        this.keyUp1 = this.input.keyboard.addKey(KC.W);
        this.keyDown1 = this.input.keyboard.addKey(KC.S);
        this.keyUp2 = this.input.keyboard.addKey(KC.UP);
        this.keyDown2 = this.input.keyboard.addKey(KC.DOWN);
        this.keyConfirm1 = this.input.keyboard.addKey(KC.ENTER);
        this.keyConfirm2 = this.input.keyboard.addKey(KC.SPACE);

        this.refreshCards();
        this.updateInventoryText();
    }

    describe(w) {
        if (w.id === 'strongLinear') {
            return '위로 빠르게 연사. 초당 8발, 데미지 1.';
        }
        if (w.id === 'piercing') {
            return '위로 발사, 대상을 관통. 초당 2발, 데미지 2.';
        }
        if (w.id === 'spread') {
            return '정면·좌우로 벌어진 3발. 초당 3발, 발당 데미지 1.';
        }
        if (w.id === 'homing') {
            return '보스를 완만하게 추적. 초당 2발, 데미지 2, 느림.';
        }
        if (w.id === 'orbit') {
            return '캐릭터 주변을 회전하는 궤도체. 접촉 시 데미지.';
        }
        return '';
    }

    update() {
        const JD = Phaser.Input.Keyboard.JustDown;
        if (JD(this.keyUp1) || JD(this.keyUp2)) {
            this.selectedIndex = (this.selectedIndex - 1 + this.candidates.length) % this.candidates.length;
            this.refreshCards();
        } else if (JD(this.keyDown1) || JD(this.keyDown2)) {
            this.selectedIndex = (this.selectedIndex + 1) % this.candidates.length;
            this.refreshCards();
        } else if (JD(this.keyConfirm1) || JD(this.keyConfirm2)) {
            this.confirm();
        }
    }

    refreshCards() {
        this.cards.forEach((c, i) => {
            const selected = i === this.selectedIndex;
            c.bg.setFillStyle(selected ? 0x336633 : 0x223322);
            c.bg.setStrokeStyle(selected ? 3 : 1, selected ? 0xffee00 : 0x555566);
        });
    }

    updateInventoryText() {
        const inv = this.registry.get('inventory') || [];
        if (inv.length === 0) {
            this.invText.setText('창고: 비어있음');
        } else {
            const names = inv.map((id) => Weapons[id]?.name ?? id).join(', ');
            this.invText.setText(`창고 (${inv.length}개): ${names}`);
        }
    }

    confirm() {
        const wid = this.candidates[this.selectedIndex];
        const inv = this.registry.get('inventory') || [];
        inv.push(wid);
        this.registry.set('inventory', inv);
        const loadout = this.registry.get('loadout');
        Storage.save(inv, loadout);
        this.scene.start('LoadoutScene');
    }
}
