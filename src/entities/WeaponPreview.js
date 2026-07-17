class WeaponPreview {
    constructor(scene, x, y, width, height) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.weaponId = null;
        this.weapon = null;
        this.lastFireTime = 0;
        this.bullets = [];
        this.orbs = [];
        this.startTime = null;

        this.bg = scene.add.rectangle(
            x + width / 2, y + height / 2,
            width, height, 0x0a0a1a
        ).setStrokeStyle(1, 0x555577);

        const scarecrowSize = 32;
        this.scarecrow = scene.add.rectangle(
            x + width / 2, y + 26,
            scarecrowSize, scarecrowSize, 0x666666
        ).setStrokeStyle(1, 0x888888);
        this.scarecrowHalfW = scarecrowSize / 2;
        this.scarecrowHalfH = scarecrowSize / 2;

        const playerSize = 18;
        this.playerY = y + height - 24;
        this.playerCenterX = x + width / 2;
        this.playerRange = width / 2 - 30;
        this.player = scene.add.rectangle(
            this.playerCenterX, this.playerY,
            playerSize, playerSize, GameConfig.PLAYER_1_COLOR
        );

        this.label = scene.add.text(x + width / 2, y - 14, '', {
            fontSize: '11px', color: '#ccccdd',
        }).setOrigin(0.5, 0);
    }

    setWeapon(weaponId, level) {
        const lv = level ?? 0;
        if (this.weaponId === weaponId && this.weaponLevel === lv) return;
        this.weaponId = weaponId;
        this.weaponLevel = lv;
        this.weapon = weaponId ? getWeapon(weaponId, lv) : null;
        this.clearBullets();
        this.clearOrbs();
        this.rebuildOrbs();
        this.lastFireTime = 0;
        this.startTime = null;
        this.label.setText(this.weapon ? this.weapon.name : '');
    }

    clearBullets() {
        for (const b of this.bullets) if (b.sprite) b.sprite.destroy();
        this.bullets = [];
    }

    clearOrbs() {
        for (const o of this.orbs) o.destroy();
        this.orbs = [];
    }

    rebuildOrbs() {
        if (!this.weapon || this.weapon.type !== 'orbit') return;
        const w = this.weapon;
        const count = w.orbCount ?? 1;
        for (let i = 0; i < count; i += 1) {
            const orb = this.scene.add.circle(
                this.player.x, this.player.y,
                w.orbSize ?? 8, w.color
            );
            orb.phaseOffset = (i / count) * Math.PI * 2;
            this.orbs.push(orb);
        }
    }

    update(time, delta) {
        if (!this.weapon) return;
        if (this.startTime === null) this.startTime = time;

        const w = this.weapon;
        const isOrbit = w.type === 'orbit';

        if (isOrbit) {
            this.player.x = this.playerCenterX;
        } else {
            const t = (time - this.startTime) / 1000;
            const offset = Math.sin(t * 1.5) * this.playerRange;
            this.player.x = this.playerCenterX + offset;
        }

        for (const orb of this.orbs) {
            const angle = orb.phaseOffset + (time / 1000) * w.rotationSpeedRadPerSec;
            const radius = Math.min(w.radius, 32);
            orb.x = this.player.x + Math.cos(angle) * radius;
            orb.y = this.player.y + Math.sin(angle) * radius;
        }

        if (!isOrbit && time - this.lastFireTime >= w.intervalMs) {
            this.fire();
            this.lastFireTime = time;
        }

        this.updateBullets(delta);
    }

    fire() {
        const w = this.weapon;
        const px = this.player.x;
        const py = this.player.y - 10;
        const speed = Math.min(w.bulletSpeed, 320);

        if (w.type === 'linear') {
            this.spawnRectBullet(px, py, 0, -speed, w, false);
        } else if (w.type === 'spread') {
            const total = w.pellets;
            const half = (total - 1) / 2;
            const step = total > 1 ? w.angleSpreadDeg / (total - 1) : 0;
            for (let i = 0; i < total; i += 1) {
                const offset = (i - half) * step;
                const rad = Phaser.Math.DegToRad(-90 + offset);
                this.spawnRectBullet(
                    px, py,
                    Math.cos(rad) * speed, Math.sin(rad) * speed,
                    w, false
                );
            }
        } else if (w.type === 'homing') {
            this.spawnHomingBullet(px, py, w, speed);
        }
    }

    spawnRectBullet(x, y, vx, vy, w, homing) {
        const sprite = this.scene.add.rectangle(
            x, y, w.width ?? 6, w.height ?? 14, w.color
        );
        const rad = Math.atan2(vy, vx);
        sprite.rotation = rad + Math.PI / 2;
        this.bullets.push({
            sprite, vx, vy, w, alive: true, homing,
            hitCooldownMs: w.contactCooldownMs ?? 0,
            lastHitTime: -Infinity,
        });
    }

    spawnHomingBullet(x, y, w, speed) {
        const sprite = this.scene.add.circle(x, y, w.radius ?? 5, w.color);
        this.bullets.push({
            sprite, vx: 0, vy: -speed, w, alive: true, homing: true,
            currentSpeed: speed,
            hitCooldownMs: w.contactCooldownMs ?? 0,
            lastHitTime: -Infinity,
        });
    }

    updateBullets(delta) {
        const dt = delta / 1000;
        const now = this.scene.time.now;
        for (const b of this.bullets) {
            if (!b.alive) continue;
            const w = b.w;
            if (b.homing) {
                const dx = this.scarecrow.x - b.sprite.x;
                const dy = this.scarecrow.y - b.sprite.y;
                const currAngle = Math.atan2(b.vy, b.vx);
                const targetAngle = Math.atan2(dy, dx);
                let diff = targetAngle - currAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                const maxTurn = Phaser.Math.DegToRad(w.turnRateDegPerSec) * dt;
                const turn = Phaser.Math.Clamp(diff, -maxTurn, maxTurn);
                const newAngle = currAngle + turn;
                b.currentSpeed += (w.accel ?? 0) * dt;
                const cappedSpeed = Math.min(b.currentSpeed, 320);
                b.vx = Math.cos(newAngle) * cappedSpeed;
                b.vy = Math.sin(newAngle) * cappedSpeed;
            }
            b.sprite.x += b.vx * dt;
            b.sprite.y += b.vy * dt;

            if (b.sprite.x < this.x - 20 || b.sprite.x > this.x + this.width + 20 ||
                b.sprite.y < this.y - 20 || b.sprite.y > this.y + this.height + 20) {
                b.sprite.destroy();
                b.alive = false;
                continue;
            }

            const dxs = Math.abs(b.sprite.x - this.scarecrow.x);
            const dys = Math.abs(b.sprite.y - this.scarecrow.y);
            if (dxs < this.scarecrowHalfW && dys < this.scarecrowHalfH) {
                if (w.pierce) {
                    if (now - b.lastHitTime >= b.hitCooldownMs) {
                        b.lastHitTime = now;
                    }
                } else {
                    b.sprite.destroy();
                    b.alive = false;
                }
            }
        }
        this.bullets = this.bullets.filter((b) => b.alive);
    }

    destroy() {
        this.bg.destroy();
        this.scarecrow.destroy();
        this.player.destroy();
        this.label.destroy();
        this.clearBullets();
        this.clearOrbs();
    }
}
