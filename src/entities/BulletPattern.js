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
        const count = this.spec.count ?? 1;
        const startAngleDeg = (this.spec.startAngleDeg ?? 90) + this.baseAngleOffset;
        const angleSpreadDeg = this.spec.angleSpreadDeg ?? 0;
        const speed = this.spec.speed ?? 150;

        const originX = this.boss.sprite.x;
        const originY = this.boss.sprite.y;

        for (let i = 0; i < count; i += 1) {
            const angleDeg = startAngleDeg + i * angleSpreadDeg;
            const rad = Phaser.Math.DegToRad(angleDeg);
            const vx = Math.cos(rad) * speed;
            const vy = Math.sin(rad) * speed;
            this.scene.spawnBossBullet(originX, originY, vx, vy);
        }

        this.baseAngleOffset += this.spec.rotationPerShotDeg ?? 0;
    }
}
