class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        this.lives = GameConfig.MAX_LIVES;
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
            loadout.p1, weaponLevels
        );
        this.player2 = new Player(
            this,
            GameConfig.GAME_WIDTH * 0.65, bottomY,
            keys2, GameConfig.PLAYER_2_COLOR, true,
            loadout.p2, weaponLevels
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
            this.boss.sprite, this.orbitOrbs,
            (bossSprite, orb) => this.onBossOrbitHit(orb)
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

        this.uiEndpointCounter = this.add.text(10, 55, '', {
            fontSize: '11px', color: '#ffcc66',
        });

        this.add.text(10, GameConfig.GAME_HEIGHT - 22, 'ESC: 메뉴로', {
            fontSize: '12px', color: '#666677',
        });

        this.updateUI();
    }

    update(time, delta) {
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.scene.start('BootScene');
            return;
        }

        if (this.cleared) {
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
        if (this.uiEndpointCounter) {
            this.uiEndpointCounter.setText(`끝점 카운터: ${st.counter} / ${cfg.triggerCount ?? 5}`);
        }
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

        if (elapsed >= (spec.freezeAtMs ?? 3000)) {
            this.freezeAllSnowflakes(spec);
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
        bullet.destroy();
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
        this.despawnBirdEmitters();
        this.despawnClouds();
        this.boss.destroy();

        const bossData = this.boss.data;
        const bossProgress = this.registry.get('bossProgress') || {};
        const weaponLevels = this.registry.get('weaponLevels') || {};
        const loadout = this.registry.get('loadout');

        const prevBossLv = bossProgress[bossData.id] ?? 0;
        const newBossLv = Math.max(prevBossLv, this.bossLevel);
        bossProgress[bossData.id] = newBossLv;

        const rewardId = bossData.rewardWeapon;
        const prevWpnLv = weaponLevels[rewardId] ?? 0;
        const newWpnLv = Math.max(prevWpnLv, this.bossLevel);
        const isLevelUp = newWpnLv > prevWpnLv;
        weaponLevels[rewardId] = newWpnLv;

        this.registry.set('bossProgress', bossProgress);
        this.registry.set('weaponLevels', weaponLevels);
        Storage.save(weaponLevels, loadout, bossProgress);

        const wpnName = Weapons[rewardId]?.name ?? rewardId;
        const msg = isLevelUp
            ? `클리어!\n${wpnName} Lv${newWpnLv} 해금!`
            : `클리어!\n${wpnName} 이미 Lv${prevWpnLv}`;
        this.uiMessage.setText(msg);
        this.clearAdvanceAt = this.time.now + 3000;
    }

    updateUI() {
        this.uiLives.setText(`목숨: ${this.lives}/${GameConfig.MAX_LIVES}`);
    }

    updateHpBar() {
        const ratio = this.boss.hp / this.boss.maxHp;
        const fullWidth = GameConfig.GAME_WIDTH - 40;
        this.uiHpBar.width = Math.max(0, fullWidth * ratio);
    }
}
