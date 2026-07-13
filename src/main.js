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
    scene: [BootScene, TutorialScene, LoadoutScene, GameScene, RewardScene],
};

const game = new Phaser.Game(phaserConfig);
