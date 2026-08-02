const phaserConfig = {
    type: Phaser.AUTO,
    width: GameConfig.GAME_WIDTH,
    height: GameConfig.GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false,
        },
    },
    scene: [BootScene, TutorialScene, BossSelectScene, LoadoutScene, GameScene, PatternLabScene, UpgradeShopScene, SettingsScene],
};

// 폰트 로드 완료 후 게임 시작 — 첫 프레임 폴백 폰트 flicker 방지.
// 모든 add.text 호출에 기본 fontFamily 자동 세팅 (팩토리 오버라이드).
function startGameWithFont() {
    const _originalText = Phaser.GameObjects.GameObjectFactory.prototype.text;
    Phaser.GameObjects.GameObjectFactory.prototype.text = function(x, y, text, style) {
        const merged = Object.assign({ fontFamily: 'NeoDunggeunmo' }, style || {});
        return _originalText.call(this, x, y, text, merged);
    };
    return new Phaser.Game(phaserConfig);
}

document.fonts.load('16px NeoDunggeunmo').then(startGameWithFont).catch(startGameWithFont);
