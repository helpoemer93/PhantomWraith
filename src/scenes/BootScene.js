class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');

        if (!this.registry.get('loadout')) {
            const saved = Storage.load();
            if (saved) {
                this.registry.set('weaponLevels', saved.weaponLevels);
                this.registry.set('loadout', saved.loadout);
                this.registry.set('bossProgress', saved.bossProgress);
            } else {
                const init = makeInitialSaveData();
                this.registry.set('weaponLevels', init.weaponLevels);
                this.registry.set('loadout', init.loadout);
                this.registry.set('bossProgress', init.bossProgress);
                Storage.save(init.weaponLevels, init.loadout, init.bossProgress);
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

        const weaponLevels = this.registry.get('weaponLevels') || {};
        const weaponLabel = BASIC_WEAPON_IDS
            .map((id) => `${Weapons[id]?.name ?? id} Lv${weaponLevels[id] ?? 0}`)
            .join('  ·  ');
        this.add.text(centerX, 290, weaponLabel, {
            fontSize: '11px',
            color: '#7788aa',
            align: 'center',
            wordWrap: { width: GameConfig.GAME_WIDTH - 40 },
        }).setOrigin(0.5);

        const bossProgress = this.registry.get('bossProgress') || {};
        const progressLines = Stages.map((b) => {
            const lv = bossProgress[b.id] ?? 0;
            const label = lv === 0 ? '미클리어' : `최고 Lv${lv} 클리어`;
            return `${b.name}: ${label}`;
        }).join('\n');
        this.add.text(centerX, 330, progressLines, {
            fontSize: '11px',
            color: '#88ccff',
            align: 'center',
            lineSpacing: 4,
        }).setOrigin(0.5);

        this.items = [
            { label: '게임 시작', scene: 'BossSelectScene' },
            { label: '조작 실습 (튜토리얼)', scene: 'TutorialScene' },
            { label: '패턴 실험실', scene: 'PatternLabScene' },
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
