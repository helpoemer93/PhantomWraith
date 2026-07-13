class LoadoutScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoadoutScene' });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a3a');
        this.centerX = GameConfig.GAME_WIDTH / 2;

        this.inv = this.registry.get('inventory') || [];
        const raw = this.registry.get('loadout');
        this.loadout = raw
            ? { p1: raw.p1.slice(), p2: raw.p2.slice() }
            : { p1: [null, null, null, null], p2: [null, null, null, null] };

        this.cursorIndex = 0;

        this.add.text(this.centerX, 30, '장착 화면', {
            fontSize: '22px', color: '#ffee88',
        }).setOrigin(0.5);

        this.add.text(20, 80, '1P', {
            fontSize: '14px', color: '#4488ff',
        });
        this.p1SlotUI = this.buildSlotRow(115);

        this.add.text(20, 165, '2P', {
            fontSize: '14px', color: '#ff4466',
        });
        this.p2SlotUI = this.buildSlotRow(200);

        this.invHeader = this.add.text(this.centerX, 250, '', {
            fontSize: '14px', color: '#aaaacc',
        }).setOrigin(0.5);

        this.invItemUI = [];
        this.buildInventoryUI();

        this.add.text(this.centerX, GameConfig.GAME_HEIGHT - 74,
            '↑↓ 또는 W/S: 무기 선택\n← 1P 장착   → 2P 장착   Backspace: 해제',
            { fontSize: '11px', color: '#8888aa', align: 'center', lineSpacing: 4 }
        ).setOrigin(0.5);
        this.add.text(this.centerX, GameConfig.GAME_HEIGHT - 28,
            'Space: 게임 시작   ESC: 메뉴로',
            { fontSize: '12px', color: '#ffee88', align: 'center' }
        ).setOrigin(0.5);

        const KC = Phaser.Input.Keyboard.KeyCodes;
        this.keyUp1 = this.input.keyboard.addKey(KC.W);
        this.keyDown1 = this.input.keyboard.addKey(KC.S);
        this.keyUp2 = this.input.keyboard.addKey(KC.UP);
        this.keyDown2 = this.input.keyboard.addKey(KC.DOWN);
        this.keyLeft = this.input.keyboard.addKey(KC.LEFT);
        this.keyRight = this.input.keyboard.addKey(KC.RIGHT);
        this.keyRemove = this.input.keyboard.addKey(KC.BACKSPACE);
        this.keyStart = this.input.keyboard.addKey(KC.SPACE);
        this.keyMenu = this.input.keyboard.addKey(KC.ESC);

        this.refresh();
    }

    buildSlotRow(y) {
        const slotW = 100;
        const slotH = 58;
        const gap = 10;
        const totalW = slotW * 4 + gap * 3;
        const startX = (GameConfig.GAME_WIDTH - totalW) / 2;
        const ui = [];
        for (let i = 0; i < 4; i += 1) {
            const x = startX + i * (slotW + gap) + slotW / 2;
            const bg = this.add.rectangle(x, y, slotW, slotH, 0x333344)
                .setStrokeStyle(1, 0x555577);
            const swatch = this.add.rectangle(x, y - 12, slotW - 12, 10, 0x000000);
            const text = this.add.text(x, y + 12, '---', {
                fontSize: '11px', color: '#aaaacc',
            }).setOrigin(0.5);
            ui.push({ bg, swatch, text });
        }
        return ui;
    }

    buildInventoryUI() {
        const rowH = 26;
        const startY = 278;
        const listW = GameConfig.GAME_WIDTH - 30;

        if (this.inv.length === 0) {
            this.emptyText = this.add.text(
                this.centerX, startY + 20,
                '(창고 비어있음 — 보스를 처치해 무기를 획득하세요)',
                { fontSize: '11px', color: '#666677' }
            ).setOrigin(0.5);
            return;
        }

        for (let i = 0; i < this.inv.length; i += 1) {
            const wid = this.inv[i];
            const w = Weapons[wid];
            const y = startY + i * rowH;
            const bg = this.add.rectangle(this.centerX, y, listW, rowH - 3, 0x222233);
            const swatch = this.add.rectangle(25, y, 14, 14, w.color);
            const nameText = this.add.text(45, y, w.name, {
                fontSize: '13px', color: '#ffffff',
            }).setOrigin(0, 0.5);
            const posText = this.add.text(GameConfig.GAME_WIDTH - 20, y, '', {
                fontSize: '11px', color: '#aaaacc',
            }).setOrigin(1, 0.5);
            this.invItemUI.push({ bg, swatch, nameText, posText });
        }
    }

    findLoadoutPos(invIdx) {
        for (let i = 0; i < this.loadout.p1.length; i += 1) {
            if (this.loadout.p1[i] === invIdx) return { char: 'p1', slot: i };
        }
        for (let i = 0; i < this.loadout.p2.length; i += 1) {
            if (this.loadout.p2[i] === invIdx) return { char: 'p2', slot: i };
        }
        return null;
    }

    removeFromLoadout(invIdx) {
        for (let i = 0; i < this.loadout.p1.length; i += 1) {
            if (this.loadout.p1[i] === invIdx) this.loadout.p1[i] = null;
        }
        for (let i = 0; i < this.loadout.p2.length; i += 1) {
            if (this.loadout.p2[i] === invIdx) this.loadout.p2[i] = null;
        }
    }

    placeTo(invIdx, char) {
        this.removeFromLoadout(invIdx);
        const arr = this.loadout[char];
        for (let i = 0; i < arr.length; i += 1) {
            if (arr[i] == null) {
                arr[i] = invIdx;
                return true;
            }
        }
        return false;
    }

    update() {
        const JD = Phaser.Input.Keyboard.JustDown;
        if (JD(this.keyMenu)) {
            this.registry.set('loadout', this.loadout);
            Storage.save(this.inv, this.loadout);
            this.scene.start('BootScene');
            return;
        }
        if (JD(this.keyStart)) {
            this.registry.set('loadout', this.loadout);
            Storage.save(this.inv, this.loadout);
            this.scene.start('GameScene');
            return;
        }

        if (this.inv.length === 0) return;

        if (JD(this.keyUp1) || JD(this.keyUp2)) {
            this.cursorIndex = (this.cursorIndex - 1 + this.inv.length) % this.inv.length;
            this.refresh();
        } else if (JD(this.keyDown1) || JD(this.keyDown2)) {
            this.cursorIndex = (this.cursorIndex + 1) % this.inv.length;
            this.refresh();
        } else if (JD(this.keyLeft)) {
            this.placeTo(this.cursorIndex, 'p1');
            this.refresh();
        } else if (JD(this.keyRight)) {
            this.placeTo(this.cursorIndex, 'p2');
            this.refresh();
        } else if (JD(this.keyRemove)) {
            this.removeFromLoadout(this.cursorIndex);
            this.refresh();
        }
    }

    refresh() {
        this.invHeader.setText(
            this.inv.length === 0 ? '창고: 비어있음' : `창고 (${this.inv.length}개)`
        );

        for (let i = 0; i < 4; i += 1) {
            this.updateSlotUI(this.p1SlotUI[i], this.loadout.p1[i]);
            this.updateSlotUI(this.p2SlotUI[i], this.loadout.p2[i]);
        }

        for (let i = 0; i < this.invItemUI.length; i += 1) {
            const u = this.invItemUI[i];
            const selected = i === this.cursorIndex;
            u.bg.setFillStyle(selected ? 0x334455 : 0x222233);
            u.bg.setStrokeStyle(selected ? 2 : 0, 0xffee00);
            const pos = this.findLoadoutPos(i);
            u.posText.setText(pos ? `${pos.char.toUpperCase()} #${pos.slot + 1}` : '—');
            u.posText.setColor(pos ? '#88ffcc' : '#555566');
        }
    }

    updateSlotUI(ui, invIdx) {
        if (invIdx == null || invIdx >= this.inv.length) {
            ui.bg.setFillStyle(0x333344);
            ui.swatch.setFillStyle(0x000000);
            ui.text.setText('---');
            ui.text.setColor('#666677');
            return;
        }
        const wid = this.inv[invIdx];
        const w = Weapons[wid];
        ui.bg.setFillStyle(0x334455);
        ui.swatch.setFillStyle(w.color);
        ui.text.setText(w.name);
        ui.text.setColor('#ffffff');
    }
}
