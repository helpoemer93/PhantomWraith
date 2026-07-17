class LoadoutScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoadoutScene' });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a3a');
        this.centerX = GameConfig.GAME_WIDTH / 2;

        this.weaponLevels = this.registry.get('weaponLevels') || {};
        const raw = this.registry.get('loadout');
        this.loadout = raw
            ? { p1: raw.p1.slice(), p2: raw.p2.slice() }
            : { p1: [null, null, null, null], p2: [null, null, null, null] };

        this.cursorIndex = 0;

        this.add.text(this.centerX, 30, '장착 화면', {
            fontSize: '22px', color: '#ffee88',
        }).setOrigin(0.5);

        this.add.text(20, 80, '1P', {
            fontSize: '14px', color: '#ff4466',
        });
        this.p1SlotUI = this.buildSlotRow(115, 'p1');

        this.add.text(20, 165, '2P', {
            fontSize: '14px', color: '#4488ff',
        });
        this.p2SlotUI = this.buildSlotRow(200, 'p2');

        this.add.text(20, 245, '무기 (캐릭터별 중복 불가, p1·p2 서로는 가능)', {
            fontSize: '12px', color: '#88ffcc',
        });

        this.cardUI = [];
        this.buildCardUI();

        const previewW = 240;
        const previewH = 130;
        const previewX = (GameConfig.GAME_WIDTH - previewW) / 2;
        const previewY = 490;
        this.preview = new WeaponPreview(this, previewX, previewY, previewW, previewH);

        this.add.text(this.centerX, GameConfig.GAME_HEIGHT - 60,
            '↑↓/W·S: 무기 선택   ← 1P 장착   → 2P 장착   Backspace: 해제',
            { fontSize: '10px', color: '#8888aa', align: 'center', lineSpacing: 4 }
        ).setOrigin(0.5);
        this.add.text(this.centerX, GameConfig.GAME_HEIGHT - 28,
            'Space: 게임 시작   ESC: 보스 선택으로',
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

    buildSlotRow(y, char) {
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
            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerdown', () => this.onSlotClick(char, i));
            bg.on('pointerover', () => bg.setStrokeStyle(2, 0x88ccff));
            bg.on('pointerout', () => bg.setStrokeStyle(1, 0x555577));
            ui.push({ bg, swatch, text });
        }
        return ui;
    }

    buildCardUI() {
        const rowH = 24;
        const startY = 268;
        const listW = GameConfig.GAME_WIDTH - 30;

        for (let i = 0; i < BASIC_WEAPON_IDS.length; i += 1) {
            const wid = BASIC_WEAPON_IDS[i];
            const lv = this.weaponLevels[wid] ?? 0;
            const w = getWeapon(wid, lv);
            if (!w) continue;
            const y = startY + i * rowH;
            const bg = this.add.rectangle(this.centerX, y, listW, rowH - 3, 0x222233);
            const swatch = this.add.rectangle(25, y, 12, 12, w.color);
            const nameText = this.add.text(45, y, w.name, {
                fontSize: '12px', color: '#ffffff',
            }).setOrigin(0, 0.5);
            const posText = this.add.text(GameConfig.GAME_WIDTH - 20, y, '', {
                fontSize: '10px', color: '#aaaacc',
            }).setOrigin(1, 0.5);
            bg.setInteractive({ useHandCursor: true });
            const cardIdx = i;
            bg.on('pointerdown', () => this.onCardClick(cardIdx));
            this.cardUI.push({ bg, swatch, nameText, posText, wid });
        }
    }

    findEquippedPositions(wid) {
        const positions = [];
        for (const char of ['p1', 'p2']) {
            const arr = this.loadout[char];
            for (let i = 0; i < arr.length; i += 1) {
                if (arr[i] === wid) positions.push({ char, slot: i });
            }
        }
        return positions;
    }

    placeTo(wid, char) {
        const arr = this.loadout[char];
        if (arr.includes(wid)) return false;
        for (let i = 0; i < arr.length; i += 1) {
            if (arr[i] == null) {
                arr[i] = wid;
                return true;
            }
        }
        return false;
    }

    placeToSpecificSlot(wid, char, slotIndex) {
        const arr = this.loadout[char];
        if (arr[slotIndex] === wid) return false;
        for (let i = 0; i < arr.length; i += 1) {
            if (i !== slotIndex && arr[i] === wid) return false;
        }
        arr[slotIndex] = wid;
        return true;
    }

    unequipSlot(char, slotIndex) {
        const arr = this.loadout[char];
        if (!arr[slotIndex]) return false;
        arr[slotIndex] = null;
        return true;
    }

    onSlotClick(char, slotIndex) {
        const arr = this.loadout[char];
        if (arr[slotIndex]) {
            this.unequipSlot(char, slotIndex);
        } else {
            const wid = BASIC_WEAPON_IDS[this.cursorIndex];
            this.placeToSpecificSlot(wid, char, slotIndex);
        }
        this.refresh();
    }

    onCardClick(cardIndex) {
        if (cardIndex < 0 || cardIndex >= BASIC_WEAPON_IDS.length) return;
        this.cursorIndex = cardIndex;
        this.refresh();
    }

    removeCard(wid) {
        let removed = false;
        for (const char of ['p1', 'p2']) {
            const arr = this.loadout[char];
            for (let i = 0; i < arr.length; i += 1) {
                if (arr[i] === wid) {
                    arr[i] = null;
                    removed = true;
                }
            }
        }
        return removed;
    }

    persistAndExit(sceneKey) {
        this.registry.set('loadout', this.loadout);
        const bossProgress = this.registry.get('bossProgress') || {};
        Storage.save(this.weaponLevels, this.loadout, bossProgress);
        this.scene.start(sceneKey);
    }

    update(time, delta) {
        if (this.preview) this.preview.update(time, delta);
        const JD = Phaser.Input.Keyboard.JustDown;
        if (JD(this.keyMenu)) {
            this.persistAndExit('BossSelectScene');
            return;
        }
        if (JD(this.keyStart)) {
            this.persistAndExit('GameScene');
            return;
        }

        if (BASIC_WEAPON_IDS.length === 0) return;

        if (JD(this.keyUp1) || JD(this.keyUp2)) {
            this.cursorIndex = (this.cursorIndex - 1 + BASIC_WEAPON_IDS.length) % BASIC_WEAPON_IDS.length;
            this.refresh();
        } else if (JD(this.keyDown1) || JD(this.keyDown2)) {
            this.cursorIndex = (this.cursorIndex + 1) % BASIC_WEAPON_IDS.length;
            this.refresh();
        } else if (JD(this.keyLeft)) {
            this.placeTo(BASIC_WEAPON_IDS[this.cursorIndex], 'p1');
            this.refresh();
        } else if (JD(this.keyRight)) {
            this.placeTo(BASIC_WEAPON_IDS[this.cursorIndex], 'p2');
            this.refresh();
        } else if (JD(this.keyRemove)) {
            this.removeCard(BASIC_WEAPON_IDS[this.cursorIndex]);
            this.refresh();
        }
    }

    refresh() {
        for (let i = 0; i < 4; i += 1) {
            this.updateSlotUI(this.p1SlotUI[i], this.loadout.p1[i]);
            this.updateSlotUI(this.p2SlotUI[i], this.loadout.p2[i]);
        }

        if (this.preview) {
            const wid = BASIC_WEAPON_IDS[this.cursorIndex];
            this.preview.setWeapon(wid, this.weaponLevels[wid] ?? 0);
        }

        for (let i = 0; i < this.cardUI.length; i += 1) {
            const u = this.cardUI[i];
            const selected = i === this.cursorIndex;
            u.bg.setFillStyle(selected ? 0x334455 : 0x222233);
            u.bg.setStrokeStyle(selected ? 2 : 0, 0xffee00);

            const positions = this.findEquippedPositions(u.wid);
            if (positions.length > 0) {
                const label = positions
                    .map((p) => `${p.char.toUpperCase()} #${p.slot + 1}`)
                    .join(', ');
                u.posText.setText(label);
                u.posText.setColor('#88ffcc');
            } else {
                u.posText.setText('—');
                u.posText.setColor('#555566');
            }
        }
    }

    updateSlotUI(ui, wid) {
        if (!wid) {
            ui.bg.setFillStyle(0x333344);
            ui.swatch.setFillStyle(0x000000);
            ui.text.setText('---');
            ui.text.setColor('#666677');
            return;
        }
        const w = getWeapon(wid, this.weaponLevels[wid] ?? 0);
        if (!w) {
            ui.bg.setFillStyle(0x333344);
            ui.swatch.setFillStyle(0x000000);
            ui.text.setText('?');
            ui.text.setColor('#ff6666');
            return;
        }
        ui.bg.setFillStyle(0x334455);
        ui.swatch.setFillStyle(w.color);
        ui.text.setText(w.name);
        ui.text.setColor('#ffffff');
    }
}
