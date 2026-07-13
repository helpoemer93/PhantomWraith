class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        this.lives = GameConfig.MAX_LIVES;
        this.swapStack = GameConfig.SWAP_MAX_STACK;
        this.lastSwapChargeTime = 0;
        this.gameOver = false;
        this.cleared = false;

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

        const inv = this.registry.get('inventory') || [];
        const loadout = this.registry.get('loadout') || {
            p1: [null, null, null, null], p2: [null, null, null, null],
        };
        const toSlotIds = (arr) => arr.map((idx) => (idx == null ? null : inv[idx]));

        const bottomY = GameConfig.GAME_HEIGHT - 100;
        this.player1 = new Player(
            this,
            GameConfig.GAME_WIDTH * 0.35, bottomY,
            keys1, GameConfig.PLAYER_1_COLOR, false,
            toSlotIds(loadout.p1)
        );
        this.player2 = new Player(
            this,
            GameConfig.GAME_WIDTH * 0.65, bottomY,
            keys2, GameConfig.PLAYER_2_COLOR, true,
            toSlotIds(loadout.p2)
        );

        this.boss = new Boss(this, DummyBoss);

        this.physics.add.overlap(
            this.player1.sprite, this.bossBullets,
            (s, b) => this.onPlayerHit(this.player1, b)
        );
        this.physics.add.overlap(
            this.player2.sprite, this.bossBullets,
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
        this.uiSwap = this.add.text(10, 36, '', {
            fontSize: '18px', color: '#ffffff',
        });
        this.uiBossName = this.add.text(
            GameConfig.GAME_WIDTH / 2, 12, this.boss.data.name,
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
    }

    update(time, delta) {
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            if (this.gameOver) this.resetRun();
            this.scene.start('BootScene');
            return;
        }

        if (this.cleared) {
            if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
                this.scene.start('RewardScene');
            }
            return;
        }
        if (this.gameOver) {
            if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
                this.resetRun();
                this.scene.start('BootScene');
            }
            return;
        }

        this.player1.update(time);
        this.player2.update(time);
        this.boss.update(time, delta);

        if (Phaser.Input.Keyboard.JustDown(this.swapKey) && this.swapStack > 0) {
            this.doSwap();
        }

        if (this.swapStack < GameConfig.SWAP_MAX_STACK) {
            if (time - this.lastSwapChargeTime >= GameConfig.SWAP_CHARGE_INTERVAL_MS) {
                this.swapStack += 1;
                this.lastSwapChargeTime = time;
                this.updateUI();
            }
        } else {
            this.lastSwapChargeTime = time;
        }

        this.updateHomingBullets(delta);

        this.playerBullets.children.each((b) => {
            if (!b) return;
            if (b.y < -30 || b.y > GameConfig.GAME_HEIGHT + 30 ||
                b.x < -30 || b.x > GameConfig.GAME_WIDTH + 30) {
                b.destroy();
            }
        });
        this.bossBullets.children.each((b) => {
            if (!b) return;
            if (b.y > GameConfig.GAME_HEIGHT + 20 || b.y < -40 ||
                b.x < -40 || b.x > GameConfig.GAME_WIDTH + 40) {
                b.destroy();
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
        this.swapStack -= 1;
        this.lastSwapChargeTime = this.time.now;
        this.updateUI();
    }

    spawnPlayerLinearBullet(x, y, w) {
        const b = this.add.rectangle(x, y, w.width, w.height, w.color);
        this.physics.add.existing(b);
        this.playerBullets.add(b);
        b.body.setVelocityY(-w.bulletSpeed);
        b.damage = w.damage;
        b.pierce = w.pierce;
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
    }

    spawnPlayerHomingBullet(x, y, w) {
        const b = this.add.circle(x, y, w.radius, w.color);
        this.physics.add.existing(b);
        b.body.setCircle(w.radius);
        this.playerBullets.add(b);
        b.body.setVelocity(0, -w.bulletSpeed);
        b.damage = w.damage;
        b.pierce = w.pierce;
        b.isHoming = true;
        b.turnRateDegPerSec = w.turnRateDegPerSec;
        b.bulletSpeed = w.bulletSpeed;
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
            this.uiMessage.setText('GAME OVER\nEnter/ESC 로 메뉴');
        }
    }

    onBossHit(bullet) {
        if (this.boss.isDead()) return;
        this.boss.onHit(bullet.damage ?? 1);
        if (!bullet.pierce) {
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
        this.bossBullets.children.each((b) => b && b.destroy());
        this.boss.destroy();
        this.uiMessage.setText('CLEAR!\nEnter로 무기 획득 / ESC로 메뉴');
    }

    resetRun() {
        Storage.clear();
        this.registry.remove('inventory');
        this.registry.remove('loadout');
    }

    updateUI() {
        this.uiLives.setText(`목숨: ${this.lives}/${GameConfig.MAX_LIVES}`);
        this.uiSwap.setText(`스왑: ${this.swapStack}/${GameConfig.SWAP_MAX_STACK}`);
    }

    updateHpBar() {
        const ratio = this.boss.hp / this.boss.maxHp;
        const fullWidth = GameConfig.GAME_WIDTH - 40;
        this.uiHpBar.width = Math.max(0, fullWidth * ratio);
    }
}
