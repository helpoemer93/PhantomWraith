// 총알의 미래 위치를 예측한다.
// 첫 단계에서는 현재 velocity 기반 직선 근사만 지원.
// 웨이비/유도/궤도 등 특수 궤적은 나중에 확장.
const BulletPredictor = {
    // bullet: Phaser Arcade sprite. body.velocity 필요.
    // times: 예측할 시점 리스트 (ms). 예: [100, 200, 400, 600, 800]
    // returns: [{ x, y, t }, ...]
    predictLinear(bullet, times) {
        const vx = bullet.body.velocity.x;
        const vy = bullet.body.velocity.y;
        const out = [];
        for (const t of times) {
            const s = t / 1000;
            out.push({
                x: bullet.x + vx * s,
                y: bullet.y + vy * s,
                t,
            });
        }
        return out;
    },

    // 궤도 orb: owner(core) 위치는 직선, orb는 그 주위를 회전
    predictOrbit(bullet, times) {
        const owner = bullet.orbitOwner;
        if (!owner || !owner.active || !owner.body) {
            return this.predictLinear(bullet, times);
        }
        const ox = owner.x;
        const oy = owner.y;
        const ovx = owner.body.velocity.x;
        const ovy = owner.body.velocity.y;
        const startAngle = bullet.orbitAngle;
        const spd = bullet.orbitSpeed;
        const r = bullet.orbitRadius;
        const out = [];
        for (const t of times) {
            const s = t / 1000;
            const cx = ox + ovx * s;
            const cy = oy + ovy * s;
            const angle = startAngle + spd * s;
            out.push({
                x: cx + Math.cos(angle) * r,
                y: cy + Math.sin(angle) * r,
                t,
            });
        }
        return out;
    },

    // 웨이비 총알: y는 직선, x는 사인 진동
    // sceneTime: 씬의 현재 time.now
    predictWavy(bullet, times, sceneTime) {
        const vx0 = bullet.wavyVx ?? 0;
        const vy = bullet.wavyVy ?? 0;
        const amp = bullet.wavyAmp ?? 0;
        const freq = bullet.wavyFreq ?? 0;
        const phase = bullet.wavyPhase ?? 0;
        const twopi = 2 * Math.PI * freq;
        const elapsedNow = (sceneTime - bullet.wavyStartTime) / 1000;
        const sinNow = Math.sin(twopi * elapsedNow + phase);
        const out = [];
        for (const t of times) {
            const s = t / 1000;
            const elapsedFuture = elapsedNow + s;
            const sinFuture = Math.sin(twopi * elapsedFuture + phase);
            const dx = vx0 * s + amp * (sinFuture - sinNow);
            const dy = vy * s;
            out.push({ x: bullet.x + dx, y: bullet.y + dy, t });
        }
        return out;
    },

    // 기어: 상태 머신 벽 반사. times는 오름차순 가정.
    predictGear(bullet, times) {
        const W = GameConfig.GAME_WIDTH;
        const H = GameConfig.GAME_HEIGHT;
        const speed = bullet.gearSpeed ?? Math.hypot(bullet.body.velocity.x, bullet.body.velocity.y);
        let x = bullet.x;
        let y = bullet.y;
        let vx = bullet.body.velocity.x;
        let vy = bullet.body.velocity.y;
        let state = bullet.gearState;
        let wallSide = bullet.wallSide;
        let elapsedMs = 0;
        let destroyed = false;

        const out = [];
        for (const t of times) {
            if (destroyed) {
                out.push({ x, y, t });
                continue;
            }
            let safety = 20;
            while (elapsedMs < t && !destroyed && safety > 0) {
                safety -= 1;
                const remainingMs = t - elapsedMs;
                let wallHitMs = Infinity;
                if (state === 'initial') {
                    if (vx > 0) wallHitMs = Math.min(wallHitMs, (W - x) / vx * 1000);
                    else if (vx < 0) wallHitMs = Math.min(wallHitMs, (0 - x) / vx * 1000);
                    if (vy > 0) wallHitMs = Math.min(wallHitMs, (H - y) / vy * 1000);
                    else if (vy < 0) wallHitMs = Math.min(wallHitMs, (0 - y) / vy * 1000);
                } else if (state === 'goingDown') {
                    if (vy > 0) wallHitMs = (H - y) / vy * 1000;
                } else if (state === 'goingRight') {
                    if (vx > 0) wallHitMs = (W - x) / vx * 1000;
                } else if (state === 'goingLeft') {
                    if (vx < 0) wallHitMs = (0 - x) / vx * 1000;
                } else if (state === 'goingUp') {
                    if (vy < 0) wallHitMs = (0 - y) / vy * 1000;
                }
                if (wallHitMs < 0) wallHitMs = 0;

                if (wallHitMs >= remainingMs) {
                    x += vx * (remainingMs / 1000);
                    y += vy * (remainingMs / 1000);
                    elapsedMs = t;
                } else {
                    x += vx * (wallHitMs / 1000);
                    y += vy * (wallHitMs / 1000);
                    elapsedMs += wallHitMs;
                    // 상태 전환
                    if (state === 'initial') {
                        if (x <= 0) { wallSide = 'left'; state = 'goingDown'; vx = 0; vy = speed; }
                        else if (x >= W) { wallSide = 'right'; state = 'goingDown'; vx = 0; vy = speed; }
                        else if (y >= H) {
                            if (x < W / 2) { state = 'goingRight'; vx = speed; vy = 0; }
                            else { state = 'goingLeft'; vx = -speed; vy = 0; }
                        } else if (y <= 0) {
                            destroyed = true;
                        }
                    } else if (state === 'goingDown') {
                        if (wallSide === 'left') { state = 'goingRight'; vx = speed; vy = 0; }
                        else { state = 'goingLeft'; vx = -speed; vy = 0; }
                    } else if (state === 'goingRight') {
                        wallSide = 'right'; state = 'goingUp'; vx = 0; vy = -speed;
                    } else if (state === 'goingLeft') {
                        wallSide = 'left'; state = 'goingUp'; vx = 0; vy = -speed;
                    } else if (state === 'goingUp') {
                        destroyed = true;
                    }
                }
            }
            out.push({ x, y, t });
        }
        return out;
    },

    // 파도미사일: 방향(waveDx, waveDy) 고정, 속도 v(t) = a·(1 + c·sin(2π·t/T)).
    // 위치 = 시작위치 + 방향 · integral(v). 현재 x/y는 physics 누적이므로 (미래 적분 - 현재 적분) 차이를 더함.
    predictWaveMissile(bullet, times, sceneTime) {
        const dx = bullet.waveDx;
        const dy = bullet.waveDy;
        const a = bullet.waveA;
        const c = bullet.waveCoef ?? 2;
        const T = bullet.wavePeriodSec || 1.0;
        const elapsedNowSec = (sceneTime - bullet.waveStartTime) / 1000;
        // ∫ a·(1 + c·sin(2π·τ/T)) dτ from 0 to t  =  a·t + a·c·(T/(2π))·(1 - cos(2π·t/T))
        const integralOf = (t) => a * t + a * c * (T / (2 * Math.PI)) * (1 - Math.cos((2 * Math.PI * t) / T));
        const nowIntegral = integralOf(elapsedNowSec);
        const out = [];
        for (const t of times) {
            const s = t / 1000;
            const dDist = integralOf(elapsedNowSec + s) - nowIntegral;
            out.push({ x: bullet.x + dx * dDist, y: bullet.y + dy * dDist, t });
        }
        return out;
    },

    // 총알의 유효 반경(판정용). halfWidth는 월드 디스플레이 반경(스프라이트 스케일 반영).
    // body.radius는 setCircle 소스 단위 raw 값이라 스케일된 스프라이트에서 잘못 나옴.
    getRadius(bullet, fallback = 6) {
        if (bullet.body && bullet.body.halfWidth) return bullet.body.halfWidth;
        if (bullet.body && bullet.body.radius) return bullet.body.radius;
        if (bullet.radius) return bullet.radius;
        return fallback;
    },

    // 총알 유형 판별 후 적절한 예측 함수 호출
    predict(bullet, times, sceneTime) {
        if (bullet.isGear) {
            return this.predictGear(bullet, times);
        }
        if (bullet.isOrbit && bullet.orbitOwner) {
            return this.predictOrbit(bullet, times);
        }
        if (bullet.hasWavyMotion) {
            return this.predictWavy(bullet, times, sceneTime);
        }
        if (bullet.isWaveMissile) {
            return this.predictWaveMissile(bullet, times, sceneTime);
        }
        return this.predictLinear(bullet, times);
    },
};
