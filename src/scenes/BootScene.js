class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // 사운드는 전역 캐시. 이후 모든 씬에서 this.sound.play(key) 로 사용.
        this.load.audio('gugu-flap', 'Sound/gugu-flap.mp3');
        this.load.audio('gugu-vortex', 'Sound/gugu-vortex.mp3');
        this.load.audio('gugu-scatter', 'Sound/gugu-scatter.mp3');
        this.load.audio('gugu-bird-burst', 'Sound/gugu-bird-burst.mp3');
        this.load.audio('gugu-spiral-fire', 'Sound/gugu-spiral-fire.mp3');
        this.load.audio('gugu-spiral-freeze', 'Sound/gugu-spiral-freeze.mp3');
        this.load.audio('gugu-bgm', 'Sound/gugu-bgm.mp3');
        this.load.audio('freezer-bgm', 'Sound/freezer-bgm.mp3');
        this.load.audio('freezer-p1-wave', 'Sound/freezer-p1-wave.mp3');
        this.load.audio('freezer-p1-wall', 'Sound/freezer-p1-wall.mp3');
        this.load.audio('freezer-p23-wind', 'Sound/freezer-p23-wind.mp3');
        this.load.audio('freezer-p3-blade', 'Sound/freezer-p3-blade.mp3');
        this.load.audio('freezer-p3-derive', 'Sound/freezer-p3-derive.mp3');
        this.load.audio('metagross-bgm', 'Sound/metagross-bgm.mp3');
        this.load.audio('metagross-gear-fire', 'Sound/metagross-gear-fire.mp3');
        this.load.audio('metagross-turret-shot', 'Sound/metagross-turret-shot.mp3');
        this.load.audio('metagross-drone-spawn', 'Sound/metagross-drone-spawn.mp3');
        this.load.audio('metagross-chaser-alert', 'Sound/metagross-chaser-alert.mp3');
        this.load.audio('metagross-interlude', 'Sound/metagross-interlude.mp3');
        this.load.audio('suicune-bgm', 'Sound/suicune-bgm.mp3');
        this.load.audio('doopapang-bgm', 'Sound/Nebula Ascension.mp3');
        this.load.audio('suicune-wave', 'Sound/스이쿤파도.mp3');
        this.load.audio('suicune-charge', 'Sound/스이쿤돌진.mp3');
        this.load.audio('suicune-water', 'Sound/스이쿤물대포.mp3');
        this.load.audio('raikou-charge', 'Sound/라이코돌진.mp3');
        this.load.audio('entei-charge', 'Sound/엔테이돌진.mp3');
        this.load.audio('entei-flame', 'Sound/엔테이화염방사.mp3');
        this.load.audio('menu-bgm', 'Sound/Starlight Drift.mp3');

        this.load.spritesheet(
            'gugu-sprite',
            'Image/gugu-sprite-2f.png',
            { frameWidth: 677, frameHeight: 369 },
        );
        this.load.spritesheet(
            'freezer-sprite',
            'Image/freezer-sprite-2f.png',
            { frameWidth: 677, frameHeight: 369 },
        );
        this.load.spritesheet(
            'metagross-sprite',
            'Image/metagross-sprite-4f.png',
            { frameWidth: 676, frameHeight: 369 },
        );
        this.load.spritesheet(
            'doopapang-sprite',
            'Image/doopapang-sprite-2f.png',
            { frameWidth: 1024, frameHeight: 1024 },
        );
        this.load.spritesheet(
            'thunder-sprite',
            'Image/thunder-sprite-4f.png',
            { frameWidth: 47, frameHeight: 47 },
        );
        this.load.spritesheet(
            'voltorb-sprite',
            'Image/voltorb-sprite-6f.png',
            { frameWidth: 24, frameHeight: 24 },
        );
        this.load.spritesheet(
            'magneton-sprite',
            'Image/magneton-sprite-6f.png',
            { frameWidth: 31, frameHeight: 31 },
        );
        // 코일(자포코일 부하)은 메타그로스 자폭드론 텍스처(`metagross-chaser`, 8방향×4프레임) 재사용.
        this.load.spritesheet(
            'pikachu-tumble-sprite',
            'Image/pikachu-tumble-sprite-8f.png',
            { frameWidth: 40, frameHeight: 40 },
        );
        // 썬더 페이즈3 라이더용 8방향 시트 (4프레임 × 8방향, 표준 순서 [down, down-right, right, up-right, up, up-left, left, down-left])
        this.load.spritesheet(
            'thunder-dir8-sprite',
            'Image/thunder-dir8-sprite-32f.png',
            { frameWidth: 47, frameHeight: 47 },
        );

        this.load.image('latias-sprite', 'Image/latias-sprite-1f.png');
        this.load.image('latios-sprite', 'Image/latios-sprite-1f.png');

        this.load.spritesheet(
            'suicune-sprite',
            'Image/suicune-sprite-9f.png',
            { frameWidth: 40, frameHeight: 40 },
        );
        this.load.spritesheet(
            'raikou-sprite',
            'Image/raikou-sprite-9f.png',
            { frameWidth: 40, frameHeight: 40 },
        );
        this.load.spritesheet(
            'entei-sprite',
            'Image/entei-sprite-9f.png',
            { frameWidth: 40, frameHeight: 40 },
        );

        // 메타그로스 관련 강철 포켓몬 스프라이트 (프로젝트 루트에 위치)
        this.load.image('metagross-gear', '기어르.png');
        // 포탑·드론은 idle/방향별 애니메이션 스프라이트 시트
        this.load.spritesheet('metagross-turret', 'metagross-turret-sprite-4f.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('metagross-invincible', 'metagross-invincible-sprite-4f.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('metagross-chaser', 'metagross-chaser-sprite-32f.png', { frameWidth: 24, frameHeight: 24 });
        this.load.spritesheet('metagross-harvester', 'metagross-harvester-sprite-64f.png', { frameWidth: 40, frameHeight: 40 });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');
        this.cameras.main.fadeIn(300, 0, 0, 0);
        AudioSettings.applyMaster(this);
        BootScene.ensureMenuBgm(this);

        if (!this.registry.get('loadout')) {
            const saved = Storage.load();
            if (saved) {
                this.registry.set('weaponLevels', saved.weaponLevels);
                this.registry.set('loadout', saved.loadout);
                this.registry.set('bossProgress', saved.bossProgress);
                this.registry.set('crystals', saved.crystals ?? 0);
                this.registry.set('upgrades', saved.upgrades ?? makeInitialUpgrades());
            } else {
                const init = makeInitialSaveData();
                this.registry.set('weaponLevels', init.weaponLevels);
                this.registry.set('loadout', init.loadout);
                this.registry.set('bossProgress', init.bossProgress);
                this.registry.set('crystals', init.crystals);
                this.registry.set('upgrades', init.upgrades);
                Storage.save(init.weaponLevels, init.loadout, init.bossProgress,
                    init.crystals, init.upgrades);
            }
        }

        const centerX = GameConfig.GAME_WIDTH / 2;

        this.add.text(centerX, 180, '탄막슈팅게임', {
            fontSize: '40px',
            color: '#ffffff',
        }).setOrigin(0.5);

        this.add.text(centerX, 230, '두 캐릭터 동시 조작', {
            fontSize: '14px',
            color: '#8888aa',
        }).setOrigin(0.5);

        const weaponLevels = this.registry.get('weaponLevels') || {};
        const weaponLabel = BASIC_WEAPON_IDS
            .map((id) => `${Weapons[id]?.name ?? id} Lv${weaponLevels[id] ?? 0}`)
            .join('  ·  ');
        this.add.text(centerX, 290, weaponLabel, {
            fontSize: '11px',
            color: '#7788aa',
            align: 'center',
            wordWrap: { width: GameConfig.GAME_WIDTH - 40 },
        }).setOrigin(0.5);

        const bossProgress = this.registry.get('bossProgress') || {};
        const progressLines = Stages.map((b) => {
            const lv = bossProgress[b.id] ?? 0;
            const label = lv === 0 ? '미클리어' : `최고 Lv${lv} 클리어`;
            return `${b.name}: ${label}`;
        }).join('\n');
        this.add.text(centerX, 330, progressLines, {
            fontSize: '11px',
            color: '#88ccff',
            align: 'center',
            lineSpacing: 4,
        }).setOrigin(0.5);

        const crystals = this.registry.get('crystals') ?? 0;
        this.add.text(centerX, 372, `결정: ${crystals}개`, {
            fontSize: '13px', color: '#ffcc88',
        }).setOrigin(0.5);

        this.items = [
            { label: '게임 시작', scene: 'BossSelectScene' },
            { label: '강화 상점', scene: 'UpgradeShopScene' },
            { label: '조작 실습 (튜토리얼)', scene: 'TutorialScene' },
            { label: '패턴 실험실', scene: 'PatternLabScene' },
            { label: '설정', scene: 'SettingsScene' },
            { label: '게임 초기화', action: 'reset', color: '#ff6666' },
        ];
        this.selectedIndex = 0;

        this.itemTexts = this.items.map((item, i) => {
            return this.add.text(centerX, 415 + i * 44, '', {
                fontSize: '22px',
                color: '#ffffff',
            }).setOrigin(0.5);
        });

        this.confirmingReset = false;
        this.confirmOverlay = this.add.rectangle(
            centerX, GameConfig.GAME_HEIGHT / 2,
            GameConfig.GAME_WIDTH, 160, 0x000000, 0.85
        ).setStrokeStyle(2, 0xff6666).setVisible(false);
        this.confirmText = this.add.text(centerX, GameConfig.GAME_HEIGHT / 2,
            '정말 초기화하시겠습니까?\n무기 · 결정 · 강화 · 진행도 모두 삭제됩니다.\n\nEnter = 확인    ESC = 취소',
            {
                fontSize: '14px', color: '#ffcccc', align: 'center', lineSpacing: 6,
            }
        ).setOrigin(0.5).setVisible(false);

        this.add.text(centerX, GameConfig.GAME_HEIGHT - 80,
            'W/S 또는 ↑/↓ 로 선택\nEnter 또는 Space 로 확정',
            {
                fontSize: '13px',
                color: '#666677',
                align: 'center',
                lineSpacing: 6,
            }
        ).setOrigin(0.5);

        const KC = Phaser.Input.Keyboard.KeyCodes;
        this.keyUp1 = this.input.keyboard.addKey(KC.W);
        this.keyDown1 = this.input.keyboard.addKey(KC.S);
        this.keyUp2 = this.input.keyboard.addKey(KC.UP);
        this.keyDown2 = this.input.keyboard.addKey(KC.DOWN);
        this.keyConfirm1 = this.input.keyboard.addKey(KC.ENTER);
        this.keyConfirm2 = this.input.keyboard.addKey(KC.SPACE);
        this.keyCancel = this.input.keyboard.addKey(KC.ESC);

        this.refreshMenu();
    }

    update() {
        const JD = Phaser.Input.Keyboard.JustDown;

        if (this.confirmingReset) {
            if (JD(this.keyConfirm1)) {
                this.resetGame();
            } else if (JD(this.keyCancel)) {
                this.cancelReset();
            }
            return;
        }

        if (JD(this.keyUp1) || JD(this.keyUp2)) {
            this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
            this.refreshMenu();
        } else if (JD(this.keyDown1) || JD(this.keyDown2)) {
            this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
            this.refreshMenu();
        } else if (JD(this.keyConfirm1) || JD(this.keyConfirm2)) {
            const item = this.items[this.selectedIndex];
            if (item.action === 'reset') {
                this.promptReset();
            } else {
                this.scene.start(item.scene);
            }
        }
    }

    promptReset() {
        this.confirmingReset = true;
        this.confirmOverlay.setVisible(true);
        this.confirmText.setVisible(true);
    }

    cancelReset() {
        this.confirmingReset = false;
        this.confirmOverlay.setVisible(false);
        this.confirmText.setVisible(false);
    }

    resetGame() {
        Storage.clear();
        const init = makeInitialSaveData();
        this.registry.set('weaponLevels', init.weaponLevels);
        this.registry.set('loadout', init.loadout);
        this.registry.set('bossProgress', init.bossProgress);
        this.registry.set('crystals', init.crystals);
        this.registry.set('upgrades', init.upgrades);
        Storage.save(init.weaponLevels, init.loadout, init.bossProgress,
            init.crystals, init.upgrades);
        this.scene.restart();
    }

    refreshMenu() {
        this.itemTexts.forEach((t, i) => {
            const item = this.items[i];
            const selected = i === this.selectedIndex;
            t.setText(selected ? `▶  ${item.label}` : `    ${item.label}`);
            t.setColor(selected ? '#ffee00' : (item.color ?? '#aaaaaa'));
            if (t.__pulseTween) { t.__pulseTween.stop(); t.__pulseTween = null; }
            t.setScale(1);
            if (selected) {
                t.__pulseTween = this.tweens.add({
                    targets: t, scale: 1.08, duration: 500,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            }
        });
    }

    // 메뉴 BGM: 게임 전역 사운드로 한 인스턴스만 유지. 씬 왕복 시 이어서 재생.
    // __baseVolume 태그로 AudioSettings 팩터 반영 및 실시간 갱신 지원.
    static ensureMenuBgm(scene) {
        if (!scene.cache.audio.exists('menu-bgm')) return;
        let bgm = scene.sound.get('menu-bgm');
        if (!bgm) {
            bgm = scene.sound.add('menu-bgm', { loop: true, volume: 0 });
            bgm.__baseVolume = 0.2;
        }
        if (!bgm.isPlaying) {
            bgm.setVolume(AudioSettings.bgmVolume(bgm.__baseVolume ?? 0.2));
            bgm.play();
        }
    }

    static stopMenuBgm(scene) {
        const bgm = scene.sound.get('menu-bgm');
        if (bgm && bgm.isPlaying) bgm.stop();
    }

    // 크로스페이드용: 800ms 동안 볼륨 → 0, 완료 시 stop
    static fadeOutMenuBgm(scene, durationMs = 800) {
        const bgm = scene.sound.get('menu-bgm');
        if (!bgm || !bgm.isPlaying) return;
        scene.tweens.add({
            targets: bgm, volume: 0, duration: durationMs,
            onComplete: () => bgm.stop(),
        });
    }
}
