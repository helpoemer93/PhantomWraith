class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        this.cameras.main.fadeIn(300, 0, 0, 0);
        const upgrades = this.registry.get('upgrades') || {};
        this.maxLives = Upgrades.maxLives.applied(upgrades.maxLives ?? 0);
        this.lives = this.maxLives;
        this.gameOver = false;
        this.cleared = false;
        this.clearAdvanceAt = null;
        this.__gameOverMessageShown = false;
        this.prevLives = undefined;

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
        // 보스 총알 통일 스타일 — 그룹 add를 hook해서 stroke 없는 Shape에만 흰 아웃라인 부여.
        // (예: gear·snowflake는 이미 자체 stroke 있어 isStroked=true → 건너뜀)
        this.applyBossBulletStyling(this.bossBullets);
        this.applyBossBulletStyling(this.snowflakesGroup);
        this.applyPlayerBulletStyling(this.playerBullets);
        this.applyPlayerBulletStyling(this.orbitOrbs);
        this.turretsGroup = this.physics.add.group();
        this.turretSpawnerSpec = null;
        this.turretSpawnLastTime = 0;
        this.suicideDronesGroup = this.physics.add.group();
        this.suicideDroneSpawnerSpec = null;
        this.suicideDroneSpawnLastTime = null;
        this.harvesterDronesGroup = this.physics.add.group();
        this.harvesterDroneSpawnerSpec = null;
        // 두파팡 궤도체 캐리어(가상 중심점 + 3구체).
        this.doopaCores = [];
        // 두파팡 페이즈1: 천장 타원 궤도 5구체 + 랜덤 2개 수직 돌진.
        this.ceilingOrbs = [];
        this.ceilingSpec = null;
        this.ceilingCharge = null;
        // 두파팡 페이즈2: BH/WH 4개(회전) + 스파이럴 구체(HP있음, 격파가능).
        this.spiralOrbsGroup = this.physics.add.group();
        this.spiralOrbCores = [];
        this.doopaHolesSpec = null;
        this.blackHoles = [];
        this.whiteHoles = [];
        this.holesRotation = 0;
        this.doopaCenteringState = null;
        // 스이쿤 페이즈 1 라이코 관련 상태 (라이코는 항상 1개체).
        this.raikou = null;
        this.raikouSpec = null;
        this.leashSpec = null;
        this.waveMissileSpec = null;
        this.raikouOverlayGraphics = null;
        this.leashGraphics = null;
        this.raikouAfterimages = [];
        // 스이쿤 페이즈 3 상태 (씬 재시작 시 이전 게임 상태가 남아 다음 게임 페이즈 1에 페이즈 3 로직이 함께 도는 버그 방지).
        this.suicunePhase3State = null;
        this.suicunePhase3Spec = null;
        this.suicuneOverlayGraphics = null;
        this.entei = null;
        this.roaringWaves = null;
        this.convergingWaves = null;
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

        AudioSettings.applyMaster(this);
        BootScene.fadeOutMenuBgm(this, 800);

        // 보스별 BGM: <boss.id>-bgm 키 규칙. 있으면 loop 재생, 씬 종료 시 정지.
        // 순차 페이드 — 메뉴 800ms 페이드아웃 뒤 보스 BGM 800ms 페이드인.
        this.bossBgm = null;
        const bgmKey = `${this.boss.data.id}-bgm`;
        if (this.cache.audio.exists(bgmKey)) {
            this.bossBgm = this.sound.add(bgmKey, { loop: true, volume: 0 });
            this.bossBgm.__baseVolume = 0.2;
            this.bossBgm.play();
            this.tweens.add({
                targets: this.bossBgm,
                volume: AudioSettings.bgmVolume(0.2),
                duration: 800, delay: 800,
            });
        }
        this.events.once('shutdown', () => this.stopBossBgm());

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
        // 두파팡 페이즈2 스파이럴 구체: 플레이어 피격·플레이어 총알로 격파 가능.
        this.physics.add.overlap(
            this.player1.sprite, this.spiralOrbsGroup,
            (s, o) => this.onPlayerHit(this.player1, o)
        );
        this.physics.add.overlap(
            this.player2.sprite, this.spiralOrbsGroup,
            (s, o) => this.onPlayerHit(this.player2, o)
        );
        this.physics.add.overlap(
            this.spiralOrbsGroup, this.playerBullets,
            (o, b) => this.onSpiralOrbShot(o, b)
        );
        this.physics.add.overlap(
            this.spiralOrbsGroup, this.orbitOrbs,
            (o, ob) => this.onSpiralOrbOrbitHit(o, ob)
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
        // HP바 잔여 표시 (파이팅 게임 스타일): 실제 바 뒤에서 서서히 따라 축소.
        this.uiHpBarLoss = this.add.rectangle(
            20, 40,
            GameConfig.GAME_WIDTH - 40, 8,
            0xffffff
        ).setOrigin(0, 0.5).setAlpha(0.5);
        this.uiHpBar = this.add.rectangle(
            20, 40,
            GameConfig.GAME_WIDTH - 40, 8,
            0xff6688
        ).setOrigin(0, 0.5);

        // 플레이어 피격 시 붉은 화면 플래시 (최상단 depth).
        this.damageFlash = this.add.rectangle(
            GameConfig.GAME_WIDTH / 2, GameConfig.GAME_HEIGHT / 2,
            GameConfig.GAME_WIDTH, GameConfig.GAME_HEIGHT,
            0xff0000,
        ).setDepth(1000).setAlpha(0);

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

    stopBossBgm() {
        if (this.bossBgm) {
            this.bossBgm.stop();
            this.bossBgm.destroy();
            this.bossBgm = null;
        }
        if (this.freezerWindLoop) {
            this.freezerWindLoop.stop();
            this.freezerWindLoop.destroy();
            this.freezerWindLoop = null;
        }
        // 재생 중이던 SFX(날개짓·회오리 등)도 즉시 정지
        this.sound.stopAll();
    }

    startFreezerWind() {
        if (this.freezerWindLoop) return;
        if (!this.cache.audio.exists('freezer-p23-wind')) return;
        this.freezerWindLoop = this.sound.add('freezer-p23-wind', { loop: true, volume: 0 });
        this.freezerWindLoop.__baseVolume = 0.2;
        this.freezerWindLoop.play();
        this.tweens.add({
            targets: this.freezerWindLoop,
            volume: AudioSettings.bgmVolume(0.2),
            duration: 4000,
        });
    }

    update(time, delta) {
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.stopBossBgm();
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
            // 스이쿤 페이즈 1/2: 라이코·엔테이 몸통 접촉 회피
            if (this.raikou && this.raikou.active) {
                const rr = (this.raikou.body?.radius ?? 18) + 15;
                staticHazards.push({
                    x: this.raikou.x, y: this.raikou.y,
                    radius: rr, arrivalTime: 0,
                });
            }
            if (this.entei && this.entei.active && this.entei.state && this.entei.state !== 'entering') {
                const rr = (this.entei.body?.radius ?? 18) + 15;
                staticHazards.push({
                    x: this.entei.x, y: this.entei.y,
                    radius: rr, arrivalTime: 0,
                });
            }
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
            // 스이쿤 조준 경고선을 위험선으로. arrival = 발사 시점까지 남은 시간.
            if (this.raikou && this.raikou.active && this.raikou.state === 'aiming' && this.raikou.aimComputed) {
                const r = this.raikou;
                const remain = Math.max(0, (r.spec?.aimIntervalMs ?? 1000) - (time - r.stateStartTime));
                lineHazards.push({
                    x1: r.x, y1: r.y,
                    x2: r.aimEndX, y2: r.aimEndY,
                    radius: (r.spec?.radius ?? 18) + 8,
                    arrivalTime: remain,
                });
            }
            if (this.entei && this.entei.active && this.entei.state === 'aiming' && this.entei.aimComputed) {
                const e = this.entei;
                const remain = Math.max(0, (e.spec?.aimIntervalMs ?? 1000) - (time - e.stateStartTime));
                lineHazards.push({
                    x1: e.x, y1: e.y,
                    x2: e.aimEndX, y2: e.aimEndY,
                    radius: (e.spec?.radius ?? 18) + 8,
                    arrivalTime: remain,
                });
            }
            if (this.suicunePhase3State && this.suicunePhase3Spec && this.boss && this.boss.sprite) {
                const st = this.suicunePhase3State;
                const spec = this.suicunePhase3Spec;
                const b = this.boss.sprite;
                if (st.stage === 'aim' && st.aimComputed) {
                    const remain = Math.max(0, (spec.aimIntervalMs ?? 1000) - (time - st.stateStartTime));
                    lineHazards.push({
                        x1: b.x, y1: b.y,
                        x2: st.aimEndX, y2: st.aimEndY,
                        radius: (spec.bodySize ?? 44) / 2 + 8,
                        arrivalTime: remain,
                    });
                } else if (st.stage === 'grandAim' && st.aimComputed) {
                    const grand = spec.grand ?? {};
                    const remain = Math.max(0, (grand.aimIntervalMs ?? spec.aimIntervalMs ?? 1000) - (time - st.stateStartTime));
                    lineHazards.push({
                        x1: b.x, y1: b.y,
                        x2: st.aimEndX, y2: st.aimEndY,
                        radius: (spec.bodySize ?? 44) / 2 + 8,
                        arrivalTime: remain,
                    });
                } else if (st.stage === 'water') {
                    const wc = spec.waterCannon ?? {};
                    const halfW = (wc.beamWidth ?? 24) / 2 + 8;
                    for (const shot of st.waterShots) {
                        if (shot.fired) continue;
                        const remain = Math.max(0, shot.fireAt - time);
                        lineHazards.push({
                            x1: shot.originX, y1: shot.originY,
                            x2: shot.endX, y2: shot.endY,
                            radius: halfW,
                            arrivalTime: remain,
                        });
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
                this.stopBossBgm();
                this.scene.start('BossSelectScene');
                return;
            }
            if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
                this.stopBossBgm();
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
                this.stopBossBgm();
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
        this.updateDoopaOrbs(time, delta);
        this.updateCeilingOrbits(time, delta);
        this.updateDoopaCentering(time, delta);
        this.updateDoopaHoles(time, delta);
        this.updateSpiralOrbs(time, delta);
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
        this.updateRaikou(time, delta);
        this.updateWaveMissiles(time);
        this.updateLightningMissiles(time);
        this.updateRoaringWaves(time);
        this.updateConvergingWaves(time);
        this.updateEntei(time, delta);
        this.updateSuicunePhase3(time, delta);

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
        this.followHpBarLoss(delta);

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
        // seek: 파일 앞부분 무음 스킵 (초 단위)
        AudioSettings.playSfx(this, 'gugu-spiral-fire', { volume: 0.4, seek: 0.3 });
        // 발사 후 2초 뒤 freeze 사운드 (조정 가능)
        if (this.decelSpiralFreezeTimer) this.decelSpiralFreezeTimer.remove();
        this.decelSpiralFreezeTimer = this.time.delayedCall(3500, () => {
            AudioSettings.playSfx(this, 'gugu-spiral-freeze', { volume: 0.4 });
            this.decelSpiralFreezeTimer = null;
        });
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

    // 궤도체 자동 미사일: 가장 가까운 적을 향해 직선 발사. 유도·관통 없음.
    // 대상 없으면 false 반환 (Player가 다음 프레임 재시도).
    spawnOrbitMissile(x, y, w) {
        const target = this.getNearestEnemyTo(x, y);
        if (!target) return false;
        const dx = target.x - x;
        const dy = target.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) return false;
        const speed = w.missileSpeed ?? 380;
        const size = w.missileSize ?? 6;
        const b = this.add.circle(x, y, size, w.color);
        this.physics.add.existing(b);
        b.body.setCircle(size);
        this.playerBullets.add(b);
        b.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
        b.damage = w.missileDamage ?? 3;
        b.pierce = false;
        b.contactCooldownMs = 0;
        b.lastHitTargetTime = -Infinity;
        return true;
    }

    // 궤도체 미사일 대상 후보: 메인 보스, 라이코/엔테이, 각종 그룹 소속 적.
    getNearestEnemyTo(x, y) {
        let bestDist = Infinity;
        let best = null;
        const consider = (obj) => {
            if (!obj || !obj.active) return;
            const dx = obj.x - x;
            const dy = obj.y - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestDist) { bestDist = d2; best = obj; }
        };
        if (this.boss && this.boss.sprite) consider(this.boss.sprite);
        if (this.raikou) consider(this.raikou);
        if (this.entei) consider(this.entei);
        const groups = [
            this.turretsGroup, this.suicideDronesGroup, this.harvesterDronesGroup,
        ];
        for (const g of groups) {
            if (!g) continue;
            g.children.each((c) => consider(c));
        }
        return best ? { x: best.x, y: best.y } : null;
    }

    // 그룹의 add 메서드를 감싸서 stroke 없는 Shape에 붉은 아웃라인 적용.
    // 플레이어 총알과 시각적 구분 위해 보스 총알만 붉은 stroke.
    applyBossBulletStyling(group) {
        const origAdd = group.add.bind(group);
        group.add = (child, addToScene) => {
            if (child && child.setStrokeStyle && !child.isStroked) {
                child.setStrokeStyle(2, 0xff4444, 1);
            }
            return origAdd(child, addToScene);
        };
    }

    // 플레이어 총알은 배경으로 녹아들도록 알파 감쇠.
    applyPlayerBulletStyling(group) {
        const origAdd = group.add.bind(group);
        group.add = (child, addToScene) => {
            if (child && child.setAlpha) child.setAlpha(0.6);
            return origAdd(child, addToScene);
        };
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
        AudioSettings.playSfx(this, 'gugu-vortex', { volume: 0.4 });
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

    // 두파팡 궤도체 캐리어: 가상 중심점(비가시·무판정) + 3구체.
    // 스폰 순간 3구체 모두 두파팡 위치에 있다가 궤도 반경으로 튀어나감 (transitionMs).
    // 도착 후 중심점이 조준 방향 직선 이동, 구체는 공전하며 따라감.
    spawnDoopaOrb(originX, originY, spec) {
        const target = this.getActivePlayerPos();
        const dx = target.x - originX;
        const dy = target.y - originY;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) return null;
        const coreSpeed = spec.core?.speed ?? 200;
        const transitionMs = spec.core?.transitionMs ?? 300;
        const orbCount = spec.orbit?.count ?? 3;
        const orbRadius = spec.orbit?.radius ?? 6;
        const orbColor = spec.orbit?.color ?? 0x88ff88;
        const orbitRad = spec.orbit?.orbitRadius ?? 30;
        const orbitSpd = spec.orbit?.orbitSpeedRadPerSec ?? 3;

        const time = this.time.now;
        const core = {
            x: originX, y: originY,
            vx: (dx / dist) * coreSpeed,
            vy: (dy / dist) * coreSpeed,
            spawnTime: time,
            transitionEndTime: time + transitionMs,
            transitionMs,
            orbitRad, orbitSpd,
            orbs: [],
        };
        for (let i = 0; i < orbCount; i += 1) {
            const phaseAngle = (i / orbCount) * Math.PI * 2;
            const orb = this.add.circle(originX, originY, orbRadius, orbColor);
            this.physics.add.existing(orb);
            this.bossBullets.add(orb);
            orb.body.setCircle(orbRadius);
            orb.doopaCore = core;
            orb.phaseAngle = phaseAngle;
            core.orbs.push(orb);
        }
        this.doopaCores.push(core);
        return null;
    }

    updateDoopaOrbs(time, delta) {
        if (!this.doopaCores || this.doopaCores.length === 0) return;
        const dt = delta / 1000;
        const remaining = [];
        const margin = 300;
        for (const core of this.doopaCores) {
            const inTransition = time < core.transitionEndTime;
            if (!inTransition) {
                core.x += core.vx * dt;
                core.y += core.vy * dt;
            }
            for (const orb of core.orbs) {
                if (!orb.active) continue;
                if (inTransition) {
                    // 스폰 시점 t=0 (중심에 겹침) → transitionMs 시점 t=1 (궤도 위치).
                    const t = (time - core.spawnTime) / core.transitionMs;
                    const tx = core.x + Math.cos(orb.phaseAngle) * core.orbitRad;
                    const ty = core.y + Math.sin(orb.phaseAngle) * core.orbitRad;
                    orb.x = core.x + (tx - core.x) * t;
                    orb.y = core.y + (ty - core.y) * t;
                    // 예측용 velocity (스폰→궤도 위치 방향).
                    const trX = (tx - core.x) / (core.transitionMs / 1000);
                    const trY = (ty - core.y) / (core.transitionMs / 1000);
                    orb.body.setVelocity(trX, trY);
                } else {
                    orb.phaseAngle += core.orbitSpd * dt;
                    orb.x = core.x + Math.cos(orb.phaseAngle) * core.orbitRad;
                    orb.y = core.y + Math.sin(orb.phaseAngle) * core.orbitRad;
                    const tangSpd = core.orbitSpd * core.orbitRad;
                    const tangVx = -Math.sin(orb.phaseAngle) * tangSpd;
                    const tangVy = Math.cos(orb.phaseAngle) * tangSpd;
                    orb.body.setVelocity(core.vx + tangVx, core.vy + tangVy);
                }
            }
            const off = core.x < -margin || core.x > GameConfig.GAME_WIDTH + margin
                || core.y < -margin || core.y > GameConfig.GAME_HEIGHT + margin;
            const allDead = core.orbs.every((o) => !o.active);
            if (off || allDead) {
                for (const orb of core.orbs) if (orb.active) orb.destroy();
                continue;
            }
            remaining.push(core);
        }
        this.doopaCores = remaining;
    }

    // 두파팡 페이즈1: 천장 타원 궤도 5구체 + 2초마다 랜덤 2개 수직 돌진.
    // 구체 상태: 'orbiting' → 'preCharging'(경고) → 'charging'(순간이동+잔상)
    //          → 'returning'(위로 이동) → 'orbiting'.
    startCeilingOrbits(spec) {
        this.destroyCeilingOrbits();
        this.ceilingSpec = spec;
        this.ceilingOrbs = [];
        // lastChargeTime은 첫 update에서 지연 초기화 (create() 시점 time.now는 0이라 즉발 방지).
        this.ceilingCharge = { lastChargeTime: null };
        for (let i = 0; i < spec.count; i += 1) {
            const phaseAngle = (i / spec.count) * Math.PI * 2;
            const px = spec.cx + spec.a * Math.cos(phaseAngle);
            const py = spec.cy + spec.b * Math.sin(phaseAngle);
            const orb = this.add.circle(px, py, spec.orbSize, spec.color);
            this.physics.add.existing(orb);
            orb.body.setCircle(spec.orbSize);
            this.bossBullets.add(orb);
            orb.state = 'orbiting';
            orb.phaseAngle = phaseAngle;
            orb.isCeilingOrb = true;
            this.ceilingOrbs.push(orb);
        }
    }

    updateCeilingOrbits(time, delta) {
        if (!this.ceilingSpec || this.ceilingOrbs.length === 0) return;
        const spec = this.ceilingSpec;
        const dt = delta / 1000;
        this.ceilingOrbs = this.ceilingOrbs.filter((o) => o && o.active);

        for (const orb of this.ceilingOrbs) {
            if (orb.state === 'orbiting') {
                orb.phaseAngle += spec.rotationSpeedRadPerSec * dt;
                orb.x = spec.cx + spec.a * Math.cos(orb.phaseAngle);
                orb.y = spec.cy + spec.b * Math.sin(orb.phaseAngle);
            } else if (orb.state === 'preCharging') {
                if (time >= orb.warningEndTime) {
                    this.performCeilingCharge(orb, time, spec);
                }
            } else if (orb.state === 'charging') {
                if (time >= orb.chargeEndTime) {
                    orb.state = 'returning';
                    if (orb.body) orb.body.enable = true;
                }
            } else if (orb.state === 'returning') {
                orb.y -= spec.returnSpeedPxPerSec * dt;
                if (orb.y <= orb.chargeStartY) {
                    orb.y = orb.chargeStartY;
                    orb.x = orb.chargeStartX;
                    orb.state = 'orbiting';
                }
            }
        }

        // 새 돌진 트리거. x축 거리 chargeMinXGap 이상인 쌍만 유효.
        if (this.ceilingCharge.lastChargeTime == null) {
            this.ceilingCharge.lastChargeTime = time;
        }
        if (time - this.ceilingCharge.lastChargeTime >= spec.chargeIntervalMs) {
            const chosen = this.pickCeilingChargePair(spec);
            if (chosen) {
                for (const orb of chosen) this.triggerCeilingWarning(orb, time, spec);
                this.ceilingCharge.lastChargeTime = time;
            }
            // 후보 쌍 부족 시 스킵 (다음 프레임 재시도).
        }
    }

    pickCeilingChargePair(spec) {
        const candidates = this.ceilingOrbs.filter((o) => o.state === 'orbiting');
        const minGap = spec.chargeMinXGap ?? 0;
        const validPairs = [];
        for (let i = 0; i < candidates.length; i += 1) {
            for (let j = i + 1; j < candidates.length; j += 1) {
                if (Math.abs(candidates[i].x - candidates[j].x) >= minGap) {
                    validPairs.push([candidates[i], candidates[j]]);
                }
            }
        }
        if (validPairs.length === 0) return null;
        return validPairs[Math.floor(Math.random() * validPairs.length)];
    }

    triggerCeilingWarning(orb, time, spec) {
        orb.state = 'preCharging';
        orb.chargeStartX = orb.x;
        orb.chargeStartY = orb.y;
        orb.warningEndTime = time + spec.warningMs;
        const rectYCenter = (orb.y + spec.floorY) / 2;
        const rectH = spec.floorY - orb.y;
        const rectW = spec.orbSize * 2;
        orb.warningRect = this.add.rectangle(
            orb.x, rectYCenter, rectW, rectH,
            spec.warningColor ?? 0xff3333,
        ).setAlpha(spec.warningAlpha ?? 0.35).setDepth(20);
    }

    performCeilingCharge(orb, time, spec) {
        if (orb.warningRect) { orb.warningRect.destroy(); orb.warningRect = null; }
        orb.x = orb.chargeStartX;
        orb.y = spec.floorY;
        orb.state = 'charging';
        orb.chargeEndTime = time + spec.chargeStayMs;
        if (orb.body) orb.body.enable = false;
        // 라인-원 판정 (순간이동 궤적).
        const halfW = spec.orbSize;
        for (const player of [this.player1, this.player2]) {
            if (!player || !player.sprite || !player.sprite.active) continue;
            if (!player.canBeHit(time)) continue;
            const dist = this.pointToSegmentDistance(
                player.sprite.x, player.sprite.y,
                orb.chargeStartX, orb.chargeStartY,
                orb.chargeStartX, spec.floorY,
            );
            if (dist <= halfW + player.size / 2) {
                player.onHit(time);
                this.recordBotHit('ceiling-charge', null, player);
                this.lives -= 1;
                this.updateUI();
                if (this.lives <= 0) {
                    this.gameOver = true;
                    this.showGameOverMessage();
                }
            }
        }
        // 잔상 (raikouAfterimages 재활용, 씬 이미 관리 중).
        const N = spec.afterimageCount ?? 5;
        const fadeMs = spec.afterimageFadeMs ?? 300;
        const startY = orb.chargeStartY;
        const endY = spec.floorY;
        for (let i = 1; i <= N; i += 1) {
            const t = i / (N + 1);
            const ay = startY + (endY - startY) * t;
            const g = this.add.circle(orb.chargeStartX, ay, spec.orbSize, spec.color);
            g.setDepth(20).setAlpha(0.5);
            this.raikouAfterimages.push({ sprite: g, expireAt: time + fadeMs, fadeMs });
        }
    }

    destroyCeilingOrbits() {
        if (this.ceilingOrbs) {
            for (const o of this.ceilingOrbs) {
                if (o && o.warningRect) o.warningRect.destroy();
                if (o && o.active) o.destroy();
            }
        }
        this.ceilingOrbs = [];
        this.ceilingSpec = null;
        this.ceilingCharge = null;
    }

    // ===== 두파팡 페이즈2: 인터루드(중앙 이동+홀 배치) + 스파이럴 구체 + 워프/회복/게이지 =====

    // 인터루드 시작. 보스 위치를 tween으로 중앙 이동, 기존 공격 정리, 5초 무적.
    startDoopaCentering(spec) {
        // 진행 중 doopaOrb·기타 공격 즉시 정리 (인터루드 동안 필드 clean).
        this.boss.activePatterns = [];
        this.doopaCores = [];
        this.bossBullets.children.each((b) => {
            if (b && b.active && !b.isCeilingOrb) b.destroy();
        });
        // 페이즈2 진입까지 무적 (인터루드 3초 + 페이즈2 초입 2초 = 5초).
        const now = this.time.now;
        const untilTime = now + (spec.invincibleMs ?? 5000);
        if (this.player1) this.player1.hitImmunityUntil = untilTime;
        if (this.player2) this.player2.hitImmunityUntil = untilTime;
        // 두파팡 위치 이동 상태 저장 (updateDoopaCentering에서 tween).
        this.boss.movementFrozen = true;
        this.doopaCenteringState = {
            startTime: now,
            fromX: this.boss.sprite.x,
            fromY: this.boss.sprite.y,
            toX: spec.centerX ?? 240,
            toY: spec.centerY ?? 400,
            descentMs: spec.descentMs ?? 1500,
            holeFadeInMs: spec.holeFadeInMs ?? 1500,
            holesSpawned: false,
            spec,
        };
        this.doopaHolesSpec = spec.holes;
    }

    updateDoopaCentering(time, delta) {
        const st = this.doopaCenteringState;
        if (!st) return;
        const elapsed = time - st.startTime;
        const t = Math.min(1, elapsed / st.descentMs);
        // easeOut 느낌: 1 - (1-t)^2
        const eased = 1 - (1 - t) * (1 - t);
        this.boss.sprite.x = st.fromX + (st.toX - st.fromX) * eased;
        this.boss.sprite.y = st.fromY + (st.toY - st.fromY) * eased;
        if (t >= 1 && !st.holesSpawned) {
            this.spawnDoopaHoles(st.spec.holes, st.holeFadeInMs);
            st.holesSpawned = true;
        }
        // 인터루드 시각 종료 판정 (descent + fadeIn). currentInterlude 자체는 durationMs로 별도 처리 안 하므로 null 처리.
        if (elapsed >= st.descentMs + st.holeFadeInMs) {
            this.doopaCenteringState = null;
            // interlude visual done — currentInterlude은 페이즈 전환이 완료할 때 자연 소멸.
            this.currentInterlude = null;
        }
    }

    // 페이즈2 진입시 훅. 홀은 인터루드에서 이미 생성됐으므로 여기서는 spec 참조 확인만.
    startDoopaHolesPhase(spec) {
        this.doopaHolesSpec = spec;
        // 인터루드 없이 페이즈2를 바로 진입한 경우 (Lab manual 등) 홀이 없을 수 있음 → 생성.
        if (!this.blackHoles.length && !this.whiteHoles.length) {
            this.spawnDoopaHoles(spec, 0);
        }
    }

    // 4개 홀 교차 배치 (BH 0°, WH 90°, BH 180°, WH 270°). 페어 (0°BH↔90°WH), (180°BH↔270°WH).
    // holeIdx = 시계순 인덱스 0~3 (반경 오실레이션 위상 오프셋용).
    spawnDoopaHoles(spec, fadeInMs) {
        this.destroyDoopaHoles();
        if (!this.holesConnectorGraphics) {
            this.holesConnectorGraphics = this.add.graphics();
            this.holesConnectorGraphics.setDepth(14);
        }
        const cx = spec.centerX ?? 240;
        const cy = spec.centerY ?? 400;
        const A0 = spec.radiusBase ?? 140;
        const r = spec.holeRadius ?? 24;
        const makeHole = (angleRad, isBlack, pairIdx, holeIdx) => {
            const x = cx + Math.cos(angleRad) * A0;
            const y = cy + Math.sin(angleRad) * A0;
            const color = isBlack ? spec.bhColor : spec.whColor;
            const stroke = isBlack ? spec.bhStrokeColor : spec.whStrokeColor;
            const s = this.add.circle(x, y, r, color);
            s.setStrokeStyle(spec.ringLineWidth ?? 2, stroke);
            s.setDepth(15);
            s.baseAngle = angleRad;
            s.pairIdx = pairIdx;
            s.holeIdx = holeIdx;
            s.isBlack = isBlack;
            if (fadeInMs > 0) {
                s.setAlpha(0);
                this.tweens.add({ targets: s, alpha: 1, duration: fadeInMs });
            }
            return s;
        };
        // 시계 순회: 0°(BH), 90°(WH), 180°(BH), 270°(WH)
        this.blackHoles.push(makeHole(0, true, 0, 0));
        this.whiteHoles.push(makeHole(Math.PI / 2, false, 0, 1));
        this.blackHoles.push(makeHole(Math.PI, true, 1, 2));
        this.whiteHoles.push(makeHole(-Math.PI / 2, false, 1, 3));
        this.holesRotation = 0;
        this.holesOscTime = 0;
    }

    updateDoopaHoles(time, delta) {
        if (!this.doopaHolesSpec) return;
        if (!this.blackHoles.length && !this.whiteHoles.length) return;
        const spec = this.doopaHolesSpec;
        const dt = delta / 1000;
        this.holesRotation += (spec.orbitalSpeedRadPerSec ?? Math.PI / 12) * dt;
        this.holesOscTime = (this.holesOscTime ?? 0) + dt;
        const cx = spec.centerX ?? 240;
        const cy = spec.centerY ?? 400;
        const A0 = spec.radiusBase ?? 140;
        const amp = spec.radiusAmp ?? 40;
        const omega = spec.radiusOmegaRadPerSec ?? 1.5;
        const phaseStep = spec.radiusPhaseStepRad ?? (Math.PI / 2);
        const r = spec.holeRadius ?? 24;
        const updateHole = (h) => {
            const ang = h.baseAngle + this.holesRotation;
            const rad = A0 + amp * Math.sin(omega * this.holesOscTime + h.holeIdx * phaseStep);
            h.x = cx + Math.cos(ang) * rad;
            h.y = cy + Math.sin(ang) * rad;
        };
        for (const h of this.blackHoles) updateHole(h);
        for (const h of this.whiteHoles) updateHole(h);
        // 페어 연결 라인 (BH → WH 두꺼운 라인). alpha는 홀 alpha 최소값으로 매칭.
        const g = this.holesConnectorGraphics;
        if (g) {
            g.clear();
            const w = spec.connectorWidth ?? 30;
            const col = spec.connectorColor ?? 0x88ccff;
            const a = spec.connectorAlpha ?? 0.2;
            for (const bh of this.blackHoles) {
                const wh = this.whiteHoles.find((wt) => wt.pairIdx === bh.pairIdx);
                if (!wh) continue;
                const alpha = Math.min(bh.alpha, wh.alpha) * a;
                g.lineStyle(w, col, alpha);
                g.lineBetween(bh.x, bh.y, wh.x, wh.y);
            }
        }
        // 플레이어 vs 블랙홀 (수동 거리 판정, 무적 무관 강제 워프).
        for (const player of [this.player1, this.player2]) {
            if (!player || !player.sprite || !player.sprite.active) continue;
            for (const bh of this.blackHoles) {
                const dx = player.sprite.x - bh.x;
                const dy = player.sprite.y - bh.y;
                if (dx * dx + dy * dy <= (r + player.size / 2) * (r + player.size / 2)) {
                    const wh = this.whiteHoles.find((wt) => wt.pairIdx === bh.pairIdx);
                    if (wh) this.warpPlayer(player, bh, wh);
                    break;
                }
            }
        }
        // 스파이럴 구체 vs 블랙홀: 즉시 파괴 + 대응 WH에서 360° 10발 사출.
        for (const orb of this.spiralOrbsGroup.getChildren()) {
            if (!orb || !orb.active) continue;
            for (const bh of this.blackHoles) {
                const dx = orb.x - bh.x;
                const dy = orb.y - bh.y;
                if (dx * dx + dy * dy <= (r + orb.orbRadius) * (r + orb.orbRadius)) {
                    const wh = this.whiteHoles.find((wt) => wt.pairIdx === bh.pairIdx);
                    if (wh) this.fireWh360(wh, time);
                    orb.destroy();
                    break;
                }
            }
        }
    }

    warpPlayer(player, bh, wh) {
        // 대응 화이트홀 위치로 즉시 순간이동. 다음 프레임 재접촉 방지 위해 밖으로 살짝 밀기.
        const cx = this.doopaHolesSpec.centerX ?? 240;
        const cy = this.doopaHolesSpec.centerY ?? 400;
        // WH에서 중앙 반대 방향(=바깥) 벡터로 살짝 밀어냄.
        const outDx = wh.x - cx;
        const outDy = wh.y - cy;
        const outLen = Math.hypot(outDx, outDy) || 1;
        const push = (this.doopaHolesSpec.holeRadius ?? 24) + player.size / 2 + 4;
        player.sprite.x = wh.x + (outDx / outLen) * push;
        player.sprite.y = wh.y + (outDy / outLen) * push;
    }

    // WH에서 360°/N발 즉시 사출. 짧은 flash로 발사 시각적 신호.
    fireWh360(wh, time) {
        const spec = this.doopaHolesSpec;
        const n = spec.wh360Count ?? 10;
        const speed = spec.wh360BulletSpeed ?? 220;
        const r = spec.wh360BulletRadius ?? 6;
        const color = spec.wh360BulletColor ?? 0xff88ff;
        // 짧은 확장 링 flash.
        const flash = this.add.circle(wh.x, wh.y, spec.holeRadius ?? 24, 0xffffff, 0);
        flash.setStrokeStyle(3, color);
        flash.setDepth(16);
        this.tweens.add({
            targets: flash,
            radius: (spec.holeRadius ?? 24) * 2.0,
            alpha: 0,
            duration: spec.wh360FlashMs ?? 100,
            onComplete: () => flash.destroy(),
        });
        for (let i = 0; i < n; i += 1) {
            const a = (i / n) * Math.PI * 2;
            const vx = Math.cos(a) * speed;
            const vy = Math.sin(a) * speed;
            this.spawnColoredCircleBullet(wh.x, wh.y, vx, vy, r, color);
        }
    }

    // BulletPattern.doopaSpiral 진입점. 3구체(HP 있음, 격파 가능) 스폰.
    spawnDoopaSpiral(originX, originY, spec) {
        const sp = spec.spiral ?? {};
        const count = sp.count ?? 3;
        const orbRadius = sp.radius ?? 10;
        const orbColor = sp.color ?? 0x88ff88;
        const hp = sp.hp ?? 15;
        const angularSpeed = sp.angularSpeedRadPerSec ?? 2.5;
        const radiusGrowth = sp.radiusGrowthPxPerSec ?? 60;
        const initialRadius = sp.initialRadius ?? 0;
        const time = this.time.now;
        const core = {
            x: originX,
            y: originY,
            angularSpeed,
            radiusGrowth,
            spawnTime: time,
            orbs: [],
        };
        for (let i = 0; i < count; i += 1) {
            const phaseAngle = (i / count) * Math.PI * 2;
            const px = originX + Math.cos(phaseAngle) * initialRadius;
            const py = originY + Math.sin(phaseAngle) * initialRadius;
            const orb = this.add.circle(px, py, orbRadius, orbColor);
            this.physics.add.existing(orb);
            this.spiralOrbsGroup.add(orb);
            orb.body.setCircle(orbRadius);
            orb.isSpiralOrb = true;
            orb.orbRadius = orbRadius;
            orb.hp = hp;
            orb.maxHp = hp;
            orb.core = core;
            orb.currentAngle = phaseAngle;
            orb.currentRadius = initialRadius;
            orb.warpCooldownUntil = 0;
            // stroke로 시각 강조 (보스 총알 스타일과 구분: 격파 가능 표시).
            orb.setStrokeStyle(2, 0xffffff);
            orb.isStroked = true; // applyBossBulletStyling 자동 skip
            core.orbs.push(orb);
        }
        this.spiralOrbCores.push(core);
        return null;
    }

    updateSpiralOrbs(time, delta) {
        if (!this.spiralOrbCores || this.spiralOrbCores.length === 0) return;
        const dt = delta / 1000;
        const margin = 60;
        const remaining = [];
        for (const core of this.spiralOrbCores) {
            const aliveOrbs = core.orbs.filter((o) => o && o.active);
            for (const orb of aliveOrbs) {
                orb.currentAngle += core.angularSpeed * dt;
                orb.currentRadius += core.radiusGrowth * dt;
                orb.x = core.x + Math.cos(orb.currentAngle) * orb.currentRadius;
                orb.y = core.y + Math.sin(orb.currentAngle) * orb.currentRadius;
                // 예측용 velocity: 반경 성장(반경 방향) + 접선 회전(접선 방향).
                const tanSpd = core.angularSpeed * orb.currentRadius;
                const cosA = Math.cos(orb.currentAngle);
                const sinA = Math.sin(orb.currentAngle);
                const vx = cosA * core.radiusGrowth - sinA * tanSpd;
                const vy = sinA * core.radiusGrowth + cosA * tanSpd;
                if (orb.body) orb.body.setVelocity(vx, vy);
                // 화면 밖 도달 시 조용히 소멸 (회복 없음).
                if (orb.x < -margin || orb.x > GameConfig.GAME_WIDTH + margin
                    || orb.y < -margin || orb.y > GameConfig.GAME_HEIGHT + margin) {
                    orb.destroy();
                }
            }
            const surviving = core.orbs.filter((o) => o && o.active);
            if (surviving.length > 0) remaining.push(core);
        }
        this.spiralOrbCores = remaining;
    }

    onSpiralOrbShot(orb, bullet) {
        if (!orb.active || orb.hp <= 0) return;
        if (bullet.pierce) {
            const time = this.time.now;
            const cd = bullet.contactCooldownMs ?? 0;
            if (time - (bullet.lastHitTargetTime ?? -Infinity) < cd) return;
            bullet.lastHitTargetTime = time;
            orb.hp -= bullet.damage ?? 1;
        } else {
            orb.hp -= bullet.damage ?? 1;
            bullet.destroy();
        }
        if (orb.hp <= 0) orb.destroy();
    }

    onSpiralOrbOrbitHit(orb, orbitOrb) {
        if (!orb.active || orb.hp <= 0) return;
        const time = this.time.now;
        orbitOrb.lastContactTime = time;
        if (time - orbitOrb.lastHitTargetTime < orbitOrb.weaponSpec.contactCooldownMs) return;
        orbitOrb.lastHitTargetTime = time;
        orb.hp -= orbitOrb.weaponSpec.damage;
        if (orb.hp <= 0) orb.destroy();
    }

    destroyDoopaHoles() {
        if (this.blackHoles) {
            for (const h of this.blackHoles) if (h && h.active) h.destroy();
        }
        if (this.whiteHoles) {
            for (const h of this.whiteHoles) if (h && h.active) h.destroy();
        }
        this.blackHoles = [];
        this.whiteHoles = [];
        this.holesRotation = 0;
        this.holesOscTime = 0;
        if (this.holesConnectorGraphics) this.holesConnectorGraphics.clear();
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
                AudioSettings.playSfx(this, 'gugu-scatter', { volume: 0.4 });
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
        AudioSettings.playSfx(this, 'gugu-bird-burst', { volume: 0.4 });
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
        tri.bladeSpawnTime = this.time.now;
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
            if (time - b.bladeSpawnTime < 1500) {
                AudioSettings.playSfx(this, 'freezer-p3-derive', { volume: 0.05 });
            }
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
        if (inter.spec.type === 'doopaCentering') {
            this.startDoopaCentering(inter.spec);
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
        if (!bullet.isGear && !bullet.isElectricField && !bullet.isCeilingOrb && !bullet.isSpiralOrb) bullet.destroy();
        this.lives -= 1;
        this.updateUI();
        if (this.lives <= 0) {
            this.gameOver = true;
            this.showGameOverMessage();
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
            this.showGameOverMessage();
        }
    }

    // 스이쿤 페이즈 1/2: 라이코 or 엔테이 살아있는 동안 스이쿤 몸통 피격 데미지 1/2.
    bossDamageMultiplier() {
        if (this.raikou && this.raikou.active) return 0.5;
        if (this.entei && this.entei.active) return 0.5;
        return 1.0;
    }

    onBossHit(bullet) {
        if (this.boss.isDead()) return;
        const mult = this.bossDamageMultiplier();
        const dmg = (bullet.damage ?? 1) * mult;
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

    onBossOrbitHit(orb) {
        if (this.boss.isDead()) return;
        const time = this.time.now;
        orb.lastContactTime = time;
        if (time - orb.lastHitTargetTime < orb.weaponSpec.contactCooldownMs) return;
        orb.lastHitTargetTime = time;
        this.boss.onHit(orb.weaponSpec.damage * this.bossDamageMultiplier());
    }

    // 라이코 피격: 데미지 100% 그대로 스이쿤 hp에 반영.
    onRaikouShot(raikou, bullet) {
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

    onRaikouOrbitHit(raikou, orb) {
        if (!this.boss || this.boss.isDead()) return;
        const time = this.time.now;
        orb.lastContactTime = time;
        if (time - orb.lastHitTargetTime < orb.weaponSpec.contactCooldownMs) return;
        orb.lastHitTargetTime = time;
        this.boss.onHit(orb.weaponSpec.damage);
    }

    // 라이코 몸통 접촉(돌진 아닌 상시 접촉): 플레이어 라이프 감소.
    // 돌진 자체 데미지는 performRaikouCharge 안에서 라인-원 판정으로 처리.
    onRaikouBodyHit(player) {
        if (!player) return;
        const time = this.time.now;
        if (!player.canBeHit(time)) return;
        player.onHit(time);
        this.recordBotHit('raikou-body', null, player);
        this.lives -= 1;
        this.updateUI();
        if (this.lives <= 0) {
            this.gameOver = true;
            this.showGameOverMessage();
        }
    }

    onBossDefeated() {
        this.cleared = true;
        this.player1.sprite.body.setVelocity(0, 0);
        this.player2.sprite.body.setVelocity(0, 0);
        this.bossBullets.children.each((b) => b && b.destroy());
        this.snowflakesGroup.children.each((s) => s && s.destroy());
        this.turretsGroup.children.each((t) => t && t.destroy());
        this.turretSpawnerSpec = null;
        this.doopaCores = [];
        this.spiralOrbCores = [];
        this.spiralOrbsGroup.children.each((o) => o && o.destroy());
        this.destroyDoopaHoles();
        this.doopaCenteringState = null;
        this.destroyCeilingOrbits();
        this.suicideDronesGroup.children.each((d) => d && d.destroy());
        this.suicideDroneSpawnerSpec = null;
        this.despawnBirdEmitters();
        this.despawnClouds();
        this.destroyRaikou();
        this.destroyEntei();
        this.destroySuicunePhase3();
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
        this.typeText(this.uiMessage, `클리어!\n${line1}\n${line2}`);
        this.clearAdvanceAt = this.time.now + 3000;
    }

    updateUI() {
        if (this.prevLives !== undefined && this.lives < this.prevLives) {
            this.playDamageFeedback();
        }
        this.prevLives = this.lives;
        this.uiLives.setText(`목숨: ${this.lives}/${this.maxLives}`);
    }

    playDamageFeedback() {
        this.cameras.main.shake(150, 0.008);
        if (this.damageFlash) {
            this.tweens.killTweensOf(this.damageFlash);
            this.damageFlash.setAlpha(0.3);
            this.tweens.add({
                targets: this.damageFlash, alpha: 0, duration: 250,
            });
        }
    }

    typeText(textObj, fullText, msPerChar = 40) {
        if (textObj.__typeEvent) textObj.__typeEvent.remove();
        textObj.setText('');
        let idx = 0;
        textObj.__typeEvent = this.time.addEvent({
            delay: msPerChar, loop: true,
            callback: () => {
                idx += 1;
                textObj.setText(fullText.substring(0, idx));
                if (idx >= fullText.length) {
                    textObj.__typeEvent.remove();
                    textObj.__typeEvent = null;
                }
            },
        });
    }

    showGameOverMessage() {
        if (this.__gameOverMessageShown) return;
        this.__gameOverMessageShown = true;
        this.typeText(this.uiMessage, 'GAME OVER\nEnter: 다시 도전 / ESC: 메뉴');
    }

    updateHpBar() {
        const ratio = this.boss.hp / this.boss.maxHp;
        const fullWidth = GameConfig.GAME_WIDTH - 40;
        this.uiHpBar.width = Math.max(0, fullWidth * ratio);
    }

    followHpBarLoss(delta) {
        if (!this.uiHpBar || !this.uiHpBarLoss) return;
        const target = this.uiHpBar.width;
        const current = this.uiHpBarLoss.width;
        const fullWidth = GameConfig.GAME_WIDTH - 40;
        // 초당 fullWidth의 5% 축소 (예: 폭 400 → 20px/s, 완전 사라지는 데 약 20초)
        const rate = fullWidth * 0.05;
        if (current > target) {
            this.uiHpBarLoss.width = Math.max(target, current - (delta / 1000) * rate);
        } else if (current < target) {
            this.uiHpBarLoss.width = target;
        }
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
        orb.lastContactTime = time;
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
            this.showGameOverMessage();
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
        orb.lastContactTime = time;
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
            this.showGameOverMessage();
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
        orb.lastContactTime = time;
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
                    this.showGameOverMessage();
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
        if (b.isSpiralOrb) return 'spiralOrb';
        if (b.isCeilingOrb) return 'ceilingOrb';
        if (b.isElectricField) return 'electricField';
        if (b.hasWavyMotion) return 'wavy';
        if (b.hasHoming) return 'homing';
        if (b.hasSeeking) return 'seeking';
        if (b.decelerating) return 'decelerating';
        if (b.isBird) return 'bird';
        if (b.isSnowflake) return 'snowflake';
        // 스이쿤 계열 (isTriangle보다 우선 — 번개미사일은 isTriangle 겸함)
        if (b.isWaveMissile) return 'waveMissile';
        if (b.isLightningMissile) return 'lightningMissile';
        if (b.isWaterDroplet) return 'waterDroplet';
        if (b.isFlame) return 'flame';
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

    // ===== 스이쿤 페이즈 1: 라이코 상태머신 =====
    // 라이코는 스이쿤 앞에서 시작 → aiming (조준 방향 프리즈, 경고선) → 순간 돌진(벽까지) → 4회 후 스이쿤 복귀 + 파도미사일 발사.
    // 주의: Boss 생성자에서 enterPhase(0)이 호출되는 시점엔 GameScene.boss가 아직 할당 전.
    // 여기서는 spec만 저장하고 실제 스폰은 첫 updateRaikou 프레임에서 (this.boss 준비됨).
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
        let r;
        if (this.textures.exists('raikou-sprite')) {
            if (!this.anims.exists('raikou-down')) {
                this.anims.create({ key: 'raikou-down',
                    frames: this.anims.generateFrameNumbers('raikou-sprite', { start: 0, end: 2 }),
                    frameRate: 6, repeat: -1 });
                this.anims.create({ key: 'raikou-left',
                    frames: this.anims.generateFrameNumbers('raikou-sprite', { start: 3, end: 5 }),
                    frameRate: 6, repeat: -1 });
                this.anims.create({ key: 'raikou-up',
                    frames: this.anims.generateFrameNumbers('raikou-sprite', { start: 6, end: 8 }),
                    frameRate: 6, repeat: -1 });
            }
            r = this.add.sprite(startX, startY, 'raikou-sprite');
            r.play('raikou-down');
            r.setDisplaySize(rSpec.radius * 4, rSpec.radius * 4);
            r.isSprite = true;
            r.facingDir = 'down';
        } else {
            r = this.add.circle(startX, startY, rSpec.radius, rSpec.color);
            r.setStrokeStyle(2, rSpec.strokeColor ?? 0x664400);
            r.isSprite = false;
        }
        r.setDepth(35);
        this.physics.add.existing(r);
        if (r.isSprite) {
            r.body.setCircle(rSpec.radius, 20 - rSpec.radius, 20 - rSpec.radius);
        } else {
            r.body.setCircle(rSpec.radius);
        }
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
        this.physics.add.overlap(r, this.playerBullets, (rr, b) => this.onRaikouShot(rr, b));
        this.physics.add.overlap(r, this.orbitOrbs, (rr, o) => this.onRaikouOrbitHit(rr, o));
        this.physics.add.overlap(this.player1.sprite, r, () => this.onRaikouBodyHit(this.player1));
        this.physics.add.overlap(this.player2.sprite, r, () => this.onRaikouBodyHit(this.player2));
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

    // ===== 스이쿤 페이즈 1→2 인터루드 (roaring_waves) =====
    startRoaringWavesInterlude(spec) {
        // 라이코 제거 (연출: 라이코가 물러남)
        this.destroyRaikou();
        // 파도 5연발 스케줄. missile 스펙을 임시 waveMissileSpec로 채워 fireWaveMissiles 재사용.
        const burstSpec = spec.waveBurst ?? {};
        const missile = burstSpec.missile ?? {};
        this.roaringWaves = {
            missile,
            burstsRemaining: burstSpec.count ?? 5,
            nextBurstAt: this.time.now + (burstSpec.delayMs ?? 0),
            intervalMs: burstSpec.intervalMs ?? 200,
        };
        // 엔테이 등장
        if (spec.entei) {
            this.spawnEntei(spec.entei);
        }
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

    // ===== 스이쿤 페이즈 2→3 인터루드 (converging_waves) =====
    // 엔테이 즉시 제거 → 스이쿤이 맵 중앙 xy로 슬라이딩(3초) → 도착 후 파도미사일 9연발(0.2초 간격).
    startConvergingWavesInterlude(spec) {
        this.destroyEntei();
        if (!this.boss || !this.boss.sprite) return;
        const burstSpec = spec.waveBurst ?? {};
        this.convergingWaves = {
            slideStartX: this.boss.sprite.x,
            slideStartY: this.boss.sprite.y,
            slideTargetX: GameConfig.GAME_WIDTH / 2,
            slideTargetY: GameConfig.GAME_HEIGHT / 2,
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

    // ===== 페이즈 2 엔테이 =====
    // 인터루드에서 spawnEntei로 생성 (상태 'entering'). enterEnteiStubPhase에서 활성화 ('active').
    spawnEntei(spec) {
        if (!this.boss || !this.boss.sprite) return;
        const bx = this.boss.sprite.x;
        const by = this.boss.sprite.y;
        const startY = by + (spec.startOffsetY ?? -30);
        const targetY = by + (spec.targetOffsetY ?? 34);
        const eRadius = spec.radius ?? 18;
        let e;
        if (this.textures.exists('entei-sprite')) {
            if (!this.anims.exists('entei-down')) {
                this.anims.create({ key: 'entei-down',
                    frames: this.anims.generateFrameNumbers('entei-sprite', { start: 0, end: 2 }),
                    frameRate: 6, repeat: -1 });
                this.anims.create({ key: 'entei-left',
                    frames: this.anims.generateFrameNumbers('entei-sprite', { start: 3, end: 5 }),
                    frameRate: 6, repeat: -1 });
                this.anims.create({ key: 'entei-up',
                    frames: this.anims.generateFrameNumbers('entei-sprite', { start: 6, end: 8 }),
                    frameRate: 6, repeat: -1 });
            }
            e = this.add.sprite(bx, startY, 'entei-sprite');
            e.play('entei-down');
            e.setDisplaySize(eRadius * 4, eRadius * 4);
            e.isSprite = true;
            e.facingDir = 'down';
        } else {
            e = this.add.circle(bx, startY, eRadius, spec.color ?? 0xff6644);
            e.setStrokeStyle(2, spec.strokeColor ?? 0x883322);
            e.isSprite = false;
        }
        e.setDepth(30);
        e.setAlpha(spec.startAlpha ?? 0.25);
        this.physics.add.existing(e);
        if (e.isSprite) {
            e.body.setCircle(eRadius, 20 - eRadius, 20 - eRadius);
        } else {
            e.body.setCircle(eRadius);
        }
        e.body.setImmovable(true);
        e.spec = spec;
        e.state = 'entering';
        e.stateStartTime = this.time.now;
        e.entranceStartX = bx;
        e.entranceStartY = startY;
        e.entranceTargetX = bx;
        e.entranceTargetY = targetY;
        this.entei = e;
        // 콜리전: 총알 오버랩은 활성화 (다만 entering 중엔 no-op).
        this.physics.add.overlap(e, this.playerBullets, (ee, b) => this.onEnteiShot(ee, b));
        this.physics.add.overlap(e, this.orbitOrbs, (ee, o) => this.onEnteiOrbitHit(ee, o));
        this.physics.add.overlap(this.player1.sprite, e, () => this.onEnteiBodyHit(this.player1));
        this.physics.add.overlap(this.player2.sprite, e, () => this.onEnteiBodyHit(this.player2));
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
                // 3발 모두 발사 → 다음 서브사이클 or 복귀
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
                this.setBeastFacing(e, dx, dy, 'entei');
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
        const tx = p.sprite.x;
        const ty = p.sprite.y;
        const dx = tx - e.x;
        const dy = ty - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        e.aimVecX = dx / dist;
        e.aimVecY = dy / dist;
        const end = this.enteiWallIntersect(e.x, e.y, e.aimVecX, e.aimVecY, e.spec.radius);
        e.aimEndX = end.x;
        e.aimEndY = end.y;
        this.setBeastFacing(e, e.aimVecX, e.aimVecY, 'entei');
    }

    enteiWallIntersect(x, y, vx, vy, radius) {
        const W = GameConfig.GAME_WIDTH;
        const H = GameConfig.GAME_HEIGHT;
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
        AudioSettings.playSfx(this, 'entei-charge', { volume: 0.4 });
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
                this.recordBotHit('entei-charge', null, player);
                this.lives -= 1;
                this.updateUI();
                if (this.lives <= 0) {
                    this.gameOver = true;
                    this.showGameOverMessage();
                }
            }
        }
        // 잔상 (라이코와 동일 배열 재활용 — 동시 존재 안 함)
        const N = e.spec.afterimageCount ?? 5;
        const fadeMs = e.spec.afterimageFadeMs ?? 300;
        for (let i = 1; i <= N; i += 1) {
            const t = i / (N + 1);
            const ax = startX + (endX - startX) * t;
            const ay = startY + (endY - startY) * t;
            const g = this.add.circle(ax, ay, e.spec.radius, e.spec.color);
            g.setDepth(30);
            g.setAlpha(0.5);
            this.raikouAfterimages.push({
                sprite: g,
                expireAt: time + fadeMs,
                fadeMs,
            });
        }
        // 순간 이동
        e.x = endX;
        e.y = endY;
        // 돌진 착지 즉시 첫 화방
        e.state = 'flamethrower';
        e.stateStartTime = time;
        e.flameShotsFired = 0;
        e.nextFlameAt = time; // 즉시 첫 발
    }

    renderEnteiOverlays(time) {
        // 라이코 오버레이 그래픽스를 공유 사용 (동시 존재 안 함).
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
        AudioSettings.playSfx(this, 'entei-flame', { volume: 0.4 });
        // 매 화방마다 새로 조준
        let p = null;
        if (this.player1 && !this.player1.isInvincible) p = this.player1;
        else if (this.player2 && !this.player2.isInvincible) p = this.player2;
        let baseRad;
        if (p) baseRad = Math.atan2(p.sprite.y - e.y, p.sprite.x - e.x);
        else baseRad = Math.PI / 2; // 폴백: 아래쪽
        const baseDeg = Phaser.Math.RadToDeg(baseRad);
        this.setBeastFacing(e, Math.cos(baseRad), Math.sin(baseRad), 'entei');
        const N = spec.bulletCount ?? 30;
        const spread = spec.spreadDeg ?? 15;
        const a = spec.a ?? 120;
        for (let i = 0; i < N; i += 1) {
            const angle = baseDeg + (Math.random() * 2 - 1) * spread;
            const rad = Phaser.Math.DegToRad(angle);
            const speed = a + Math.random() * 2 * a; // [a, 3a]
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
            bullet.isFlame = true;
        }
    }

    fireEnteiWaveMissiles(time, waveSpec) {
        // 페이즈1과 같은 방식: 스이쿤 위치에서 90발 360도.
        // waveMissileSpec을 임시 교체 후 fireWaveMissiles 재사용.
        if (!waveSpec) return;
        const prev = this.waveMissileSpec;
        this.waveMissileSpec = waveSpec;
        this.fireWaveMissiles(time);
        this.waveMissileSpec = prev;
    }

    // 엔테이 피격 로직. entering 중엔 무적, active에서 100% 데미지 → 스이쿤 hp에.
    // 페이즈 2 스이쿤 데미지 배율은 라이코 방식(엔테이 살아있으면 1/2) 채용 (TODO 조정).
    onEnteiShot(entei, bullet) {
        if (!this.boss || this.boss.isDead()) return;
        if (!entei.state || entei.state === 'entering') return;
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

    onEnteiOrbitHit(entei, orb) {
        if (!this.boss || this.boss.isDead()) return;
        if (!entei.state || entei.state === 'entering') return;
        const time = this.time.now;
        orb.lastContactTime = time;
        if (time - orb.lastHitTargetTime < orb.weaponSpec.contactCooldownMs) return;
        orb.lastHitTargetTime = time;
        this.boss.onHit(orb.weaponSpec.damage);
    }

    onEnteiBodyHit(player) {
        if (!player || !this.entei) return;
        if (this.entei.state === 'entering') return;
        const time = this.time.now;
        if (!player.canBeHit(time)) return;
        player.onHit(time);
        this.recordBotHit('entei-body', null, player);
        this.lives -= 1;
        this.updateUI();
        if (this.lives <= 0) {
            this.gameOver = true;
            this.showGameOverMessage();
        }
    }

    updateRaikou(time, delta) {
        // 스폰 지연 처리: Boss 생성자 안에서 startRaikouSpawner가 호출되므로 여기서 실제 스폰.
        if (this.raikouSpawnPending && this.boss && this.boss.sprite && !this.raikou) {
            this.spawnRaikou();
            this.raikouSpawnPending = false;
        }
        // 잔상 페이드
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
            // 사이클 시작 시 한 번만 방향 계산 (해석 a: 조준 유지)
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
                this.setBeastFacing(r, dx, dy, 'raikou');
            }
        }
        this.renderRaikouOverlays(time);
    }

    setBeastFacing(sprite, dx, dy, keyPrefix) {
        if (!sprite.isSprite) return;
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
        const dir = Math.abs(dx) >= Math.abs(dy)
            ? (dx < 0 ? 'left' : 'right')
            : (dy < 0 ? 'up' : 'down');
        if (dir === sprite.facingDir) return;
        sprite.facingDir = dir;
        const animKey = dir === 'right' ? `${keyPrefix}-left` : `${keyPrefix}-${dir}`;
        sprite.play(animKey, true);
        sprite.setFlipX(dir === 'right');
    }

    computeRaikouAim(r) {
        // 일반 상태(무적 아님) 캐릭터 조준. 규칙: 둘 중 !isInvincible 인 캐릭터.
        let p = null;
        if (this.player1 && !this.player1.isInvincible) p = this.player1;
        else if (this.player2 && !this.player2.isInvincible) p = this.player2;
        if (!p) {
            // 안전장치: 둘 다 무적이면 마지막 방향 유지
            return;
        }
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
        this.setBeastFacing(r, r.aimVecX, r.aimVecY, 'raikou');
    }

    raikouWallIntersect(x, y, vx, vy) {
        const W = GameConfig.GAME_WIDTH;
        const H = GameConfig.GAME_HEIGHT;
        const EPS = 0.0001;
        // 라이코 반경만큼 벽 안쪽으로 clamp
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
        AudioSettings.playSfx(this, 'raikou-charge', { volume: 0.4 });
        const startX = r.x;
        const startY = r.y;
        const endX = r.aimEndX;
        const endY = r.aimEndY;
        // 라인-원 판정으로 플레이어 피격 (돌진은 순간이라 물리 충돌 대신 궤적 스윕 판정).
        const chargeHitRadius = r.spec.radius;
        for (const player of [this.player1, this.player2]) {
            if (!player || !player.sprite || !player.sprite.active) continue;
            if (!player.canBeHit(time)) continue;
            const dist = this.pointToSegmentDistance(
                player.sprite.x, player.sprite.y,
                startX, startY, endX, endY
            );
            if (dist <= chargeHitRadius + player.size / 2) {
                // 1라이프 감소
                player.onHit(time);
                this.recordBotHit('raikou-charge', null, player);
                this.lives -= 1;
                this.updateUI();
                if (this.lives <= 0) {
                    this.gameOver = true;
                    this.showGameOverMessage();
                }
            }
        }
        // 잔상 스폰
        const N = r.spec.afterimageCount ?? 5;
        const fadeMs = r.spec.afterimageFadeMs ?? 300;
        for (let i = 1; i <= N; i += 1) {
            const t = i / (N + 1);
            const ax = startX + (endX - startX) * t;
            const ay = startY + (endY - startY) * t;
            const g = this.add.circle(ax, ay, r.spec.radius, r.spec.color);
            g.setDepth(30);
            g.setAlpha(0.5);
            this.raikouAfterimages.push({
                sprite: g,
                expireAt: time + fadeMs,
                fadeMs,
            });
        }
        // 순간 이동
        r.x = endX;
        r.y = endY;
        // 도착 위치에서 뒤쪽 방향(원래 있던 방향)으로 번개미사일 3발 발사.
        this.fireRaikouLightningMissiles(r, time);
        r.chargeCount += 1;
        if (r.chargeCount >= (r.spec.chargesPerCycle ?? 4)) {
            r.chargeCount = 0;
            r.state = 'returning';
            r.stateStartTime = time;
            // 파도미사일 단발 발사
            this.fireWaveMissiles(time);
        } else {
            r.state = 'aiming';
            r.stateStartTime = time;
            r.aimComputed = false;
        }
    }

    renderRaikouOverlays(time) {
        // 경고선 (aiming 상태만)
        const og = this.raikouOverlayGraphics;
        og.clear();
        const r = this.raikou;
        if (r && r.active && r.state === 'aiming') {
            const spec = r.spec;
            og.lineStyle(spec.radius * 2, spec.warnColor ?? 0xff2222, spec.warnAlpha ?? 0.55);
            og.lineBetween(r.x, r.y, r.aimEndX, r.aimEndY);
        }
        // 목줄 (스이쿤-라이코 사이 항상)
        const lg = this.leashGraphics;
        lg.clear();
        if (r && r.active && this.boss && this.boss.sprite && this.boss.sprite.active && this.leashSpec) {
            const ls = this.leashSpec;
            lg.lineStyle(ls.width ?? 2, ls.color ?? 0xcccccc, ls.alpha ?? 0.7);
            lg.lineBetween(this.boss.sprite.x, this.boss.sprite.y, r.x, r.y);
        }
    }

    fireWaveMissiles(time) {
        const spec = this.waveMissileSpec;
        if (!spec || !this.boss || !this.boss.sprite) return;
        const N = spec.bulletCount ?? 90;
        const cx = this.boss.sprite.x;
        const cy = this.boss.sprite.y;
        const a = spec.a ?? 100;
        const coef = spec.waveCoef ?? 2;
        const period = spec.periodSec ?? 1.0;
        // 파도 SFX: 발사 즉시 1회 + periodSec 간격으로 수명 동안 반복
        AudioSettings.playSfx(this, 'suicune-wave', { volume: 0.4 });
        const periodMs = period * 1000;
        const repeats = Math.max(0, Math.floor((spec.lifespanMs ?? 8000) / periodMs) - 1);
        if (repeats > 0) {
            this.time.addEvent({
                delay: periodMs, repeat: repeats - 1,
                callback: () => AudioSettings.playSfx(this, 'suicune-wave', { volume: 0.4 }),
            });
        }
        // phase offset: 명시 값 우선, startFromZero면 자동 계산 (sin(2π·phase/period) = -1/coef).
        let phaseOffsetSec = spec.phaseOffsetSec ?? 0;
        if (spec.startFromZero && coef > 0) {
            const s = Math.max(-1, Math.min(1, -1 / coef));
            phaseOffsetSec = Math.asin(s) / (2 * Math.PI) * period;
        }
        const initV = a * (1 + coef * Math.sin((2 * Math.PI * phaseOffsetSec) / period));
        for (let i = 0; i < N; i += 1) {
            const angle = (i / N) * Math.PI * 2;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            const bullet = this.spawnColoredCircleBullet(cx, cy, dx * initV, dy * initV, spec.radius ?? 6, spec.color ?? 0x66ccff);
            if (!bullet) continue;
            if (spec.strokeColor !== undefined && bullet.setStrokeStyle) {
                bullet.setStrokeStyle(1, spec.strokeColor);
            }
            bullet.isWaveMissile = true;
            bullet.waveDx = dx;
            bullet.waveDy = dy;
            bullet.waveA = a;
            bullet.waveCoef = coef;
            bullet.wavePeriodSec = period;
            bullet.wavePhaseOffsetSec = phaseOffsetSec;
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
            const coef = b.waveCoef ?? 2;
            const phaseOffset = b.wavePhaseOffsetSec ?? 0;
            const tSec = (time - b.waveStartTime) / 1000 + phaseOffset;
            const v = b.waveA * (1 + coef * Math.sin((2 * Math.PI * tSec) / period));
            b.body.setVelocity(b.waveDx * v, b.waveDy * v);
        });
    }

    // 라이코 돌진 도착 위치에서 뒤쪽 방향으로 3발 발사. 각 미사일은 자기 초기 각도 A를 기억,
    // 0.2초마다 A±60도 랜덤 재조준 (지그재그 = 번개 느낌). 모양은 노란 이등변삼각형.
    fireRaikouLightningMissiles(r, time) {
        const spec = this.lightningMissileSpec;
        if (!spec) return;
        // 뒤쪽 = 돌진 방향(aimVec)의 반대
        const baseRad = Math.atan2(-r.aimVecY, -r.aimVecX);
        const baseDeg = Phaser.Math.RadToDeg(baseRad);
        const N = spec.bulletCount ?? 3;
        const spread = spec.spreadDeg ?? 15;
        const w = spec.width ?? 8;    // 좌우 (밑변)
        const h = spec.height ?? 14;  // 앞뒤 (팁~밑변)
        for (let i = 0; i < N; i += 1) {
            let offset = 0;
            if (N > 1) offset = ((i / (N - 1)) - 0.5) * 2 * spread;
            const A = baseDeg + offset;
            const rad = Phaser.Math.DegToRad(A);
            const speed = spec.speed ?? 220;
            const vx = Math.cos(rad) * speed;
            const vy = Math.sin(rad) * speed;
            // spawnBossTriangle 패턴: 팁이 위쪽(-y)이고 rotation = 진행각 + π/2 로 정렬.
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
            bullet.lightningRedirectRangeDeg = spec.redirectRangeDeg ?? 60;
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

    // 페이즈 2 진입: 인터루드에서 이미 엔테이 스폰됨. 여기서 활성화 (state → 'active').
    // 라이코가 살아있으면 안전장치로 제거 (인터루드에서 destroyRaikou 호출했지만 방어).
    enterEnteiStubPhase() {
        this.destroyRaikou();
        this.activateEntei();
    }

    // ===== 페이즈 3 (스이쿤 단독) =====
    // 대사이클: (돌진 → 파도 90발 → 물대포×3) × subCyclesPerGrand
    //         → 그랜드(중앙 xy 돌진 → 파도 9연발) → 상단 복귀 → 반복.
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
            waterBeams: [], // 발사 후 워터빔 잔상 (페이드용, 순수 시각)
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
            // 새 조준 스폰 (시작 간격 도래한 만큼)
            while (s.waterAimStarted < targetCount) {
                const dueAt = s.stateStartTime + s.waterAimStarted * (wc.aimStartIntervalMs ?? 500);
                if (time < dueAt) break;
                const shot = this.createSuicuneWaterCannonShot(dueAt, spec);
                if (!shot) break; // 무적 캐릭터만 있으면 다음 프레임 재시도
                s.waterShots.push(shot);
                s.waterAimStarted += 1;
            }
            // 발사 시점 도래한 shot 판정
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
                s.stage = 'subCycleGap';
                s.stateStartTime = time;
            }
        } else if (s.stage === 'subCycleGap') {
            // 물대포 마지막 발사 후 짧은 딜링 창. 이 상태에서 스이쿤은 정지.
            const delay = spec.subCycleDelayMs ?? 700;
            if (time - s.stateStartTime >= delay) {
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

    // 스이쿤 돌진: 조준 지점으로 순간이동 + 잔상 + 라인-원 판정. 소사이클·그랜드 공용.
    performSuicuneCharge(time, endX, endY, spec) {
        AudioSettings.playSfx(this, 'suicune-charge', { volume: 0.4 });
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
                this.recordBotHit('suicune-charge', null, player);
                this.lives -= 1;
                this.updateUI();
                if (this.lives <= 0) {
                    this.gameOver = true;
                    this.showGameOverMessage();
                }
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

    // 물대포 조준선 하나 생성. 조준 시점 스이쿤 위치·무적아닌 캐릭터 방향으로 벽까지 라인 고정.
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
        AudioSettings.playSfx(this, 'suicune-water', { volume: 0.4 });
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
                this.recordBotHit('suicune-water', null, player);
                this.lives -= 1;
                this.updateUI();
                if (this.lives <= 0) {
                    this.gameOver = true;
                    this.showGameOverMessage();
                }
            }
        }
        this.spawnSuicuneWaterDroplets(shot.endX, shot.endY, wc.droplet);
    }

    // 물방울: 벽 접점에서 벽 안쪽(반대편) 방향으로 180도 반원 부채꼴 확산.
    spawnSuicuneWaterDroplets(x, y, spec) {
        if (!spec) return;
        const W = GameConfig.GAME_WIDTH;
        const H = GameConfig.GAME_HEIGHT;
        // 접점에서 가장 가까운 벽의 안쪽 방향(노멀) 판별.
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
            const t = N > 1 ? (i / (N - 1)) - 0.5 : 0; // -0.5 ~ +0.5
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
            bullet.isWaterDroplet = true;
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
