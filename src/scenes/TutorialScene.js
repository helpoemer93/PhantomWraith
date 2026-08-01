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
        this.escKey = this.input.keyboard.addKey(KC.ESC);

        this.enemyBullets = this.physics.add.group();

        this.startPosP1 = { x: GameConfig.GAME_WIDTH * 0.35, y: GameConfig.GAME_HEIGHT - 100 };
        this.startPosP2 = { x: GameConfig.GAME_WIDTH * 0.65, y: GameConfig.GAME_HEIGHT - 100 };

        this.player1 = new Player(
            this,
            this.startPosP1.x, this.startPosP1.y,
            keys1, GameConfig.PLAYER_1_COLOR, false,
            [null, null, null, null]
        );
        this.player2 = new Player(
            this,
            this.startPosP2.x, this.startPosP2.y,
            keys2, GameConfig.PLAYER_2_COLOR, true,
            [null, null, null, null]
        );
        this.player1.canFire = false;
        this.player2.canFire = false;

        this.physics.add.overlap(
            this.player1.sprite, this.enemyBullets,
            () => this.onWallHit(this.player1)
        );
        this.physics.add.overlap(
            this.player2.sprite, this.enemyBullets,
            () => this.onWallHit(this.player2)
        );

        this.stepTitle = this.add.text(GameConfig.GAME_WIDTH / 2, 20, '', {
            fontSize: '18px', color: '#ffee88', align: 'center',
        }).setOrigin(0.5, 0);

        this.stepDetail = this.add.text(GameConfig.GAME_WIDTH / 2, 55, '', {
            fontSize: '13px', color: '#bbbbcc', align: 'center', lineSpacing: 4,
            wordWrap: { width: GameConfig.GAME_WIDTH - 40 },
        }).setOrigin(0.5, 0);

        this.stepProgress = this.add.text(GameConfig.GAME_WIDTH / 2, 140, '', {
            fontSize: '14px', color: '#88ff88', align: 'center',
        }).setOrigin(0.5, 0);

        this.failText = this.add.text(GameConfig.GAME_WIDTH / 2, GameConfig.GAME_HEIGHT / 2, '', {
            fontSize: '28px', color: '#ff6666', align: 'center',
        }).setOrigin(0.5).setVisible(false);

        this.add.text(10, GameConfig.GAME_HEIGHT - 22, 'ESC: 메뉴로', {
            fontSize: '12px', color: '#666677',
        });

        this.portalGfx = null;
        this.wallBullets = [];
        this.wallSpawnTimer = null;
        this.failing = false;

        this.step = 0;
        this.enterStep();
    }

    enterStep() {
        this.failing = false;
        this.failText.setVisible(false);
        this.stepStartTime = this.time.now;

        this.moveDistanceP1 = 0;
        this.moveDistanceP2 = 0;
        this.prevPosP1 = { x: this.player1.sprite.x, y: this.player1.sprite.y };
        this.prevPosP2 = { x: this.player2.sprite.x, y: this.player2.sprite.y };
        this.swapCount = 0;

        this.clearWalls();
        this.clearPortal();
        if (this.wallSpawnTimer) {
            this.wallSpawnTimer.remove();
            this.wallSpawnTimer = null;
        }

        this.player1.setInvincible(false);
        this.player2.setInvincible(true);
        this.player1.hitImmunityUntil = 0;
        this.player2.hitImmunityUntil = 0;

        if (this.step === 0) {
            this.stepTitle.setText('[1/4] 이동 연습');
            this.stepDetail.setText(
                '왼손 WASD 로 빨간 캐릭터,\n오른손 IJKL 로 파란 캐릭터를 움직여보세요.'
            );
            this.updateMoveProgress();
        } else if (this.step === 1) {
            this.stepTitle.setText('[2/4] 스왑 연습');
            this.stepDetail.setText(
                '캐릭터 주위에 노란 테두리가 있으면 무적 상태입니다.\n무적 상태 캐릭터는 탄에 맞지 않습니다.\nSpace 를 누르면 두 캐릭터의 무적 상태가 서로 바뀝니다.'
            );
            this.updateSwapProgress();
        } else if (this.step === 2) {
            this.resetPlayersToStart();
            this.stepTitle.setText('[3/4] 포탈로 이동');
            this.stepDetail.setText(
                '가로로 이어진 탄환벽이 앞을 막고 있습니다.\n무적 상태 캐릭터부터 통과시키고, 스왑으로 다른 캐릭터도 통과시켜서\n두 캐릭터 모두 상단 포탈에 들어가세요.'
            );
            this.stepProgress.setText('두 캐릭터 모두 포탈로!');
            this.createStaticWall(400);
            this.createPortal(GameConfig.GAME_WIDTH / 2, 90, 45);
        } else if (this.step === 3) {
            this.resetPlayersToStart();
            this.stepTitle.setText('[4/4] 회피 연습');
            this.stepDetail.setText(
                '탄환벽이 1초 간격으로 위에서 내려옵니다.\n무적 스왑을 활용해 10초 동안 살아남으세요.\n한 대라도 맞으면 처음부터 다시.'
            );
            this.updateDodgeProgress();
            this.wallSpawnTimer = this.time.addEvent({
                delay: 1000,
                callback: this.spawnMovingWall,
                callbackScope: this,
                loop: true,
            });
            this.spawnMovingWall(50);
        } else {
            this.stepTitle.setText('튜토리얼 완료!');
            this.stepDetail.setText('메뉴로 돌아갑니다...');
            this.stepProgress.setText('');
            this.time.delayedCall(1500, () => this.scene.start('BootScene'));
        }
    }

    resetPlayersToStart() {
        this.player1.sprite.setPosition(this.startPosP1.x, this.startPosP1.y);
        this.player2.sprite.setPosition(this.startPosP2.x, this.startPosP2.y);
        this.player1.sprite.body.setVelocity(0, 0);
        this.player2.sprite.body.setVelocity(0, 0);
        this.player1.outline.setPosition(this.startPosP1.x, this.startPosP1.y);
        this.player2.outline.setPosition(this.startPosP2.x, this.startPosP2.y);
        this.player1.hitboxDot.setPosition(this.startPosP1.x, this.startPosP1.y);
        this.player2.hitboxDot.setPosition(this.startPosP2.x, this.startPosP2.y);
    }

    createStaticWall(y) {
        const r = GameConfig.ENEMY_BULLET_RADIUS;
        const gap = r * 2;
        for (let x = r; x < GameConfig.GAME_WIDTH; x += gap) {
            const b = this.add.circle(x, y, r, GameConfig.ENEMY_BULLET_COLOR);
            this.physics.add.existing(b);
            b.body.setCircle(r);
            b.body.setVelocity(0, 0);
            b.body.setImmovable(true);
            this.enemyBullets.add(b);
            this.wallBullets.push(b);
        }
    }

    spawnMovingWall(startY) {
        const r = GameConfig.ENEMY_BULLET_RADIUS;
        const gap = r * 2;
        const speed = 150;
        const y0 = startY ?? -r;
        for (let x = r; x < GameConfig.GAME_WIDTH; x += gap) {
            const b = this.add.circle(x, y0, r, GameConfig.ENEMY_BULLET_COLOR);
            this.physics.add.existing(b);
            this.enemyBullets.add(b);
            b.body.setCircle(r);
            b.body.setVelocityY(speed);
            this.wallBullets.push(b);
        }
    }

    createPortal(x, y, r) {
        this.portalGfx = this.add.circle(x, y, r, 0x66ccff, 0.35);
        this.portalGfx.setStrokeStyle(2, 0x88ddff);
        this.portalX = x;
        this.portalY = y;
        this.portalR = r;
    }

    clearWalls() {
        for (const b of this.wallBullets) {
            if (b && b.active) b.destroy();
        }
        this.wallBullets = [];
    }

    clearPortal() {
        if (this.portalGfx) {
            this.portalGfx.destroy();
            this.portalGfx = null;
        }
    }

    onWallHit(player) {
        if (this.failing) return;
        if (this.step !== 2 && this.step !== 3) return;
        if (!player.canBeHit(this.time.now)) return;
        this.failStep();
    }

    failStep() {
        this.failing = true;
        this.failText.setText('실패! 다시 시작...').setVisible(true);
        this.time.delayedCall(700, () => this.enterStep());
    }

    playerInPortal(player) {
        if (!this.portalGfx) return false;
        const dx = player.sprite.x - this.portalX;
        const dy = player.sprite.y - this.portalY;
        return Math.sqrt(dx * dx + dy * dy) < this.portalR - 4;
    }

    update(time) {
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.scene.start('BootScene');
            return;
        }

        this.player1.update(time);
        this.player2.update(time);

        if (!this.failing && Phaser.Input.Keyboard.JustDown(this.swapKey)) {
            this.doSwap();
        }

        if (this.failing) return;

        if (this.step === 0) {
            this.trackMove();
            this.updateMoveProgress();
            if (this.moveDistanceP1 >= 50 && this.moveDistanceP2 >= 50) {
                this.step = 1;
                this.enterStep();
            }
        } else if (this.step === 2) {
            if (this.playerInPortal(this.player1) && this.playerInPortal(this.player2)) {
                this.step = 3;
                this.enterStep();
            }
        } else if (this.step === 3) {
            this.updateDodgeProgress();
            for (const b of this.wallBullets) {
                if (b && b.active && b.y > GameConfig.GAME_HEIGHT + 20) b.destroy();
            }
            if (time - this.stepStartTime >= 10000) {
                this.step = 4;
                this.enterStep();
            }
        }
    }

    trackMove() {
        const dx1 = this.player1.sprite.x - this.prevPosP1.x;
        const dy1 = this.player1.sprite.y - this.prevPosP1.y;
        this.moveDistanceP1 += Math.sqrt(dx1 * dx1 + dy1 * dy1);
        this.prevPosP1.x = this.player1.sprite.x;
        this.prevPosP1.y = this.player1.sprite.y;

        const dx2 = this.player2.sprite.x - this.prevPosP2.x;
        const dy2 = this.player2.sprite.y - this.prevPosP2.y;
        this.moveDistanceP2 += Math.sqrt(dx2 * dx2 + dy2 * dy2);
        this.prevPosP2.x = this.player2.sprite.x;
        this.prevPosP2.y = this.player2.sprite.y;
    }

    doSwap() {
        const p1Was = this.player1.isInvincible;
        this.player1.setInvincible(this.player2.isInvincible);
        this.player2.setInvincible(p1Was);

        if (this.step === 1) {
            this.swapCount += 1;
            this.updateSwapProgress();
            if (this.swapCount >= 2) {
                this.step = 2;
                this.enterStep();
            }
        }
    }

    updateMoveProgress() {
        const p1 = Math.min(50, Math.floor(this.moveDistanceP1));
        const p2 = Math.min(50, Math.floor(this.moveDistanceP2));
        this.stepProgress.setText(`이동 거리  빨강 ${p1}/50   파랑 ${p2}/50`);
    }

    updateSwapProgress() {
        this.stepProgress.setText(`스왑: ${this.swapCount} / 2`);
    }

    updateDodgeProgress() {
        const elapsed = (this.time.now - this.stepStartTime) / 1000;
        const remain = Math.max(0, 10 - elapsed);
        this.stepProgress.setText(`남은 시간: ${remain.toFixed(1)}초`);
    }
}
