class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');

        if (!this.registry.get('inventory')) {
            const saved = Storage.load();
            if (saved) {
                this.registry.set('inventory', saved.inventory);
                this.registry.set('loadout', saved.loadout);
            } else {
                const inventory = ['basicLinear', 'basicLinear'];
                const loadout = {
                    p1: [0, null, null, null],
                    p2: [1, null, null, null],
                };
                this.registry.set('inventory', inventory);
                this.registry.set('loadout', loadout);
                Storage.save(inventory, loadout);
            }
        }

        const centerX = GameConfig.GAME_WIDTH / 2;

        this.add.text(centerX, 180, '탄막슈팅게임', {
            fontSize: '40px',
            color: '#ffffff',
        }).setOrigin(0.5);

        this.add.text(centerX, 230, '두 캐릭터 동시 조작', {
            fontSize: '14px',
            color: '#8888aa',
        }).setOrigin(0.5);

        const inv = this.registry.get('inventory') || [];
        const invLabel = inv.length === 0
            ? '창고: 비어있음'
            : `창고: ${inv.length}개 (${inv.map((id) => Weapons[id]?.name ?? id).join(', ')})`;
        this.add.text(centerX, 290, invLabel, {
            fontSize: '11px',
            color: '#7788aa',
            align: 'center',
            wordWrap: { width: GameConfig.GAME_WIDTH - 40 },
        }).setOrigin(0.5);

        this.items = [
            { label: '게임 시작', scene: 'LoadoutScene' },
            { label: '조작 실습 (튜토리얼)', scene: 'TutorialScene' },
        ];
        this.selectedIndex = 0;

        this.itemTexts = this.items.map((item, i) => {
            return this.add.text(centerX, 380 + i * 50, '', {
                fontSize: '22px',
                color: '#ffffff',
            }).setOrigin(0.5);
        });

        this.add.text(centerX, GameConfig.GAME_HEIGHT - 80,
            'W/S 또는 ↑/↓ 로 선택\nEnter 또는 Space 로 확정',
            {
                fontSize: '13px',
                color: '#666677',
                align: 'center',
                lineSpacing: 6,
            }
        ).setOrigin(0.5);

        const KC = Phaser.Input.Keyboard.KeyCodes;
        this.keyUp1 = this.input.keyboard.addKey(KC.W);
        this.keyDown1 = this.input.keyboard.addKey(KC.S);
        this.keyUp2 = this.input.keyboard.addKey(KC.UP);
        this.keyDown2 = this.input.keyboard.addKey(KC.DOWN);
        this.keyConfirm1 = this.input.keyboard.addKey(KC.ENTER);
        this.keyConfirm2 = this.input.keyboard.addKey(KC.SPACE);

        this.refreshMenu();
    }

    update() {
        const JD = Phaser.Input.Keyboard.JustDown;
        if (JD(this.keyUp1) || JD(this.keyUp2)) {
            this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
            this.refreshMenu();
        } else if (JD(this.keyDown1) || JD(this.keyDown2)) {
            this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
            this.refreshMenu();
        } else if (JD(this.keyConfirm1) || JD(this.keyConfirm2)) {
            this.scene.start(this.items[this.selectedIndex].scene);
        }
    }

    refreshMenu() {
        this.itemTexts.forEach((t, i) => {
            const selected = i === this.selectedIndex;
            t.setText(selected ? `▶  ${this.items[i].label}` : `    ${this.items[i].label}`);
            t.setColor(selected ? '#ffee00' : '#aaaaaa');
        });
    }
}
