class Boss {
    constructor(scene, data) {
        this.scene = scene;
        this.data = data;
        this.maxHp = data.maxHp;
        this.hp = data.maxHp;
        this.phaseIndex = -1;
        this.activePatterns = [];

        const startX = GameConfig.GAME_WIDTH / 2;
        const startY = data.startY ?? 140;

        this.sprite = scene.add.rectangle(
            startX, startY, data.size, data.size, data.color
        );
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setImmovable(true);
        this.sprite.body.setSize(data.size, data.size);

        this.spawnTime = scene.time.now;
        this.enterPhase(0);
    }

    enterPhase(index) {
        this.phaseIndex = index;
        this.activePatterns = [];
        const phase = this.data.phases[index];
        if (!phase) return;
        for (const patternSpec of phase.patterns) {
            this.activePatterns.push(new BulletPattern(this.scene, this, patternSpec));
        }
    }

    update(time, delta) {
        if (this.isDead()) return;

        const move = this.data.movement ?? {};
        const type = move.type ?? 'pendulum';
        if (type === 'pendulum') {
            const speed = move.speedRadPerSec ?? 1.0;
            const range = move.rangePx ?? 100;
            const t = (time - this.spawnTime) / 1000;
            this.sprite.x = GameConfig.GAME_WIDTH / 2 + Math.sin(t * speed) * range;
        } else if (type === 'fixed') {
            // no movement
        }

        this.activePatterns = this.activePatterns.filter((p) => p.update(time, delta));

        const nextPhase = this.data.phases[this.phaseIndex + 1];
        if (nextPhase && this.hp <= nextPhase.hpEnter) {
            this.enterPhase(this.phaseIndex + 1);
        }
    }

    onHit(damage) {
        if (this.isDead()) return;
        this.hp = Math.max(0, this.hp - damage);
    }

    isDead() {
        return this.hp <= 0;
    }

    destroy() {
        this.activePatterns = [];
        this.sprite.destroy();
    }
}
