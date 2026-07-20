class Boss {
    constructor(scene, data, level, opts) {
        this.scene = scene;
        this.level = Math.max(1, level ?? 1);
        if (data.buildLevelData) {
            this.data = data.buildLevelData(this.level);
            this.maxHp = this.data.maxHp;
        } else {
            this.data = data;
            this.maxHp = Math.round(data.maxHp * Math.pow(1.20, this.level - 1));
        }
        this.hp = this.maxHp;
        this.phaseIndex = -1;
        this.activePatterns = [];
        this.sideDirection = 1;
        this.baseAttackLastTime = 0;
        this.pendingNextPhase = null;
        this.pendingStartTime = 0;
        this.phaseTransitionMs = 5000;

        const startX = GameConfig.GAME_WIDTH / 2;
        const startY = data.startY ?? 140;

        this.sprite = scene.add.rectangle(
            startX, startY, data.size, data.size, data.color
        );
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setImmovable(true);
        this.sprite.body.setSize(data.size, data.size);

        this.spawnTime = scene.time.now;
        if (!opts || opts.autoStart !== false) {
            this.enterPhase(0);
        }
    }

    enterPhase(index) {
        const prevPatterns = this.activePatterns;
        this.phaseIndex = index;
        this.activePatterns = [];
        const phase = this.data.phases[index];
        if (!phase) return;
        if (phase.resetSideDirection) this.sideDirection = 1;
        if (phase.clouds && this.scene.spawnClouds) {
            this.scene.spawnClouds(phase.clouds);
        }
        if (phase.birdEmitters && this.scene.spawnBirdEmitters) {
            this.scene.spawnBirdEmitters(phase.birdEmitters);
        }
        if (phase.turretSpawner && this.scene.startTurretSpawner) {
            this.scene.startTurretSpawner(phase.turretSpawner);
        }
        if (phase.suicideDroneSpawner && this.scene.startSuicideDroneSpawner) {
            this.scene.startSuicideDroneSpawner(phase.suicideDroneSpawner);
        }
        if (phase.harvesterDroneSpawner && this.scene.startHarvesterDroneSpawner) {
            this.scene.startHarvesterDroneSpawner(phase.harvesterDroneSpawner);
        }
        if (phase.turretSpawnerOverride && this.scene.setTurretSpawnerOverride) {
            this.scene.setTurretSpawnerOverride(phase.turretSpawnerOverride);
        }
        if (phase.turretMotion && this.scene.startTurretMotion) {
            this.scene.startTurretMotion(phase.turretMotion);
        }
        if (phase.invincibleTurret && this.scene.spawnInvincibleTurret) {
            this.scene.spawnInvincibleTurret(phase.invincibleTurret);
        }
        if (phase.turretConnections && this.scene.startTurretConnections) {
            this.scene.startTurretConnections(phase.turretConnections);
        }
        if (phase.sequence) {
            const reused = prevPatterns.find(
                (p) => p instanceof Sequence && p.spec === phase.sequence && !p.done,
            );
            if (reused) {
                this.activePatterns.push(reused);
            } else {
                this.activePatterns.push(new Sequence(this.scene, this, phase.sequence));
            }
        } else if (phase.patterns) {
            for (const patternSpec of phase.patterns) {
                this.activePatterns.push(new BulletPattern(this.scene, this, patternSpec));
            }
        }
    }

    update(time, delta) {
        if (this.isDead()) return;

        const move = this.data.movement ?? {};
        const type = move.type ?? 'pendulum';
        if (type === 'pendulum') {
            const speed = move.speedRadPerSec ?? 1.0;
            const range = move.rangePx ?? 100;
            const t = (time - this.spawnTime) / 1000;
            this.sprite.x = GameConfig.GAME_WIDTH / 2 + Math.sin(t * speed) * range;
        } else if (type === 'fixed') {
            // no movement
        }

        this.activePatterns = this.activePatterns.filter((p) => p.update(time, delta));

        const baseAttack = this.currentBaseAttack();
        const baseAttackActive = baseAttack &&
            (this.phaseIndex >= 0 || this.activePatterns.length > 0);
        if (baseAttackActive) {
            const interval = baseAttack.intervalMs ?? 500;
            if (time - this.baseAttackLastTime >= interval) {
                this.fireBaseAttack(time);
                this.baseAttackLastTime = time;
            }
        } else {
            this.baseAttackLastTime = time;
        }

        if (this.phaseIndex >= 0) {
            if (this.pendingNextPhase === null) {
                const nextPhase = this.data.phases[this.phaseIndex + 1];
                const threshold = nextPhase ? this.maxHp * nextPhase.hpEnterRatio : null;
                if (nextPhase && this.hp <= threshold) {
                    this.pendingNextPhase = this.phaseIndex + 1;
                    this.pendingStartTime = time;
                    const currPhase = this.data.phases[this.phaseIndex];
                    const interludeName = currPhase && currPhase.interludeOnExit;
                    if (interludeName && this.scene.triggerInterlude) {
                        this.scene.triggerInterlude(interludeName);
                    }
                }
            } else if (time - this.pendingStartTime >= this.phaseTransitionMs) {
                this.enterPhase(this.pendingNextPhase);
                this.pendingNextPhase = null;
            }
        }
    }

    currentBaseAttack() {
        const phase = this.data.phases?.[this.phaseIndex];
        return (phase && phase.baseAttack) || this.data.baseAttack;
    }

    fireBaseAttack(time) {
        const cfg = this.currentBaseAttack();
        if (!cfg) return;

        if (cfg.type === 'gearMultiTarget') {
            if (this.scene.fireGearBurst) this.scene.fireGearBurst(this, cfg);
            return;
        }

        let targetX;
        let targetY;
        const target = this.scene.getActivePlayerPos?.();
        if (target) {
            targetX = target.x;
            targetY = target.y;
        } else {
            targetX = 240;
            targetY = 500;
        }
        const dx = targetX - this.sprite.x;
        const dy = targetY - this.sprite.y;
        const baseAngleDeg = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
        const spec = cfg.bulletSpec;
        const speed = spec.speed ?? 200;
        for (const offsetDeg of cfg.angles) {
            const rad = Phaser.Math.DegToRad(baseAngleDeg + offsetDeg);
            const vx = Math.cos(rad) * speed;
            const vy = Math.sin(rad) * speed;
            let bullet = null;
            if (this.scene.spawnColoredCircleBullet) {
                bullet = this.scene.spawnColoredCircleBullet(
                    this.sprite.x, this.sprite.y,
                    vx, vy,
                    spec.radius ?? 6,
                    spec.color ?? 0xffcc44,
                );
            } else if (this.scene.spawnBossBullet) {
                bullet = this.scene.spawnBossBullet(this.sprite.x, this.sprite.y, vx, vy);
            }
            if (spec.sinX && bullet) {
                const s = spec.sinX;
                const ampBase = s.amplitude ?? 30;
                const ampR = s.amplitudeRandomRange ?? 0;
                const amp = ampBase + (Math.random() * 2 - 1) * ampR;
                const phase = s.phaseRandom ? Math.random() * Math.PI * 2 : 0;
                bullet.hasWavyMotion = true;
                bullet.wavyStartTime = time;
                bullet.wavyVx = vx;
                bullet.wavyVy = vy;
                bullet.wavyAmp = amp;
                bullet.wavyFreq = s.frequency ?? 1;
                bullet.wavyPhase = phase;
            }
        }
    }

    onHit(damage) {
        if (this.isDead()) return;
        if (this.pendingNextPhase !== null) return;
        this.hp = Math.max(0, this.hp - damage);
    }

    isDead() {
        return this.hp <= 0;
    }

    destroy() {
        this.activePatterns = [];
        this.sprite.destroy();
    }
}
