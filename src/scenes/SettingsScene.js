class SettingsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'SettingsScene' });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');
        AudioSettings.applyMaster(this);

        const centerX = GameConfig.GAME_WIDTH / 2;

        this.add.text(centerX, 100, '설정', {
            fontSize: '40px', color: '#ffffff',
        }).setOrigin(0.5);

        this.add.text(centerX, 160, '오디오 볼륨', {
            fontSize: '16px', color: '#8888aa',
        }).setOrigin(0.5);

        this.items = [
            { key: 'master', label: '마스터' },
            { key: 'bgm', label: 'BGM' },
            { key: 'sfx', label: 'SFX' },
        ];
        this.selectedIndex = 0;

        this.itemTexts = this.items.map((item, i) => (
            this.add.text(centerX, 240 + i * 60, '', {
                fontSize: '20px', color: '#ffffff', align: 'center',
                fontFamily: 'monospace',
            }).setOrigin(0.5)
        ));

        this.add.text(centerX, GameConfig.GAME_HEIGHT - 100,
            'W/S 또는 ↑/↓ : 항목 선택\nA/D 또는 ←/→ : 볼륨 조정 (10%)\nESC : 뒤로',
            {
                fontSize: '13px', color: '#666677', align: 'center', lineSpacing: 6,
            },
        ).setOrigin(0.5);

        const KC = Phaser.Input.Keyboard.KeyCodes;
        this.keyUp1 = this.input.keyboard.addKey(KC.W);
        this.keyDown1 = this.input.keyboard.addKey(KC.S);
        this.keyUp2 = this.input.keyboard.addKey(KC.UP);
        this.keyDown2 = this.input.keyboard.addKey(KC.DOWN);
        this.keyLeft1 = this.input.keyboard.addKey(KC.A);
        this.keyRight1 = this.input.keyboard.addKey(KC.D);
        this.keyLeft2 = this.input.keyboard.addKey(KC.LEFT);
        this.keyRight2 = this.input.keyboard.addKey(KC.RIGHT);
        this.keyCancel = this.input.keyboard.addKey(KC.ESC);

        this.refreshMenu();
    }

    update() {
        const JD = Phaser.Input.Keyboard.JustDown;
        if (JD(this.keyCancel)) {
            this.scene.start('BootScene');
            return;
        }
        if (JD(this.keyUp1) || JD(this.keyUp2)) {
            this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
            this.refreshMenu();
        } else if (JD(this.keyDown1) || JD(this.keyDown2)) {
            this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
            this.refreshMenu();
        } else if (JD(this.keyLeft1) || JD(this.keyLeft2)) {
            this.adjustValue(-0.1);
        } else if (JD(this.keyRight1) || JD(this.keyRight2)) {
            this.adjustValue(0.1);
        }
    }

    adjustValue(delta) {
        const item = this.items[this.selectedIndex];
        const cur = AudioSettings.get(item.key);
        const next = Math.max(0, Math.min(1, Math.round((cur + delta) * 10) / 10));
        if (next === cur) return;
        AudioSettings.set(item.key, next);

        if (item.key === 'master') {
            AudioSettings.applyMaster(this);
        } else if (item.key === 'bgm') {
            AudioSettings.refreshActiveBgm(this);
        } else if (item.key === 'sfx') {
            // 미리듣기: 짧은 SFX 재생
            AudioSettings.playSfx(this, 'gugu-flap', { volume: 0.35 });
        }
        this.refreshMenu();
    }

    refreshMenu() {
        this.itemTexts.forEach((t, i) => {
            const item = this.items[i];
            const selected = i === this.selectedIndex;
            const v = AudioSettings.get(item.key);
            const pct = Math.round(v * 100);
            const bars = Math.round(v * 10);
            const bar = '■'.repeat(bars) + '□'.repeat(10 - bars);
            const prefix = selected ? '▶ ' : '  ';
            const label = item.label.padEnd(6, ' ');
            t.setText(`${prefix}${label} ${bar} ${String(pct).padStart(3, ' ')}%`);
            t.setColor(selected ? '#ffee00' : '#aaaaaa');
        });
    }
}
