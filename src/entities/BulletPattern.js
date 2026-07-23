class BulletPattern {
    constructor(scene, boss, spec) {
        this.scene = scene;
        this.boss = boss;
        this.spec = spec;

        this.elapsedMs = 0;
        this.shotsFired = 0;
        this.lastShotTime = -Infinity;
        this.baseAngleOffset = 0;
        this.done = false;
    }

    update(time, delta) {
        if (this.done) return false;

        this.elapsedMs += delta;

        if (this.spec.durationMs != null && this.elapsedMs >= this.spec.durationMs) {
            this.done = true;
            return false;
        }
        if (this.spec.maxShots != null && this.shotsFired >= this.spec.maxShots) {
            this.done = true;
            return false;
        }

        const interval = this.spec.intervalMs ?? 1000;
        if (time - this.lastShotTime >= interval) {
            this.fire();
            this.lastShotTime = time;
            this.shotsFired += 1;
        }

        return true;
    }

    fire() {
        const name = this.spec.name;
        if (name && name.endsWith('wave12') && this.scene.cache.audio.exists('freezer-p1-wave')) {
            this.scene.sound.play('freezer-p1-wave', { volume: 0.05 });
        }
        if (name && name.endsWith('wall360') && this.scene.cache.audio.exists('freezer-p1-wall')) {
            this.scene.sound.play('freezer-p1-wall', { volume: 0.25 });
        }
        if (name === 'p3_blade' && this.scene.cache.audio.exists('freezer-p3-blade')) {
            this.scene.sound.play('freezer-p3-blade', { volume: 0.35 });
        }
        const count = this.spec.count ?? 1;
        const angleSpreadDeg = this.spec.angleSpreadDeg ?? 0;
        const speed = this.spec.speed ?? 150;

        const originX = this.boss.sprite.x;
        const originY = this.boss.sprite.y;

        let baseStartAngleDeg = this.spec.startAngleDeg ?? 90;
        if (this.spec.aimAtActivePlayer && this.scene.getActivePlayerPos) {
            const target = this.scene.getActivePlayerPos();
            if (target) {
                baseStartAngleDeg = Phaser.Math.RadToDeg(
                    Math.atan2(target.y - originY, target.x - originX),
                );
            }
        }
        const startAngleDeg = baseStartAngleDeg + this.baseAngleOffset;

        const useSide = this.spec.dynamicSideDirection && this.spec.sideSpeed;
        const sideDir = useSide ? (this.boss.sideDirection ?? 1) : 0;

        for (let i = 0; i < count; i += 1) {
            const angleDeg = startAngleDeg + i * angleSpreadDeg;
            const rad = Phaser.Math.DegToRad(angleDeg);
            const vx = Math.cos(rad) * speed;
            const vy = Math.sin(rad) * speed;

            let sprite;
            if (this.spec.shape === 'triangle') {
                sprite = this.scene.spawnBossTriangle(originX, originY, vx, vy, angleDeg, this.spec);
            } else if (this.spec.shape === 'blade') {
                sprite = this.scene.spawnBladeMissile(originX, originY, vx, vy, angleDeg, this.spec);
            } else if (this.spec.shape === 'orbCarrier') {
                sprite = this.scene.spawnOrbCarrier(originX, originY, angleDeg, this.spec);
            } else if (this.spec.shape === 'snowflake') {
                if (this.spec.snowflake) {
                    sprite = this.scene.spawnSnowflake(originX, originY, vx, vy, angleDeg, this.spec.snowflake);
                } else {
                    sprite = this.scene.spawnPlainSnowflake(originX, originY, vx, vy, this.spec);
                }
            } else {
                sprite = this.scene.spawnBossBullet(originX, originY, vx, vy);
            }

            if (useSide && sprite) {
                sprite.hasSideMotion = true;
                sprite.forwardSpeed = speed;
                sprite.sideSpeed = this.spec.sideSpeed;
                sprite.sideDirectionValue = sideDir;
            }
        }

        this.baseAngleOffset += this.spec.rotationPerShotDeg ?? 0;
    }
}
