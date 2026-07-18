class UpgradeShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UpgradeShopScene' });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a2432');
        this.centerX = GameConfig.GAME_WIDTH / 2;
        this.upgrades = { ...(this.registry.get('upgrades') || makeInitialUpgrades()) };
        this.crystals = this.registry.get('crystals') ?? 0;
        this.cursorIndex = 0;

        this.add.text(this.centerX, 40, '강화 상점', {
            fontSize: '24px', color: '#ffee88',
        }).setOrigin(0.5);

        this.crystalText = this.add.text(this.centerX, 76, '', {
            fontSize: '14px', color: '#88ccff',
        }).setOrigin(0.5);

        this.rowUIs = [];
        const rowH = 92;
        const rowW = GameConfig.GAME_WIDTH - 40;
        const startY = 130;
        for (let i = 0; i < UPGRADE_IDS.length; i += 1) {
            const y = startY + i * (rowH + 10);
            this.rowUIs.push(this.buildRow(UPGRADE_IDS[i], y, rowW, rowH));
        }

        this.add.text(this.centerX, GameConfig.GAME_HEIGHT - 60,
            'W/S 또는 ↑/↓ 선택 · Enter/Space 구매 · ESC 메뉴',
            { fontSize: '11px', color: '#666677', align: 'center' }
        ).setOrigin(0.5);

        const KC = Phaser.Input.Keyboard.KeyCodes;
        this.keyUp1 = this.input.keyboard.addKey(KC.W);
        this.keyDown1 = this.input.keyboard.addKey(KC.S);
        this.keyUp2 = this.input.keyboard.addKey(KC.UP);
        this.keyDown2 = this.input.keyboard.addKey(KC.DOWN);
        this.keyConfirm1 = this.input.keyboard.addKey(KC.ENTER);
        this.keyConfirm2 = this.input.keyboard.addKey(KC.SPACE);
        this.keyMenu = this.input.keyboard.addKey(KC.ESC);

        this.refresh();
    }

    buildRow(id, y, rowW, rowH) {
        const upgrade = Upgrades[id];
        const bg = this.add.rectangle(this.centerX, y, rowW, rowH, 0x223344)
            .setStrokeStyle(1, 0x556677);
        const nameText = this.add.text(
            this.centerX - rowW / 2 + 16, y - rowH / 2 + 10, upgrade.name,
            { fontSize: '16px', color: '#ffffff' }
        );
        const statText = this.add.text(
            this.centerX - rowW / 2 + 16, y - rowH / 2 + 34, '',
            { fontSize: '11px', color: '#ccccdd' }
        );
        const nextText = this.add.text(
            this.centerX - rowW / 2 + 16, y - rowH / 2 + 54, '',
            { fontSize: '11px', color: '#88ff88' }
        );
        const costText = this.add.text(
            this.centerX + rowW / 2 - 16, y - rowH / 2 + 10, '',
            { fontSize: '15px', color: '#88ccff' }
        ).setOrigin(1, 0);

        bg.setInteractive({ useHandCursor: true });
        const idx = UPGRADE_IDS.indexOf(id);
        bg.on('pointerdown', () => {
            this.cursorIndex = idx;
            this.refresh();
            this.buy();
        });
        bg.on('pointerover', () => {
            this.cursorIndex = idx;
            this.refresh();
        });

        return { bg, nameText, statText, nextText, costText, id };
    }

    update() {
        const JD = Phaser.Input.Keyboard.JustDown;
        if (JD(this.keyMenu)) {
            this.scene.start('BootScene');
            return;
        }
        if (JD(this.keyUp1) || JD(this.keyUp2)) {
            this.cursorIndex = (this.cursorIndex - 1 + UPGRADE_IDS.length) % UPGRADE_IDS.length;
            this.refresh();
        } else if (JD(this.keyDown1) || JD(this.keyDown2)) {
            this.cursorIndex = (this.cursorIndex + 1) % UPGRADE_IDS.length;
            this.refresh();
        } else if (JD(this.keyConfirm1) || JD(this.keyConfirm2)) {
            this.buy();
        }
    }

    buy() {
        const id = UPGRADE_IDS[this.cursorIndex];
        const upgrade = Upgrades[id];
        const currLv = this.upgrades[id] ?? 0;
        if (currLv >= upgrade.maxLevel) return;
        const cost = upgrade.costs[currLv];
        if (this.crystals < cost) return;
        this.crystals -= cost;
        this.upgrades[id] = currLv + 1;
        this.registry.set('crystals', this.crystals);
        this.registry.set('upgrades', this.upgrades);
        const weaponLevels = this.registry.get('weaponLevels') || {};
        const loadout = this.registry.get('loadout');
        const bossProgress = this.registry.get('bossProgress') || {};
        Storage.save(weaponLevels, loadout, bossProgress, this.crystals, this.upgrades);
        this.refresh();
    }

    refresh() {
        this.crystalText.setText(`보유 결정: ${this.crystals}`);
        this.rowUIs.forEach((r, i) => {
            const upgrade = Upgrades[r.id];
            const currLv = this.upgrades[r.id] ?? 0;
            const selected = i === this.cursorIndex;
            r.bg.setFillStyle(selected ? 0x2a4a5a : 0x223344);
            r.bg.setStrokeStyle(selected ? 3 : 1, selected ? 0xffee00 : 0x556677);
            r.statText.setText(`현재 Lv${currLv} — ${upgrade.describe(currLv)}`);
            if (currLv >= upgrade.maxLevel) {
                r.nextText.setText('최대 강화 완료');
                r.nextText.setColor('#ffcc44');
                r.costText.setText('MAX');
                r.costText.setColor('#ffcc44');
            } else {
                const nextLv = currLv + 1;
                const cost = upgrade.costs[currLv];
                r.nextText.setText(`Lv${nextLv} → ${upgrade.describe(nextLv)}`);
                r.nextText.setColor('#88ff88');
                const affordable = this.crystals >= cost;
                r.costText.setText(`${cost} 결정`);
                r.costText.setColor(affordable ? '#88ccff' : '#ff8888');
            }
        });
    }
}
