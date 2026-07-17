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
            '🎯 유도 미사일',
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
    }

    despawnPlayers() {
        for (const ov of [this.overlap1, this.overlap2, this.snowflakeOverlap1, this.snowflakeOverlap2]) {
            if (ov) ov.destroy();
        }
        this.overlap1 = null;
        this.overlap2 = null;
        this.snowflakeOverlap1 = null;
        this.snowflakeOverlap2 = null;
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
        if (!bullet.isBlade && !bullet.isOrbCarrier) bullet.destroy();
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
}
