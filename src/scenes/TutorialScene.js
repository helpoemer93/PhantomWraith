class TutorialScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TutorialScene' });
    }

    create() {
        this.cameras.main.setBackgroundColor('#161628');

        const KC = Phaser.Input.Keyboard.KeyCodes;
        const keys1 = this.input.keyboard.addKeys({
            up: KC.W, down: KC.S, left: KC.A, right: KC.D,
        });
        const keys2 = this.input.keyboard.addKeys({
            up: KC.I, down: KC.K, left: KC.J, right: KC.L,
        });
        this.swapKey = this.input.keyboard.addKey(KC.SPACE);
        this.nextKey = this.input.keyboard.addKey(KC.ENTER);
        this.escKey = this.input.keyboard.addKey(KC.ESC);


        this.playerBullets = this.physics.add.group();
        this.enemyBullets = this.physics.add.group();
        this.orbitOrbs = this.physics.add.group();

        const bottomY = GameConfig.GAME_HEIGHT - 100;
        this.player1 = new Player(
            this,
            GameConfig.GAME_WIDTH * 0.35, bottomY,
            keys1, GameConfig.PLAYER_1_COLOR, false,
            [null, null, null, null]
        );
        this.player2 = new Player(
            this,
            GameConfig.GAME_WIDTH * 0.65, bottomY,
            keys2, GameConfig.PLAYER_2_COLOR, true,
            [null, null, null, null]
        );
        this.player1.canFire = false;
        this.player2.canFire = false;

        this.physics.add.overlap(
            this.player1.sprite, this.enemyBullets,
            (s, b) => this.onPlayerHit(this.player1, b)
        );
        this.physics.add.overlap(
            this.player2.sprite, this.enemyBullets,
            (s, b) => this.onPlayerHit(this.player2, b)
        );

        this.stepTitle = this.add.text(GameConfig.GAME_WIDTH / 2, 30, '', {
            fontSize: '18px', color: '#ffee88', align: 'center',
        }).setOrigin(0.5, 0);

        this.stepDetail = this.add.text(GameConfig.GAME_WIDTH / 2, 70, '', {
            fontSize: '13px', color: '#bbbbcc', align: 'center', lineSpacing: 4,
            wordWrap: { width: GameConfig.GAME_WIDTH - 40 },
        }).setOrigin(0.5, 0);

        this.stepProgress = this.add.text(GameConfig.GAME_WIDTH / 2, 150, '', {
            fontSize: '15px', color: '#88ff88', align: 'center',
        }).setOrigin(0.5, 0);

        this.add.text(10, GameConfig.GAME_HEIGHT - 22, 'ESC: 메뉴로', {
            fontSize: '12px', color: '#666677',
        });

        this.step = 0;
        this.enterStep();
    }

    enterStep() {
        this.stepStartTime = this.time.now;
        this.swapSuccessCount = 0;

        if (this.enemyFireTimer) {
            this.enemyFireTimer.remove();
            this.enemyFireTimer = null;
        }

        if (this.step === 0) {
            this.stepTitle.setText('[1/3] 이동 연습');
            this.stepDetail.setText(
                '왼손 WASD 로 파란 캐릭터,\n오른손 IJKL 로 빨간 캐릭터를 움직여보세요.\n\n양손이 익숙해지면 Enter로 다음.'
            );
            this.stepProgress.setText('');
        } else if (this.step === 1) {
            this.stepTitle.setText('[2/3] 스왑 연습');
            this.stepDetail.setText(
                'Space를 누르면 두 캐릭터의 무적 상태(노란 테두리)가 서로 바뀝니다.\n쿨타임 없이 언제든 사용 가능.\n\n스왑을 3번 성공하면 다음 단계.'
            );
            this.updateSwapProgress();
        } else if (this.step === 2) {
            this.stepTitle.setText('[3/3] 회피 연습');
            this.stepDetail.setText(
                '10초간 탄막을 피해보세요.\n무적 캐릭터로 안전 지대를 만드는 게 핵심입니다.\n(튜토리얼에서는 목숨이 닳지 않음)'
            );
            this.player1.equipSlot(0, 'basicLinear');
            this.player2.equipSlot(0, 'basicLinear');
            this.player1.canFire = true;
            this.player2.canFire = true;
            this.enemyFireTimer = this.time.addEvent({
                delay: GameConfig.ENEMY_FIRE_INTERVAL_MS,
                callback: this.spawnEnemyBullet,
                callbackScope: this,
                loop: true,
            });
            this.updateDodgeProgress();
        } else {
            this.stepTitle.setText('튜토리얼 완료!');
            this.stepDetail.setText('메뉴로 돌아갑니다...');
            this.stepProgress.setText('');
            this.time.delayedCall(1500, () => this.scene.start('BootScene'));
        }
    }

    update(time) {
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.scene.start('BootScene');
            return;
        }

        this.player1.update(time);
        this.player2.update(time);

        if (Phaser.Input.Keyboard.JustDown(this.swapKey)) {
            this.doSwap();
        }

        if (this.step === 0) {
            if (Phaser.Input.Keyboard.JustDown(this.nextKey)) {
                this.step = 1;
                this.enterStep();
            }
        } else if (this.step === 2) {
            this.updateDodgeProgress();
            if (time - this.stepStartTime >= 10000) {
                this.step = 3;
                this.enterStep();
            }
        }

        this.playerBullets.children.each((b) => {
            if (b && b.y < -20) b.destroy();
        });
        this.enemyBullets.children.each((b) => {
            if (b && b.y > GameConfig.GAME_HEIGHT + 20) b.destroy();
        });
    }

    doSwap() {
        const p1Was = this.player1.isInvincible;
        this.player1.setInvincible(this.player2.isInvincible);
        this.player2.setInvincible(p1Was);

        if (this.step === 1) {
            this.swapSuccessCount += 1;
            this.updateSwapProgress();
            if (this.swapSuccessCount >= 3) {
                this.step = 2;
                this.enterStep();
            }
        }
    }

    updateSwapProgress() {
        this.stepProgress.setText(`스왑 성공: ${this.swapSuccessCount} / 3`);
    }

    updateDodgeProgress() {
        const elapsed = (this.time.now - this.stepStartTime) / 1000;
        const remain = Math.max(0, 10 - elapsed);
        this.stepProgress.setText(`남은 시간: ${remain.toFixed(1)}초`);
    }

    spawnPlayerLinearBullet(x, y, w) {
        const b = this.add.rectangle(x, y, w.width, w.height, w.color);
        this.physics.add.existing(b);
        this.playerBullets.add(b);
        b.body.setVelocityY(-w.bulletSpeed);
    }

    spawnEnemyBullet() {
        const x = Phaser.Math.Between(30, GameConfig.GAME_WIDTH - 30);
        const b = this.add.circle(
            x, -10,
            GameConfig.ENEMY_BULLET_RADIUS,
            GameConfig.ENEMY_BULLET_COLOR
        );
        this.physics.add.existing(b);
        this.enemyBullets.add(b);
        b.body.setCircle(GameConfig.ENEMY_BULLET_RADIUS);
        b.body.setVelocityY(GameConfig.ENEMY_BULLET_SPEED);
    }

    onPlayerHit(player, bullet) {
        const time = this.time.now;
        if (!player.canBeHit(time)) return;
        player.onHit(time);
        bullet.destroy();
    }
}
