// 격자 기반 위험도 맵.
// 각 셀에 "가장 빠른 총알 도달 시간(ms)"을 저장하고, 짧을수록 진한 색으로 시각화.
class DangerMap {
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.cellSize = opts.cellSize ?? 20;
        this.width = opts.width ?? GameConfig.GAME_WIDTH;
        this.height = opts.height ?? GameConfig.GAME_HEIGHT;
        this.cols = Math.ceil(this.width / this.cellSize);
        this.rows = Math.ceil(this.height / this.cellSize);
        // 몇 개의 시점을 샘플링할지. 더 촘촘하면 정확, 성능 감소.
        this.timeSamples = opts.timeSamples ?? [80, 160, 240, 320, 480, 640, 800, 1000, 1250, 1500];
        this.horizonMs = this.timeSamples[this.timeSamples.length - 1];
        this.bulletRadiusFallback = opts.bulletRadiusFallback ?? 6;

        // cellArrivals[r * cols + c] = 그 셀에 총알이 도달하는 최소 시간(ms). Infinity = 안전.
        this.cellArrivals = new Float32Array(this.cols * this.rows);
        this.reset();

        this.graphics = scene.add.graphics();
        this.graphics.setDepth(50);
        this.visible = false;
    }

    reset() {
        this.cellArrivals.fill(Infinity);
    }

    toggle() {
        this.visible = !this.visible;
        if (!this.visible) this.graphics.clear();
    }

    // groups: [bossBullets, snowflakesGroup, ...] 등 위험한 그룹 배열
    // sceneTime: 현재 씬 time.now (일부 예측 함수에 필요)
    // staticHazards: [{ x, y, radius, arrivalTime }] 정적 위험 지대 (예: 보스 몸통, 드론)
    // lineHazards: [{ x1, y1, x2, y2, radius, arrivalTime }] 위험 선분 (예: 포탑 연결선)
    // 계산은 항상 수행, 렌더는 visible일 때만
    update(groups, sceneTime, staticHazards, lineHazards) {
        this.reset();

        for (const group of groups) {
            if (!group) continue;
            group.children.each((b) => {
                if (!b || !b.active || !b.body) return;
                if (b.isElectricField) {
                    const halfW = (b.width ?? this.width) / 2;
                    const halfH = (b.height ?? 22) / 2;
                    const vx = b.body.velocity.x;
                    const vy = b.body.velocity.y;
                    for (const t of this.timeSamples) {
                        const s = t / 1000;
                        this.markCells(b.x + vx * s, b.y + vy * s, halfW, halfH, t);
                    }
                    return;
                }
                const radius = BulletPredictor.getRadius(b, this.bulletRadiusFallback);
                const preds = BulletPredictor.predict(b, this.timeSamples, sceneTime);
                // 기어는 벽을 따라 사각형 궤도 → 시점 사이 궤적도 위험. 선분으로 연결.
                if (b.isGear) {
                    let prev = null;
                    for (const p of preds) {
                        this.markCells(p.x, p.y, radius, radius, p.t);
                        if (prev) this.markLine(prev.x, prev.y, p.x, p.y, radius, p.t);
                        prev = p;
                    }
                    return;
                }
                for (const p of preds) {
                    this.markCells(p.x, p.y, radius, radius, p.t);
                }
            });
        }

        if (staticHazards) {
            for (const h of staticHazards) {
                this.markCells(h.x, h.y, h.radius, h.radius, h.arrivalTime ?? 0);
            }
        }

        if (lineHazards) {
            for (const h of lineHazards) {
                this.markLine(h.x1, h.y1, h.x2, h.y2, h.radius, h.arrivalTime ?? 0);
            }
        }

        if (this.visible) this.render();
    }

    // (cx, cy)는 셀 인덱스. 화면 밖은 0(최고 위험) 반환 → 봇이 화면 밖으로 안 감.
    getArrivalAtCell(cx, cy) {
        if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return 0;
        return this.cellArrivals[cy * this.cols + cx];
    }

    // 픽셀 좌표를 셀 인덱스로 변환 후 위험도 반환
    getArrivalAtPos(px, py) {
        const cx = Math.floor(px / this.cellSize);
        const cy = Math.floor(py / this.cellSize);
        return this.getArrivalAtCell(cx, cy);
    }

    // 히트박스(반경 r)에 걸치는 모든 셀 중 최소값(가장 임박) 반환
    getArrivalInRadius(px, py, r) {
        const minCol = Math.max(0, Math.floor((px - r) / this.cellSize));
        const maxCol = Math.min(this.cols - 1, Math.floor((px + r) / this.cellSize));
        const minRow = Math.max(0, Math.floor((py - r) / this.cellSize));
        const maxRow = Math.min(this.rows - 1, Math.floor((py + r) / this.cellSize));
        let minArrival = Infinity;
        for (let row = minRow; row <= maxRow; row += 1) {
            const rowBase = row * this.cols;
            for (let col = minCol; col <= maxCol; col += 1) {
                const v = this.cellArrivals[rowBase + col];
                if (v < minArrival) minArrival = v;
            }
        }
        return minArrival;
    }

    // 선분 (x1,y1)-(x2,y2) 를 stepPx 간격으로 샘플링해서 각 점을 원형 위험으로 마킹.
    // radius: 각 샘플점의 위험 반경 (판정 반경 + 여유).
    markLine(x1, y1, x2, y2, radius, arrivalTime, stepPx = 15) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len < 0.01) {
            this.markCells(x1, y1, radius, radius, arrivalTime);
            return;
        }
        const steps = Math.max(1, Math.ceil(len / stepPx));
        const ux = dx / steps;
        const uy = dy / steps;
        for (let i = 0; i <= steps; i += 1) {
            this.markCells(x1 + ux * i, y1 + uy * i, radius, radius, arrivalTime);
        }
    }

    markCells(px, py, halfW, halfH, arrivalTime) {
        const minCol = Math.max(0, Math.floor((px - halfW) / this.cellSize));
        const maxCol = Math.min(this.cols - 1, Math.floor((px + halfW) / this.cellSize));
        const minRow = Math.max(0, Math.floor((py - halfH) / this.cellSize));
        const maxRow = Math.min(this.rows - 1, Math.floor((py + halfH) / this.cellSize));
        for (let r = minRow; r <= maxRow; r += 1) {
            const rowBase = r * this.cols;
            for (let c = minCol; c <= maxCol; c += 1) {
                const idx = rowBase + c;
                if (arrivalTime < this.cellArrivals[idx]) {
                    this.cellArrivals[idx] = arrivalTime;
                }
            }
        }
    }

    render() {
        this.graphics.clear();
        for (let r = 0; r < this.rows; r += 1) {
            const rowBase = r * this.cols;
            const y = r * this.cellSize;
            for (let c = 0; c < this.cols; c += 1) {
                const arrival = this.cellArrivals[rowBase + c];
                if (arrival === Infinity) continue;
                // arrival 0 → 진한 빨강 (alpha 0.55), horizonMs → 옅은 노랑 (alpha 0.1)
                const t = Math.min(1, arrival / this.horizonMs);
                const alpha = 0.55 - 0.45 * t;
                // 색상도 시간에 따라 빨강→주황
                const rC = 255;
                const gC = Math.round(200 * t);
                const bC = 0;
                const color = (rC << 16) | (gC << 8) | bC;
                this.graphics.fillStyle(color, alpha);
                this.graphics.fillRect(c * this.cellSize, y, this.cellSize, this.cellSize);
            }
        }
    }

    destroy() {
        if (this.graphics && this.graphics.active) this.graphics.destroy();
    }
}
