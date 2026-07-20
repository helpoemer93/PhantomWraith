// 단일 캐릭터를 조작하는 봇 컨트롤러.
// - mockKeys 인터페이스로 Player.keys를 대체 (Player 로직은 그대로)
// - 무적/일반 공통: 자기 자리 위험하면 안전한 곳으로, 안전하면 home으로
// - 스왑 판단은 GameScene에서 두 봇 상태 종합
class BotController {
    constructor(scene, player, opts = {}) {
        this.scene = scene;
        this.player = player;
        this.mockKeys = {
            left: { isDown: false },
            right: { isDown: false },
            up: { isDown: false },
            down: { isDown: false },
        };
        // 위험도 임계 (ms). 낮을수록 임박한 위험.
        this.dangerNow = opts.dangerNow ?? 200;
        this.dangerSafe = opts.dangerSafe ?? 1000;
        // 기본 위치
        this.homeX = opts.homeX ?? GameConfig.GAME_WIDTH / 2;
        this.homeY = opts.homeY ?? GameConfig.GAME_HEIGHT - 100;
        // 히트박스 반경 (봇이 판단할 때 사용). 여유를 넉넉하게.
        this.hitRadius = (this.player.size ?? 30) / 2 + 8;
        // 이전 프레임 방향 (관성용)
        this.lastDx = 0;
        this.lastDy = 0;
        // 마지막 결정 유효 시간 (관성 유지). 짧을수록 반응 빠름.
        this.decisionHoldMs = opts.decisionHoldMs ?? 40;
        this.lastDecisionAt = -Infinity;
        // 파트너 (다른 봇 or 플레이어). GameScene에서 세팅.
        this.partner = null;
        // 파트너와 유지할 최소 거리
        this.minPartnerDist = opts.minPartnerDist ?? 160;
        // 화면 벽 근처 페널티 시작 거리
        this.wallMarginPx = opts.wallMarginPx ?? 80;
    }

    // 딜링 위치 보너스: 위협 드론 > 보스 > 포탑 우선순위로 x정렬 시 가산점.
    // 캐리 드론은 회수 저지 목적으로 최우선. 자폭드론 charging은 회피 대상이라 격추 시도 X.
    aimBonus(x, y) {
        let bonus = 0;
        // 채취드론(캐리 걷어치우는 게 클리어 조건)
        const harvesters = this.scene.harvesterDronesGroup;
        if (harvesters) {
            harvesters.children.each((d) => {
                if (!d || !d.active || d.hp <= 0) return;
                const dx = Math.abs(x - d.x);
                const alignRange = 40;
                if (dx >= alignRange || y <= d.y + 30) return;
                let weight = 0;
                if (d.state === 'carrying') weight = 6;        // 최우선. 최대 +240
                else if (d.state === 'wallRiding') weight = 4; // 최대 +160
                else if (d.state === 'descending') weight = 3.5; // 최대 +140
                bonus += (alignRange - dx) * weight;
            });
        }
        // 자폭드론
        const suicides = this.scene.suicideDronesGroup;
        if (suicides) {
            suicides.children.each((d) => {
                if (!d || !d.active || d.hp <= 0) return;
                if (d.state === 'charging') return;
                const dx = Math.abs(x - d.x);
                const alignRange = 40;
                if (dx >= alignRange || y <= d.y + 30) return;
                let weight = 0;
                if (d.state === 'orbiting') weight = 4;      // 최대 +160
                else if (d.state === 'approaching') weight = 3.5;
                else if (d.state === 'paused') weight = 3;
                bonus += (alignRange - dx) * weight;
            });
        }
        // 보스
        const boss = this.scene.boss;
        if (boss && boss.sprite && boss.sprite.active && !boss.isDead()) {
            const dxBoss = Math.abs(x - boss.sprite.x);
            const alignRange = 40;
            if (dxBoss < alignRange && y > boss.sprite.y + 50) {
                bonus += (alignRange - dxBoss) * 4; // 최대 +160
            }
        }
        // 포탑
        const turrets = this.scene.turretsGroup;
        if (turrets) {
            turrets.children.each((t) => {
                if (!t || !t.active || t.hp <= 0 || t.invincible) return;
                const dx = Math.abs(x - t.x);
                const alignRange = 30;
                if (dx < alignRange && y > t.y + 30) {
                    bonus += (alignRange - dx) * 1.5; // 최대 +45
                }
            });
        }
        return bonus;
    }

    // 안전 상태에서 이동 목표를 정할 때 참조할 우선 위협 드론. 없으면 null.
    pickPriorityDroneTarget() {
        let best = null;
        let bestScore = -Infinity;
        const consider = (d, score) => {
            if (score > bestScore) { bestScore = score; best = d; }
        };
        const harvesters = this.scene.harvesterDronesGroup;
        if (harvesters) {
            harvesters.children.each((d) => {
                if (!d || !d.active || d.hp <= 0) return;
                if (d.state === 'carrying') consider(d, 100);
                else if (d.state === 'wallRiding') consider(d, 60);
                else if (d.state === 'descending') consider(d, 50);
            });
        }
        const suicides = this.scene.suicideDronesGroup;
        if (suicides) {
            suicides.children.each((d) => {
                if (!d || !d.active || d.hp <= 0) return;
                if (d.state === 'charging') return;
                if (d.state === 'orbiting') consider(d, 70);
                else if (d.state === 'approaching') consider(d, 50);
                else if (d.state === 'paused') consider(d, 40);
            });
        }
        return best;
    }

    wallPenalty(x, y) {
        const W = GameConfig.GAME_WIDTH;
        const H = GameConfig.GAME_HEIGHT;
        const m = this.wallMarginPx;
        const dLeft = x;
        const dRight = W - x;
        const dTop = y;
        const dBottom = H - y;
        const minD = Math.min(dLeft, dRight, dTop, dBottom);
        let pen = 0;
        if (minD < m) pen -= ((m - minD) / m) * 1000;
        // 상단(보스 발원지 근처)은 특히 위험
        const topZone = 300;
        if (y < topZone) pen -= ((topZone - y) / topZone) * 800;
        // 하단 극벽도 코너 갇힘 방지 위해 페널티
        const bottomZone = 120;
        if (H - y < bottomZone) pen -= ((bottomZone - (H - y)) / bottomZone) * 400;
        return pen;
    }

    getKeys() {
        return this.mockKeys;
    }

    getStatus() {
        const dm = this.scene.dangerMap;
        const sprite = this.player.sprite;
        const danger = dm
            ? dm.getArrivalInRadius(sprite.x, sprite.y, this.hitRadius)
            : Infinity;
        return {
            invincible: this.player.isInvincible,
            danger,
            x: sprite.x,
            y: sprite.y,
        };
    }

    update(time, delta) {
        const dm = this.scene.dangerMap;
        if (!dm) {
            this.setKeys(0, 0);
            return;
        }
        const sprite = this.player.sprite;
        const px = sprite.x;
        const py = sprite.y;

        // 무적 캐릭터: 자기 위치 위험 무시. 화면 전체에서 안전 지점 탐색.
        if (this.player.isInvincible) {
            this.updateAsInvincible(time, px, py);
            return;
        }

        // 일반 캐릭터: 즉시 회피 우선
        this.updateAsVulnerable(time, px, py);
    }

    updateAsInvincible(time, px, py) {
        const dm = this.scene.dangerMap;
        const W = GameConfig.GAME_WIDTH;
        const H = GameConfig.GAME_HEIGHT;
        const partnerX = this.partner?.sprite?.x ?? null;
        const partnerY = this.partner?.sprite?.y ?? null;

        // 화면 그리드 샘플링. 안전 + 파트너와 거리 + 이동비용 종합
        const step = 60;
        let bestScore = -Infinity;
        let bestX = px;
        let bestY = py;
        for (let sx = step / 2; sx < W; sx += step) {
            for (let sy = step / 2; sy < H; sy += step) {
                const danger = dm.getArrivalInRadius(sx, sy, this.hitRadius);
                const dangerScore = (danger === Infinity ? 3000 : danger);
                let partnerBonus = 0;
                if (partnerX !== null) {
                    const pd = Math.hypot(sx - partnerX, sy - partnerY);
                    if (pd < this.minPartnerDist) partnerBonus = -(this.minPartnerDist - pd) * 3;
                }
                const moveCost = Math.hypot(sx - px, sy - py) * 0.4;
                const wallPen = this.wallPenalty(sx, sy);
                // 무적 캐릭터도 딜링 참여: 안전한 셀 중 위협 드론/보스 x정렬 선호
                const aimB = this.aimBonus(sx, sy);
                const score = dangerScore + partnerBonus - moveCost + wallPen + aimB;
                if (score > bestScore) {
                    bestScore = score;
                    bestX = sx;
                    bestY = sy;
                }
            }
        }
        this.moveTowards(px, py, bestX, bestY);
    }

    updateAsVulnerable(time, px, py) {
        const dm = this.scene.dangerMap;
        const currDanger = dm.getArrivalInRadius(px, py, this.hitRadius);

        if (currDanger >= this.dangerSafe) {
            // 안전: 우선 위협 드론이 있으면 그 x로, 없으면 보스 x정렬
            let tx = this.homeX;
            let ty = this.homeY;
            const priorityDrone = this.pickPriorityDroneTarget();
            if (priorityDrone) {
                tx = priorityDrone.x;
                ty = Math.max(priorityDrone.y + 120, GameConfig.GAME_HEIGHT * 0.55);
            } else {
                const boss = this.scene.boss;
                if (boss && boss.sprite && boss.sprite.active && !boss.isDead()) {
                    tx = boss.sprite.x;
                    ty = GameConfig.GAME_HEIGHT * 0.65;
                }
            }
            // 파트너와 겹치지 않게 오프셋
            const partnerX = this.partner?.sprite?.x ?? null;
            const partnerY = this.partner?.sprite?.y ?? null;
            if (partnerX !== null) {
                const dist = Math.hypot(tx - partnerX, ty - partnerY);
                if (dist < this.minPartnerDist) {
                    const dxP = tx - partnerX;
                    const dyP = ty - partnerY;
                    const d = Math.hypot(dxP, dyP) || 1;
                    tx += (dxP / d) * 60;
                    ty += (dyP / d) * 60;
                }
            }
            this.moveTowards(px, py, tx, ty);
            return;
        }

        // 위험: 관성 유지
        if (time - this.lastDecisionAt < this.decisionHoldMs && (this.lastDx !== 0 || this.lastDy !== 0)) {
            this.setKeys(this.lastDx, this.lastDy);
            return;
        }

        // 위험 상태에서는 정지 옵션 제외. 반드시 이동.
        const step = dm.cellSize;
        const candidates = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0], [1, 0],
            [-1, 1], [0, 1], [1, 1],
        ];
        let bestScore = -Infinity;
        let bestDx = 0;
        let bestDy = 0;
        const partnerX = this.partner?.sprite?.x ?? null;
        const partnerY = this.partner?.sprite?.y ?? null;
        for (const [dx, dy] of candidates) {
            const nx = px + dx * step;
            const ny = py + dy * step;
            const val = dm.getArrivalInRadius(nx, ny, this.hitRadius);
            let bonus = 0;
            if (dx === this.lastDx && dy === this.lastDy) bonus += 50;
            if (partnerX !== null) {
                const dist = Math.hypot(nx - partnerX, ny - partnerY);
                if (dist < this.minPartnerDist) {
                    bonus -= (this.minPartnerDist - dist) * 3;
                }
            }
            bonus += this.wallPenalty(nx, ny);
            // 위험 회피 상태에선 딜링 유혹이 회피 우선순위를 흐리지 않도록 대폭 축소.
            bonus += this.aimBonus(nx, ny) * 0.2;
            const score = (val === Infinity ? 10000 : val) + bonus;
            if (score > bestScore) {
                bestScore = score;
                bestDx = dx;
                bestDy = dy;
            }
        }
        this.setKeys(bestDx, bestDy);
        this.lastDx = bestDx;
        this.lastDy = bestDy;
        this.lastDecisionAt = time;
    }

    moveTowards(px, py, tx, ty) {
        const dx = tx - px;
        const dy = ty - py;
        const threshold = 4;
        const sdx = Math.abs(dx) < threshold ? 0 : Math.sign(dx);
        const sdy = Math.abs(dy) < threshold ? 0 : Math.sign(dy);
        this.setKeys(sdx, sdy);
        this.lastDx = sdx;
        this.lastDy = sdy;
    }

    setKeys(dx, dy) {
        this.mockKeys.left.isDown = dx < 0;
        this.mockKeys.right.isDown = dx > 0;
        this.mockKeys.up.isDown = dy < 0;
        this.mockKeys.down.isDown = dy > 0;
    }
}
