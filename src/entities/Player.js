class Player {
    constructor(scene, x, y, keys, color, startInvincible, initialSlots, weaponLevels, upgrades) {
        this.scene = scene;
        this.keys = keys;
        this.color = color;
        this.weaponLevels = weaponLevels || {};
        const u = upgrades || {};
        this.moveSpeed = Upgrades.moveSpeed.applied(u.moveSpeed ?? 0);
        this.hitImmunityMs = Upgrades.hitImmunity.applied(u.hitImmunity ?? 0);
        this.size = Upgrades.hitbox.applied(u.hitbox ?? 0);

        this.isInvincible = startInvincible;
        this.hitImmunityUntil = 0;
        this.canFire = true;

        this.slots = [null, null, null, null];
        this.lastFireTime = [0, 0, 0, 0];
        this.orbitOrbs = [];

        const size = this.size;

        let spriteKey = null;
        if (color === GameConfig.PLAYER_1_COLOR && scene.textures.exists('latias-sprite')) {
            spriteKey = 'latias-sprite';
        } else if (color === GameConfig.PLAYER_2_COLOR && scene.textures.exists('latios-sprite')) {
            spriteKey = 'latios-sprite';
        }
        if (spriteKey) {
            this.sprite = scene.add.sprite(x, y, spriteKey);
            this.sprite.setDisplaySize(size * (51 / 31) * 1.3, size * 1.3);
        } else {
            this.sprite = scene.add.rectangle(x, y, size, size, color);
        }
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setCollideWorldBounds(true);
        this.sprite.body.setSize(size, size);
        this.sprite.body.setCircle(size / 2);

        this.outline = scene.add.circle(x, y, size + 6, 0, 0);
        this.outline.setStrokeStyle(
            GameConfig.INVINCIBLE_STROKE_WIDTH,
            GameConfig.INVINCIBLE_STROKE_COLOR
        );
        this.outline.setVisible(startInvincible);

        this.hitboxDot = scene.add.circle(x, y, size / 2, 0xffffff, 0.35);

        if (initialSlots) {
            for (let i = 0; i < initialSlots.length && i < this.slots.length; i += 1) {
                const wid = initialSlots[i];
                this.slots[i] = wid ? getWeapon(wid, this.weaponLevels[wid] ?? 0) : null;
            }
        }
        this.rebuildOrbits();

        this.postSync = () => {
            if (!this.sprite.active) return;
            this.hitboxDot.setPosition(this.sprite.x, this.sprite.y);
            if (this.outline.visible) {
                this.outline.setPosition(this.sprite.x, this.sprite.y);
            }
        };
        scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.postSync);
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.postSync);
        });
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
                orb.currentAngle = orb.phaseOffset;
                orb.owner = this;
                orb.lastHitTargetTime = 0;
                orb.lastContactTime = -Infinity;
                // 궤도체마다 시차 두고 미사일 발사 (같은 프레임 동시 발사 방지).
                const intervalMs = w.missileIntervalMs ?? 500;
                orb.lastMissileTime = this.scene.time.now
                    - intervalMs * (1 - orbIndex / totalOrbs);
                this.orbitOrbs.push(orb);
                if (this.scene.orbitOrbs) this.scene.orbitOrbs.add(orb);
                orbIndex += 1;
            }
        }
    }

    update(time) {
        const speed = this.moveSpeed;
        let vx = 0;
        let vy = 0;
        if (this.keys.left.isDown) vx = -speed;
        else if (this.keys.right.isDown) vx = speed;
        if (this.keys.up.isDown) vy = -speed;
        else if (this.keys.down.isDown) vy = speed;
        this.sprite.body.setVelocity(vx, vy);

        // 상태 무적(isInvincible)만 노란 outline pulse. 피격 후 짧은 무적은 outline 없이 sprite 알파 깜빡으로만 표현
        // → 상대 캐릭터가 무적인지, 잠깐 맞고 무적인지 시각으로 구분.
        this.outline.setVisible(this.isInvincible);
        if (this.isInvincible) {
            const phase = Math.sin(time * 0.006);
            this.outline.setScale(1.0 + 0.15 * phase);
            this.outline.setAlpha(0.55 + 0.35 * phase);
        }

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
                if (w.type === 'beam') continue; // 광선은 update loop에서 자체 처리
                if (time - this.lastFireTime[i] < w.intervalMs) continue;
                this.fireWeapon(w);
                this.lastFireTime[i] = time;
            }
        }

        this.updateOrbits(time);
        this.updateBeams(time);
    }

    updateOrbits(time) {
        const cx = this.sprite.x;
        const cy = this.sprite.y;
        const canFire = this.canFire;
        // 이전 프레임 대비 경과 시간 (Player 자체 추적, delta 인자 없이).
        const dt = this._lastOrbitTime == null ? 0
            : Math.min(0.1, (time - this._lastOrbitTime) / 1000);
        this._lastOrbitTime = time;

        for (const orb of this.orbitOrbs) {
            const w = orb.weaponSpec;
            // 타격중이면 회전속도 감쇠.
            const slowMs = w.rotationSlowDurationMs ?? 100;
            const slowMul = w.rotationSlowMultiplier ?? 0.4;
            const isSlowed = time - orb.lastContactTime < slowMs;
            const angSpeed = w.rotationSpeedRadPerSec * (isSlowed ? slowMul : 1);
            orb.currentAngle += angSpeed * dt;
            orb.x = cx + Math.cos(orb.currentAngle) * w.radius;
            orb.y = cy + Math.sin(orb.currentAngle) * w.radius;

            if (!canFire) continue;
            const interval = w.missileIntervalMs ?? 500;
            if (time - orb.lastMissileTime >= interval) {
                if (this.scene.spawnOrbitMissile
                    && this.scene.spawnOrbitMissile(orb.x, orb.y, w)) {
                    orb.lastMissileTime = time;
                }
            }
        }
    }

    fireWeapon(w) {
        const x = this.sprite.x;
        const y = this.sprite.y - this.size / 2;

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
        } else if (w.type === 'boomerang') {
            this.scene.spawnPlayerBoomerang(x, y, w, this);
        } else if (w.type === 'chain') {
            this.scene.fireChainLightning(x, y, w);
        } else if (w.type === 'mine') {
            this.scene.spawnPlayerMine(x, y, w);
        }
    }

    // 캐릭터가 회귀 부메랑을 잡으면 다음 발사 앞당김 (rewardMs 만큼 lastFireTime을 뒤로).
    onBoomerangCaught(weaponSpec, rewardMs) {
        for (let i = 0; i < this.slots.length; i += 1) {
            if (this.slots[i] === weaponSpec) {
                this.lastFireTime[i] -= rewardMs;
                return;
            }
        }
    }

    // 광선: canFire 상태에서 자체 tick 판정. 오버히트 도달 시 강제 오프.
    updateBeams(time) {
        if (!this.beamStates) this.beamStates = [];
        for (let i = 0; i < this.slots.length; i += 1) {
            const w = this.slots[i];
            if (!w || w.type !== 'beam') {
                // 슬롯이 광선이 아니면 상태 정리
                if (this.beamStates[i]?.graphics) {
                    this.beamStates[i].graphics.destroy();
                    this.beamStates[i] = null;
                }
                continue;
            }
            if (!this.beamStates[i]) {
                this.beamStates[i] = { offUntil: 0, damageAccum: 0, lastTickTime: 0, graphics: null };
            }
            const bs = this.beamStates[i];

            const canRender = this.canFire && time >= bs.offUntil;
            if (!canRender) {
                if (bs.graphics) { bs.graphics.destroy(); bs.graphics = null; }
                continue;
            }

            const bx = this.sprite.x;
            const by = this.sprite.y - this.size / 2;
            if (!bs.graphics) bs.graphics = this.scene.add.graphics().setDepth(12);
            bs.graphics.clear();
            // 3층 구성: 외곽 옅은 글로우 + 중간 반투명 + 코어 진한 라인
            bs.graphics.fillStyle(w.color, 0.2);
            bs.graphics.fillRect(bx - w.visualWidth, 0, w.visualWidth * 2, by);
            bs.graphics.fillStyle(w.color, 0.5);
            bs.graphics.fillRect(bx - w.visualWidth / 2, 0, w.visualWidth, by);
            bs.graphics.fillStyle(0xffffff, 0.9);
            bs.graphics.fillRect(bx - w.hitWidth / 2, 0, w.hitWidth, by);

            if (time - bs.lastTickTime >= w.tickIntervalMs) {
                bs.lastTickTime = time;
                const hits = this.scene.beamApplyHits ? this.scene.beamApplyHits(bx, by, w) : 0;
                if (hits > 0) {
                    bs.damageAccum += w.damage * hits;
                    if (bs.damageAccum >= w.overheatThreshold) {
                        bs.damageAccum = 0;
                        bs.offUntil = time + w.offDurationMs;
                        if (bs.graphics) { bs.graphics.destroy(); bs.graphics = null; }
                    }
                }
            }
        }
    }

    // 씬 리셋/캐릭터 소멸 시 광선 그래픽 정리
    destroyBeams() {
        if (!this.beamStates) return;
        for (const bs of this.beamStates) {
            if (bs?.graphics) bs.graphics.destroy();
        }
        this.beamStates = [];
    }

    setInvincible(v) {
        this.isInvincible = v;
        this.outline.setVisible(v);
    }

    canBeHit(time) {
        return !this.isInvincible && time >= this.hitImmunityUntil;
    }

    onHit(time) {
        this.hitImmunityUntil = time + this.hitImmunityMs;
    }
}
