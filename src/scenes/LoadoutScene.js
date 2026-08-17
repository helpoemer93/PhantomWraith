class LoadoutScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoadoutScene' });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a3a');
        this.cameras.main.fadeIn(300, 0, 0, 0);
        this.centerX = GameConfig.GAME_WIDTH / 2;

        this.weaponLevels = this.registry.get('weaponLevels') || {};
        const raw = this.registry.get('loadout');
        this.loadout = raw
            ? { p1: raw.p1.slice(), p2: raw.p2.slice(), mirror: raw.mirror ?? true }
            : { p1: [null, null, null, null], p2: [null, null, null, null], mirror: true };

        // 챌린지 세션 상태 (오버레이에서 편집, 닫을 때 registry에 반영).
        const savedActive = this.registry.get('activeChallenges') || {};
        this.activeChallenges = { ...savedActive };
        this.overlayOpen = false;
        this.overlayCursor = 0;

        this.cursorIndex = 0;

        this.add.text(this.centerX, 30, '장착 화면', {
            fontSize: '22px', color: '#ffee88',
        }).setOrigin(0.5);

        this.mirrorBtnBg = this.add.rectangle(GameConfig.GAME_WIDTH - 90, 30, 160, 22, 0x334455)
            .setStrokeStyle(1, 0x88ccff)
            .setInteractive({ useHandCursor: true });
        this.mirrorBtnText = this.add.text(GameConfig.GAME_WIDTH - 90, 30, '', {
            fontSize: '11px', color: '#ffffff',
        }).setOrigin(0.5);
        this.mirrorBtnBg.on('pointerdown', () => this.toggleMirror());

        // 챌린지 버튼 (좌측 상단, 미러 버튼과 대칭 배치)
        this.challengeBtnBg = this.add.rectangle(90, 30, 160, 22, 0x443322)
            .setStrokeStyle(1, 0xffcc33)
            .setInteractive({ useHandCursor: true });
        this.challengeBtnText = this.add.text(90, 30, '', {
            fontSize: '11px', color: '#ffcc33',
        }).setOrigin(0.5);
        this.challengeBtnBg.on('pointerdown', () => this.openChallengeOverlay());

        this.add.text(20, 80, '1P', {
            fontSize: '14px', color: '#ff4466',
        });
        this.buildClearButton(GameConfig.GAME_WIDTH - 90, 80, 'p1');
        this.p1SlotUI = this.buildSlotRow(115, 'p1');

        this.add.text(20, 165, '2P', {
            fontSize: '14px', color: '#4488ff',
        });
        this.buildClearButton(GameConfig.GAME_WIDTH - 90, 165, 'p2');
        this.p2SlotUI = this.buildSlotRow(200, 'p2');

        this.add.text(20, 245, '무기 (캐릭터별 중복 불가, p1·p2 서로는 가능)', {
            fontSize: '12px', color: '#88ffcc',
        });

        this.cardUI = [];
        this.buildCardUI();

        const previewW = 240;
        const previewH = 180;
        const previewX = (GameConfig.GAME_WIDTH - previewW) / 2;
        const previewY = 490;
        this.preview = new WeaponPreview(this, previewX, previewY, previewW, previewH);

        this.add.text(this.centerX, GameConfig.GAME_HEIGHT - 60,
            '↑↓/W·S: 무기 선택   ← 1P 장착   → 2P 장착   Backspace: 해제   C: 챌린지',
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
        this.keyChallenge = this.input.keyboard.addKey(KC.C);
        this.keyToggle = this.input.keyboard.addKey(KC.ENTER);

        this.buildChallengeOverlay();
        this.refresh();
    }

    buildChallengeOverlay() {
        this.overlayItems = [];
        this.overlayRows = [];

        const dim = this.add.rectangle(
            GameConfig.GAME_WIDTH / 2, GameConfig.GAME_HEIGHT / 2,
            GameConfig.GAME_WIDTH, GameConfig.GAME_HEIGHT,
            0x000000, 0.75
        ).setDepth(100).setVisible(false).setInteractive();
        dim.on('pointerdown', () => this.closeChallengeOverlay());
        this.overlayItems.push(dim);

        const panelX = GameConfig.GAME_WIDTH / 2;
        const panelY = GameConfig.GAME_HEIGHT / 2;
        const panelW = 420;
        const panelH = 520;
        const panel = this.add.rectangle(panelX, panelY, panelW, panelH, 0x14202e)
            .setStrokeStyle(2, 0x8899aa)
            .setDepth(101).setVisible(false)
            .setInteractive(); // 패널 내부 여백 클릭은 흡수 (dim 오작동 방지)
        this.overlayItems.push(panel);

        const title = this.add.text(panelX, panelY - panelH / 2 + 24, '챌린지 선택', {
            fontSize: '20px', color: '#ffcc33',
        }).setOrigin(0.5).setDepth(102).setVisible(false);
        this.overlayItems.push(title);

        const rowStartY = panelY - panelH / 2 + 70;
        const rowHeight = 70;
        Challenges.forEach((c, i) => {
            const rowY = rowStartY + i * rowHeight + rowHeight / 2;
            const rowBg = this.add.rectangle(panelX, rowY, panelW - 40, rowHeight - 10, 0x223344)
                .setStrokeStyle(1, 0x556677)
                .setDepth(102).setVisible(false)
                .setInteractive({ useHandCursor: true });
            rowBg.on('pointerdown', () => {
                this.overlayCursor = i;
                this.toggleActiveChallenge(c.id);
            });
            rowBg.on('pointerover', () => {
                this.overlayCursor = i;
                this.refreshOverlay();
            });
            this.overlayItems.push(rowBg);

            const cbSize = 18;
            const cbX = panelX - panelW / 2 + 36;
            const cbBg = this.add.rectangle(cbX, rowY - 8, cbSize, cbSize, 0x111122)
                .setStrokeStyle(1, 0x8899aa)
                .setDepth(103).setVisible(false);
            const cbCheck = this.add.text(cbX, rowY - 8, '', {
                fontSize: '14px', color: '#ffcc33',
            }).setOrigin(0.5).setDepth(104).setVisible(false);
            this.overlayItems.push(cbBg, cbCheck);

            const label = this.add.text(cbX + cbSize + 10, rowY - 16, c.label, {
                fontSize: '15px', color: '#ffffff',
            }).setDepth(103).setVisible(false);
            this.overlayItems.push(label);

            const desc = this.add.text(cbX + cbSize + 10, rowY + 5, c.description, {
                fontSize: '11px', color: '#aabbcc',
            }).setDepth(103).setVisible(false);
            this.overlayItems.push(desc);

            this.overlayRows.push({ rowBg, cbBg, cbCheck, challenge: c });
        });

        const hint = this.add.text(
            panelX, panelY + panelH / 2 - 20,
            '↑↓/W·S: 선택   Space·Enter: 토글   ESC 또는 C: 닫기',
            { fontSize: '10px', color: '#8899aa', align: 'center' }
        ).setOrigin(0.5).setDepth(102).setVisible(false);
        this.overlayItems.push(hint);
    }

    openChallengeOverlay() {
        if (this.overlayOpen) return;
        this.overlayOpen = true;
        for (const item of this.overlayItems) item.setVisible(true);
        this.refreshOverlay();
    }

    closeChallengeOverlay() {
        if (!this.overlayOpen) return;
        this.overlayOpen = false;
        for (const item of this.overlayItems) item.setVisible(false);
        this.registry.set('activeChallenges', { ...this.activeChallenges });
        this.refreshChallengeButton();
    }

    toggleActiveChallenge(id) {
        if (this.activeChallenges[id]) delete this.activeChallenges[id];
        else this.activeChallenges[id] = true;
        this.refreshOverlay();
    }

    refreshOverlay() {
        if (!this.overlayRows) return;
        this.overlayRows.forEach((row, i) => {
            const isCursor = i === this.overlayCursor;
            const isActive = !!this.activeChallenges[row.challenge.id];
            row.rowBg.setFillStyle(isCursor ? 0x334466 : 0x223344);
            row.rowBg.setStrokeStyle(isCursor ? 2 : 1, isCursor ? 0xffcc33 : 0x556677);
            row.cbCheck.setText(isActive ? '✓' : '');
            row.cbBg.setFillStyle(isActive ? 0x332211 : 0x111122);
        });
    }

    refreshChallengeButton() {
        if (!this.challengeBtnText) return;
        const activeCount = Challenges.filter((c) => this.activeChallenges[c.id]).length;
        if (activeCount === 0) {
            this.challengeBtnText.setText('챌린지 (없음)');
            this.challengeBtnText.setColor('#886644');
            this.challengeBtnBg.setFillStyle(0x332211);
            this.challengeBtnBg.setStrokeStyle(1, 0x664422);
        } else {
            this.challengeBtnText.setText(`🎗 챌린지 [${activeCount}개 활성]`);
            this.challengeBtnText.setColor('#ffcc33');
            this.challengeBtnBg.setFillStyle(0x554400);
            this.challengeBtnBg.setStrokeStyle(1, 0xffcc33);
        }
    }

    buildClearButton(x, y, char) {
        const bg = this.add.rectangle(x, y, 78, 18, 0x442233)
            .setStrokeStyle(1, 0x885566)
            .setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true });
        const text = this.add.text(x + 39, y, '전체 비우기', {
            fontSize: '10px', color: '#ffaabb',
        }).setOrigin(0.5);
        bg.on('pointerdown', () => {
            this.clearAll(char);
            this.refresh();
        });
        bg.on('pointerover', () => bg.setStrokeStyle(2, 0xff88aa));
        bg.on('pointerout', () => bg.setStrokeStyle(1, 0x885566));
        return { bg, text };
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

    targetsFor(char) {
        return this.loadout.mirror ? ['p1', 'p2'] : [char];
    }

    placeTo(wid, char) {
        let changed = false;
        for (const c of this.targetsFor(char)) {
            const arr = this.loadout[c];
            if (arr.includes(wid)) continue;
            for (let i = 0; i < arr.length; i += 1) {
                if (arr[i] == null) {
                    arr[i] = wid;
                    changed = true;
                    break;
                }
            }
        }
        return changed;
    }

    placeToSpecificSlot(wid, char, slotIndex) {
        let changed = false;
        for (const c of this.targetsFor(char)) {
            const arr = this.loadout[c];
            if (arr[slotIndex] === wid) continue;
            for (let i = 0; i < arr.length; i += 1) {
                if (i !== slotIndex && arr[i] === wid) arr[i] = null;
            }
            arr[slotIndex] = wid;
            changed = true;
        }
        return changed;
    }

    clearAll(char) {
        for (const c of this.targetsFor(char)) {
            const arr = this.loadout[c];
            for (let i = 0; i < arr.length; i += 1) arr[i] = null;
        }
    }

    onSlotClick(char, slotIndex) {
        const wid = BASIC_WEAPON_IDS[this.cursorIndex];
        this.placeToSpecificSlot(wid, char, slotIndex);
        this.refresh();
    }

    toggleMirror() {
        this.loadout.mirror = !this.loadout.mirror;
        if (this.loadout.mirror) {
            this.loadout.p2 = this.loadout.p1.slice();
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
        const crystals = this.registry.get('crystals') ?? 0;
        const upgrades = this.registry.get('upgrades') || makeInitialUpgrades();
        const challengeProgress = this.registry.get('challengeProgress') || makeInitialChallengeProgress();
        Storage.save(this.weaponLevels, this.loadout, bossProgress, crystals, upgrades, challengeProgress);
        this.scene.start(sceneKey);
    }

    update(time, delta) {
        if (this.preview) this.preview.update(time, delta);
        const JD = Phaser.Input.Keyboard.JustDown;

        if (this.overlayOpen) {
            if (JD(this.keyMenu) || JD(this.keyChallenge)) {
                this.closeChallengeOverlay();
                return;
            }
            if (Challenges.length > 0) {
                if (JD(this.keyUp1) || JD(this.keyUp2)) {
                    this.overlayCursor = (this.overlayCursor - 1 + Challenges.length) % Challenges.length;
                    this.refreshOverlay();
                } else if (JD(this.keyDown1) || JD(this.keyDown2)) {
                    this.overlayCursor = (this.overlayCursor + 1) % Challenges.length;
                    this.refreshOverlay();
                } else if (JD(this.keyStart) || JD(this.keyToggle)) {
                    const c = Challenges[this.overlayCursor];
                    this.toggleActiveChallenge(c.id);
                }
            }
            return;
        }

        if (JD(this.keyChallenge)) {
            this.openChallengeOverlay();
            return;
        }

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
        this.refreshChallengeButton();
        if (this.mirrorBtnText) {
            const on = this.loadout.mirror;
            this.mirrorBtnText.setText(`1P·2P 동시 편집: ${on ? 'ON' : 'OFF'}`);
            this.mirrorBtnBg.setFillStyle(on ? 0x224477 : 0x333344);
            this.mirrorBtnBg.setStrokeStyle(1, on ? 0x88ccff : 0x666677);
        }

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
