class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        const upgrades = this.registry.get('upgrades') || {};
        this.maxLives = Upgrades.maxLives.applied(upgrades.maxLives ?? 0);
        this.lives = this.maxLives;
        this.gameOver = false;
        this.cleared = false;
        this.clearAdvanceAt = null;

        const KC = Phaser.Input.Keyboard.KeyCodes;
        const keys1 = this.input.keyboard.addKeys({
            up: KC.W, down: KC.S, left: KC.A, right: KC.D,
        });
        const keys2 = this.input.keyboard.addKeys({
            up: KC.I, down: KC.K, left: KC.J, right: KC.L,
        });
        this.swapKey = this.input.keyboard.addKey(KC.SPACE);
        this.restartKey = this.input.keyboard.addKey(KC.ENTER);
        this.escKey = this.input.keyboard.addKey(KC.ESC);

        this.playerBullets = this.physics.add.group();
        this.bossBullets = this.physics.add.group();
        this.orbitOrbs = this.physics.add.group();
        this.snowflakesGroup = this.physics.add.group();
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
        this.birdEmitterSpec = null;
        this.birdEmitters = [];
        this.birdActivateLastTime = 0;
        this.birdCenterFireTime = null;
        this.clouds = [];
        this.cloudSpec = null;
        this.currentInterlude = null;
        this.interludeStartTime = 0;
        this.interludeFrozen = false;

        const loadout = this.registry.get('loadout') || {
            p1: [null, null, null, null], p2: [null, null, null, null],
        };
        const weaponLevels = this.registry.get('weaponLevels') || {};

        const bottomY = GameConfig.GAME_HEIGHT - 100;
        this.player1 = new Player(
            this,
            GameConfig.GAME_WIDTH * 0.35, bottomY,
            keys1, GameConfig.PLAYER_1_COLOR, false,
            loadout.p1, weaponLevels, upgrades
        );
        this.player2 = new Player(
            this,
            GameConfig.GAME_WIDTH * 0.65, bottomY,
            keys2, GameConfig.PLAYER_2_COLOR, true,
            loadout.p2, weaponLevels, upgrades
        );

        const selected = this.registry.get('selectedStage');
        const stageIdx = (typeof selected === 'number') ? selected : 0;
        const clampedStage = Math.max(0, Math.min(stageIdx, Stages.length - 1));
        this.stageIndex = clampedStage;
        const selectedLevel = this.registry.get('selectedLevel') ?? 1;
        this.bossLevel = Math.max(1, Math.min(selectedLevel, MAX_WEAPON_LEVEL));
        this.boss = new Boss(this, Stages[clampedStage], this.bossLevel);

        this.physics.add.overlap(
            this.player1.sprite, this.bossBullets,
            (s, b) => this.onPlayerHit(this.player1, b)
        );
        this.physics.add.overlap(
            this.player2.sprite, this.bossBullets,
            (s, b) => this.onPlayerHit(this.player2, b)
        );
        this.physics.add.overlap(
            this.player1.sprite, this.snowflakesGroup,
            (s, b) => this.onPlayerHit(this.player1, b)
        );
        this.physics.add.overlap(
            this.player2.sprite, this.snowflakesGroup,
            (s, b) => this.onPlayerHit(this.player2, b)
        );
        this.physics.add.overlap(
            this.boss.sprite, this.playerBullets,
            (bossSprite, bullet) => this.onBossHit(bullet)
        );
        this.physics.add.overlap(
            this.player1.sprite, this.boss.sprite,
            () => this.onBossBodyHit(this.player1)
        );
        this.physics.add.overlap(
            this.player2.sprite, this.boss.sprite,
            () => this.onBossBodyHit(this.player2)
        );
        this.physics.add.overlap(
            this.boss.sprite, this.orbitOrbs,
            (bossSprite, orb) => this.onBossOrbitHit(orb)
        );
        this.physics.add.overlap(
            this.turretsGroup, this.playerBullets,
            (t, b) => this.onTurretHit(t, b)
        );
        this.physics.add.overlap(
            this.turretsGroup, this.orbitOrbs,
            (t, o) => this.onTurretOrbitHit(t, o)
        );
        this.physics.add.overlap(
            this.player1.sprite, this.suicideDronesGroup,
            (p, d) => this.onDroneHitPlayer(this.player1, d)
        );
        this.physics.add.overlap(
            this.player2.sprite, this.suicideDronesGroup,
            (p, d) => this.onDroneHitPlayer(this.player2, d)
        );
        this.physics.add.overlap(
            this.suicideDronesGroup, this.playerBullets,
            (d, b) => this.onDroneShot(d, b)
        );
        this.physics.add.overlap(
            this.suicideDronesGroup, this.orbitOrbs,
            (d, o) => this.onDroneOrbitHit(d, o)
        );
        this.physics.add.overlap(
            this.player1.sprite, this.harvesterDronesGroup,
            (p, d) => this.onHarvesterHitPlayer(this.player1, d)
        );
        this.physics.add.overlap(
            this.player2.sprite, this.harvesterDronesGroup,
            (p, d) => this.onHarvesterHitPlayer(this.player2, d)
        );
        this.physics.add.overlap(
            this.harvesterDronesGroup, this.playerBullets,
            (d, b) => this.onHarvesterShot(d, b)
        );
        this.physics.add.overlap(
            this.harvesterDronesGroup, this.orbitOrbs,
            (d, o) => this.onHarvesterOrbitHit(d, o)
        );
        this.physics.add.overlap(
            this.harvesterDronesGroup, this.bossBullets,
            (d, b) => this.onHarvesterTouchBossBullet(d, b)
        );

        this.uiLives = this.add.text(10, 10, '', {
            fontSize: '18px', color: '#ffffff',
        });
        this.uiBossName = this.add.text(
            GameConfig.GAME_WIDTH / 2, 12,
            `${this.boss.data.name}  Lv${this.bossLevel}`,
            { fontSize: '14px', color: '#ffddff' }
        ).setOrigin(0.5, 0);

        this.uiHpBarBg = this.add.rectangle(
            GameConfig.GAME_WIDTH / 2, 40,
            GameConfig.GAME_WIDTH - 40, 8,
            0x333344
        );
        this.uiHpBar = this.add.rectangle(
            20, 40,
            GameConfig.GAME_WIDTH - 40, 8,
            0xff6688
        ).setOrigin(0, 0.5);

        this.uiMessage = this.add.text(
            GameConfig.GAME_WIDTH / 2, GameConfig.GAME_HEIGHT / 2, '',
            { fontSize: '28px', color: '#ff8888', align: 'center' }
        ).setOrigin(0.5);

        this.add.text(10, GameConfig.GAME_HEIGHT - 22, 'ESC: 메뉴로', {
            fontSize: '12px', color: '#666677',
        });

        this.updateUI();

        this.dangerMap = new DangerMap(this, {});
        this.dangerToggleKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
        this.botToggleKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
        this.botMode = false;
        this.botOriginalKeys1 = null;
        this.botOriginalKeys2 = null;
        this.bot1 = null;
        this.bot2 = null;
        this.botLastSwapTime = 0;
        this.botSwapCooldownMs = 300;
        this.botUI = this.add.text(GameConfig.GAME_WIDTH - 10, 10, '', {
            fontSize: '11px', color: '#88ffcc', align: 'right',
        }).setOrigin(1, 0);
        this.botSwapCount = 0;
        this.botLog = [];
        this.botLogMaxFrames = 300; // 약 5초 (60fps 기준)
        this.botDumped = false;
        this.botLogger = (typeof window !== 'undefined' && window.__botLoggerInstance)
            ? window.__botLoggerInstance
            : new BotLogger();
    }

    update(time, delta) {
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.scene.start('BootScene');
            return;
        }
        if (this.dangerToggleKey && Phaser.Input.Keyboard.JustDown(this.dangerToggleKey)) {
            this.dangerMap.toggle();
        }
        if (this.botToggleKey && Phaser.Input.Keyboard.JustDown(this.botToggleKey)) {
            this.toggleBotMode();
        }
        if (this.dangerMap && (this.botMode || this.dangerMap.visible)) {
            const staticHazards = [];
            if (this.boss && this.boss.sprite && this.boss.sprite.active) {
                staticHazards.push({
                    x: this.boss.sprite.x,
                    y: this.boss.sprite.y,
                    radius: (this.boss.data.size ?? 70) / 2 + 20,
                    arrivalTime: 0,
                });
            }
            this.turretsGroup.children.each((t) => {
                if (t && t.active && t.hp > 0) {
                    staticHazards.push({
                        x: t.x,
                        y: t.y,
                        radius: 70,
                        arrivalTime: 200,
                    });
                }
            });
            // 드론: velocity 기반 미래 위치를 시점별 정적 위험으로 마킹.
            // 지금 위치는 baseArrival(반응 여유)로 표시 → 봇이 즉시 밀려나지 않고 방향 판단.
            const droneTimeSamples = [0, 80, 160, 240, 320, 480, 640];
            const pushDroneHazards = (d, radiusPadding, baseArrivalByState) => {
                if (!d || !d.active || !d.body) return;
                const r = (d.body.radius ?? 14) + radiusPadding;
                const baseArrival = baseArrivalByState[d.state] ?? baseArrivalByState.default;
                // orbiting 상태는 원운동으로 미래 위치 예측 (velocity가 접선이라 직선 예측 부정확).
                const isOrbiting = d.state === 'orbiting'
                    && typeof d.phi === 'number'
                    && typeof d.orbitRadius === 'number'
                    && typeof d.orbitSpeed === 'number'
                    && typeof d.orbitCenterX === 'number'
                    && typeof d.orbitCenterY === 'number';
                const vx = d.body.velocity.x;
                const vy = d.body.velocity.y;
                for (const t of droneTimeSamples) {
                    const s = t / 1000;
                    let fx;
                    let fy;
                    if (isOrbiting) {
                        const futurePhi = d.phi + d.orbitSpeed * s;
                        fx = d.orbitCenterX + Math.cos(futurePhi) * d.orbitRadius;
                        fy = d.orbitCenterY + Math.sin(futurePhi) * d.orbitRadius;
                    } else {
                        fx = d.x + vx * s;
                        fy = d.y + vy * s;
                    }
                    staticHazards.push({
                        x: fx,
                        y: fy,
                        radius: r,
                        arrivalTime: Math.max(t, baseArrival),
                    });
                }
            };
            this.suicideDronesGroup.children.each((d) => {
                pushDroneHazards(d, 15, {
                    charging: 60,
                    approaching: 120,
                    orbiting: 200,
                    paused: 200,
                    default: 250,
                });
            });
            this.harvesterDronesGroup.children.each((d) => {
                pushDroneHazards(d, 15, {
                    descending: 120,
                    wallRiding: 200,
                    carrying: 100,
                    default: 250,
                });
            });
            // 포탑 연결선(페이즈 3): 살아있는 포탑 완전그래프 세그먼트를 위험선으로
            const lineHazards = [];
            if (this.turretConnectionsSpec) {
                const turrets = [];
                this.turretsGroup.children.each((t) => {
                    if (t && t.active && t.hp > 0) turrets.push(t);
                });
                if (turrets.length >= 2) {
                    const threshold = this.turretConnectionsSpec.damageThreshold ?? 8;
                    const lineRadius = threshold + 20;
                    const lineArrival = 150;
                    for (let i = 0; i < turrets.length; i += 1) {
                        for (let j = i + 1; j < turrets.length; j += 1) {
                            lineHazards.push({
                                x1: turrets[i].x, y1: turrets[i].y,
                                x2: turrets[j].x, y2: turrets[j].y,
                                radius: lineRadius, arrivalTime: lineArrival,
                            });
                        }
                    }
                }
            }
            this.dangerMap.update(
                [this.bossBullets, this.snowflakesGroup],
                time,
                staticHazards,
                lineHazards,
            );
        }
        if (this.botMode && this.bot1 && this.bot2) {
            this.bot1.update(time, delta);
            this.bot2.update(time, delta);
            this.tryBotSwap(time);
            this.updateBotUI();
            this.logBotFrame(time);
        }

        if (this.cleared) {
            if (this.botMode && !this.botDumped) {
                this.dumpBotLog(time, 'win');
                this.botDumped = true;
            }
            if (this.clearAdvanceAt !== null && time >= this.clearAdvanceAt) {
                this.scene.start('BossSelectScene');
                return;
            }
            if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
                this.scene.start('BossSelectScene');
            }
            return;
        }
        if (this.gameOver) {
            if (this.botMode && !this.botDumped) {
                this.dumpBotLog(time, 'lose');
                this.botDumped = true;
            }
            if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
                this.scene.start('BossSelectScene');
            }
            return;
        }

        this.player1.update(time);
        this.player2.update(time);
        this.boss.update(time, delta);

        if (Phaser.Input.Keyboard.JustDown(this.swapKey)) {
            this.doSwap();
        }

        this.updateBirdEmitters(time, delta);
        this.updateWavyBullets(time);
        this.updateInterludeCycle(time);
        this.updateSnowflakes(delta);
        this.updateClouds(time, delta);
        this.updateBossBulletSideMotion();
        this.updateBladeMissiles(time);
        this.updateDeceleratingBullets(delta);
        this.updateOrbCarriers(time, delta);
        this.updateHomingBullets(delta);
        this.updateSeekingMissiles(delta);
        this.updateEndpointDecelSpiral();
        this.updateTurretSpawner(time);
        this.updateTurrets(time, delta);
        this.updateGears(delta);
        this.updateSuicideDroneSpawner(time);
        this.updateSuicideDrones(time, delta);
        this.updateHarvesterDrones(time, delta);
        this.updateTurretConnections(time);

        this.playerBullets.children.each((b) => {
            if (!b) return;
            if (b.y < -30 || b.y > GameConfig.GAME_HEIGHT + 30 ||
                b.x < -30 || b.x > GameConfig.GAME_WIDTH + 30) {
                b.destroy();
            }
        });
        this.bossBullets.children.each((b) => {
            if (!b) return;
            if (b.y > GameConfig.GAME_HEIGHT + 300 || b.y < -300 ||
                b.x < -300 || b.x > GameConfig.GAME_WIDTH + 300) {
                b.destroy();
            }
        });
        this.snowflakesGroup.children.each((s) => {
            if (!s) return;
            if (s.y > GameConfig.GAME_HEIGHT + 300 || s.y < -300 ||
                s.x < -300 || s.x > GameConfig.GAME_WIDTH + 300) {
                s.destroy();
            }
        });

        this.updateHpBar();

        if (this.boss.isDead() && !this.cleared) {
            this.onBossDefeated();
        }
    }

    updateHomingBullets(delta) {
        if (!this.boss || this.boss.isDead()) return;
        const tx = this.boss.sprite.x;
        const ty = this.boss.sprite.y;
        const dtSec = delta / 1000;
        this.playerBullets.children.each((b) => {
            if (!b || !b.isHoming) return;
            b.bulletSpeed += (b.accel ?? 0) * dtSec;
            const currentAngle = Math.atan2(b.body.velocity.y, b.body.velocity.x);
            const targetAngle = Math.atan2(ty - b.y, tx - b.x);
            let diff = targetAngle - currentAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const maxTurn = Phaser.Math.DegToRad(b.turnRateDegPerSec) * dtSec;
            const turn = Phaser.Math.Clamp(diff, -maxTurn, maxTurn);
            const newAngle = currentAngle + turn;
            const speed = b.bulletSpeed;
            b.body.setVelocity(Math.cos(newAngle) * speed, Math.sin(newAngle) * speed);
        });
    }

    doSwap() {
        const p1Was = this.player1.isInvincible;
        this.player1.setInvincible(this.player2.isInvincible);
        this.player2.setInvincible(p1Was);
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

    fireDecelSpiralBurst(cfg, angularSign) {
        const originX = this.boss.sprite.x;
        const originY = this.boss.sprite.y;
        const count = cfg.count ?? 5;
        const spreadDeg = cfg.spreadDeg ?? 15;
        const centerAngleDeg = cfg.centerAngleDeg ?? 90;
        const initSpeed = cfg.initSpeed ?? 180;
        const initAngularRate = cfg.initAngularRate ?? 0;
        const speedAccel = cfg.speedAccel ?? -80;
        const angularAccel = (cfg.angularAccelMagnitude ?? 0.3) * angularSign;
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
        const phase = this.boss.data.phases[this.boss.phaseIndex];
        if (!phase || !phase.endpointDecelSpiral) {
            this.endpointState = null;
            return;
        }
        const cfg = phase.endpointDecelSpiral;
        if (!this.endpointState || this.endpointState.phaseIndex !== this.boss.phaseIndex) {
            this.endpointState = {
                phaseIndex: this.boss.phaseIndex,
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
                const isLeftSide = st.prevX < GameConfig.GAME_WIDTH / 2;
                const angularSign = isLeftSide ? 1 : -1;
                this.fireDecelSpiralBurst(cfg, angularSign);
            }
        }
        if (currDir !== 0) st.direction = currDir;
        st.prevX = currentX;
    }

    spawnPlayerLinearBullet(x, y, w) {
        const b = this.add.rectangle(x, y, w.width, w.height, w.color);
        this.physics.add.existing(b);
        this.playerBullets.add(b);
        b.body.setVelocityY(-w.bulletSpeed);
        b.damage = w.damage;
        b.pierce = w.pierce;
        b.contactCooldownMs = w.contactCooldownMs ?? 0;
        b.lastHitTargetTime = -Infinity;
    }

    spawnPlayerAngledBullet(x, y, angleDeg, w) {
        const b = this.add.rectangle(x, y, w.width, w.height, w.color);
        this.physics.add.existing(b);
        this.playerBullets.add(b);
        const rad = Phaser.Math.DegToRad(angleDeg);
        b.body.setVelocity(Math.cos(rad) * w.bulletSpeed, Math.sin(rad) * w.bulletSpeed);
        b.rotation = rad + Math.PI / 2;
        b.damage = w.damage;
        b.pierce = w.pierce;
        b.contactCooldownMs = w.contactCooldownMs ?? 0;
        b.lastHitTargetTime = -Infinity;
    }

    spawnPlayerHomingBullet(x, y, w) {
        const b = this.add.circle(x, y, w.radius, w.color);
        this.physics.add.existing(b);
        b.body.setCircle(w.radius);
        this.playerBullets.add(b);
        b.body.setVelocity(0, -w.bulletSpeed);
        b.damage = w.damage;
        b.pierce = w.pierce;
        b.contactCooldownMs = w.contactCooldownMs ?? 0;
        b.lastHitTargetTime = -Infinity;
        b.isHoming = true;
        b.turnRateDegPerSec = w.turnRateDegPerSec;
        b.bulletSpeed = w.bulletSpeed;
        b.accel = w.accel ?? 0;
    }

    spawnBossBullet(x, y, vx, vy) {
        const b = this.add.circle(
            x, y,
            GameConfig.ENEMY_BULLET_RADIUS,
            GameConfig.ENEMY_BULLET_COLOR
        );
        this.physics.add.existing(b);
        this.bossBullets.add(b);
        b.body.setCircle(GameConfig.ENEMY_BULLET_RADIUS);
        b.body.setVelocity(vx, vy);
        return b;
    }

    spawnColoredCircleBullet(x, y, vx, vy, radius, color) {
        const b = this.add.circle(x, y, radius, color);
        this.physics.add.existing(b);
        this.bossBullets.add(b);
        b.body.setCircle(radius);
        b.body.setVelocity(vx, vy);
        return b;
    }

    getActivePlayerPos() {
        const candidates = [this.player1, this.player2].filter((p) => p);
        const active = candidates.find((p) => !p.isInvincible);
        if (active) return { x: active.sprite.x, y: active.sprite.y };
        return { x: GameConfig.GAME_WIDTH / 2, y: GameConfig.GAME_HEIGHT * 0.625 };
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

            if (e.x < -20 || e.x > GameConfig.GAME_WIDTH + 20 ||
                e.y < -20 || e.y > GameConfig.GAME_HEIGHT + 20) {
                this.birdEmitters.splice(i, 1);
            }
        }
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

    spawnBladeMissile(x, y, vx, vy, angleDeg, spec) {
        const w = spec.bladeWidth ?? 10;
        const h = spec.bladeHeight ?? 30;
        const color = spec.bladeColor ?? 0x77bbee;
        // 양수 vertex 로 shift → Phaser 가 정확한 displayOrigin 을 잡음 → sprite.x/y = visual center
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
            if (c.sprite.x - c.w / 2 >= GameConfig.GAME_WIDTH) {
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

    triggerInterlude(name) {
        const inter = (this.boss.data.interludes ?? []).find((i) => i.name === name);
        if (!inter) return;
        if (inter.spec.type === 'birdEmitter') {
            this.spawnBirdEmitters(inter.spec);
            return;
        }
        if (inter.spec.type === 'electricField') {
            this.spawnElectricField(inter.spec.field);
            const count = inter.spec.turretsToSpawn ?? 3;
            for (let i = 0; i < count; i += 1) {
                if (this.turretSpawnerSpec) this.spawnTurretRandom(this.turretSpawnerSpec);
            }
            this.currentInterlude = inter;
            this.interludeStartTime = this.time.now;
            this.interludeFrozen = false;
            return;
        }
        if (inter.spec.type === 'sparkLink') {
            this.spawnElectricField(inter.spec.field);
            const count = inter.spec.turretsToSpawn ?? 3;
            for (let i = 0; i < count; i += 1) {
                if (this.turretSpawnerSpec) this.spawnTurretRandom(this.turretSpawnerSpec);
            }
            this.currentInterlude = inter;
            this.interludeStartTime = this.time.now;
            this.interludeFrozen = false;
            if (!this.turretConnectionsGraphics) {
                this.turretConnectionsGraphics = this.add.graphics();
            }
            return;
        }
        this.currentInterlude = inter;
        this.interludeStartTime = this.time.now;
        this.interludeFrozen = false;
        this.boss.activePatterns.push(new BulletPattern(this, this.boss, inter.spec));
    }

    isInterludeActive() {
        return this.currentInterlude !== null;
    }

    updateInterludeCycle(time) {
        if (!this.currentInterlude) return;
        const spec = this.currentInterlude.spec;
        const elapsed = time - this.interludeStartTime;

        if (spec.freezeAtMs !== undefined) {
            if (elapsed >= spec.freezeAtMs) {
                this.freezeAllSnowflakes(spec);
                this.currentInterlude = null;
                this.interludeFrozen = false;
            }
            return;
        }
        if (spec.durationMs !== undefined && elapsed >= spec.durationMs) {
            this.currentInterlude = null;
            this.interludeFrozen = false;
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

    onPlayerHit(player, bullet) {
        const time = this.time.now;
        if (!player.canBeHit(time)) return;
        player.onHit(time);
        this.recordBotHit('bullet', this.classifyBossBullet(bullet), player);
        if (!bullet.isGear && !bullet.isElectricField) bullet.destroy();
        this.lives -= 1;
        this.updateUI();
        if (this.lives <= 0) {
            this.gameOver = true;
            this.uiMessage.setText('GAME OVER\nEnter: 다시 도전 / ESC: 메뉴');
        }
    }

    onBossBodyHit(player) {
        if (!player) return;
        const time = this.time.now;
        if (!player.canBeHit(time)) return;
        player.onHit(time);
        this.recordBotHit('boss-body', null, player);
        this.lives -= 1;
        this.updateUI();
        if (this.lives <= 0) {
            this.gameOver = true;
            this.uiMessage.setText('GAME OVER\nEnter: 다시 도전 / ESC: 메뉴');
        }
    }

    onBossHit(bullet) {
        if (this.boss.isDead()) return;
        if (bullet.pierce) {
            const time = this.time.now;
            const cd = bullet.contactCooldownMs ?? 0;
            if (time - (bullet.lastHitTargetTime ?? -Infinity) < cd) return;
            bullet.lastHitTargetTime = time;
            this.boss.onHit(bullet.damage ?? 1);
        } else {
            this.boss.onHit(bullet.damage ?? 1);
            bullet.destroy();
        }
    }

    onBossOrbitHit(orb) {
        if (this.boss.isDead()) return;
        const time = this.time.now;
        if (time - orb.lastHitTargetTime < orb.weaponSpec.contactCooldownMs) return;
        orb.lastHitTargetTime = time;
        this.boss.onHit(orb.weaponSpec.damage);
    }

    onBossDefeated() {
        this.cleared = true;
        this.player1.sprite.body.setVelocity(0, 0);
        this.player2.sprite.body.setVelocity(0, 0);
        this.bossBullets.children.each((b) => b && b.destroy());
        this.snowflakesGroup.children.each((s) => s && s.destroy());
        this.turretsGroup.children.each((t) => t && t.destroy());
        this.turretSpawnerSpec = null;
        this.suicideDronesGroup.children.each((d) => d && d.destroy());
        this.suicideDroneSpawnerSpec = null;
        this.despawnBirdEmitters();
        this.despawnClouds();
        this.boss.destroy();

        const bossData = this.boss.data;
        const bossProgress = this.registry.get('bossProgress') || {};
        const weaponLevels = this.registry.get('weaponLevels') || {};
        const loadout = this.registry.get('loadout');
        const upgrades = this.registry.get('upgrades') || {};

        const prevBossLv = bossProgress[bossData.id] ?? 0;
        const isFirstClearOfLevel = this.bossLevel > prevBossLv;
        const newBossLv = Math.max(prevBossLv, this.bossLevel);
        bossProgress[bossData.id] = newBossLv;

        const rewardId = bossData.rewardWeapon;
        const prevWpnLv = weaponLevels[rewardId] ?? 0;
        const newWpnLv = Math.max(prevWpnLv, this.bossLevel);
        const isLevelUp = newWpnLv > prevWpnLv;
        weaponLevels[rewardId] = newWpnLv;

        // 결정 지급: 최초 클리어 = Lv×2, 재도전 = Lv
        const crystalReward = isFirstClearOfLevel ? this.bossLevel * 2 : this.bossLevel;
        const prevCrystals = this.registry.get('crystals') ?? 0;
        const newCrystals = prevCrystals + crystalReward;

        this.registry.set('bossProgress', bossProgress);
        this.registry.set('weaponLevels', weaponLevels);
        this.registry.set('crystals', newCrystals);
        Storage.save(weaponLevels, loadout, bossProgress, newCrystals, upgrades);

        const wpnName = Weapons[rewardId]?.name ?? rewardId;
        const line1 = isLevelUp
            ? `${wpnName} Lv${newWpnLv} 해금!`
            : `${wpnName} 이미 Lv${prevWpnLv}`;
        const line2 = `결정 +${crystalReward} (총 ${newCrystals})`;
        this.uiMessage.setText(`클리어!\n${line1}\n${line2}`);
        this.clearAdvanceAt = this.time.now + 3000;
    }

    updateUI() {
        this.uiLives.setText(`목숨: ${this.lives}/${this.maxLives}`);
    }

    updateHpBar() {
        const ratio = this.boss.hp / this.boss.maxHp;
        const fullWidth = GameConfig.GAME_WIDTH - 40;
        this.uiHpBar.width = Math.max(0, fullWidth * ratio);
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
        const radius = gearSpec.radius ?? 32;
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
        const W = GameConfig.GAME_WIDTH;
        const H = GameConfig.GAME_HEIGHT;
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

    onTurretHit(turret, bullet) {
        if (!turret.active || turret.hp <= 0) return;
        if (turret.invincible) {
            if (!bullet.pierce) bullet.destroy();
            return;
        }
        if (bullet.pierce) {
            const time = this.time.now;
            const cd = bullet.contactCooldownMs ?? 0;
            if (time - (bullet.lastHitTargetTime ?? -Infinity) < cd) return;
            bullet.lastHitTargetTime = time;
            turret.hp -= bullet.damage ?? 1;
        } else {
            turret.hp -= bullet.damage ?? 1;
            bullet.destroy();
        }
        if (turret.hp <= 0) turret.destroy();
    }

    onTurretOrbitHit(turret, orb) {
        if (!turret.active || turret.hp <= 0) return;
        if (turret.invincible) return;
        const time = this.time.now;
        if (time - orb.lastHitTargetTime < orb.weaponSpec.contactCooldownMs) return;
        orb.lastHitTargetTime = time;
        turret.hp -= orb.weaponSpec.damage;
        if (turret.hp <= 0) turret.destroy();
    }

    spawnElectricField(fieldSpec) {
        const w = fieldSpec.width ?? GameConfig.GAME_WIDTH;
        const h = fieldSpec.height ?? 22;
        const y0 = fieldSpec.initialY ?? -20;
        const field = this.add.rectangle(
            GameConfig.GAME_WIDTH / 2, y0, w, h,
            fieldSpec.color ?? 0x88ccff
        );
        field.setStrokeStyle(2, fieldSpec.strokeColor ?? 0xffffff);
        this.physics.add.existing(field);
        this.bossBullets.add(field);
        field.body.setSize(w, h);
        field.body.setVelocityY(fieldSpec.speed ?? 235);
        field.isElectricField = true;
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
        const cx = droneSpec.centerX ?? GameConfig.GAME_WIDTH / 2;
        const cy = droneSpec.centerY ?? GameConfig.GAME_HEIGHT / 2;
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
        const W = GameConfig.GAME_WIDTH;
        const H = GameConfig.GAME_HEIGHT;
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

    onDroneHitPlayer(player, drone) {
        if (!drone.active) return;
        const time = this.time.now;
        if (!player.canBeHit(time)) return;
        player.onHit(time);
        this.recordBotHit('suicide-drone', drone.state ?? null, player);
        drone.destroy();
        this.lives -= 1;
        this.updateUI();
        if (this.lives <= 0) {
            this.gameOver = true;
            this.uiMessage.setText('GAME OVER\nEnter: 다시 도전 / ESC: 메뉴');
        }
    }

    onDroneShot(drone, bullet) {
        if (!drone.active || drone.hp <= 0) return;
        if (bullet.pierce) {
            const time = this.time.now;
            const cd = bullet.contactCooldownMs ?? 0;
            if (time - (bullet.lastHitTargetTime ?? -Infinity) < cd) return;
            bullet.lastHitTargetTime = time;
            drone.hp -= bullet.damage ?? 1;
        } else {
            drone.hp -= bullet.damage ?? 1;
            bullet.destroy();
        }
        if (drone.hp <= 0) drone.destroy();
    }

    onDroneOrbitHit(drone, orb) {
        if (!drone.active || drone.hp <= 0) return;
        const time = this.time.now;
        if (time - orb.lastHitTargetTime < orb.weaponSpec.contactCooldownMs) return;
        orb.lastHitTargetTime = time;
        drone.hp -= orb.weaponSpec.damage;
        if (drone.hp <= 0) drone.destroy();
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
        const W = GameConfig.GAME_WIDTH;
        const H = GameConfig.GAME_HEIGHT;
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
        const heal = this.boss.maxHp * (drone.healPercent / 100);
        this.boss.hp = Math.min(this.boss.maxHp, this.boss.hp + heal);
        this.updateHpBar();
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

    onHarvesterHitPlayer(player, drone) {
        if (!drone.active) return;
        const time = this.time.now;
        if (!player.canBeHit(time)) return;
        player.onHit(time);
        this.recordBotHit('harvester-drone', drone.state ?? null, player);
        this.lives -= 1;
        this.updateUI();
        if (this.lives <= 0) {
            this.gameOver = true;
            this.uiMessage.setText('GAME OVER\nEnter: 다시 도전 / ESC: 메뉴');
        }
    }

    onHarvesterShot(drone, bullet) {
        if (!drone.active || drone.hp <= 0) return;
        if (bullet.pierce) {
            const time = this.time.now;
            const cd = bullet.contactCooldownMs ?? 0;
            if (time - (bullet.lastHitTargetTime ?? -Infinity) < cd) return;
            bullet.lastHitTargetTime = time;
            drone.hp -= bullet.damage ?? 1;
        } else {
            drone.hp -= bullet.damage ?? 1;
            bullet.destroy();
        }
        if (drone.hp <= 0) drone.destroy();
    }

    onHarvesterOrbitHit(drone, orb) {
        if (!drone.active || drone.hp <= 0) return;
        const time = this.time.now;
        if (time - orb.lastHitTargetTime < orb.weaponSpec.contactCooldownMs) return;
        orb.lastHitTargetTime = time;
        drone.hp -= orb.weaponSpec.damage;
        if (drone.hp <= 0) drone.destroy();
    }

    setTurretSpawnerOverride(override) {
        if (!this.turretSpawnerSpec) return;
        this.turretSpawnerSpec = {
            ...this.turretSpawnerSpec,
            ...override,
        };
    }

    startTurretMotion(spec) {
        this.turretMotionSpec = spec;
        this.turretsGroup.children.each((t) => {
            if (t && t.active && !t.invincible) this.initTurretOrbit(t);
        });
    }

    spawnInvincibleTurret(cfg) {
        const cx = cfg.spawnX ?? GameConfig.GAME_WIDTH / 2;
        const cy = cfg.spawnY ?? 300;
        const r = cfg.radius ?? 80;
        const startAngle = Math.random() * Math.PI * 2;
        const x = cx + Math.cos(startAngle) * r;
        const y = cy + Math.sin(startAngle) * r;

        const baseTurret = this.turretSpawnerSpec?.turret ?? {};
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
                this.recordBotHit('turret-link', null, p);
                this.lives -= 1;
                this.updateUI();
                if (this.lives <= 0) {
                    this.gameOver = true;
                    this.uiMessage.setText('GAME OVER\nEnter: 다시 도전 / ESC: 메뉴');
                }
            }
        }
    }

    toggleBotMode() {
        this.botMode = !this.botMode;
        if (this.botMode) {
            this.botOriginalKeys1 = this.player1.keys;
            this.botOriginalKeys2 = this.player2.keys;
            this.bot1 = new BotController(this, this.player1, {
                homeX: GameConfig.GAME_WIDTH * 0.35,
                homeY: GameConfig.GAME_HEIGHT * 0.55,
                minPartnerDist: 220,
            });
            this.bot2 = new BotController(this, this.player2, {
                homeX: GameConfig.GAME_WIDTH * 0.65,
                homeY: GameConfig.GAME_HEIGHT * 0.8,
                minPartnerDist: 220,
            });
            this.bot1.partner = this.player2;
            this.bot2.partner = this.player1;
            this.player1.keys = this.bot1.getKeys();
            this.player2.keys = this.bot2.getKeys();
            this.botUI.setText('BOT ON');
            const loadout = this.registry.get('loadout') || { p1: [], p2: [] };
            this.botLogger.startRun({
                bossName: this.boss?.data?.name ?? 'unknown',
                bossLv: this.bossLevel,
                weapons: { p1: loadout.p1, p2: loadout.p2 },
                startSceneTime: this.time.now,
            });
        } else {
            if (this.botLogger.isActive()) {
                this.botLogger.endRun('abort', this.time.now);
            }
            if (this.botOriginalKeys1) this.player1.keys = this.botOriginalKeys1;
            if (this.botOriginalKeys2) this.player2.keys = this.botOriginalKeys2;
            this.bot1 = null;
            this.bot2 = null;
            this.botUI.setText('');
            this.botSwapCount = 0;
            this.botLog = [];
            this.botDumped = false;
        }
    }

    tryBotSwap(time) {
        if (time - this.botLastSwapTime < this.botSwapCooldownMs) return;
        const s1 = this.bot1.getStatus();
        const s2 = this.bot2.getStatus();
        const b1Danger = !s1.invincible && s1.danger < this.bot1.dangerNow;
        const b2Danger = !s2.invincible && s2.danger < this.bot2.dangerNow;
        // 무적 캐릭터 자리 판정 완화: 상대 일반보다 안전하면 스왑 유효
        const shouldSwapTo1 = b2Danger && s1.danger > s2.danger;
        const shouldSwapTo2 = b1Danger && s2.danger > s1.danger;
        if (shouldSwapTo1 || shouldSwapTo2) {
            this.doSwap();
            this.botLastSwapTime = time;
            this.botSwapCount += 1;
        }
    }

    logBotFrame(time) {
        const s1 = this.bot1.getStatus();
        const s2 = this.bot2.getStatus();
        const bulletCount = this.bossBullets.countActive() + this.snowflakesGroup.countActive();
        this.botLog.push({
            t: Math.round(time),
            p1: { inv: s1.invincible, danger: Math.round(s1.danger === Infinity ? 9999 : s1.danger), x: Math.round(s1.x), y: Math.round(s1.y) },
            p2: { inv: s2.invincible, danger: Math.round(s2.danger === Infinity ? 9999 : s2.danger), x: Math.round(s2.x), y: Math.round(s2.y) },
            lives: this.lives,
            bullets: bulletCount,
            bossHp: Math.round(this.boss.hp),
            phase: this.boss.phaseIndex,
        });
        if (this.botLog.length > this.botLogMaxFrames) this.botLog.shift();
    }

    classifyBossBullet(b) {
        if (!b) return 'unknown';
        if (b.isGear) return 'gear';
        if (b.isOrbit) return 'orbit';
        if (b.isElectricField) return 'electricField';
        if (b.hasWavyMotion) return 'wavy';
        if (b.hasHoming) return 'homing';
        if (b.hasSeeking) return 'seeking';
        if (b.decelerating) return 'decelerating';
        if (b.isBird) return 'bird';
        if (b.isSnowflake) return 'snowflake';
        if (b.isTriangle) return 'triangle';
        return 'linear';
    }

    recordBotHit(cause, subType, player) {
        if (!this.botMode || !this.botLogger.isActive()) return;
        if (!player || !player.sprite) return;
        const botCtl = (player === this.player1) ? this.bot1 : this.bot2;
        let predictedDanger = null;
        if (botCtl && this.dangerMap) {
            const d = this.dangerMap.getArrivalInRadius(player.sprite.x, player.sprite.y, botCtl.hitRadius);
            predictedDanger = (d === Infinity) ? 9999 : Math.round(d);
        }
        this.botLogger.recordHit({
            t: this.time.now,
            cause,
            subType,
            playerIdx: (player === this.player1) ? 1 : 2,
            x: player.sprite.x,
            y: player.sprite.y,
            phase: this.boss?.phaseIndex ?? 0,
            livesBefore: this.lives,
            predictedDanger,
        });
    }

    dumpBotLog(time, result = 'lose') {
        const bossName = this.boss.data.name;
        const lv = this.bossLevel;
        const resultLabel = result === 'win' ? '승리' : (result === 'lose' ? '패배' : result);
        console.log(`=== BOT ${resultLabel} 로그 [${bossName} Lv${lv}] ===`);
        console.log(`종료 시각 ${Math.round(time)}, 총 스왑 ${this.botSwapCount}회, 피격 ${this.botLogger.getCurrentHitCount()}회`);
        console.log(`최근 ${this.botLog.length} 프레임:`);
        console.table(this.botLog.slice(-60).map((f) => ({
            t: f.t,
            phase: f.phase,
            bossHp: f.bossHp,
            bullets: f.bullets,
            lives: f.lives,
            p1: `${f.p1.inv ? '무' : '일'} ${f.p1.danger}ms (${f.p1.x},${f.p1.y})`,
            p2: `${f.p2.inv ? '무' : '일'} ${f.p2.danger}ms (${f.p2.x},${f.p2.y})`,
        })));
        console.log('전체 프레임 로그:', JSON.stringify(this.botLog));
        this.botLogger.setSwaps(this.botSwapCount);
        this.botLogger.endRun(result, time);
    }

    updateBotUI() {
        const s1 = this.bot1.getStatus();
        const s2 = this.bot2.getStatus();
        const fmt = (v) => (v === Infinity ? 'safe' : `${Math.round(v)}ms`);
        const tag = (s) => (s.invincible ? '무적' : '일반');
        const lines = [
            `BOT ON`,
            `P1[${tag(s1)}] ${fmt(s1.danger)}`,
            `P2[${tag(s2)}] ${fmt(s2.danger)}`,
            `swaps: ${this.botSwapCount}  hits: ${this.botLogger.getCurrentHitCount()}`,
        ];
        this.botUI.setText(lines.join('\n'));
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
}
