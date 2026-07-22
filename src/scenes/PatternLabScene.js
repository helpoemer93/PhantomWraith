const LAB_PLAY_W = 480;
const LAB_TOTAL_W = 640;
const LAB_H = 800;
const LAB_SIDEBAR_X = LAB_PLAY_W;
const LAB_SIDEBAR_W = LAB_TOTAL_W - LAB_PLAY_W;
const LAB_SIDEBAR_DEPTH = 1000;

class PatternLabScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PatternLabScene' });
    }

    init(data) {
        this.bossIndex = data?.bossIndex ?? 0;
        if (this.bossIndex < 0 || this.bossIndex >= Stages.length) this.bossIndex = 0;
        this.bossLevel = Math.max(1, Math.min(data?.bossLevel ?? 1, MAX_WEAPON_LEVEL));
        this.baseBossData = Stages[this.bossIndex];
        this.scale.resize(LAB_TOTAL_W, LAB_H);
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');

        this.physics.world.setBounds(0, 0, LAB_PLAY_W, LAB_H);

        this.add.rectangle(LAB_SIDEBAR_X, 0, LAB_SIDEBAR_W, LAB_H, 0x2a2a3a)
            .setOrigin(0, 0).setDepth(LAB_SIDEBAR_DEPTH);
        this.add.rectangle(LAB_PLAY_W - 1, 0, 2, LAB_H, 0x555577)
            .setOrigin(0, 0).setDepth(LAB_SIDEBAR_DEPTH);

        this.playerBullets = this.physics.add.group();
        this.bossBullets = this.physics.add.group();
        this.snowflakesGroup = this.physics.add.group();
        this.orbitOrbs = this.physics.add.group();
        this.turretsGroup = this.physics.add.group();
        this.turretSpawnerSpec = null;
        this.turretSpawnLastTime = 0;
        this.suicideDronesGroup = this.physics.add.group();
        this.suicideDroneSpawnerSpec = null;
        this.suicideDroneSpawnLastTime = null;
        this.harvesterDronesGroup = this.physics.add.group();
        this.harvesterDroneSpawnerSpec = null;
        this.turretConnectionsSpec = null;
        this.turretConnectionsGraphics = null;
        this.turretMotionSpec = null;
        // 스이쿤 페이즈 1 라이코 관련 상태
        this.raikou = null;
        this.raikouSpec = null;
        this.leashSpec = null;
        this.waveMissileSpec = null;
        this.lightningMissileSpec = null;
        this.raikouOverlayGraphics = null;
        this.leashGraphics = null;
        this.raikouAfterimages = [];
        this.raikouSpawnPending = false;
        this.roaringWaves = null;
        this.convergingWaves = null;
        this.entei = null;
        // 스이쿤 페이즈 3 상태 (씬 재시작 시 이전 게임 상태가 남는 버그 방지).
        this.suicunePhase3State = null;
        this.suicunePhase3Spec = null;
        this.suicuneOverlayGraphics = null;
        this.clouds = [];
        this.cloudSpec = null;
        this.birdEmitterSpec = null;
        this.birdEmitters = [];
        this.birdActivateLastTime = 0;
        this.birdCenterFireTime = null;

        this.boss = new Boss(this, this.baseBossData, this.bossLevel, { autoStart: false });
        this.bossData = this.boss.data;

        this.mode = 'manual';
        this.activePhaseIndex = -1;
        this.currentInterlude = null;
        this.interludeStartTime = 0;
        this.interludeFrozen = false;
        this.hitCount = 0;
        this.player1 = null;
        this.player2 = null;
        this.overlap1 = null;
        this.overlap2 = null;
        this.snowflakeOverlap1 = null;
        this.snowflakeOverlap2 = null;

        const KC = Phaser.Input.Keyboard.KeyCodes;
        this.keys1 = this.input.keyboard.addKeys({
            up: KC.W, down: KC.S, left: KC.A, right: KC.D,
        });
        this.keys2 = this.input.keyboard.addKeys({
            up: KC.I, down: KC.K, left: KC.J, right: KC.L,
        });
        this.swapKey = this.input.keyboard.addKey(KC.SPACE);
        this.escKey = this.input.keyboard.addKey(KC.ESC);

        this.uiMode = this.add.text(LAB_SIDEBAR_X + 8, 8, '', {
            fontSize: '12px', color: '#88ddff',
        }).setDepth(LAB_SIDEBAR_DEPTH);
        this.uiHits = this.add.text(LAB_SIDEBAR_X + 8, 26, '', {
            fontSize: '12px', color: '#ff8888',
        }).setDepth(LAB_SIDEBAR_DEPTH);
        this.add.text(LAB_SIDEBAR_X + 8, LAB_H - 16, 'ESC: 메뉴로', {
            fontSize: '10px', color: '#777788',
        }).setDepth(LAB_SIDEBAR_DEPTH);

        this.patternButtons = [];
        this.buildSidebar();
        this.updateModeUI();
        this.setButtonsForMode();
    }

    collectManualEntries() {
        const entries = [];
        this.bossData.phases.forEach((phase, idx) => {
            entries.push({ label: `phase_${idx + 1}`, kind: 'phase', phaseIdx: idx });
        });
        (this.bossData.interludes ?? []).forEach((inter) => {
            entries.push({ label: inter.name, kind: 'interlude', inter });
        });
        return entries;
    }

    buildSidebar() {
        let y = 50;
        this.add.text(LAB_SIDEBAR_X + 8, y, '보스 선택', {
            fontSize: '11px', color: '#ffee88',
        }).setDepth(LAB_SIDEBAR_DEPTH);
        y += 16;
        for (let i = 0; i < Stages.length; i += 1) {
            const boss = Stages[i];
            const isCurrent = i === this.bossIndex;
            const label = (isCurrent ? '● ' : '○ ') + boss.name;
            this.makeButton(
                LAB_SIDEBAR_X + 8, y,
                LAB_SIDEBAR_W - 16, 22,
                label,
                () => this.selectBoss(i),
                isCurrent ? '#ffee88' : '#cccccc',
            );
            y += 24;
        }
        y += 6;

        this.add.text(LAB_SIDEBAR_X + 8, y, '레벨', {
            fontSize: '11px', color: '#ffee88',
        }).setDepth(LAB_SIDEBAR_DEPTH);
        y += 16;
        const btnSize = 22;
        const gap = 3;
        const rowStartX = LAB_SIDEBAR_X + 8;
        for (let lv = 1; lv <= MAX_WEAPON_LEVEL; lv += 1) {
            const bx = rowStartX + (lv - 1) * (btnSize + gap);
            const isCurrent = lv === this.bossLevel;
            const bg = this.add.rectangle(bx, y, btnSize, btnSize,
                isCurrent ? 0x448844 : 0x333344)
                .setOrigin(0, 0)
                .setStrokeStyle(1, isCurrent ? 0xffee00 : 0x666688)
                .setDepth(LAB_SIDEBAR_DEPTH);
            const lbl = this.add.text(bx + btnSize / 2, y + btnSize / 2, `${lv}`, {
                fontSize: '11px', color: isCurrent ? '#ffffff' : '#cccccc',
            }).setOrigin(0.5).setDepth(LAB_SIDEBAR_DEPTH);
            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerdown', () => this.selectLevel(lv));
            bg.on('pointerover', () => { if (!isCurrent) bg.setFillStyle(0x445566); });
            bg.on('pointerout', () => { if (!isCurrent) bg.setFillStyle(0x333344); });
        }
        y += btnSize + 4;

        const boss = this.baseBossData;
        const labels = boss.getLevelUpLabels
            ? boss.getLevelUpLabels(this.bossLevel)
            : (this.bossLevel > 1 ? ['HP +25%'] : []);
        const deltaText = this.bossLevel === 1
            ? '(baseline)'
            : labels.map((l) => `· ${l}`).join('\n');
        this.add.text(LAB_SIDEBAR_X + 8, y, deltaText, {
            fontSize: '10px', color: '#8899aa', lineSpacing: 3,
            wordWrap: { width: LAB_SIDEBAR_W - 16 },
        }).setDepth(LAB_SIDEBAR_DEPTH);
        y += (labels.length + 1) * 14 + 8;

        this.add.text(LAB_SIDEBAR_X + 8, y, '개별 발사 (관찰용)', {
            fontSize: '11px', color: '#ffee88',
        }).setDepth(LAB_SIDEBAR_DEPTH);
        y += 18;

        const entries = this.collectManualEntries();
        for (const entry of entries) {
            const btn = this.makeButton(
                LAB_SIDEBAR_X + 8, y,
                LAB_SIDEBAR_W - 16, 22,
                entry.label, () => this.firePatternManual(entry),
            );
            btn.role = 'pattern';
            this.patternButtons.push(btn);
            y += 26;
        }

        y += 8;
        this.add.text(LAB_SIDEBAR_X + 8, y, '실험 패턴', {
            fontSize: '11px', color: '#ff88cc',
        }).setDepth(LAB_SIDEBAR_DEPTH);
        y += 18;
        this.makeButton(
            LAB_SIDEBAR_X + 8, y,
            LAB_SIDEBAR_W - 16, 22,
            '🌪 조준 나선 (가속)',
            () => this.fireSeekingMissile(),
            '#ffaacc',
        );
        y += 26;
        this.makeButton(
            LAB_SIDEBAR_X + 8, y,
            LAB_SIDEBAR_W - 16, 22,
            '🌀 역가속+각가속 5발',
            () => this.fireDecelSpiralBurst(),
            '#ffcc88',
        );

        let by = LAB_H - 170;
        this.add.text(LAB_SIDEBAR_X + 8, by, '자동 실행 (실전)', {
            fontSize: '11px', color: '#ffee88',
        }).setDepth(LAB_SIDEBAR_DEPTH);
        by += 20;

        for (let pIdx = 0; pIdx < this.bossData.phases.length; pIdx += 1) {
            this.makeButton(
                LAB_SIDEBAR_X + 8, by,
                LAB_SIDEBAR_W - 16, 24,
                `▶ 페이즈 ${pIdx + 1}`,
                () => this.startPhaseAuto(pIdx),
                '#88ff88',
            );
            by += 28;
        }
        for (const inter of (this.bossData.interludes ?? [])) {
            this.makeButton(
                LAB_SIDEBAR_X + 8, by,
                LAB_SIDEBAR_W - 16, 24,
                `▶ ${inter.name}`,
                () => this.startInterludeAuto(inter),
                '#aaffdd',
            );
            by += 28;
        }
        this.makeButton(
            LAB_SIDEBAR_X + 8, by,
            LAB_SIDEBAR_W - 16, 24,
            '■ 정지',
            () => this.stopAll(),
            '#ff8888',
        );
    }

    selectBoss(idx) {
        if (idx === this.bossIndex) return;
        this.scene.restart({ bossIndex: idx, bossLevel: 1 });
    }

    selectLevel(lv) {
        if (lv === this.bossLevel) return;
        this.scene.restart({ bossIndex: this.bossIndex, bossLevel: lv });
    }

    makeButton(x, y, w, h, label, onClick, textColor) {
        const bg = this.add.rectangle(x, y, w, h, 0x333344).setOrigin(0, 0);
        bg.setStrokeStyle(1, 0x666688);
        bg.setInteractive({ useHandCursor: true });
        bg.setDepth(LAB_SIDEBAR_DEPTH);
        const text = this.add.text(x + 6, y + Math.floor((h - 12) / 2), label, {
            fontSize: '11px', color: textColor ?? '#cccccc',
        }).setDepth(LAB_SIDEBAR_DEPTH);
        const btn = { bg, text, role: null, disabled: false, baseColor: textColor ?? '#cccccc' };
        bg.on('pointerdown', () => {
            if (btn.disabled) return;
            onClick();
        });
        bg.on('pointerover', () => {
            if (!btn.disabled) bg.setFillStyle(0x444455);
        });
        bg.on('pointerout', () => {
            if (!btn.disabled) bg.setFillStyle(0x333344);
        });
        return btn;
    }

    resetForManual() {
        this.boss.activePatterns = [];
        this.boss.phaseIndex = -1;
        this.boss.sideDirection = 1;
        this.currentInterlude = null;
        this.interludeFrozen = false;
        this.bossBullets.children.each((b) => b && b.destroy());
        this.snowflakesGroup.children.each((s) => s && s.destroy());
        this.turretsGroup.children.each((t) => t && t.destroy());
        this.suicideDronesGroup.children.each((d) => d && d.destroy());
        this.harvesterDronesGroup.children.each((d) => d && d.destroy());
        this.turretSpawnerSpec = null;
        this.suicideDroneSpawnerSpec = null;
        this.harvesterDroneSpawnerSpec = null;
        this.turretConnectionsSpec = null;
        this.turretMotionSpec = null;
        if (this.turretConnectionsGraphics) this.turretConnectionsGraphics.clear();
        this.despawnClouds();
        this.despawnBirdEmitters();
    }

    firePatternManual(entry) {
        if (this.mode !== 'manual') return;
        const prevSide = this.boss.sideDirection;
        this.resetForManual();
        if (entry.kind === 'phase') {
            const phase = this.bossData.phases[entry.phaseIdx];
            if (phase.sequence && phase.sequence.onLoop === 'toggleSideDirection') {
                this.boss.sideDirection = prevSide;
            }
            if (phase.clouds) this.spawnClouds(phase.clouds);
            if (phase.birdEmitters) this.spawnBirdEmitters(phase.birdEmitters);
            if (phase.sequence) {
                const seqSpec = { ...phase.sequence, loop: false };
                this.boss.activePatterns.push(new Sequence(this, this.boss, seqSpec));
            } else if (phase.patterns) {
                for (const s of phase.patterns) {
                    this.boss.activePatterns.push(new BulletPattern(this, this.boss, s));
                }
            }
            // endpointDecelSpiral 은 boss.phaseIndex 기반이라 세팅해줘야 발동
            if (phase.endpointDecelSpiral) {
                this.boss.phaseIndex = entry.phaseIdx;
            }
        } else if (entry.kind === 'interlude') {
            this.setupInterludeCycle(entry.inter);
        }
        if (entry.kind === 'phase') {
            const phase = this.bossData.phases[entry.phaseIdx];
            if (phase.turretSpawner) {
                for (let i = 0; i < 3; i += 1) this.spawnTurretRandom(phase.turretSpawner);
            }
            if (phase.suicideDroneSpawner) {
                this.spawnSuicideDrone(phase.suicideDroneSpawner.drone);
            }
            if (phase.harvesterDroneSpawner) {
                this.startHarvesterDroneSpawner(phase.harvesterDroneSpawner);
            }
            if (phase.turretMotion) {
                this.turretMotionSpec = phase.turretMotion;
            }
            if (phase.turretConnections) {
                this.startTurretConnections(phase.turretConnections);
                if (phase.turretSpawner) {
                    for (let i = 0; i < 3; i += 1) this.spawnTurretRandom(phase.turretSpawner);
                } else {
                    const prevTurret = this.bossData.phases[0]?.turretSpawner;
                    if (prevTurret) {
                        for (let i = 0; i < 4; i += 1) this.spawnTurretRandom(prevTurret);
                    }
                }
                if (phase.turretMotion) {
                    this.turretsGroup.children.each((t) => {
                        if (t && t.active && !t.invincible) this.initTurretOrbit(t);
                    });
                }
            }
            if (phase.invincibleTurret) {
                this.spawnInvincibleTurret(phase.invincibleTurret);
            }
            if (phase.baseAttack) {
                const prevPhaseIdx = this.boss.phaseIndex;
                this.boss.phaseIndex = entry.phaseIdx;
                this.boss.fireBaseAttack(this.time.now);
                this.boss.phaseIndex = prevPhaseIdx;
            }
        }
    }

    startPhaseAuto(idx) {
        this.stopAll();
        this.mode = 'phase';
        this.activePhaseIndex = idx;
        this.hitCount = 0;
        this.boss.enterPhase(idx);
        this.spawnPlayers();
        this.updateModeUI();
        this.setButtonsForMode();
    }

    startInterludeAuto(inter) {
        this.stopAll();
        this.mode = 'interlude';
        this.hitCount = 0;
        this.spawnPlayers();
        this.setupInterludeCycle(inter);
        this.updateModeUI();
        this.setButtonsForMode();
    }

    setupInterludeCycle(inter) {
        if (inter.spec.type === 'birdEmitter') {
            this.spawnBirdEmitters(inter.spec);
            this.currentInterlude = null;
            this.interludeFrozen = false;
            return;
        }
        if (inter.spec.type === 'electricField') {
            this.spawnElectricField(inter.spec.field);
            const turretRef = this.turretSpawnerSpec || this.bossData.phases[0]?.turretSpawner;
            const count = inter.spec.turretsToSpawn ?? 3;
            if (turretRef) {
                for (let i = 0; i < count; i += 1) this.spawnTurretRandom(turretRef);
            }
            this.currentInterlude = inter;
            this.interludeStartTime = this.time.now;
            this.interludeFrozen = false;
            return;
        }
        if (inter.spec.type === 'sparkLink') {
            this.spawnElectricField(inter.spec.field);
            const turretRef = this.turretSpawnerSpec || this.bossData.phases[0]?.turretSpawner;
            const count = inter.spec.turretsToSpawn ?? 3;
            if (turretRef) {
                for (let i = 0; i < count; i += 1) this.spawnTurretRandom(turretRef);
            }
            this.currentInterlude = inter;
            this.interludeStartTime = this.time.now;
            this.interludeFrozen = false;
            if (!this.turretConnectionsGraphics) {
                this.turretConnectionsGraphics = this.add.graphics();
            }
            return;
        }
        if (inter.spec.type === 'roaringWaves') {
            this.startRoaringWavesInterlude(inter.spec);
            this.currentInterlude = inter;
            this.interludeStartTime = this.time.now;
            this.interludeFrozen = false;
            return;
        }
        if (inter.spec.type === 'convergingWaves') {
            this.startConvergingWavesInterlude(inter.spec);
            this.currentInterlude = inter;
            this.interludeStartTime = this.time.now;
            this.interludeFrozen = false;
            return;
        }
        this.currentInterlude = inter;
        this.interludeStartTime = this.time.now;
        this.interludeFrozen = false;
        this.boss.activePatterns.push(new BulletPattern(this, this.boss, inter.spec));
    }

    stopAll() {
        this.mode = 'manual';
        this.activePhaseIndex = -1;
        this.currentInterlude = null;
        this.interludeFrozen = false;
        this.boss.activePatterns = [];
        this.boss.phaseIndex = -1;
        this.boss.sideDirection = 1;
        this.bossBullets.children.each((b) => b && b.destroy());
        this.snowflakesGroup.children.each((s) => s && s.destroy());
        this.turretsGroup.children.each((t) => t && t.destroy());
        this.suicideDronesGroup.children.each((d) => d && d.destroy());
        this.harvesterDronesGroup.children.each((d) => d && d.destroy());
        this.turretSpawnerSpec = null;
        this.suicideDroneSpawnerSpec = null;
        this.harvesterDroneSpawnerSpec = null;
        this.turretConnectionsSpec = null;
        this.turretMotionSpec = null;
        if (this.turretConnectionsGraphics) this.turretConnectionsGraphics.clear();
        // 스이쿤 라이코·엔테이·파도·페이즈3 상태 정리
        this.destroyRaikou();
        this.destroyEntei();
        this.destroySuicunePhase3();
        this.roaringWaves = null;
        // 스이쿤 몸통을 시작 위치로 복귀 (돌진 후 위치 유지되지 않도록)
        if (this.boss && this.boss.sprite) {
            this.boss.sprite.x = LAB_PLAY_W / 2;
            this.boss.sprite.y = this.boss.data.startY ?? 140;
        }
        this.despawnClouds();
        this.despawnBirdEmitters();
        this.despawnPlayers();
        this.updateModeUI();
        this.setButtonsForMode();
    }

    spawnPlayers() {
        this.despawnPlayers();
        const bottomY = LAB_H - 100;
        this.player1 = new Player(
            this,
            LAB_PLAY_W * 0.35, bottomY,
            this.keys1, GameConfig.PLAYER_1_COLOR, false,
            [null, null, null, null], {},
        );
        this.player2 = new Player(
            this,
            LAB_PLAY_W * 0.65, bottomY,
            this.keys2, GameConfig.PLAYER_2_COLOR, true,
            [null, null, null, null], {},
        );
        this.player1.canFire = false;
        this.player2.canFire = false;

        this.overlap1 = this.physics.add.overlap(
            this.player1.sprite, this.bossBullets,
            (s, b) => this.onLabHit(this.player1, b),
        );
        this.overlap2 = this.physics.add.overlap(
            this.player2.sprite, this.bossBullets,
            (s, b) => this.onLabHit(this.player2, b),
        );
        this.snowflakeOverlap1 = this.physics.add.overlap(
            this.player1.sprite, this.snowflakesGroup,
            (s, b) => this.onLabHit(this.player1, b),
        );
        this.snowflakeOverlap2 = this.physics.add.overlap(
            this.player2.sprite, this.snowflakesGroup,
            (s, b) => this.onLabHit(this.player2, b),
        );
        this.droneOverlap1 = this.physics.add.overlap(
            this.player1.sprite, this.suicideDronesGroup,
            (s, d) => this.onDroneLabHit(this.player1, d),
        );
        this.droneOverlap2 = this.physics.add.overlap(
            this.player2.sprite, this.suicideDronesGroup,
            (s, d) => this.onDroneLabHit(this.player2, d),
        );
        this.harvesterOverlap1 = this.physics.add.overlap(
            this.player1.sprite, this.harvesterDronesGroup,
            (s, d) => this.onHarvesterLabHit(this.player1, d),
        );
        this.harvesterOverlap2 = this.physics.add.overlap(
            this.player2.sprite, this.harvesterDronesGroup,
            (s, d) => this.onHarvesterLabHit(this.player2, d),
        );
        this.harvesterGearOverlap = this.physics.add.overlap(
            this.harvesterDronesGroup, this.bossBullets,
            (d, b) => this.onHarvesterTouchBossBullet(d, b),
        );
    }

    despawnPlayers() {
        for (const ov of [this.overlap1, this.overlap2, this.snowflakeOverlap1, this.snowflakeOverlap2, this.droneOverlap1, this.droneOverlap2, this.harvesterOverlap1, this.harvesterOverlap2, this.harvesterGearOverlap]) {
            if (ov) ov.destroy();
        }
        this.overlap1 = null;
        this.overlap2 = null;
        this.snowflakeOverlap1 = null;
        this.snowflakeOverlap2 = null;
        this.droneOverlap1 = null;
        this.droneOverlap2 = null;
        this.harvesterOverlap1 = null;
        this.harvesterOverlap2 = null;
        this.harvesterGearOverlap = null;
        for (const p of [this.player1, this.player2]) {
            if (!p) continue;
            p.sprite.destroy();
            p.outline.destroy();
            for (const o of p.orbitOrbs) o.destroy();
        }
        this.player1 = null;
        this.player2 = null;
    }

    onLabHit(player, bullet) {
        const time = this.time.now;
        if (!player.canBeHit(time)) return;
        player.onHit(time);
        if (!bullet.isBlade && !bullet.isOrbCarrier && !bullet.isGear && !bullet.isElectricField) {
            bullet.destroy();
        }
        this.hitCount += 1;
        this.updateModeUI();
    }

    doSwap() {
        if (!this.player1 || !this.player2) return;
        const p1Was = this.player1.isInvincible;
        this.player1.setInvincible(this.player2.isInvincible);
        this.player2.setInvincible(p1Was);
    }

    updateModeUI() {
        if (this.mode === 'manual') {
            this.uiMode.setText('모드: 수동');
            this.uiMode.setColor('#88ddff');
            this.uiHits.setText('');
        } else if (this.mode === 'phase') {
            this.uiMode.setText(`모드: 페이즈 ${this.activePhaseIndex + 1}`);
            this.uiMode.setColor('#88ff88');
            this.uiHits.setText(`피격: ${this.hitCount}`);
        } else if (this.mode === 'interlude') {
            this.uiMode.setText('모드: 인터루드');
            this.uiMode.setColor('#aaffdd');
            this.uiHits.setText(`피격: ${this.hitCount}`);
        }
    }

    setButtonsForMode() {
        for (const btn of this.patternButtons) {
            const disabled = this.mode !== 'manual';
            btn.disabled = disabled;
            btn.bg.setFillStyle(disabled ? 0x222233 : 0x333344);
            btn.text.setColor(disabled ? '#555566' : btn.baseColor);
        }
    }

    update(time, delta) {
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.scale.resize(GameConfig.GAME_WIDTH, GameConfig.GAME_HEIGHT);
            this.scene.start('BootScene');
            return;
        }

        this.boss.update(time, delta);

        if (this.player1) this.player1.update(time);
        if (this.player2) this.player2.update(time);

        if ((this.mode === 'phase' || this.mode === 'interlude') && Phaser.Input.Keyboard.JustDown(this.swapKey)) {
            this.doSwap();
        }

        this.updateInterludeCycle(time);
        this.updateSnowflakes(delta);
        this.updateClouds(time, delta);
        this.updateBirdEmitters(time, delta);
        this.updateWavyBullets(time);
        this.updateBossBulletSideMotion();
        this.updateBladeMissiles(time);
        this.updateDeceleratingBullets(delta);
        this.updateOrbCarriers(time, delta);
        this.updateSeekingMissiles(delta);
        this.updateEndpointDecelSpiral();
        this.updateTurretSpawner(time);
        this.updateTurrets(time, delta);
        this.updateSuicideDroneSpawner(time);
        this.updateSuicideDrones(time, delta);
        this.updateHarvesterDrones(time, delta);
        this.updateTurretConnections(time);
        this.updateGears(delta);
        this.updateRaikou(time, delta);
        this.updateWaveMissiles(time);
        this.updateLightningMissiles(time);
        this.updateRoaringWaves(time);
        this.updateConvergingWaves(time);
        this.updateEntei(time, delta);
        this.updateSuicunePhase3(time, delta);

        this.bossBullets.children.each((b) => {
            if (!b) return;
            if (b.y > LAB_H + 300 || b.y < -300 ||
                b.x < -300 || b.x > LAB_PLAY_W + 300) {
                b.destroy();
            }
        });
        this.snowflakesGroup.children.each((s) => {
            if (!s) return;
            if (s.y > LAB_H + 300 || s.y < -300 ||
                s.x < -300 || s.x > LAB_PLAY_W + 300) {
                s.destroy();
            }
        });
    }

    updateInterludeCycle(time) {
        if (!this.currentInterlude) return;
        const spec = this.currentInterlude.spec;
        const elapsed = time - this.interludeStartTime;

        if (spec.durationMs !== undefined) {
            if (elapsed >= spec.durationMs) {
                if (this.mode === 'interlude') {
                    this.setupInterludeCycle(this.currentInterlude);
                } else {
                    this.currentInterlude = null;
                    this.interludeFrozen = false;
                }
            }
            return;
        }

        if (!this.interludeFrozen && elapsed >= (spec.freezeAtMs ?? 3000)) {
            this.freezeAllSnowflakes(spec);
            this.interludeFrozen = true;
        }

        if (this.interludeFrozen && this.snowflakesGroup.countActive(true) === 0 &&
            (!this.boss.activePatterns || this.boss.activePatterns.length === 0)) {
            if (this.mode === 'interlude') {
                this.setupInterludeCycle(this.currentInterlude);
            } else {
                this.currentInterlude = null;
                this.interludeFrozen = false;
            }
        }
    }

    freezeAllSnowflakes(spec) {
        const bossX = this.boss.sprite.x;
        const bossY = this.boss.sprite.y;
        const initSpeed = spec.reverseInitSpeed ?? 300;
        const minSpeed = spec.reverseMinSpeed ?? 60;
        const halfLifeMs = spec.reverseHalfLifeMs ?? 1000;
        this.snowflakesGroup.children.each((s) => {
            if (!s || !s.body) return;
            s.frozen = true;
            const dx = s.x - bossX;
            const dy = s.y - bossY;
            const dist = Math.hypot(dx, dy);
            let ux;
            let uy;
            if (dist < 0.01) {
                const rad = Math.random() * Math.PI * 2;
                ux = Math.cos(rad);
                uy = Math.sin(rad);
            } else {
                ux = dx / dist;
                uy = dy / dist;
            }
            s.body.setVelocity(ux * initSpeed, uy * initSpeed);
            s.currentSpeed = initSpeed;
            s.reverseMinSpeed = minSpeed;
            s.reverseHalfLifeMs = halfLifeMs;
        });
    }

    updateSnowflakes(delta) {
        const dt = delta / 1000;
        this.snowflakesGroup.children.each((s) => {
            if (!s || !s.body) return;

            if (s.frozen) {
                const halfLifeSec = (s.reverseHalfLifeMs ?? 1000) / 1000;
                const factor = Math.pow(0.5, dt / halfLifeSec);
                let newSpeed = s.currentSpeed * factor;
                if (newSpeed < s.reverseMinSpeed) newSpeed = s.reverseMinSpeed;
                const vx = s.body.velocity.x;
                const vy = s.body.velocity.y;
                const curr = Math.hypot(vx, vy);
                if (curr > 0.01) {
                    s.body.setVelocity((vx / curr) * newSpeed, (vy / curr) * newSpeed);
                }
                s.currentSpeed = newSpeed;
                return;
            }

            const vx = s.body.velocity.x;
            const vy = s.body.velocity.y;
            const step = Math.hypot(vx, vy) * dt;
            s.traveledDist += step;
            if (s.traveledDist >= s.burstDistance && s.generation < s.maxGeneration) {
                this.burstSnowflake(s);
            }
        });
    }

    burstSnowflake(s) {
        const parentAngleDeg = s.angleDeg;
        const childCount = s.childrenPerBurst;
        const offset = s.childAngleOffsetDeg;
        for (let i = 0; i < childCount; i += 1) {
            const sign = (i % 2 === 0) ? -1 : 1;
            const angleDeg = parentAngleDeg + sign * offset;
            const rad = Phaser.Math.DegToRad(angleDeg);
            const vx = Math.cos(rad) * s.speed;
            const vy = Math.sin(rad) * s.speed;
            this.spawnSnowflakeChild(s.x, s.y, vx, vy, angleDeg, s);
        }
        s.destroy();
    }

    getActivePlayerPos() {
        const candidates = [this.player1, this.player2].filter((p) => p);
        const active = candidates.find((p) => !p.isInvincible);
        if (active) return { x: active.sprite.x, y: active.sprite.y };
        return { x: 240, y: 500 };
    }

    spawnColoredCircleBullet(x, y, vx, vy, radius, color) {
        const b = this.add.circle(x, y, radius, color);
        this.physics.add.existing(b);
        this.bossBullets.add(b);
        b.body.setCircle(radius);
        b.body.setVelocity(vx, vy);
        return b;
    }

    spawnOrbCarrier(originX, originY, angleDeg, spec) {
        const target = this.getActivePlayerPos();
        const dx = target.x - originX;
        const dy = target.y - originY;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) return null;
        const A = spec.core.speedMultiplier ?? 1.2;
        const coreSpeed = A * dist;
        const lifespanMs = (1 / A) * 1000;
        const ux = dx / dist;
        const uy = dy / dist;
        const vx = ux * coreSpeed;
        const vy = uy * coreSpeed;

        const coreRadius = spec.core.radius ?? 15;
        const coreColor = spec.core.color ?? 0xcc66cc;
        const core = this.add.circle(originX, originY, coreRadius, coreColor);
        this.physics.add.existing(core);
        this.bossBullets.add(core);
        core.body.setCircle(coreRadius);
        core.body.setVelocity(vx, vy);
        core.isOrbCarrier = true;
        core.spawnAt = this.time.now;
        core.lifespanMs = lifespanMs;
        core.forwardVx = vx;
        core.forwardVy = vy;
        core.spinForwardSpeed = spec.orbit.spinForwardSpeed ?? 80;
        core.spinSideSpeed = spec.orbit.spinSideSpeed ?? 100;
        core.orbits = [];

        const orbCount = spec.orbit.count ?? 20;
        const orbRadius = spec.orbit.radius ?? 4;
        const orbColor = spec.orbit.color ?? 0xcc66cc;
        const orbitRad = spec.orbit.orbitRadius ?? 30;
        core.orbitRadius = orbitRad;
        const orbitSpd = spec.orbit.orbitSpeedRadPerSec ?? 3;
        for (let i = 0; i < orbCount; i += 1) {
            const angle0 = (i / orbCount) * Math.PI * 2;
            const ox = originX + Math.cos(angle0) * orbitRad;
            const oy = originY + Math.sin(angle0) * orbitRad;
            const orb = this.add.circle(ox, oy, orbRadius, orbColor);
            this.physics.add.existing(orb);
            this.bossBullets.add(orb);
            orb.body.setCircle(orbRadius);
            orb.isOrbit = true;
            orb.orbitOwner = core;
            orb.orbitAngle = angle0;
            orb.orbitRadius = orbitRad;
            orb.orbitSpeed = orbitSpd;
            core.orbits.push(orb);
        }
        return core;
    }

    updateOrbCarriers(time, delta) {
        const dt = delta / 1000;
        this.bossBullets.children.each((b) => {
            if (!b || !b.body) return;
            if (b.isOrbit && b.orbitOwner) {
                const owner = b.orbitOwner;
                if (!owner.active) {
                    b.isOrbit = false;
                    b.orbitOwner = null;
                    return;
                }
                b.orbitAngle += b.orbitSpeed * dt;
                const tangSpd = b.orbitSpeed * b.orbitRadius;
                const tangVx = -Math.sin(b.orbitAngle) * tangSpd;
                const tangVy = Math.cos(b.orbitAngle) * tangSpd;
                b.body.setVelocity(
                    owner.body.velocity.x + tangVx,
                    owner.body.velocity.y + tangVy,
                );
            }
        });
        this.bossBullets.children.each((b) => {
            if (!b || !b.body || !b.isOrbCarrier) return;
            if (time - b.spawnAt >= b.lifespanMs) {
                const cx = b.x;
                const cy = b.y;
                const fwdSpeed = b.spinForwardSpeed;
                const sideSpeed = b.spinSideSpeed;
                const gatherEndTime = time + ((b.orbitRadius - 5) / fwdSpeed) * 1000 + 50;
                for (const orb of b.orbits) {
                    if (!orb || !orb.active) continue;
                    orb.isOrbit = false;
                    orb.orbitOwner = null;

                    const dx = orb.x - cx;
                    const dy = orb.y - cy;
                    const d = Math.hypot(dx, dy);
                    let ux;
                    let uy;
                    if (d < 0.01) {
                        ux = 0; uy = 1;
                    } else {
                        ux = dx / d; uy = dy / d;
                    }

                    orb.gatherAngle = Math.atan2(dy, dx);
                    orb.isGathering = true;
                    orb.gatherTargetX = cx;
                    orb.gatherTargetY = cy;
                    orb.gatherStartTime = time;
                    orb.gatherEndTime = gatherEndTime;
                    orb.forwardSpeed = fwdSpeed;
                    orb.sideSpeed = sideSpeed;
                    orb.body.setVelocity(-ux * fwdSpeed, -uy * fwdSpeed);
                }
                b.destroy();
            }
        });
        this.bossBullets.children.each((b) => {
            if (!b || !b.body || !b.isGathering) return;
            if (time >= b.gatherEndTime) {
                const elapsedSec = (time - b.gatherStartTime) / 1000;
                let R0 = b.orbitRadius - b.forwardSpeed * elapsedSec;
                if (R0 < 1) R0 = 1;
                b.spreadStartRadius = R0;
                b.spreadStartTime = time;
                b.isGathering = false;
                b.isSpreading = true;
            }
        });
        this.bossBullets.children.each((b) => {
            if (!b || !b.body || !b.isSpreading) return;
            const elapsed = (time - b.spreadStartTime) / 1000;
            const R0 = b.spreadStartRadius;
            const vR = b.forwardSpeed;
            const vT = b.sideSpeed;
            const r = R0 + vR * elapsed;
            const theta = b.gatherAngle + (vT / vR) * Math.log(r / R0);
            const cosT = Math.cos(theta);
            const sinT = Math.sin(theta);
            const vx = vR * cosT - vT * sinT;
            const vy = vR * sinT + vT * cosT;
            b.body.setVelocity(vx, vy);
        });
    }

    spawnBladeMissile(x, y, vx, vy, angleDeg, spec) {
        const w = spec.bladeWidth ?? 10;
        const h = spec.bladeHeight ?? 30;
        const color = spec.bladeColor ?? 0x77bbee;
        // 양수 vertex 로 shift → sprite.x/y = visual center
        const tri = this.add.triangle(
            x, y,
            w / 2, 0,
            0, h,
            w, h,
            color,
        );
        this.physics.add.existing(tri);
        this.bossBullets.add(tri);
        tri.body.setSize(w, h);
        tri.body.setVelocity(vx, vy);
        const rad = Phaser.Math.DegToRad(angleDeg);
        tri.rotation = rad + Math.PI / 2;

        tri.isBlade = true;
        tri.bladeAngleDeg = angleDeg;
        tri.bladeHeight = h;
        tri.derive = spec.derive;
        tri.lastDeriveTime = this.time.now;
        return tri;
    }

    updateBladeMissiles(time) {
        this.bossBullets.children.each((b) => {
            if (!b || !b.isBlade || !b.derive) return;
            const cfg = b.derive;
            if (time - b.lastDeriveTime < (cfg.intervalMs ?? 100)) return;
            b.lastDeriveTime = time;
            // 뒷변 중앙 = b.x/b.y (수정된 vertex 로 이제 정확한 visual center) 에서 진행방향 반대쪽으로 h/2
            const forwardRad = Phaser.Math.DegToRad(b.bladeAngleDeg);
            const half = (b.bladeHeight ?? 30) / 2;
            const spawnX = b.x - Math.cos(forwardRad) * half;
            const spawnY = b.y - Math.sin(forwardRad) * half;
            const backAngle = b.bladeAngleDeg + 180;
            const offset = cfg.angleOffsetDeg ?? 30;
            const count = cfg.childrenPerBurst ?? 2;
            for (let i = 0; i < count; i += 1) {
                const sign = (i % 2 === 0) ? -1 : 1;
                const angleDeg = backAngle + sign * offset;
                const rad = Phaser.Math.DegToRad(angleDeg);
                const initSpeed = cfg.initSpeed ?? 200;
                const cvx = Math.cos(rad) * initSpeed;
                const cvy = Math.sin(rad) * initSpeed;
                // childAngularRate 는 크기, 좌우 sign 으로 방향 결정 (바깥으로 벌어짐)
                const angularRate = (cfg.childAngularRate ?? 0) * sign;
                this.spawnDeceleratingBullet(spawnX, spawnY, cvx, cvy, angleDeg, cfg, angularRate);
            }
        });
    }

    spawnDeceleratingBullet(x, y, vx, vy, angleDeg, cfg, angularRate) {
        const w = cfg.childWidth ?? 6;
        const h = cfg.childHeight ?? 18;
        const color = cfg.childColor ?? 0xbbeeff;
        // 양수 vertex 로 shift → sprite.x/y = visual center
        const tri = this.add.triangle(
            x, y,
            w / 2, 0,
            0, h,
            w, h,
            color,
        );
        this.physics.add.existing(tri);
        this.bossBullets.add(tri);
        tri.body.setSize(w, h);
        tri.body.setVelocity(vx, vy);
        const rad = Phaser.Math.DegToRad(angleDeg);
        tri.rotation = rad + Math.PI / 2;

        tri.decelerating = true;
        tri.headingRad = rad;
        tri.angularRate = angularRate ?? 0;
        tri.rotationAccumulated = 0;
        tri.angularMaxRotation = cfg.childAngularMaxRotationRad ?? Math.PI / 6;
        tri.currentSpeed = cfg.initSpeed ?? 200;
        tri.decelPerSec = cfg.decelPerSec ?? 400;
        tri.maxReverseSpeed = cfg.maxReverseSpeed ?? 200;
        return tri;
    }

    updateDeceleratingBullets(delta) {
        const dt = delta / 1000;
        this.bossBullets.children.each((b) => {
            if (!b || !b.body || !b.decelerating) return;
            b.currentSpeed -= b.decelPerSec * dt;
            if (b.currentSpeed < -b.maxReverseSpeed) b.currentSpeed = -b.maxReverseSpeed;
            if (b.angularRate) {
                const dHeading = b.angularRate * dt;
                b.headingRad += dHeading;
                b.rotationAccumulated += dHeading;
                if (Math.abs(b.rotationAccumulated) >= b.angularMaxRotation) {
                    b.angularRate = 0;
                }
            }
            const dirX = Math.cos(b.headingRad);
            const dirY = Math.sin(b.headingRad);
            b.body.setVelocity(dirX * b.currentSpeed, dirY * b.currentSpeed);
            const vx = b.body.velocity.x;
            const vy = b.body.velocity.y;
            b.rotation = Math.atan2(vy, vx) + Math.PI / 2;
        });
    }

    updateWavyBullets(time) {
        this.bossBullets.children.each((b) => {
            if (!b || !b.body || !b.hasWavyMotion) return;
            const elapsed = (time - b.wavyStartTime) / 1000;
            const twopi = 2 * Math.PI * b.wavyFreq;
            const wobble = b.wavyAmp * twopi * Math.cos(twopi * elapsed + b.wavyPhase);
            b.body.velocity.x = b.wavyVx + wobble;
            b.body.velocity.y = b.wavyVy;
        });
    }

    updateBossBulletSideMotion() {
        this.bossBullets.children.each((b) => {
            if (!b || !b.body || !b.hasSideMotion) return;
            let bx;
            let by;
            if (b.customCenterX !== undefined) {
                bx = b.customCenterX;
                by = b.customCenterY;
            } else {
                if (!this.boss || !this.boss.sprite) return;
                bx = this.boss.sprite.x;
                by = this.boss.sprite.y;
            }
            const dx = b.x - bx;
            const dy = b.y - by;
            const dist = Math.hypot(dx, dy);
            if (dist < 0.5) return;
            const ux = dx / dist;
            const uy = dy / dist;
            const tx = -uy;
            const ty = ux;
            let fwdX;
            let fwdY;
            if (b.initForwardVx !== undefined) {
                fwdX = b.initForwardVx;
                fwdY = b.initForwardVy;
            } else {
                fwdX = ux * b.forwardSpeed;
                fwdY = uy * b.forwardSpeed;
            }
            const sideMag = b.sideSpeed * b.sideDirectionValue;
            const newVx = fwdX + tx * sideMag;
            const newVy = fwdY + ty * sideMag;
            b.body.setVelocity(newVx, newVy);
            b.rotation = Math.atan2(newVy, newVx) + Math.PI / 2;
        });
    }

    spawnClouds(cloudsSpec) {
        this.despawnClouds();
        this.cloudSpec = cloudsSpec;
        const w = cloudsSpec.width ?? 60;
        const h = cloudsSpec.height ?? 40;
        const color = cloudsSpec.color ?? 0xaaaaaa;
        const interval = cloudsSpec.cloudFireIntervalMs ?? 1400;
        const count = cloudsSpec.items.length;
        const now = this.time.now;
        for (let i = 0; i < count; i += 1) {
            const item = cloudsSpec.items[i];
            const c = this.add.rectangle(item.startX + w / 2, item.y, w, h, color);
            c.setStrokeStyle(1, 0xdddddd);
            // stagger: 첫 번째는 즉시, 이후 균등 시차
            const lastFireTime = now - interval * (count - i) / count;
            this.clouds.push({ sprite: c, w, h, y: item.y, lastFireTime });
        }
    }

    despawnClouds() {
        for (const c of this.clouds) {
            if (c.sprite) c.sprite.destroy();
        }
        this.clouds = [];
        this.cloudSpec = null;
    }

    updateClouds(time, delta) {
        if (!this.cloudSpec || this.clouds.length === 0) return;
        const dt = delta / 1000;
        const step = (this.cloudSpec.moveSpeed ?? 100) * dt;
        const interval = this.cloudSpec.cloudFireIntervalMs ?? 1400;
        for (const c of this.clouds) {
            c.sprite.x += step;
            if (c.sprite.x - c.w / 2 >= LAB_PLAY_W) {
                c.sprite.x = -c.w / 2;
            }
            if (time - c.lastFireTime >= interval) {
                this.fireCloudBullet(c, this.cloudSpec.bullet);
                c.lastFireTime = time;
            }
        }
    }

    fireCloudBullet(cloud, bulletSpec) {
        if (!bulletSpec) return;
        const rad = Phaser.Math.DegToRad(bulletSpec.angleDeg ?? 90);
        const vx = Math.cos(rad) * bulletSpec.speed;
        const vy = Math.sin(rad) * bulletSpec.speed;
        const x = cloud.sprite.x;
        const y = cloud.sprite.y + cloud.h / 2;
        if (bulletSpec.shape === 'snowflake') {
            this.spawnPlainSnowflake(x, y, vx, vy, bulletSpec);
        } else if (bulletSpec.shape === 'triangle') {
            this.spawnBossTriangle(x, y, vx, vy, bulletSpec.angleDeg ?? 90, bulletSpec);
        } else {
            this.spawnBossBullet(x, y, vx, vy);
        }
    }

    spawnBirdEmitters(spec) {
        this.despawnBirdEmitters();
        this.birdEmitterSpec = spec;
        this.birdActivateLastTime = this.time.now - (spec.activateIntervalMs ?? 7000);
    }

    despawnBirdEmitters() {
        this.birdEmitters = [];
        this.birdEmitterSpec = null;
    }

    updateBirdEmitters(time, delta) {
        if (!this.birdEmitterSpec) return;
        const spec = this.birdEmitterSpec;
        const dt = delta / 1000;

        if (this.birdEmitters.length === 0 &&
            time - this.birdActivateLastTime >= (spec.activateIntervalMs ?? 7000)) {
            const fireInterval = spec.fireIntervalMs ?? 200;
            for (const item of spec.items) {
                this.birdEmitters.push({
                    x: item.startX,
                    y: item.startY,
                    dirX: item.dirX ?? 0,
                    dirY: item.dirY ?? 0,
                    lastFireTime: time - fireInterval + (item.fireDelayMs ?? 0),
                });
            }
            this.birdActivateLastTime = time;
            this.birdCenterFireTime = null;
        }

        const speed = spec.moveSpeed ?? 100;
        const step = speed * dt;
        const fireInterval = spec.fireIntervalMs ?? 200;
        for (let i = this.birdEmitters.length - 1; i >= 0; i -= 1) {
            const e = this.birdEmitters[i];
            e.x += e.dirX * step;
            e.y += e.dirY * step;

            if (time - e.lastFireTime >= fireInterval) {
                const bs = spec.bullet;
                let effectiveSpeed;
                if (this.birdCenterFireTime === null) {
                    this.birdCenterFireTime = time;
                    effectiveSpeed = bs.speed ?? 200;
                } else {
                    const elapsedSec = (time - this.birdCenterFireTime) / 1000;
                    effectiveSpeed = (bs.speed ?? 200) + (bs.accel ?? 0) * elapsedSec;
                }
                const rad = Phaser.Math.DegToRad(bs.angleDeg ?? 90);
                const vx = Math.cos(rad) * effectiveSpeed;
                const vy = Math.sin(rad) * effectiveSpeed;
                if (bs.shape === 'bird') {
                    this.spawnBird(e.x, e.y, vx, vy, bs);
                } else {
                    this.spawnBossBullet(e.x, e.y, vx, vy);
                }
                e.lastFireTime = time;
            }

            if (e.x < -20 || e.x > LAB_PLAY_W + 20 ||
                e.y < -20 || e.y > LAB_H + 20) {
                this.birdEmitters.splice(i, 1);
            }
        }
    }

    spawnBird(x, y, vx, vy, spec) {
        const color = spec.color ?? 0xffdd88;
        const size = spec.size ?? 8;
        const points = [
            0, size * 0.5,
            -size, -size * 0.5,
            0, -size * 0.125,
            size, -size * 0.5,
        ];
        const bird = this.add.polygon(x, y, points, color);
        this.physics.add.existing(bird);
        this.bossBullets.add(bird);
        bird.body.setSize(size * 2, size);
        bird.body.setVelocity(vx, vy);
        bird.rotation = Math.atan2(vy, vx) - Math.PI / 2;
        const accel = spec.accel ?? 0;
        if (accel !== 0) {
            const speedMag = Math.hypot(vx, vy);
            if (speedMag > 0) {
                bird.body.setAcceleration((vx / speedMag) * accel, (vy / speedMag) * accel);
            }
        }
        return bird;
    }

    spawnPlainSnowflake(x, y, vx, vy, spec) {
        const radius = spec.radius ?? 6;
        const color = spec.color ?? 0xddf4ff;
        const s = this.add.circle(x, y, radius, color);
        s.setStrokeStyle(1, 0xffffff);
        this.physics.add.existing(s);
        this.bossBullets.add(s);
        s.body.setCircle(radius);
        s.body.setVelocity(vx, vy);
        return s;
    }

    spawnBossBullet(x, y, vx, vy) {
        const b = this.add.circle(
            x, y,
            GameConfig.ENEMY_BULLET_RADIUS,
            GameConfig.ENEMY_BULLET_COLOR,
        );
        this.physics.add.existing(b);
        this.bossBullets.add(b);
        b.body.setCircle(GameConfig.ENEMY_BULLET_RADIUS);
        b.body.setVelocity(vx, vy);
        return b;
    }

    spawnBossTriangle(x, y, vx, vy, angleDeg, spec) {
        const w = spec.triangleWidth ?? 6;
        const h = spec.triangleHeight ?? 18;
        const color = spec.bulletColor ?? GameConfig.ENEMY_BULLET_COLOR;
        const tri = this.add.triangle(
            x, y,
            0, -h / 2,
            -w / 2, h / 2,
            w / 2, h / 2,
            color,
        );
        this.physics.add.existing(tri);
        this.bossBullets.add(tri);
        tri.body.setSize(w, h);
        tri.body.setVelocity(vx, vy);
        const rad = Phaser.Math.DegToRad(angleDeg);
        tri.rotation = rad + Math.PI / 2;
        return tri;
    }

    fireSeekingMissile() {
        const originX = this.boss.sprite.x;
        const originY = this.boss.sprite.y;
        const target = this.getActivePlayerPos();
        const initAngle = Math.atan2(target.y - originY, target.x - originX);

        const initSpeed = 60;
        const initAngularRate = 0.3;
        const speedAccel = 80;
        const angularAccel = 0.6;

        const w = 10;
        const h = 22;
        const color = 0xff8899;
        const tri = this.add.triangle(
            originX, originY,
            0, -h / 2,
            -w / 2, h / 2,
            w / 2, h / 2,
            color,
        );
        this.physics.add.existing(tri);
        this.bossBullets.add(tri);
        tri.body.setSize(w, h);
        tri.body.setVelocity(Math.cos(initAngle) * initSpeed, Math.sin(initAngle) * initSpeed);
        tri.rotation = initAngle + Math.PI / 2;

        tri.isSeekingMissile = true;
        tri.headingRad = initAngle;
        tri.currentSpeed = initSpeed;
        tri.angularRate = initAngularRate;
        tri.speedAccel = speedAccel;
        tri.angularAccel = angularAccel;
        tri.rotationAccumulated = 0;
    }

    fireDecelSpiralBurst(cfg, angularSign) {
        const c = cfg ?? {};
        const originX = this.boss.sprite.x;
        const originY = this.boss.sprite.y;
        const count = c.count ?? 5;
        const spreadDeg = c.spreadDeg ?? 15;
        const centerAngleDeg = c.centerAngleDeg ?? 90;
        const initSpeed = c.initSpeed ?? 180;
        const initAngularRate = c.initAngularRate ?? 0;
        const speedAccel = c.speedAccel ?? -100;
        const angularAccel = (c.angularAccelMagnitude ?? 0.3) * (angularSign ?? 1);
        const half = (count - 1) / 2;

        const w = 10;
        const h = 22;
        const color = 0xffcc66;

        for (let i = 0; i < count; i += 1) {
            const angleDeg = centerAngleDeg + (i - half) * spreadDeg;
            const angle = Phaser.Math.DegToRad(angleDeg);
            const tri = this.add.triangle(
                originX, originY,
                0, -h / 2,
                -w / 2, h / 2,
                w / 2, h / 2,
                color,
            );
            this.physics.add.existing(tri);
            this.bossBullets.add(tri);
            tri.body.setSize(w, h);
            tri.body.setVelocity(Math.cos(angle) * initSpeed, Math.sin(angle) * initSpeed);
            tri.rotation = angle + Math.PI / 2 + Math.PI;

            tri.isSeekingMissile = true;
            tri.visualFlip = true;
            tri.headingRad = angle;
            tri.currentSpeed = initSpeed;
            tri.angularRate = initAngularRate;
            tri.speedAccel = speedAccel;
            tri.angularAccel = angularAccel;
            tri.rotationAccumulated = 0;
        }
    }

    updateEndpointDecelSpiral() {
        if (!this.boss || this.boss.isDead()) return;
        if (this.boss.pendingNextPhase !== null) return;
        const phaseIdx = this.boss.phaseIndex;
        if (phaseIdx < 0) {
            this.endpointState = null;
            return;
        }
        const phase = this.boss.data.phases[phaseIdx];
        if (!phase || !phase.endpointDecelSpiral) {
            this.endpointState = null;
            return;
        }
        const cfg = phase.endpointDecelSpiral;
        if (!this.endpointState || this.endpointState.phaseIndex !== phaseIdx) {
            this.endpointState = {
                phaseIndex: phaseIdx,
                prevX: this.boss.sprite.x,
                direction: 0,
                counter: 0,
            };
            return;
        }
        const st = this.endpointState;
        const currentX = this.boss.sprite.x;
        const dx = currentX - st.prevX;
        const currDir = Math.sign(dx);
        if (currDir !== 0 && st.direction !== 0 && currDir !== st.direction) {
            st.counter += 1;
            if (st.counter >= (cfg.triggerCount ?? 5)) {
                st.counter = 0;
                const isLeftSide = st.prevX < LAB_PLAY_W / 2;
                const angularSign = isLeftSide ? 1 : -1;
                this.fireDecelSpiralBurst(cfg, angularSign);
            }
        }
        if (currDir !== 0) st.direction = currDir;
        st.prevX = currentX;
    }

    updateSeekingMissiles(delta) {
        const dt = delta / 1000;
        this.bossBullets.children.each((b) => {
            if (!b || !b.body || !b.isSeekingMissile) return;
            const rotAcc = b.rotationAccumulated ?? 0;
            if (!b.angularFrozen) {
                if (Math.abs(rotAcc) >= Math.PI * 1.5) {
                    b.angularRate *= 0.5;
                    b.angularFrozen = true;
                } else {
                    b.angularRate += b.angularAccel * dt;
                    if (b.angularRate > 2) b.angularRate = 2;
                    else if (b.angularRate < -2) b.angularRate = -2;
                }
            }
            b.currentSpeed += b.speedAccel * dt;
            const dHeading = b.angularRate * dt;
            b.headingRad += dHeading;
            b.rotationAccumulated = rotAcc + dHeading;

            const vx = Math.cos(b.headingRad) * b.currentSpeed;
            const vy = Math.sin(b.headingRad) * b.currentSpeed;
            b.body.setVelocity(vx, vy);
            const flipOffset = b.visualFlip ? Math.PI : 0;
            b.rotation = b.headingRad + Math.PI / 2 + flipOffset;
        });
    }

    spawnSnowflake(x, y, vx, vy, angleDeg, cfg) {
        this.spawnSnowflakeInternal(x, y, vx, vy, angleDeg, cfg, 1, cfg);
    }

    spawnSnowflakeChild(x, y, vx, vy, angleDeg, parent) {
        this.spawnSnowflakeInternal(
            x, y, vx, vy, angleDeg,
            {
                radius: parent.radius,
                color: parent.tintColor,
                burstDistance: parent.burstDistance,
                maxGeneration: parent.maxGeneration,
                childrenPerBurst: parent.childrenPerBurst,
                childAngleOffsetDeg: parent.childAngleOffsetDeg,
            },
            parent.generation + 1,
            parent,
        );
    }

    spawnElectricField(fieldSpec) {
        const w = fieldSpec.width ?? LAB_PLAY_W;
        const h = fieldSpec.height ?? 22;
        const y0 = fieldSpec.initialY ?? -20;
        const field = this.add.rectangle(
            LAB_PLAY_W / 2, y0, w, h,
            fieldSpec.color ?? 0x88ccff
        );
        field.setStrokeStyle(2, fieldSpec.strokeColor ?? 0xffffff);
        this.physics.add.existing(field);
        this.bossBullets.add(field);
        field.body.setSize(w, h);
        field.body.setVelocityY(fieldSpec.speed ?? 235);
        field.isElectricField = true;
    }

    startTurretSpawner(spec) {
        this.turretSpawnerSpec = spec;
        this.turretSpawnLastTime = null;
    }

    updateTurretSpawner(time) {
        if (!this.turretSpawnerSpec) return;
        if (this.turretSpawnLastTime === null) {
            this.turretSpawnLastTime = time;
            return;
        }
        const spec = this.turretSpawnerSpec;
        const interval = spec.intervalMs ?? 5000;
        if (time - this.turretSpawnLastTime >= interval) {
            this.spawnTurretRandom(spec);
            this.turretSpawnLastTime = time;
        }
    }

    spawnTurretRandom(spec) {
        const area = spec.area;
        const turretSpec = spec.turret;
        const minDist = (turretSpec.radius ?? 12) * 5;
        let x = Phaser.Math.Between(area.xMin, area.xMax);
        let y = Phaser.Math.Between(area.yMin, area.yMax);
        for (let attempt = 0; attempt < 10; attempt += 1) {
            let ok = true;
            this.turretsGroup.children.each((t) => {
                if (t && t.active && Math.hypot(t.x - x, t.y - y) < minDist) ok = false;
            });
            if (ok) break;
            x = Phaser.Math.Between(area.xMin, area.xMax);
            y = Phaser.Math.Between(area.yMin, area.yMax);
        }
        this.spawnTurret(x, y, turretSpec);
    }

    spawnTurret(x, y, turretSpec) {
        const radius = turretSpec.radius ?? 12;
        const t = this.add.circle(x, y, radius, turretSpec.color ?? 0x999999);
        t.setStrokeStyle(2, turretSpec.strokeColor ?? 0x666666);
        this.physics.add.existing(t);
        this.turretsGroup.add(t);
        t.body.setCircle(radius);
        t.body.setImmovable(true);
        t.hp = turretSpec.maxHp ?? 70;
        t.maxHp = turretSpec.maxHp ?? 70;
        t.decayPercentPerSec = turretSpec.decayPercentPerSec ?? 5;
        t.fireIntervalMs = turretSpec.fireIntervalMs ?? 1000;
        t.shotsPerBurst = turretSpec.shotsPerBurst ?? 3;
        t.shotIntervalMs = turretSpec.shotIntervalMs ?? 200;
        t.missileSpec = turretSpec.missile ?? { radius: 4, speed: 200, color: 0xff8844 };
        t.lastCycleStart = this.time.now - Math.random() * t.fireIntervalMs;
        t.shotsFiredInCycle = t.shotsPerBurst;
        t.cycleAngleLocked = false;
        t.cyclesCompleted = 0;
        if (this.turretMotionSpec) {
            this.initTurretOrbit(t);
        }
        return t;
    }

    initTurretOrbit(t) {
        t.orbitCenterX = t.x;
        t.orbitCenterY = t.y;
        t.orbitAngle = Math.random() * Math.PI * 2;
        t.orbitRadius = 0;
    }

    spawnInvincibleTurret(cfg) {
        const cx = cfg.spawnX ?? LAB_PLAY_W / 2;
        const cy = cfg.spawnY ?? 300;
        const r = cfg.radius ?? 80;
        const startAngle = Math.random() * Math.PI * 2;
        const x = cx + Math.cos(startAngle) * r;
        const y = cy + Math.sin(startAngle) * r;

        const baseTurret = this.turretSpawnerSpec?.turret ?? this.bossData.phases[0]?.turretSpawner?.turret ?? {};
        const turretSpec = { ...baseTurret };
        const t = this.spawnTurret(x, y, turretSpec);
        t.invincible = true;
        t.setFillStyle(cfg.color ?? 0xccccdd);
        t.setStrokeStyle(3, cfg.strokeColor ?? 0x4488ff);
        t.setAlpha(1);
        t.orbitCenterX = cx;
        t.orbitCenterY = cy;
        t.orbitAngle = startAngle;
        t.orbitRadius = r;
        t.orbitAngularSpeed = cfg.angularSpeedRadPerSec ?? Math.PI / 2;
        t.orbitGrowRate = 0;
        return t;
    }

    updateTurrets(time, delta) {
        const dtSec = delta / 1000;
        let turretCount = 0;
        this.turretsGroup.children.each((t) => {
            if (t && t.active && !t.invincible) turretCount += 1;
        });
        const motion = this.turretMotionSpec;
        this.turretsGroup.children.each((t) => {
            if (!t || !t.active || !t.body) return;

            if (!t.invincible) {
                t.hp -= t.maxHp * (t.decayPercentPerSec / 100) * turretCount * dtSec;
                if (t.hp <= 0) {
                    t.destroy();
                    return;
                }
                t.setAlpha(0.4 + 0.6 * (t.hp / t.maxHp));
            }

            if (t.orbitCenterX !== undefined) {
                const w = t.orbitAngularSpeed ?? motion?.angularSpeedRadPerSec ?? Math.PI / 4;
                const dr = t.orbitGrowRate ?? motion?.radiusGrowRatePxPerSec ?? 3;
                t.orbitAngle += w * dtSec;
                t.orbitRadius += dr * dtSec;
                const tanUx = -Math.sin(t.orbitAngle);
                const tanUy = Math.cos(t.orbitAngle);
                const radUx = Math.cos(t.orbitAngle);
                const radUy = Math.sin(t.orbitAngle);
                const tangSpeed = w * t.orbitRadius;
                t.body.setVelocity(tanUx * tangSpeed + radUx * dr, tanUy * tangSpeed + radUy * dr);
            }

            if (time - t.lastCycleStart >= t.fireIntervalMs) {
                t.lastCycleStart = time;
                t.shotsFiredInCycle = 0;
                t.cycleAngleLocked = false;
                t.cyclesCompleted = (t.cyclesCompleted ?? 0) + 1;
                const harvSpec = this.harvesterDroneSpawnerSpec;
                if (harvSpec && t.cyclesCompleted % (harvSpec.cyclesPerSpawn ?? 3) === 0) {
                    this.spawnHarvesterDrone(t.x, t.y, harvSpec.drone);
                }
            }
            if (t.shotsFiredInCycle < t.shotsPerBurst) {
                const nextShotAt = t.lastCycleStart + t.shotsFiredInCycle * t.shotIntervalMs;
                if (time >= nextShotAt) {
                    const aimEveryShot = motion && motion.aimEveryShot;
                    if (aimEveryShot || !t.cycleAngleLocked) {
                        const target = this.getActivePlayerPos();
                        if (target) {
                            const dx = target.x - t.x;
                            const dy = target.y - t.y;
                            const dist = Math.hypot(dx, dy) || 1;
                            t.cycleUx = dx / dist;
                            t.cycleUy = dy / dist;
                        } else {
                            t.cycleUx = 0;
                            t.cycleUy = 1;
                        }
                        if (!aimEveryShot) t.cycleAngleLocked = true;
                    }
                    this.fireTurretMissile(t);
                    t.shotsFiredInCycle += 1;
                }
            }
        });
    }

    fireTurretMissile(turret) {
        const spec = turret.missileSpec;
        const speed = spec.speed ?? 200;
        const vx = (turret.cycleUx ?? 0) * speed;
        const vy = (turret.cycleUy ?? 1) * speed;
        this.spawnColoredCircleBullet(
            turret.x, turret.y, vx, vy,
            spec.radius ?? 4, spec.color ?? 0xff8844
        );
    }

    startSuicideDroneSpawner(spec) {
        this.suicideDroneSpawnerSpec = spec;
        this.suicideDroneSpawnLastTime = null;
    }

    updateSuicideDroneSpawner(time) {
        if (!this.suicideDroneSpawnerSpec) return;
        if (this.suicideDroneSpawnLastTime === null) {
            this.suicideDroneSpawnLastTime = time;
            return;
        }
        const spec = this.suicideDroneSpawnerSpec;
        const interval = spec.intervalMs ?? 4000;
        if (time - this.suicideDroneSpawnLastTime >= interval) {
            this.spawnSuicideDrone(spec.drone);
            this.suicideDroneSpawnLastTime = time;
        }
    }

    spawnSuicideDrone(droneSpec) {
        const cx = droneSpec.centerX ?? LAB_PLAY_W / 2;
        const cy = droneSpec.centerY ?? LAB_H / 2;
        const R = droneSpec.orbitRadius ?? 150;
        const startX = (this.boss && this.boss.sprite) ? this.boss.sprite.x : cx;
        const startY = (this.boss && this.boss.sprite) ? this.boss.sprite.y : cy - R;
        const bx2c = startX - cx;
        const by2c = startY - cy;
        const bdist = Math.hypot(bx2c, by2c);
        const initPhi = (bdist < 0.01) ? Math.random() * Math.PI * 2 : Math.atan2(by2c, bx2c);
        const targetX = cx + Math.cos(initPhi) * R;
        const targetY = cy + Math.sin(initPhi) * R;

        const drone = this.add.circle(startX, startY, droneSpec.radius ?? 15, droneSpec.color ?? 0x666666);
        drone.setStrokeStyle(2, droneSpec.strokeColor ?? 0x333333);
        this.physics.add.existing(drone);
        this.suicideDronesGroup.add(drone);
        drone.body.setCircle(droneSpec.radius ?? 15);

        const halfDeg = (droneSpec.detectionAngleDeg ?? 60) / 2;
        const fan = this.add.arc(
            startX, startY,
            droneSpec.detectionRadius ?? 110,
            -halfDeg, halfDeg, false,
            droneSpec.fanColor ?? 0xff4444,
            droneSpec.fanAlpha ?? 0.3
        );

        const dxA = targetX - startX;
        const dyA = targetY - startY;
        const distA = Math.hypot(dxA, dyA) || 1;
        const approachSpeed = droneSpec.approachSpeed ?? 250;
        drone.body.setVelocity((dxA / distA) * approachSpeed, (dyA / distA) * approachSpeed);

        drone.spec = droneSpec;
        drone.state = 'approaching';
        drone.phi = initPhi;
        drone.targetX = targetX;
        drone.targetY = targetY;
        drone.orbitCenterX = cx;
        drone.orbitCenterY = cy;
        drone.orbitRadius = R;
        drone.orbitSpeed = droneSpec.orbitSpeedRadPerSec ?? Math.PI / 3;
        drone.hp = droneSpec.maxHp ?? 20;
        drone.maxHp = droneSpec.maxHp ?? 20;
        drone.decayPercentPerSecPerDrone = droneSpec.decayPercentPerSecPerDrone ?? 5;
        drone.detectionRadius = droneSpec.detectionRadius ?? 110;
        drone.detectionHalfRad = Phaser.Math.DegToRad(halfDeg);
        drone.pauseMs = droneSpec.pauseMs ?? 500;
        drone.pauseUntil = 0;
        drone.chargeSpeed = droneSpec.chargeSpeed ?? 500;
        drone.chargeVx = 0;
        drone.chargeVy = 0;
        drone.fan = fan;

        drone.once('destroy', () => {
            if (fan && fan.active) fan.destroy();
        });

        return drone;
    }

    updateSuicideDrones(time, delta) {
        const dtSec = delta / 1000;
        const W = LAB_PLAY_W;
        const H = LAB_H;
        const droneCount = this.suicideDronesGroup.countActive();
        this.suicideDronesGroup.children.each((d) => {
            if (!d || !d.active || !d.body) return;

            d.hp -= d.maxHp * (d.decayPercentPerSecPerDrone / 100) * droneCount * dtSec;
            if (d.hp <= 0) {
                d.destroy();
                return;
            }

            if (d.state === 'approaching') {
                const dx = d.targetX - d.x;
                const dy = d.targetY - d.y;
                if (Math.hypot(dx, dy) < 8) {
                    d.x = d.targetX;
                    d.y = d.targetY;
                    d.body.setVelocity(0, 0);
                    d.state = 'orbiting';
                    return;
                }
                const moveAngle = Math.atan2(dy, dx);
                d.fan.x = d.x;
                d.fan.y = d.y;
                d.fan.rotation = moveAngle;
                d.fan.setFillStyle(d.spec.fanColor ?? 0xff4444, d.spec.fanAlpha ?? 0.3);
                d.fan.setVisible(true);

                const targets = [];
                if (this.player1 && !this.player1.isInvincible) targets.push(this.player1);
                if (this.player2 && !this.player2.isInvincible) targets.push(this.player2);
                for (const p of targets) {
                    const pdx = p.sprite.x - d.x;
                    const pdy = p.sprite.y - d.y;
                    const dist = Math.hypot(pdx, pdy);
                    if (dist > d.detectionRadius) continue;
                    const angle = Math.atan2(pdy, pdx);
                    let diff = angle - moveAngle;
                    while (diff > Math.PI) diff -= 2 * Math.PI;
                    while (diff < -Math.PI) diff += 2 * Math.PI;
                    if (Math.abs(diff) <= d.detectionHalfRad) {
                        d.state = 'paused';
                        d.pauseUntil = time + d.pauseMs;
                        d.chargeVx = Math.cos(angle) * d.chargeSpeed;
                        d.chargeVy = Math.sin(angle) * d.chargeSpeed;
                        d.body.setVelocity(0, 0);
                        break;
                    }
                }
            } else if (d.state === 'orbiting') {
                d.phi += d.orbitSpeed * dtSec;
                d.x = d.orbitCenterX + Math.cos(d.phi) * d.orbitRadius;
                d.y = d.orbitCenterY + Math.sin(d.phi) * d.orbitRadius;
                d.body.setVelocity(0, 0);

                const tangentAngle = d.phi + Math.PI / 2;
                d.fan.x = d.x;
                d.fan.y = d.y;
                d.fan.rotation = tangentAngle;
                d.fan.setFillStyle(d.spec.fanColor ?? 0xff4444, d.spec.fanAlpha ?? 0.3);
                d.fan.setVisible(true);

                const targets = [];
                if (this.player1 && !this.player1.isInvincible) targets.push(this.player1);
                if (this.player2 && !this.player2.isInvincible) targets.push(this.player2);
                for (const p of targets) {
                    const dx = p.sprite.x - d.x;
                    const dy = p.sprite.y - d.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > d.detectionRadius) continue;
                    const angle = Math.atan2(dy, dx);
                    let diff = angle - tangentAngle;
                    while (diff > Math.PI) diff -= 2 * Math.PI;
                    while (diff < -Math.PI) diff += 2 * Math.PI;
                    if (Math.abs(diff) <= d.detectionHalfRad) {
                        d.state = 'paused';
                        d.pauseUntil = time + d.pauseMs;
                        d.chargeVx = Math.cos(angle) * d.chargeSpeed;
                        d.chargeVy = Math.sin(angle) * d.chargeSpeed;
                        d.body.setVelocity(0, 0);
                        break;
                    }
                }
            } else if (d.state === 'paused') {
                d.fan.x = d.x;
                d.fan.y = d.y;
                d.fan.setFillStyle(d.spec.fanColor ?? 0xff4444, d.spec.fanAlphaPaused ?? 0.7);
                d.body.setVelocity(0, 0);
                if (time >= d.pauseUntil) {
                    d.state = 'charging';
                    d.body.setVelocity(d.chargeVx, d.chargeVy);
                    d.fan.setVisible(false);
                }
            } else if (d.state === 'charging') {
                if (d.x < -30 || d.x > W + 30 || d.y < -30 || d.y > H + 30) {
                    d.destroy();
                    return;
                }
            }
        });
    }

    onDroneLabHit(player, drone) {
        if (!drone.active) return;
        const time = this.time.now;
        if (!player.canBeHit(time)) return;
        player.onHit(time);
        drone.destroy();
        this.hitCount += 1;
        this.updateModeUI();
    }

    fireGearBurst(boss, cfg) {
        const bx = boss.sprite.x;
        const by = boss.sprite.y;
        const activePos = this.getActivePlayerPos();
        if (activePos) {
            this.spawnGear(bx, by, activePos.x, activePos.y, cfg.gear);
        }
    }

    spawnGear(originX, originY, targetX, targetY, gearSpec) {
        const dx = targetX - originX;
        const dy = targetY - originY;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = gearSpec.speed ?? 200;
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;
        const radius = gearSpec.radius ?? 22;
        const color = gearSpec.color ?? 0x888888;

        const gear = this.add.circle(originX, originY, radius, color);
        gear.setStrokeStyle(3, 0x555555);
        this.physics.add.existing(gear);
        this.bossBullets.add(gear);
        gear.body.setCircle(radius);
        gear.body.setVelocity(vx, vy);

        const spoke1 = this.add.rectangle(originX, originY, radius * 2 - 6, 5, 0x555555);
        const spoke2 = this.add.rectangle(originX, originY, 5, radius * 2 - 6, 0x555555);
        const inner = this.add.circle(originX, originY, radius * 0.35, 0x333333);

        gear.isGear = true;
        gear.gearState = 'initial';
        gear.gearSpeed = speed;
        gear.gearRotSpeed = gearSpec.rotationRadPerSec ?? Math.PI;
        gear.gearRotAngle = 0;
        gear.gearRadius = radius;
        gear.wallSide = null;
        gear.spoke1 = spoke1;
        gear.spoke2 = spoke2;
        gear.inner = inner;

        gear.once('destroy', () => {
            if (spoke1 && spoke1.active) spoke1.destroy();
            if (spoke2 && spoke2.active) spoke2.destroy();
            if (inner && inner.active) inner.destroy();
        });

        return gear;
    }

    updateGears(delta) {
        const dtSec = delta / 1000;
        const W = LAB_PLAY_W;
        const H = LAB_H;
        this.bossBullets.children.each((g) => {
            if (!g || !g.isGear || !g.body) return;

            if (g.gearState === 'initial') {
                if (g.y <= 0) {
                    g.destroy();
                    return;
                }
                if (g.x <= 0) {
                    g.x = 0;
                    g.gearState = 'goingDown';
                    g.wallSide = 'left';
                    g.body.setVelocity(0, g.gearSpeed);
                } else if (g.x >= W) {
                    g.x = W;
                    g.gearState = 'goingDown';
                    g.wallSide = 'right';
                    g.body.setVelocity(0, g.gearSpeed);
                } else if (g.y >= H) {
                    g.y = H;
                    if (g.x < W / 2) {
                        g.gearState = 'goingRight';
                        g.body.setVelocity(g.gearSpeed, 0);
                    } else {
                        g.gearState = 'goingLeft';
                        g.body.setVelocity(-g.gearSpeed, 0);
                    }
                }
            } else if (g.gearState === 'goingDown') {
                g.x = (g.wallSide === 'left') ? 0 : W;
                if (g.y >= H) {
                    g.y = H;
                    if (g.wallSide === 'left') {
                        g.gearState = 'goingRight';
                        g.body.setVelocity(g.gearSpeed, 0);
                    } else {
                        g.gearState = 'goingLeft';
                        g.body.setVelocity(-g.gearSpeed, 0);
                    }
                }
            } else if (g.gearState === 'goingRight') {
                g.y = H;
                if (g.x >= W) {
                    g.x = W;
                    g.gearState = 'goingUp';
                    g.wallSide = 'right';
                    g.body.setVelocity(0, -g.gearSpeed);
                }
            } else if (g.gearState === 'goingLeft') {
                g.y = H;
                if (g.x <= 0) {
                    g.x = 0;
                    g.gearState = 'goingUp';
                    g.wallSide = 'left';
                    g.body.setVelocity(0, -g.gearSpeed);
                }
            } else if (g.gearState === 'goingUp') {
                g.x = (g.wallSide === 'left') ? 0 : W;
                if (g.y <= 0) {
                    g.destroy();
                    return;
                }
            }

            g.gearRotAngle += g.gearRotSpeed * dtSec;
            if (g.spoke1 && g.spoke1.active) {
                g.spoke1.x = g.x; g.spoke1.y = g.y; g.spoke1.rotation = g.gearRotAngle;
            }
            if (g.spoke2 && g.spoke2.active) {
                g.spoke2.x = g.x; g.spoke2.y = g.y; g.spoke2.rotation = g.gearRotAngle;
            }
            if (g.inner && g.inner.active) {
                g.inner.x = g.x; g.inner.y = g.y;
            }
        });
    }

    spawnSnowflakeInternal(x, y, vx, vy, angleDeg, cfg, generation, sourceCfg) {
        const radius = cfg.radius ?? 8;
        const color = cfg.color ?? 0xddf4ff;
        const s = this.add.circle(x, y, radius, color);
        s.setStrokeStyle(1, 0xffffff);
        this.physics.add.existing(s);
        this.snowflakesGroup.add(s);
        s.body.setCircle(radius);
        s.body.setVelocity(vx, vy);

        s.generation = generation;
        s.angleDeg = angleDeg;
        s.speed = Math.hypot(vx, vy);
        s.traveledDist = 0;
        s.burstDistance = sourceCfg.burstDistance ?? 150;
        s.maxGeneration = sourceCfg.maxGeneration ?? 4;
        s.childrenPerBurst = sourceCfg.childrenPerBurst ?? 2;
        s.childAngleOffsetDeg = sourceCfg.childAngleOffsetDeg ?? 60;
        s.radius = radius;
        s.tintColor = color;
        s.frozen = false;
        return s;
    }

    startHarvesterDroneSpawner(spec) {
        this.harvesterDroneSpawnerSpec = spec;
    }

    spawnHarvesterDrone(x, y, droneSpec) {
        const radius = droneSpec.radius ?? 14;
        const drone = this.add.circle(x, y, radius, droneSpec.color ?? 0xccaa44);
        drone.setStrokeStyle(2, droneSpec.strokeColor ?? 0x664422);
        this.physics.add.existing(drone);
        this.harvesterDronesGroup.add(drone);
        drone.body.setCircle(radius);

        drone.spec = droneSpec;
        drone.state = 'descending';
        drone.hp = droneSpec.maxHp ?? 20;
        drone.maxHp = droneSpec.maxHp ?? 20;
        drone.decayPercentPerSecPerDrone = droneSpec.decayPercentPerSecPerDrone ?? 2.5;
        drone.moveSpeed = droneSpec.speed ?? 250;
        drone.healPercent = droneSpec.healPercent ?? 2;
        drone.wallSegment = null;
        drone.rotation2 = null;
        drone.carryingGear = false;
        drone.carriedGearVisual = null;
        drone.body.setVelocity(0, drone.moveSpeed);
        return drone;
    }

    updateHarvesterDrones(time, delta) {
        const dtSec = delta / 1000;
        const W = LAB_PLAY_W;
        const H = LAB_H;
        const droneCount = this.harvesterDronesGroup.countActive();
        this.harvesterDronesGroup.children.each((d) => {
            if (!d || !d.active || !d.body) return;

            d.hp -= d.maxHp * (d.decayPercentPerSecPerDrone / 100) * droneCount * dtSec;
            if (d.hp <= 0) {
                d.destroy();
                return;
            }

            const s = d.moveSpeed;

            if (d.state === 'descending') {
                if (d.y >= H) {
                    d.y = H;
                    d.wallSegment = 'bottom';
                    d.rotation2 = (d.x < W / 2) ? 'ccw' : 'cw';
                    d.state = 'wallRiding';
                    this.setHarvesterWallVelocity(d);
                } else if (d.x <= 0) {
                    d.x = 0;
                    d.wallSegment = 'left';
                    d.rotation2 = 'ccw';
                    d.state = 'wallRiding';
                    this.setHarvesterWallVelocity(d);
                } else if (d.x >= W) {
                    d.x = W;
                    d.wallSegment = 'right';
                    d.rotation2 = 'cw';
                    d.state = 'wallRiding';
                    this.setHarvesterWallVelocity(d);
                }
            } else if (d.state === 'wallRiding') {
                if (d.wallSegment === 'bottom') {
                    d.y = H;
                    if (d.rotation2 === 'ccw' && d.x <= 0) {
                        d.x = 0; d.wallSegment = 'left'; this.setHarvesterWallVelocity(d);
                    } else if (d.rotation2 === 'cw' && d.x >= W) {
                        d.x = W; d.wallSegment = 'right'; this.setHarvesterWallVelocity(d);
                    }
                } else if (d.wallSegment === 'left') {
                    d.x = 0;
                    if (d.rotation2 === 'ccw' && d.y <= 0) {
                        d.y = 0; d.wallSegment = 'top'; this.setHarvesterWallVelocity(d);
                    } else if (d.rotation2 === 'cw' && d.y >= H) {
                        d.y = H; d.wallSegment = 'bottom'; this.setHarvesterWallVelocity(d);
                    }
                } else if (d.wallSegment === 'top') {
                    d.y = 0;
                    if (d.rotation2 === 'ccw' && d.x >= W) {
                        d.x = W; d.wallSegment = 'right'; this.setHarvesterWallVelocity(d);
                    } else if (d.rotation2 === 'cw' && d.x <= 0) {
                        d.x = 0; d.wallSegment = 'left'; this.setHarvesterWallVelocity(d);
                    }
                } else if (d.wallSegment === 'right') {
                    d.x = W;
                    if (d.rotation2 === 'ccw' && d.y >= H) {
                        d.y = H; d.wallSegment = 'bottom'; this.setHarvesterWallVelocity(d);
                    } else if (d.rotation2 === 'cw' && d.y <= 0) {
                        d.y = 0; d.wallSegment = 'top'; this.setHarvesterWallVelocity(d);
                    }
                }
            } else if (d.state === 'carrying') {
                const bx = this.boss?.sprite?.x ?? W / 2;
                const by = this.boss?.sprite?.y ?? 140;
                const dx = bx - d.x;
                const dy = by - d.y;
                const dist = Math.hypot(dx, dy) || 1;
                const bossHalf = (this.boss?.data?.size ?? 70) / 2;
                const droneR = d.spec.radius ?? 14;
                if (dist < bossHalf + droneR) {
                    this.onHarvesterReachBoss(d);
                } else {
                    d.body.setVelocity((dx / dist) * s, (dy / dist) * s);
                }
            }

            if (d.carriedGearVisual && d.carriedGearVisual.active) {
                d.carriedGearVisual.x = d.x;
                d.carriedGearVisual.y = d.y - (d.spec.radius ?? 14) - 4;
            }
        });
    }

    setHarvesterWallVelocity(d) {
        const s = d.moveSpeed;
        const seg = d.wallSegment;
        const rot = d.rotation2;
        if (seg === 'bottom') {
            d.body.setVelocity(rot === 'ccw' ? -s : s, 0);
        } else if (seg === 'left') {
            d.body.setVelocity(0, rot === 'ccw' ? -s : s);
        } else if (seg === 'top') {
            d.body.setVelocity(rot === 'ccw' ? s : -s, 0);
        } else if (seg === 'right') {
            d.body.setVelocity(0, rot === 'ccw' ? s : -s);
        }
    }

    onHarvesterTouchBossBullet(drone, bullet) {
        if (!drone.active || drone.hp <= 0) return;
        if (!bullet || !bullet.active || !bullet.isGear) return;
        if (drone.carryingGear) return;
        if (drone.state !== 'wallRiding') return;

        drone.carryingGear = true;
        drone.state = 'carrying';
        const gearColor = drone.spec.carriedGearColor ?? 0x888888;
        const gearR = drone.spec.carriedGearRadius ?? 8;
        const visual = this.add.circle(drone.x, drone.y - (drone.spec.radius ?? 14) - 4, gearR, gearColor);
        visual.setStrokeStyle(2, 0x555555);
        drone.carriedGearVisual = visual;
        drone.once('destroy', () => {
            if (visual && visual.active) visual.destroy();
        });
        bullet.destroy();
    }

    onHarvesterReachBoss(drone) {
        if (!drone.active || drone.hp <= 0) return;
        if (drone.state !== 'carrying') return;
        if (drone.carriedGearVisual && drone.carriedGearVisual.active) {
            drone.carriedGearVisual.destroy();
        }
        drone.carriedGearVisual = null;
        drone.carryingGear = false;
        drone.state = 'descending';
        drone.wallSegment = null;
        drone.rotation2 = null;
        drone.body.setVelocity(0, drone.moveSpeed);
    }

    onHarvesterLabHit(player, drone) {
        if (!drone.active) return;
        const time = this.time.now;
        if (!player.canBeHit(time)) return;
        player.onHit(time);
        this.hitCount += 1;
        this.updateModeUI();
    }

    startTurretConnections(spec) {
        this.turretConnectionsSpec = spec;
        if (!this.turretConnectionsGraphics) {
            this.turretConnectionsGraphics = this.add.graphics();
        }
    }

    updateTurretConnections(time) {
        const g = this.turretConnectionsGraphics;
        if (!g) return;
        g.clear();

        const activeSpec = this.turretConnectionsSpec;
        const interSpec = (this.currentInterlude?.spec?.type === 'sparkLink')
            ? this.currentInterlude.spec : null;
        if (!activeSpec && !interSpec) return;

        const turrets = [];
        this.turretsGroup.children.each((t) => {
            if (t && t.active && t.hp > 0) turrets.push(t);
        });
        if (turrets.length < 2) return;

        let lineColor;
        let lineWidth;
        let alpha;
        let threshold = null;

        if (activeSpec) {
            const period = activeSpec.blinkPeriodMs ?? 400;
            const aMin = activeSpec.alphaMin ?? 0.4;
            const aMax = activeSpec.alphaMax ?? 1.0;
            alpha = aMin + (aMax - aMin) * (0.5 + 0.5 * Math.sin(time / period * Math.PI));
            lineColor = activeSpec.lineColor ?? 0xffdd44;
            lineWidth = activeSpec.lineWidth ?? 1.5;
            threshold = activeSpec.damageThreshold ?? 8;
        } else {
            const preview = interSpec.previewConnection ?? {};
            const duration = interSpec.durationMs ?? 5000;
            const elapsed = time - this.interludeStartTime;
            const progress = Math.max(0, Math.min(1, elapsed / duration));
            const aStart = preview.alphaStart ?? 0;
            const aEnd = preview.alphaEnd ?? 0.5;
            alpha = aStart + (aEnd - aStart) * progress;
            lineColor = preview.lineColor ?? 0xffdd44;
            lineWidth = preview.lineWidth ?? 1.5;
        }

        g.lineStyle(lineWidth, lineColor, alpha);
        for (let i = 0; i < turrets.length; i += 1) {
            for (let j = i + 1; j < turrets.length; j += 1) {
                g.lineBetween(turrets[i].x, turrets[i].y, turrets[j].x, turrets[j].y);
            }
        }

        if (threshold === null) return;
        const players = [this.player1, this.player2];
        for (const p of players) {
            if (!p || p.isInvincible) continue;
            if (!p.canBeHit(time)) continue;
            const px = p.sprite.x;
            const py = p.sprite.y;
            let hit = false;
            for (let i = 0; i < turrets.length && !hit; i += 1) {
                for (let j = i + 1; j < turrets.length && !hit; j += 1) {
                    const dist = this.pointToSegmentDistance(px, py, turrets[i].x, turrets[i].y, turrets[j].x, turrets[j].y);
                    if (dist < threshold) hit = true;
                }
            }
            if (hit) {
                p.onHit(time);
                this.hitCount += 1;
                this.updateModeUI();
            }
        }
    }

    pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        if (len2 < 0.0001) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * dx + (py - y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = x1 + t * dx;
        const cy = y1 + t * dy;
        return Math.hypot(px - cx, py - cy);
    }

    // ===== 스이쿤 페이즈 1: 라이코 (GameScene와 동일 로직, hit 기록만 lab hitCount로 변경) =====
    startRaikouSpawner(spec) {
        this.raikouSpec = spec.raikou;
        this.leashSpec = spec.leash;
        this.waveMissileSpec = spec.waveMissile;
        this.lightningMissileSpec = spec.lightningMissile;
        this.raikouSpawnPending = true;
        if (!this.raikouOverlayGraphics) {
            this.raikouOverlayGraphics = this.add.graphics();
            this.raikouOverlayGraphics.setDepth(30);
        }
        if (!this.leashGraphics) {
            this.leashGraphics = this.add.graphics();
            this.leashGraphics.setDepth(20);
        }
    }

    spawnRaikou() {
        if (!this.boss || !this.raikouSpec) return;
        const rSpec = this.raikouSpec;
        const bx = this.boss.sprite.x;
        const by = this.boss.sprite.y;
        const bossSize = this.boss.data.size ?? 44;
        const startX = bx;
        const startY = by + bossSize / 2 + rSpec.radius + 6;
        const r = this.add.circle(startX, startY, rSpec.radius, rSpec.color);
        r.setStrokeStyle(2, rSpec.strokeColor ?? 0x664400);
        r.setDepth(35);
        this.physics.add.existing(r);
        r.body.setCircle(rSpec.radius);
        r.body.setImmovable(true);
        r.spec = rSpec;
        r.state = 'aiming';
        r.stateStartTime = this.time.now;
        r.chargeCount = 0;
        r.aimVecX = 0;
        r.aimVecY = 1;
        r.aimEndX = startX;
        r.aimEndY = startY;
        r.aimComputed = false;
        this.raikou = r;
        this.physics.add.overlap(r, this.playerBullets, (rr, b) => this.onRaikouShotLab(rr, b));
        this.physics.add.overlap(r, this.orbitOrbs, (rr, o) => this.onRaikouOrbitHitLab(rr, o));
        if (this.player1) {
            this.physics.add.overlap(this.player1.sprite, r, () => this.onRaikouBodyHitLab(this.player1));
        }
        if (this.player2) {
            this.physics.add.overlap(this.player2.sprite, r, () => this.onRaikouBodyHitLab(this.player2));
        }
    }

    destroyRaikou() {
        if (this.raikou) {
            if (this.raikou.active) this.raikou.destroy();
            this.raikou = null;
        }
        this.raikouSpec = null;
        this.leashSpec = null;
        this.waveMissileSpec = null;
        this.raikouSpawnPending = false;
        this.raikouAfterimages.forEach((a) => { if (a.sprite && a.sprite.active) a.sprite.destroy(); });
        this.raikouAfterimages = [];
        if (this.raikouOverlayGraphics) this.raikouOverlayGraphics.clear();
        if (this.leashGraphics) this.leashGraphics.clear();
    }

    updateRaikou(time, delta) {
        if (this.raikouSpawnPending && this.boss && this.boss.sprite && !this.raikou) {
            this.spawnRaikou();
            this.raikouSpawnPending = false;
        }
        if (this.raikouAfterimages.length > 0) {
            this.raikouAfterimages = this.raikouAfterimages.filter((a) => {
                if (!a.sprite || !a.sprite.active) return false;
                if (time >= a.expireAt) { a.sprite.destroy(); return false; }
                const t = (a.expireAt - time) / a.fadeMs;
                a.sprite.setAlpha(t * 0.6);
                return true;
            });
        }
        if (!this.raikou || !this.raikou.active) {
            if (this.raikouOverlayGraphics) this.raikouOverlayGraphics.clear();
            if (this.leashGraphics) this.leashGraphics.clear();
            return;
        }
        const r = this.raikou;
        const spec = r.spec;
        const elapsed = time - r.stateStartTime;
        if (r.state === 'aiming') {
            if (!r.aimComputed) {
                this.computeRaikouAim(r);
                r.aimComputed = true;
            }
            if (elapsed >= spec.aimIntervalMs) {
                this.performRaikouCharge(r, time);
            }
        } else if (r.state === 'returning') {
            const bx = this.boss.sprite.x;
            const by = this.boss.sprite.y;
            const bossSize = this.boss.data.size ?? 44;
            const tx = bx;
            const ty = by + bossSize / 2 + spec.radius + 6;
            const dx = tx - r.x;
            const dy = ty - r.y;
            const dist = Math.hypot(dx, dy);
            const step = spec.returnSpeed * (delta / 1000);
            if (dist <= step + 1) {
                r.x = tx;
                r.y = ty;
                r.state = 'aiming';
                r.stateStartTime = time;
                r.aimComputed = false;
            } else {
                r.x += (dx / dist) * step;
                r.y += (dy / dist) * step;
            }
        }
        this.renderRaikouOverlays(time);
    }

    computeRaikouAim(r) {
        let p = null;
        if (this.player1 && !this.player1.isInvincible) p = this.player1;
        else if (this.player2 && !this.player2.isInvincible) p = this.player2;
        if (!p) return;
        const tx = p.sprite.x;
        const ty = p.sprite.y;
        const dx = tx - r.x;
        const dy = ty - r.y;
        const dist = Math.hypot(dx, dy) || 1;
        r.aimVecX = dx / dist;
        r.aimVecY = dy / dist;
        const end = this.raikouWallIntersect(r.x, r.y, r.aimVecX, r.aimVecY);
        r.aimEndX = end.x;
        r.aimEndY = end.y;
    }

    raikouWallIntersect(x, y, vx, vy) {
        const W = LAB_PLAY_W;
        const H = LAB_H;
        const EPS = 0.0001;
        const margin = (this.raikouSpec?.radius ?? 18) + 2;
        let tMin = Infinity;
        if (vx > EPS) tMin = Math.min(tMin, (W - margin - x) / vx);
        else if (vx < -EPS) tMin = Math.min(tMin, (margin - x) / vx);
        if (vy > EPS) tMin = Math.min(tMin, (H - margin - y) / vy);
        else if (vy < -EPS) tMin = Math.min(tMin, (margin - y) / vy);
        if (!isFinite(tMin) || tMin < 0) tMin = 0;
        return { x: x + vx * tMin, y: y + vy * tMin };
    }

    performRaikouCharge(r, time) {
        const startX = r.x;
        const startY = r.y;
        const endX = r.aimEndX;
        const endY = r.aimEndY;
        const chargeHitRadius = r.spec.radius;
        for (const player of [this.player1, this.player2]) {
            if (!player || !player.sprite || !player.sprite.active) continue;
            if (!player.canBeHit(time)) continue;
            const dist = this.pointToSegmentDistance(
                player.sprite.x, player.sprite.y,
                startX, startY, endX, endY,
            );
            if (dist <= chargeHitRadius + player.size / 2) {
                player.onHit(time);
                this.hitCount += 1;
                this.updateModeUI();
            }
        }
        const N = r.spec.afterimageCount ?? 5;
        const fadeMs = r.spec.afterimageFadeMs ?? 300;
        for (let i = 1; i <= N; i += 1) {
            const t = i / (N + 1);
            const ax = startX + (endX - startX) * t;
            const ay = startY + (endY - startY) * t;
            const g = this.add.circle(ax, ay, r.spec.radius, r.spec.color);
            g.setDepth(30);
            g.setAlpha(0.5);
            this.raikouAfterimages.push({ sprite: g, expireAt: time + fadeMs, fadeMs });
        }
        r.x = endX;
        r.y = endY;
        this.fireRaikouLightningMissiles(r, time);
        r.chargeCount += 1;
        if (r.chargeCount >= (r.spec.chargesPerCycle ?? 4)) {
            r.chargeCount = 0;
            r.state = 'returning';
            r.stateStartTime = time;
            this.fireWaveMissiles(time);
        } else {
            r.state = 'aiming';
            r.stateStartTime = time;
            r.aimComputed = false;
        }
    }

    renderRaikouOverlays(time) {
        const og = this.raikouOverlayGraphics;
        og.clear();
        const r = this.raikou;
        if (r && r.active && r.state === 'aiming') {
            const spec = r.spec;
            og.lineStyle(spec.radius * 2, spec.warnColor ?? 0xff2222, spec.warnAlpha ?? 0.55);
            og.lineBetween(r.x, r.y, r.aimEndX, r.aimEndY);
        }
        const lg = this.leashGraphics;
        lg.clear();
        if (r && r.active && this.boss && this.boss.sprite && this.boss.sprite.active && this.leashSpec) {
            const ls = this.leashSpec;
            lg.lineStyle(ls.width ?? 2, ls.color ?? 0xcccccc, ls.alpha ?? 0.7);
            lg.lineBetween(this.boss.sprite.x, this.boss.sprite.y, r.x, r.y);
        }
    }

    onRaikouShotLab(raikou, bullet) {
        if (!this.boss || this.boss.isDead()) return;
        const dmg = bullet.damage ?? 1;
        if (bullet.pierce) {
            const time = this.time.now;
            const cd = bullet.contactCooldownMs ?? 0;
            if (time - (bullet.lastHitTargetTime ?? -Infinity) < cd) return;
            bullet.lastHitTargetTime = time;
            this.boss.onHit(dmg);
        } else {
            this.boss.onHit(dmg);
            bullet.destroy();
        }
    }

    onRaikouOrbitHitLab(raikou, orb) {
        if (!this.boss || this.boss.isDead()) return;
        const time = this.time.now;
        if (time - orb.lastHitTargetTime < orb.weaponSpec.contactCooldownMs) return;
        orb.lastHitTargetTime = time;
        this.boss.onHit(orb.weaponSpec.damage);
    }

    onRaikouBodyHitLab(player) {
        if (!player) return;
        const time = this.time.now;
        if (!player.canBeHit(time)) return;
        player.onHit(time);
        this.hitCount += 1;
        this.updateModeUI();
    }

    // ===== 파도미사일 / 번개미사일 =====
    fireWaveMissiles(time) {
        const spec = this.waveMissileSpec;
        if (!spec || !this.boss || !this.boss.sprite) return;
        const N = spec.bulletCount ?? 90;
        const cx = this.boss.sprite.x;
        const cy = this.boss.sprite.y;
        const a = spec.a ?? 100;
        for (let i = 0; i < N; i += 1) {
            const angle = (i / N) * Math.PI * 2;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            const bullet = this.spawnColoredCircleBullet(cx, cy, dx * a, dy * a, spec.radius ?? 6, spec.color ?? 0x66ccff);
            if (!bullet) continue;
            if (spec.strokeColor !== undefined && bullet.setStrokeStyle) {
                bullet.setStrokeStyle(1, spec.strokeColor);
            }
            bullet.isWaveMissile = true;
            bullet.waveDx = dx;
            bullet.waveDy = dy;
            bullet.waveA = a;
            bullet.wavePeriodSec = spec.periodSec ?? 1.0;
            bullet.waveStartTime = time;
            bullet.waveExpireAt = time + (spec.lifespanMs ?? 8000);
            bullet.damage = spec.damage ?? 1;
        }
    }

    updateWaveMissiles(time) {
        this.bossBullets.children.each((b) => {
            if (!b || !b.isWaveMissile || !b.active) return;
            if (time > b.waveExpireAt) { b.destroy(); return; }
            const period = b.wavePeriodSec || 1.0;
            const tSec = (time - b.waveStartTime) / 1000;
            const v = b.waveA * (1 + 2 * Math.sin((2 * Math.PI * tSec) / period));
            b.body.setVelocity(b.waveDx * v, b.waveDy * v);
        });
    }

    fireRaikouLightningMissiles(r, time) {
        const spec = this.lightningMissileSpec;
        if (!spec) return;
        const baseRad = Math.atan2(-r.aimVecY, -r.aimVecX);
        const baseDeg = Phaser.Math.RadToDeg(baseRad);
        const N = spec.bulletCount ?? 5;
        const spread = spec.spreadDeg ?? 60;
        const w = spec.width ?? 8;
        const h = spec.height ?? 14;
        for (let i = 0; i < N; i += 1) {
            let offset = 0;
            if (N > 1) offset = ((i / (N - 1)) - 0.5) * 2 * spread;
            const A = baseDeg + offset;
            const rad = Phaser.Math.DegToRad(A);
            const speed = spec.speed ?? 220;
            const vx = Math.cos(rad) * speed;
            const vy = Math.sin(rad) * speed;
            const bullet = this.add.triangle(
                r.x, r.y,
                0, -h / 2,
                -w / 2, h / 2,
                w / 2, h / 2,
                spec.color ?? 0xffff44,
            );
            if (spec.strokeColor !== undefined && bullet.setStrokeStyle) {
                bullet.setStrokeStyle(1, spec.strokeColor);
            }
            this.physics.add.existing(bullet);
            this.bossBullets.add(bullet);
            bullet.body.setSize(w, h);
            bullet.body.setVelocity(vx, vy);
            bullet.rotation = rad + Math.PI / 2;
            bullet.isLightningMissile = true;
            bullet.isTriangle = true;
            bullet.lightningInitAngleDeg = A;
            bullet.lightningSpeed = speed;
            bullet.lightningRedirectRangeDeg = spec.redirectRangeDeg ?? 30;
            bullet.lightningNextRedirectAt = time + (spec.redirectIntervalMs ?? 100);
            bullet.lightningRedirectIntervalMs = spec.redirectIntervalMs ?? 100;
            bullet.damage = spec.damage ?? 1;
        }
    }

    updateLightningMissiles(time) {
        this.bossBullets.children.each((b) => {
            if (!b || !b.isLightningMissile || !b.active) return;
            if (time >= b.lightningNextRedirectAt) {
                const range = b.lightningRedirectRangeDeg;
                const A = b.lightningInitAngleDeg + (Math.random() * 2 - 1) * range;
                const rad = Phaser.Math.DegToRad(A);
                b.body.setVelocity(
                    Math.cos(rad) * b.lightningSpeed,
                    Math.sin(rad) * b.lightningSpeed,
                );
                b.rotation = rad + Math.PI / 2;
                b.lightningNextRedirectAt = time + b.lightningRedirectIntervalMs;
            }
        });
    }

    // ===== roaring_waves 인터루드 =====
    startRoaringWavesInterlude(spec) {
        this.destroyRaikou();
        const burstSpec = spec.waveBurst ?? {};
        const missile = burstSpec.missile ?? {};
        this.roaringWaves = {
            missile,
            burstsRemaining: burstSpec.count ?? 5,
            nextBurstAt: this.time.now + (burstSpec.delayMs ?? 0),
            intervalMs: burstSpec.intervalMs ?? 200,
        };
        if (spec.entei) this.spawnEntei(spec.entei);
    }

    updateRoaringWaves(time) {
        if (!this.roaringWaves) return;
        while (this.roaringWaves.burstsRemaining > 0 && time >= this.roaringWaves.nextBurstAt) {
            const prevSpec = this.waveMissileSpec;
            this.waveMissileSpec = this.roaringWaves.missile;
            this.fireWaveMissiles(time);
            this.waveMissileSpec = prevSpec;
            this.roaringWaves.burstsRemaining -= 1;
            this.roaringWaves.nextBurstAt += this.roaringWaves.intervalMs;
        }
        if (this.roaringWaves.burstsRemaining <= 0) {
            this.roaringWaves = null;
        }
    }

    // ===== converging_waves 인터루드 (페이즈 2→3) =====
    startConvergingWavesInterlude(spec) {
        this.destroyEntei();
        if (!this.boss || !this.boss.sprite) return;
        const burstSpec = spec.waveBurst ?? {};
        this.convergingWaves = {
            slideStartX: this.boss.sprite.x,
            slideStartY: this.boss.sprite.y,
            slideTargetX: LAB_PLAY_W / 2,
            slideTargetY: LAB_H / 2,
            slideStartTime: this.time.now,
            slideMs: spec.slideMs ?? 3000,
            slideDone: false,
            missile: burstSpec.missile ?? {},
            burstsRemaining: 0,
            burstTotal: burstSpec.count ?? 9,
            nextBurstAt: 0,
            intervalMs: burstSpec.intervalMs ?? 200,
        };
    }

    updateConvergingWaves(time) {
        if (!this.convergingWaves) return;
        if (!this.boss || !this.boss.sprite) return;
        const s = this.convergingWaves;
        if (!s.slideDone) {
            const t = Math.min(1, (time - s.slideStartTime) / s.slideMs);
            this.boss.sprite.x = s.slideStartX + (s.slideTargetX - s.slideStartX) * t;
            this.boss.sprite.y = s.slideStartY + (s.slideTargetY - s.slideStartY) * t;
            if (t >= 1) {
                s.slideDone = true;
                s.burstsRemaining = s.burstTotal;
                s.nextBurstAt = time;
            }
            return;
        }
        while (s.burstsRemaining > 0 && time >= s.nextBurstAt) {
            const prev = this.waveMissileSpec;
            this.waveMissileSpec = s.missile;
            this.fireWaveMissiles(time);
            this.waveMissileSpec = prev;
            s.burstsRemaining -= 1;
            s.nextBurstAt += s.intervalMs;
        }
        if (s.burstsRemaining <= 0) {
            this.convergingWaves = null;
        }
    }

    // ===== 엔테이 =====
    spawnEntei(spec) {
        if (!this.boss || !this.boss.sprite) return;
        const bx = this.boss.sprite.x;
        const by = this.boss.sprite.y;
        const startY = by + (spec.startOffsetY ?? -30);
        const targetY = by + (spec.targetOffsetY ?? 34);
        const e = this.add.circle(bx, startY, spec.radius ?? 18, spec.color ?? 0xff6644);
        e.setStrokeStyle(2, spec.strokeColor ?? 0x883322);
        e.setDepth(30);
        e.setAlpha(spec.startAlpha ?? 0.25);
        this.physics.add.existing(e);
        e.body.setCircle(spec.radius ?? 18);
        e.body.setImmovable(true);
        e.spec = spec;
        e.state = 'entering';
        e.stateStartTime = this.time.now;
        e.entranceStartX = bx;
        e.entranceStartY = startY;
        e.entranceTargetX = bx;
        e.entranceTargetY = targetY;
        this.entei = e;
    }

    destroyEntei() {
        if (this.entei) {
            if (this.entei.active) this.entei.destroy();
            this.entei = null;
        }
    }

    updateEntei(time, delta) {
        if (!this.entei || !this.entei.active) return;
        const e = this.entei;
        const spec = e.spec;
        if (e.state === 'entering') {
            const t = Math.min(1, (time - e.stateStartTime) / (spec.entranceMs ?? 5000));
            e.x = e.entranceStartX + (e.entranceTargetX - e.entranceStartX) * t;
            e.y = e.entranceStartY + (e.entranceTargetY - e.entranceStartY) * t;
            const a0 = spec.startAlpha ?? 0.25;
            const a1 = spec.endAlpha ?? 1.0;
            e.setAlpha(a0 + (a1 - a0) * t);
            if (t >= 1) e.state = 'idle';
        } else if (e.state === 'aiming') {
            if (!e.aimComputed) {
                this.computeEnteiAim(e);
                e.aimComputed = true;
            }
            if (time - e.stateStartTime >= (spec.aimIntervalMs ?? 1000)) {
                this.performEnteiCharge(e, time);
            }
        } else if (e.state === 'flamethrower') {
            if (e.flameShotsFired < (spec.flamesPerCharge ?? 3)) {
                if (time >= e.nextFlameAt) {
                    this.fireFlamethrower(e, time);
                    e.flameShotsFired += 1;
                    e.nextFlameAt = time + (spec.flameIntervalMs ?? 500);
                }
            } else {
                e.flameShotsFired = 0;
                e.chargeCount += 1;
                if (e.chargeCount >= (spec.chargesPerCycle ?? 3)) {
                    e.chargeCount = 0;
                    e.state = 'returning';
                    e.stateStartTime = time;
                    this.fireEnteiWaveMissiles(time, spec.waveMissile);
                } else {
                    e.state = 'aiming';
                    e.stateStartTime = time;
                    e.aimComputed = false;
                }
            }
        } else if (e.state === 'returning') {
            const bx = this.boss.sprite.x;
            const by = this.boss.sprite.y;
            const bossSize = this.boss.data.size ?? 44;
            const tx = bx;
            const ty = by + bossSize / 2 + spec.radius + 6;
            const dx = tx - e.x;
            const dy = ty - e.y;
            const dist = Math.hypot(dx, dy);
            const step = (spec.returnSpeed ?? 250) * (delta / 1000);
            if (dist <= step + 1) {
                e.x = tx;
                e.y = ty;
                e.state = 'aiming';
                e.stateStartTime = time;
                e.aimComputed = false;
            } else {
                e.x += (dx / dist) * step;
                e.y += (dy / dist) * step;
            }
        }
        this.renderEnteiOverlays(time);
    }

    activateEntei() {
        if (!this.entei) return;
        this.entei.state = 'aiming';
        this.entei.stateStartTime = this.time.now;
        this.entei.chargeCount = 0;
        this.entei.flameShotsFired = 0;
        this.entei.aimComputed = false;
        this.entei.aimVecX = 0;
        this.entei.aimVecY = 1;
        this.entei.aimEndX = this.entei.x;
        this.entei.aimEndY = this.entei.y;
        this.entei.setAlpha(1.0);
    }

    computeEnteiAim(e) {
        let p = null;
        if (this.player1 && !this.player1.isInvincible) p = this.player1;
        else if (this.player2 && !this.player2.isInvincible) p = this.player2;
        if (!p) return;
        const dx = p.sprite.x - e.x;
        const dy = p.sprite.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        e.aimVecX = dx / dist;
        e.aimVecY = dy / dist;
        const end = this.enteiWallIntersect(e.x, e.y, e.aimVecX, e.aimVecY, e.spec.radius);
        e.aimEndX = end.x;
        e.aimEndY = end.y;
    }

    enteiWallIntersect(x, y, vx, vy, radius) {
        const W = LAB_PLAY_W;
        const H = LAB_H;
        const EPS = 0.0001;
        const margin = (radius ?? 18) + 2;
        let tMin = Infinity;
        if (vx > EPS) tMin = Math.min(tMin, (W - margin - x) / vx);
        else if (vx < -EPS) tMin = Math.min(tMin, (margin - x) / vx);
        if (vy > EPS) tMin = Math.min(tMin, (H - margin - y) / vy);
        else if (vy < -EPS) tMin = Math.min(tMin, (margin - y) / vy);
        if (!isFinite(tMin) || tMin < 0) tMin = 0;
        return { x: x + vx * tMin, y: y + vy * tMin };
    }

    performEnteiCharge(e, time) {
        const startX = e.x;
        const startY = e.y;
        const endX = e.aimEndX;
        const endY = e.aimEndY;
        const chargeHitRadius = e.spec.radius;
        for (const player of [this.player1, this.player2]) {
            if (!player || !player.sprite || !player.sprite.active) continue;
            if (!player.canBeHit(time)) continue;
            const dist = this.pointToSegmentDistance(
                player.sprite.x, player.sprite.y,
                startX, startY, endX, endY,
            );
            if (dist <= chargeHitRadius + player.size / 2) {
                player.onHit(time);
                this.hitCount += 1;
                this.updateModeUI();
            }
        }
        const N = e.spec.afterimageCount ?? 5;
        const fadeMs = e.spec.afterimageFadeMs ?? 300;
        for (let i = 1; i <= N; i += 1) {
            const t = i / (N + 1);
            const ax = startX + (endX - startX) * t;
            const ay = startY + (endY - startY) * t;
            const g = this.add.circle(ax, ay, e.spec.radius, e.spec.color);
            g.setDepth(30);
            g.setAlpha(0.5);
            this.raikouAfterimages.push({ sprite: g, expireAt: time + fadeMs, fadeMs });
        }
        e.x = endX;
        e.y = endY;
        e.state = 'flamethrower';
        e.stateStartTime = time;
        e.flameShotsFired = 0;
        e.nextFlameAt = time;
    }

    renderEnteiOverlays(time) {
        const og = this.raikouOverlayGraphics;
        if (!og) return;
        og.clear();
        const e = this.entei;
        if (e && e.active && e.state === 'aiming') {
            const spec = e.spec;
            og.lineStyle(spec.radius * 2, spec.warnColor ?? 0xff2222, spec.warnAlpha ?? 0.55);
            og.lineBetween(e.x, e.y, e.aimEndX, e.aimEndY);
        }
    }

    fireFlamethrower(e, time) {
        const spec = e.spec.flamethrower;
        if (!spec) return;
        let p = null;
        if (this.player1 && !this.player1.isInvincible) p = this.player1;
        else if (this.player2 && !this.player2.isInvincible) p = this.player2;
        let baseRad;
        if (p) baseRad = Math.atan2(p.sprite.y - e.y, p.sprite.x - e.x);
        else baseRad = Math.PI / 2;
        const baseDeg = Phaser.Math.RadToDeg(baseRad);
        const N = spec.bulletCount ?? 30;
        const spread = spec.spreadDeg ?? 15;
        const a = spec.a ?? 120;
        for (let i = 0; i < N; i += 1) {
            const angle = baseDeg + (Math.random() * 2 - 1) * spread;
            const rad = Phaser.Math.DegToRad(angle);
            const speed = a + Math.random() * 2 * a;
            const vx = Math.cos(rad) * speed;
            const vy = Math.sin(rad) * speed;
            const bullet = this.spawnColoredCircleBullet(
                e.x, e.y, vx, vy,
                spec.radius ?? 5, spec.color ?? 0xff6644,
            );
            if (!bullet) continue;
            if (spec.strokeColor !== undefined && bullet.setStrokeStyle) {
                bullet.setStrokeStyle(1, spec.strokeColor);
            }
            bullet.damage = spec.damage ?? 1;
        }
    }

    fireEnteiWaveMissiles(time, waveSpec) {
        if (!waveSpec) return;
        const prev = this.waveMissileSpec;
        this.waveMissileSpec = waveSpec;
        this.fireWaveMissiles(time);
        this.waveMissileSpec = prev;
    }

    // 페이즈 2/3 진입 훅 (Boss.enterPhase에서 호출)
    enterEnteiStubPhase() {
        this.destroyRaikou();
        if (!this.entei) {
            // 인터루드 없이 페이즈 2 직행 시 엔테이 스폰 위해 인터루드 스펙에서 참조
            const enteiSpec = this.bossData.interludes?.find((i) => i.spec?.entei)?.spec?.entei;
            if (enteiSpec) this.spawnEntei(enteiSpec);
        }
        this.activateEntei();
    }

    // ===== 페이즈 3 (스이쿤 단독) — GameScene 미러 =====
    enterSuicunePhase3(spec) {
        this.destroyRaikou();
        this.destroyEntei();
        this.suicunePhase3Spec = spec;
        if (!this.suicuneOverlayGraphics) {
            this.suicuneOverlayGraphics = this.add.graphics();
            this.suicuneOverlayGraphics.setDepth(30);
        }
        this.suicunePhase3State = {
            stage: 'aim',
            stateStartTime: this.time.now,
            aimComputed: false,
            aimVecX: 0, aimVecY: 1,
            aimEndX: this.boss.sprite.x, aimEndY: this.boss.sprite.y,
            subCycleCount: 0,
            waterShots: [],
            waterAimStarted: 0,
            waterFired: 0,
            waterBeams: [],
            grandBurstRemaining: 0,
            grandNextBurstAt: 0,
            returnTargetX: 0, returnTargetY: 0,
        };
    }

    updateSuicunePhase3(time, delta) {
        if (!this.suicunePhase3State || !this.suicunePhase3Spec) return;
        if (!this.boss || this.boss.isDead()) return;
        const s = this.suicunePhase3State;
        const spec = this.suicunePhase3Spec;
        const b = this.boss.sprite;

        if (s.stage === 'aim') {
            if (!s.aimComputed) {
                let p = null;
                if (this.player1 && !this.player1.isInvincible) p = this.player1;
                else if (this.player2 && !this.player2.isInvincible) p = this.player2;
                if (p) {
                    const dx = p.sprite.x - b.x;
                    const dy = p.sprite.y - b.y;
                    const dist = Math.hypot(dx, dy) || 1;
                    s.aimVecX = dx / dist;
                    s.aimVecY = dy / dist;
                    const end = this.enteiWallIntersect(b.x, b.y, s.aimVecX, s.aimVecY, spec.bodySize / 2);
                    s.aimEndX = end.x;
                    s.aimEndY = end.y;
                    s.aimComputed = true;
                }
            }
            if (time - s.stateStartTime >= (spec.aimIntervalMs ?? 1000)) {
                this.performSuicuneCharge(time, s.aimEndX, s.aimEndY, spec);
                this.fireEnteiWaveMissiles(time, spec.waveMissile);
                s.stage = 'water';
                s.stateStartTime = time;
                s.waterAimStarted = 0;
                s.waterFired = 0;
                s.waterShots = [];
            }
        } else if (s.stage === 'water') {
            const wc = spec.waterCannon;
            const targetCount = wc?.count ?? 3;
            while (s.waterAimStarted < targetCount) {
                const dueAt = s.stateStartTime + s.waterAimStarted * (wc.aimStartIntervalMs ?? 500);
                if (time < dueAt) break;
                const shot = this.createSuicuneWaterCannonShot(dueAt, spec);
                if (!shot) break;
                s.waterShots.push(shot);
                s.waterAimStarted += 1;
            }
            for (const shot of s.waterShots) {
                if (shot.fired) continue;
                if (time >= shot.fireAt) {
                    this.fireSuicuneWaterCannon(shot, spec, time);
                    s.waterBeams.push({
                        originX: shot.originX, originY: shot.originY,
                        endX: shot.endX, endY: shot.endY,
                        startTime: time,
                        expireAt: time + (wc.beamAfterMs ?? 260),
                    });
                    shot.fired = true;
                    s.waterFired += 1;
                }
            }
            if (s.waterAimStarted >= targetCount && s.waterFired >= targetCount) {
                s.subCycleCount += 1;
                if (s.subCycleCount >= (spec.subCyclesPerGrand ?? 3)) {
                    s.subCycleCount = 0;
                    s.stage = 'grandAim';
                    s.stateStartTime = time;
                    const cx = GameConfig.GAME_WIDTH / 2;
                    const cy = GameConfig.GAME_HEIGHT / 2;
                    const dx = cx - b.x;
                    const dy = cy - b.y;
                    const dist = Math.hypot(dx, dy) || 1;
                    s.aimVecX = dx / dist;
                    s.aimVecY = dy / dist;
                    s.aimEndX = cx;
                    s.aimEndY = cy;
                    s.aimComputed = true;
                } else {
                    s.stage = 'aim';
                    s.stateStartTime = time;
                    s.aimComputed = false;
                }
            }
        } else if (s.stage === 'grandAim') {
            const grand = spec.grand ?? {};
            if (time - s.stateStartTime >= (grand.aimIntervalMs ?? spec.aimIntervalMs ?? 1000)) {
                const grandSpec = {
                    bodySize: spec.bodySize,
                    color: spec.color,
                    afterimageCount: grand.afterimageCount ?? spec.afterimageCount,
                    afterimageFadeMs: grand.afterimageFadeMs ?? spec.afterimageFadeMs,
                };
                this.performSuicuneCharge(time, s.aimEndX, s.aimEndY, grandSpec);
                s.stage = 'grandWave';
                s.stateStartTime = time;
                s.grandBurstRemaining = grand.waveBurst?.count ?? 9;
                s.grandNextBurstAt = time;
            }
        } else if (s.stage === 'grandWave') {
            const grand = spec.grand ?? {};
            const interval = grand.waveBurst?.intervalMs ?? 200;
            while (s.grandBurstRemaining > 0 && time >= s.grandNextBurstAt) {
                this.fireEnteiWaveMissiles(time, spec.waveMissile);
                s.grandBurstRemaining -= 1;
                s.grandNextBurstAt += interval;
            }
            if (s.grandBurstRemaining <= 0) {
                s.stage = 'return';
                s.returnTargetX = GameConfig.GAME_WIDTH / 2;
                s.returnTargetY = this.boss.data.startY ?? 140;
            }
        } else if (s.stage === 'return') {
            const grand = spec.grand ?? {};
            const dx = s.returnTargetX - b.x;
            const dy = s.returnTargetY - b.y;
            const dist = Math.hypot(dx, dy);
            const step = (grand.returnSpeed ?? 180) * (delta / 1000);
            if (dist <= step + 1) {
                b.x = s.returnTargetX;
                b.y = s.returnTargetY;
                s.stage = 'aim';
                s.stateStartTime = time;
                s.aimComputed = false;
            } else {
                b.x += (dx / dist) * step;
                b.y += (dy / dist) * step;
            }
        }
        this.renderSuicunePhase3Overlay();
    }

    performSuicuneCharge(time, endX, endY, spec) {
        const b = this.boss.sprite;
        const startX = b.x;
        const startY = b.y;
        const halfBody = (spec.bodySize ?? 44) / 2;
        for (const player of [this.player1, this.player2]) {
            if (!player || !player.sprite || !player.sprite.active) continue;
            if (!player.canBeHit(time)) continue;
            const dist = this.pointToSegmentDistance(
                player.sprite.x, player.sprite.y,
                startX, startY, endX, endY,
            );
            if (dist <= halfBody + player.size / 2) {
                player.onHit(time);
                this.hitCount += 1;
                this.updateModeUI();
            }
        }
        const N = spec.afterimageCount ?? 5;
        const fadeMs = spec.afterimageFadeMs ?? 300;
        for (let i = 1; i <= N; i += 1) {
            const t = i / (N + 1);
            const ax = startX + (endX - startX) * t;
            const ay = startY + (endY - startY) * t;
            const g = this.add.rectangle(ax, ay, spec.bodySize, spec.bodySize, spec.color ?? 0x88aacc);
            g.setDepth(30);
            g.setAlpha(0.5);
            this.raikouAfterimages.push({ sprite: g, expireAt: time + fadeMs, fadeMs });
        }
        b.x = endX;
        b.y = endY;
    }

    createSuicuneWaterCannonShot(aimStartTime, spec) {
        const b = this.boss.sprite;
        let p = null;
        if (this.player1 && !this.player1.isInvincible) p = this.player1;
        else if (this.player2 && !this.player2.isInvincible) p = this.player2;
        if (!p) return null;
        const dx = p.sprite.x - b.x;
        const dy = p.sprite.y - b.y;
        const dist = Math.hypot(dx, dy) || 1;
        const vx = dx / dist;
        const vy = dy / dist;
        const end = this.enteiWallIntersect(b.x, b.y, vx, vy, 0);
        return {
            originX: b.x, originY: b.y,
            endX: end.x, endY: end.y,
            fireAt: aimStartTime + (spec.waterCannon?.fuseMs ?? 500),
            fired: false,
        };
    }

    fireSuicuneWaterCannon(shot, spec, time) {
        const wc = spec.waterCannon ?? {};
        const halfW = (wc.beamWidth ?? 24) / 2;
        for (const player of [this.player1, this.player2]) {
            if (!player || !player.sprite || !player.sprite.active) continue;
            if (!player.canBeHit(time)) continue;
            const dist = this.pointToSegmentDistance(
                player.sprite.x, player.sprite.y,
                shot.originX, shot.originY, shot.endX, shot.endY,
            );
            if (dist <= halfW + player.size / 2) {
                player.onHit(time);
                this.hitCount += 1;
                this.updateModeUI();
            }
        }
        this.spawnSuicuneWaterDroplets(shot.endX, shot.endY, wc.droplet);
    }

    spawnSuicuneWaterDroplets(x, y, spec) {
        if (!spec) return;
        const W = GameConfig.GAME_WIDTH;
        const H = GameConfig.GAME_HEIGHT;
        const dLeft = x;
        const dRight = W - x;
        const dTop = y;
        const dBottom = H - y;
        const dMin = Math.min(dLeft, dRight, dTop, dBottom);
        let nx = 0, ny = 0;
        if (dMin === dLeft) nx = 1;
        else if (dMin === dRight) nx = -1;
        else if (dMin === dTop) ny = 1;
        else ny = -1;
        const baseDeg = Phaser.Math.RadToDeg(Math.atan2(ny, nx));
        const N = spec.bulletCount ?? 6;
        const spread = spec.spreadDeg ?? 90;
        const sMin = spec.speedMin ?? 200;
        const sMax = spec.speedMax ?? 320;
        for (let i = 0; i < N; i += 1) {
            const t = N > 1 ? (i / (N - 1)) - 0.5 : 0;
            const angleDeg = baseDeg + t * 2 * spread;
            const rad = Phaser.Math.DegToRad(angleDeg);
            const speed = sMin + Math.random() * (sMax - sMin);
            const vx = Math.cos(rad) * speed;
            const vy = Math.sin(rad) * speed;
            const bullet = this.spawnColoredCircleBullet(
                x, y, vx, vy,
                spec.radius ?? 4, spec.color ?? 0xaaddff,
            );
            if (!bullet) continue;
            if (spec.strokeColor !== undefined && bullet.setStrokeStyle) {
                bullet.setStrokeStyle(1, spec.strokeColor);
            }
            bullet.damage = spec.damage ?? 1;
        }
    }

    renderSuicunePhase3Overlay() {
        const og = this.suicuneOverlayGraphics;
        if (!og) return;
        og.clear();
        const s = this.suicunePhase3State;
        const spec = this.suicunePhase3Spec;
        if (!s || !spec || !this.boss || !this.boss.sprite) return;
        const b = this.boss.sprite;
        const wc = spec.waterCannon ?? {};
        if (s.stage === 'aim') {
            og.lineStyle(spec.bodySize ?? 44, spec.warnColor ?? 0xff2222, spec.warnAlpha ?? 0.55);
            og.lineBetween(b.x, b.y, s.aimEndX, s.aimEndY);
        } else if (s.stage === 'grandAim') {
            const grand = spec.grand ?? {};
            og.lineStyle(spec.bodySize ?? 44, grand.warnColor ?? spec.warnColor ?? 0xff2222, grand.warnAlpha ?? spec.warnAlpha ?? 0.55);
            og.lineBetween(b.x, b.y, s.aimEndX, s.aimEndY);
        } else if (s.stage === 'water') {
            og.lineStyle(wc.beamWidth ?? 24, wc.warnColor ?? 0x44aaff, wc.warnAlpha ?? 0.55);
            for (const shot of s.waterShots) {
                if (shot.fired) continue;
                og.lineBetween(shot.originX, shot.originY, shot.endX, shot.endY);
            }
        }
        // 워터빔 잔상 (stage 무관, 발사 후 hold → fade)
        if (s.waterBeams && s.waterBeams.length > 0) {
            const now = this.time.now;
            s.waterBeams = s.waterBeams.filter((beam) => now < beam.expireAt);
            const beamW = wc.beamAfterWidth ?? Math.round((wc.beamWidth ?? 24) * 1.5);
            const beamColor = wc.beamAfterColor ?? 0x88ccff;
            const holdMs = wc.beamAfterHoldMs ?? 0;
            for (const beam of s.waterBeams) {
                const totalMs = beam.expireAt - beam.startTime;
                const age = now - beam.startTime;
                let alpha;
                if (age < holdMs) {
                    alpha = 1.0;
                } else {
                    const fadeAge = age - holdMs;
                    const fadeMs = Math.max(1, totalMs - holdMs);
                    alpha = Math.max(0, Math.min(1, 1 - fadeAge / fadeMs));
                }
                og.lineStyle(beamW, beamColor, alpha);
                og.lineBetween(beam.originX, beam.originY, beam.endX, beam.endY);
            }
        }
    }

    destroySuicunePhase3() {
        this.suicunePhase3Spec = null;
        this.suicunePhase3State = null;
        if (this.suicuneOverlayGraphics) this.suicuneOverlayGraphics.clear();
    }
}
