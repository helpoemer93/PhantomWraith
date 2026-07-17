class Player {
    constructor(scene, x, y, keys, color, startInvincible, initialSlots, weaponLevels) {
        this.scene = scene;
        this.keys = keys;
        this.color = color;
        this.weaponLevels = weaponLevels || {};

        this.isInvincible = startInvincible;
        this.hitImmunityUntil = 0;
        this.canFire = true;

        this.slots = [null, null, null, null];
        this.lastFireTime = [0, 0, 0, 0];
        this.orbitOrbs = [];

        const size = GameConfig.PLAYER_SIZE;

        this.sprite = scene.add.rectangle(x, y, size, size, color);
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setCollideWorldBounds(true);
        this.sprite.body.setSize(size, size);

        this.outline = scene.add.rectangle(x, y, size + 8, size + 8);
        this.outline.setStrokeStyle(
            GameConfig.INVINCIBLE_STROKE_WIDTH,
            GameConfig.INVINCIBLE_STROKE_COLOR
        );
        this.outline.setFillStyle();
        this.outline.setVisible(startInvincible);

        if (initialSlots) {
            for (let i = 0; i < initialSlots.length && i < this.slots.length; i += 1) {
                const wid = initialSlots[i];
                this.slots[i] = wid ? getWeapon(wid, this.weaponLevels[wid] ?? 0) : null;
            }
        }
        this.rebuildOrbits();
    }

    equipSlot(slotIndex, weaponId) {
        this.slots[slotIndex] = weaponId
            ? getWeapon(weaponId, this.weaponLevels[weaponId] ?? 0)
            : null;
        this.lastFireTime[slotIndex] = 0;
        this.rebuildOrbits();
    }

    rebuildOrbits() {
        for (const o of this.orbitOrbs) {
            if (this.scene.orbitOrbs) this.scene.orbitOrbs.remove(o, true, true);
            else o.destroy();
        }
        this.orbitOrbs = [];

        const orbitSlots = this.slots.filter((w) => w && w.type === 'orbit');
        let totalOrbs = 0;
        for (const w of orbitSlots) totalOrbs += (w.orbCount ?? 1);
        if (totalOrbs === 0) return;

        let orbIndex = 0;
        for (const w of orbitSlots) {
            const count = w.orbCount ?? 1;
            for (let j = 0; j < count; j += 1) {
                const orb = this.scene.add.circle(this.sprite.x, this.sprite.y, w.orbSize, w.color);
                this.scene.physics.add.existing(orb);
                orb.body.setCircle(w.orbSize);
                orb.body.setAllowGravity(false);
                orb.weaponSpec = w;
                orb.phaseOffset = (orbIndex / totalOrbs) * Math.PI * 2;
                orb.owner = this;
                orb.lastHitTargetTime = 0;
                this.orbitOrbs.push(orb);
                if (this.scene.orbitOrbs) this.scene.orbitOrbs.add(orb);
                orbIndex += 1;
            }
        }
    }

    update(time) {
        const speed = GameConfig.PLAYER_SPEED;
        let vx = 0;
        let vy = 0;
        if (this.keys.left.isDown) vx = -speed;
        else if (this.keys.right.isDown) vx = speed;
        if (this.keys.up.isDown) vy = -speed;
        else if (this.keys.down.isDown) vy = speed;
        this.sprite.body.setVelocity(vx, vy);

        this.outline.setPosition(this.sprite.x, this.sprite.y);

        if (time < this.hitImmunityUntil) {
            const blink = 0.35 + 0.45 * Math.abs(Math.sin(time * 0.02));
            this.sprite.setAlpha(blink);
        } else {
            this.sprite.setAlpha(1);
        }

        if (this.canFire) {
            for (let i = 0; i < this.slots.length; i += 1) {
                const w = this.slots[i];
                if (!w) continue;
                if (w.type === 'orbit') continue;
                if (time - this.lastFireTime[i] < w.intervalMs) continue;
                this.fireWeapon(w);
                this.lastFireTime[i] = time;
            }
        }

        this.updateOrbits(time);
    }

    updateOrbits(time) {
        const cx = this.sprite.x;
        const cy = this.sprite.y;
        for (const orb of this.orbitOrbs) {
            const w = orb.weaponSpec;
            const angle = orb.phaseOffset + (time / 1000) * w.rotationSpeedRadPerSec;
            orb.x = cx + Math.cos(angle) * w.radius;
            orb.y = cy + Math.sin(angle) * w.radius;
        }
    }

    fireWeapon(w) {
        const x = this.sprite.x;
        const y = this.sprite.y - GameConfig.PLAYER_SIZE / 2;

        if (w.type === 'linear') {
            this.scene.spawnPlayerLinearBullet(x, y, w);
        } else if (w.type === 'spread') {
            const total = w.pellets;
            const half = (total - 1) / 2;
            const step = total > 1 ? w.angleSpreadDeg / (total - 1) : 0;
            for (let i = 0; i < total; i += 1) {
                const offset = (i - half) * step;
                this.scene.spawnPlayerAngledBullet(x, y, -90 + offset, w);
            }
        } else if (w.type === 'homing') {
            this.scene.spawnPlayerHomingBullet(x, y, w);
        }
    }

    setInvincible(v) {
        this.isInvincible = v;
        this.outline.setVisible(v);
    }

    canBeHit(time) {
        return !this.isInvincible && time >= this.hitImmunityUntil;
    }

    onHit(time) {
        this.hitImmunityUntil = time + GameConfig.HIT_IMMUNITY_MS;
    }
}
