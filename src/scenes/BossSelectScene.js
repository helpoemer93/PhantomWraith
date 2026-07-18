class BossSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BossSelectScene' });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');
        this.centerX = GameConfig.GAME_WIDTH / 2;
        this.bossProgress = this.registry.get('bossProgress') || {};

        this.add.text(this.centerX, 30, '보스 선택', {
            fontSize: '24px', color: '#ffee88',
        }).setOrigin(0.5).setDepth(10);
        this.add.text(this.centerX, 60,
            '보스와 레벨을 선택하세요',
            { fontSize: '11px', color: '#8899aa' }
        ).setOrigin(0.5).setDepth(10);

        // 커서 상태: 이전에 선택했던 보스는 유지, 레벨은 항상 최고 도전 가능 레벨로.
        const prevStage = this.registry.get('selectedStage');
        this.bossIndex = (typeof prevStage === 'number' && prevStage >= 0 && prevStage < Stages.length)
            ? prevStage : 0;
        this.levelSel = this.maxSelectableLevel(this.bossIndex);

        this.scrollAreaTop = 78;
        this.scrollAreaBottom = 590;
        this.scrollOffset = 0;
        this.rowH = 100;
        this.rowGap = 14;

        this.listContainer = this.add.container(0, 0);

        this.rows = [];
        const rowW = GameConfig.GAME_WIDTH - 40;
        const startY = 150;
        for (let i = 0; i < Stages.length; i += 1) {
            const y = startY + i * (this.rowH + this.rowGap);
            this.rows.push(this.buildBossRow(Stages[i], i, y, rowW, this.rowH));
        }

        this.buildDetailPanel();
        this.ensureCursorVisible();

        this.add.text(this.centerX, GameConfig.GAME_HEIGHT - 60,
            'W/S 또는 ↑/↓: 보스 변경    A/D 또는 ←/→: 레벨 변경\nEnter·Space: 확정    ESC: 메뉴',
            { fontSize: '11px', color: '#666677', align: 'center', lineSpacing: 4 }
        ).setOrigin(0.5).setDepth(10);

        const KC = Phaser.Input.Keyboard.KeyCodes;
        this.keyUp1 = this.input.keyboard.addKey(KC.W);
        this.keyDown1 = this.input.keyboard.addKey(KC.S);
        this.keyUp2 = this.input.keyboard.addKey(KC.UP);
        this.keyDown2 = this.input.keyboard.addKey(KC.DOWN);
        this.keyLeft1 = this.input.keyboard.addKey(KC.A);
        this.keyRight1 = this.input.keyboard.addKey(KC.D);
        this.keyLeft2 = this.input.keyboard.addKey(KC.LEFT);
        this.keyRight2 = this.input.keyboard.addKey(KC.RIGHT);
        this.keyConfirm1 = this.input.keyboard.addKey(KC.ENTER);
        this.keyConfirm2 = this.input.keyboard.addKey(KC.SPACE);
        this.keyMenu = this.input.keyboard.addKey(KC.ESC);

        this.refresh();
    }

    maxSelectableLevel(bossIdx) {
        const boss = Stages[bossIdx];
        const cleared = this.bossProgress[boss.id] ?? 0;
        return Math.min(MAX_WEAPON_LEVEL, cleared + 1);
    }

    buildDetailPanel() {
        const panelY = 605;
        const panelH = 110;
        const panelW = GameConfig.GAME_WIDTH - 40;
        this.add.rectangle(this.centerX, panelY + panelH / 2, panelW, panelH, 0x14202e)
            .setStrokeStyle(1, 0x445566).setDepth(10);
        this.detailTitle = this.add.text(
            this.centerX, panelY + 8, '',
            { fontSize: '14px', color: '#ffee88' }
        ).setOrigin(0.5, 0).setDepth(10);
        this.detailBody = this.add.text(
            30, panelY + 34, '',
            { fontSize: '12px', color: '#ccccdd', lineSpacing: 6 }
        ).setDepth(10);
    }

    getLabelsForLevel(boss, level) {
        if (boss.getLevelUpLabels) return boss.getLevelUpLabels(level);
        if (level <= 1) return [];
        return ['HP +25%'];
    }

    buildBossRow(boss, i, y, rowW, rowH) {
        const bg = this.add.rectangle(this.centerX, y, rowW, rowH, 0x223322)
            .setStrokeStyle(1, 0x555566);
        const nameText = this.add.text(
            this.centerX - rowW / 2 + 16, y - rowH / 2 + 14,
            boss.name,
            { fontSize: '18px', color: '#ffffff', padding: { top: 2, bottom: 6 } }
        );
        const stateText = this.add.text(
            this.centerX - rowW / 2 + 16, y - rowH / 2 + 46,
            '',
            { fontSize: '11px', color: '#aaaacc', padding: { top: 2, bottom: 4 } }
        );
        const rewardText = this.add.text(
            this.centerX + rowW / 2 - 16, y - rowH / 2 + 20,
            `보상: ${Weapons[boss.rewardWeapon]?.name ?? boss.rewardWeapon}`,
            { fontSize: '11px', color: '#ffcc88', padding: { top: 2, bottom: 4 } }
        ).setOrigin(1, 0);

        const lvButtons = [];
        const btnSize = 34;
        const gap = 6;
        const totalW = btnSize * MAX_WEAPON_LEVEL + gap * (MAX_WEAPON_LEVEL - 1);
        const startX = this.centerX - totalW / 2 + btnSize / 2;
        const btnY = y + rowH / 2 - 20;
        for (let lv = 1; lv <= MAX_WEAPON_LEVEL; lv += 1) {
            const bx = startX + (lv - 1) * (btnSize + gap);
            const btn = this.add.rectangle(bx, btnY, btnSize, btnSize, 0x333344)
                .setStrokeStyle(1, 0x555577);
            const lbl = this.add.text(bx, btnY, `${lv}`, {
                fontSize: '14px', color: '#ffffff',
            }).setOrigin(0.5);
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => {
                this.bossIndex = i;
                if (lv <= this.maxSelectableLevel(i)) {
                    this.levelSel = lv;
                    this.refresh();
                    this.confirm();
                } else {
                    this.refresh();
                }
            });
            btn.on('pointerover', () => {
                this.bossIndex = i;
                if (lv <= this.maxSelectableLevel(i)) {
                    this.levelSel = lv;
                }
                this.refresh();
            });
            lvButtons.push({ btn, lbl });
        }

        this.listContainer.add([bg, nameText, stateText, rewardText]);
        for (const lb of lvButtons) {
            this.listContainer.add([lb.btn, lb.lbl]);
        }

        return { bg, nameText, stateText, rewardText, lvButtons, bossIndex: i, origY: y };
    }

    ensureCursorVisible() {
        const row = this.rows[this.bossIndex];
        if (!row) return;
        const halfH = this.rowH / 2;
        const cursorTop = row.origY - halfH - this.scrollOffset;
        const cursorBottom = row.origY + halfH - this.scrollOffset;
        if (cursorTop < this.scrollAreaTop) {
            this.scrollOffset = row.origY - halfH - this.scrollAreaTop;
        } else if (cursorBottom > this.scrollAreaBottom) {
            this.scrollOffset = row.origY + halfH - this.scrollAreaBottom;
        }
        const listTotalH = Stages.length * (this.rowH + this.rowGap) - this.rowGap;
        const scrollAreaH = this.scrollAreaBottom - this.scrollAreaTop;
        const maxOffset = Math.max(0, listTotalH - scrollAreaH);
        if (this.scrollOffset < 0) this.scrollOffset = 0;
        if (this.scrollOffset > maxOffset) this.scrollOffset = maxOffset;
    }

    update() {
        const JD = Phaser.Input.Keyboard.JustDown;
        if (JD(this.keyMenu)) {
            this.scene.start('BootScene');
            return;
        }
        if (JD(this.keyUp1) || JD(this.keyUp2)) {
            this.moveBoss(-1);
        } else if (JD(this.keyDown1) || JD(this.keyDown2)) {
            this.moveBoss(1);
        } else if (JD(this.keyLeft1) || JD(this.keyLeft2)) {
            this.moveLevel(-1);
        } else if (JD(this.keyRight1) || JD(this.keyRight2)) {
            this.moveLevel(1);
        } else if (JD(this.keyConfirm1) || JD(this.keyConfirm2)) {
            this.confirm();
        }
    }

    moveBoss(dir) {
        this.bossIndex = (this.bossIndex + dir + Stages.length) % Stages.length;
        const maxLv = this.maxSelectableLevel(this.bossIndex);
        if (this.levelSel > maxLv) this.levelSel = maxLv;
        if (this.levelSel < 1) this.levelSel = 1;
        this.ensureCursorVisible();
        this.refresh();
    }

    moveLevel(dir) {
        const maxLv = this.maxSelectableLevel(this.bossIndex);
        let next = this.levelSel + dir;
        if (next < 1) next = 1;
        if (next > maxLv) next = maxLv;
        this.levelSel = next;
        this.refresh();
    }

    confirm() {
        const maxLv = this.maxSelectableLevel(this.bossIndex);
        if (this.levelSel > maxLv) return;
        this.registry.set('selectedStage', this.bossIndex);
        this.registry.set('selectedLevel', this.levelSel);
        this.scene.start('LoadoutScene');
    }

    refresh() {
        this.listContainer.y = -this.scrollOffset;
        this.rows.forEach((r) => {
            const y = r.origY - this.scrollOffset;
            const halfH = this.rowH / 2;
            const fullyOut = (y + halfH < this.scrollAreaTop) || (y - halfH > this.scrollAreaBottom);
            const visible = !fullyOut;
            r.bg.setVisible(visible);
            r.nameText.setVisible(visible);
            r.stateText.setVisible(visible);
            r.rewardText.setVisible(visible);
            r.lvButtons.forEach((b) => {
                b.btn.setVisible(visible);
                b.lbl.setVisible(visible);
            });
        });

        const currBoss = Stages[this.bossIndex];
        if (this.levelSel <= 1) {
            this.detailTitle.setText(`${currBoss.name} Lv1 — 첫 도전 (기본)`);
            this.detailBody.setText('');
        } else {
            this.detailTitle.setText(`${currBoss.name} Lv${this.levelSel} — Lv${this.levelSel - 1} 대비`);
            const labels = this.getLabelsForLevel(currBoss, this.levelSel);
            this.detailBody.setText(labels.map((l) => `· ${l}`).join('\n'));
        }

        this.rows.forEach((r, i) => {
            const isCurrentBoss = i === this.bossIndex;
            r.bg.setFillStyle(isCurrentBoss ? 0x2a3a4a : 0x223322);
            r.bg.setStrokeStyle(isCurrentBoss ? 3 : 1, isCurrentBoss ? 0xffee00 : 0x555566);

            const cleared = this.bossProgress[Stages[i].id] ?? 0;
            r.stateText.setText(cleared === 0 ? '미클리어' : `최고 Lv${cleared} 클리어`);
            r.stateText.setColor(cleared === 0 ? '#aaaacc' : '#88ccff');

            const maxLv = this.maxSelectableLevel(i);
            r.lvButtons.forEach((b, idx) => {
                const lv = idx + 1;
                const unlocked = lv <= maxLv;
                const isSel = isCurrentBoss && lv === this.levelSel;
                if (!unlocked) {
                    b.btn.setFillStyle(0x1a1a1a);
                    b.btn.setStrokeStyle(1, 0x333344);
                    b.lbl.setColor('#444455');
                } else if (isSel) {
                    b.btn.setFillStyle(0x448844);
                    b.btn.setStrokeStyle(2, 0xffee00);
                    b.lbl.setColor('#ffffff');
                } else {
                    b.btn.setFillStyle(0x334455);
                    b.btn.setStrokeStyle(1, 0x556677);
                    b.lbl.setColor('#ccccdd');
                }
            });
        });
    }
}
