class Sequence {
    constructor(scene, boss, spec) {
        this.scene = scene;
        this.boss = boss;
        this.spec = spec;
        this.stepIndex = 0;
        this.currentPattern = null;
        this.pauseUntil = null;
        this.done = false;
        this.executedOneShots = new Set();
    }

    update(time, delta) {
        if (this.done) return false;

        const steps = this.spec.steps;
        if (this.stepIndex >= steps.length) {
            if (this.spec.onLoop === 'toggleSideDirection') {
                this.boss.sideDirection *= -1;
            }
            if (this.spec.loop) {
                this.stepIndex = 0;
                this.currentPattern = null;
                this.pauseUntil = null;
            } else {
                this.done = true;
                return false;
            }
        }

        const step = steps[this.stepIndex];

        if (step.type === 'pattern') {
            if (!this.currentPattern) {
                this.currentPattern = new BulletPattern(this.scene, this.boss, step.spec);
            }
            const alive = this.currentPattern.update(time, delta);
            if (!alive) {
                this.currentPattern = null;
                this.stepIndex += 1;
            }
        } else if (step.type === 'pause') {
            if (this.pauseUntil == null) {
                this.pauseUntil = time + step.durationMs;
            }
            if (time >= this.pauseUntil) {
                this.pauseUntil = null;
                this.stepIndex += 1;
            }
        } else if (step.type === 'spawnClouds') {
            if (!this.executedOneShots.has(this.stepIndex)) {
                if (this.scene.spawnClouds) this.scene.spawnClouds(step.spec);
                this.executedOneShots.add(this.stepIndex);
            }
            this.stepIndex += 1;
        } else {
            this.stepIndex += 1;
        }

        return true;
    }
}
