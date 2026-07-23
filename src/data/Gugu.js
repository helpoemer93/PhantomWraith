const GuguBirdBurst = {
    type: 'birdEmitter',
    activateIntervalMs: 999999,
    items: [
        { startX: 240, startY: 20, dirX: 1, dirY: 0, fireDelayMs: 200 },
        { startX: 240, startY: 20, dirX: -1, dirY: 0 },
    ],
    moveSpeed: 100,
    width: 12,
    height: 10,
    color: 0xffdd88,
    fireIntervalMs: 200,
    bullet: {
        shape: 'bird',
        speed: 100,
        angleDeg: 90,
        color: 0xffdd88,
        size: 8,
        accel: 150,
    },
};

const GuguPhase1Sequence = {
    loop: true,
    steps: [
        {
            type: 'pattern',
            spec: {
                name: 'g1_orbCarrier',
                shape: 'orbCarrier',
                aimAtActivePlayer: true,
                count: 1,
                startAngleDeg: 90,
                angleSpreadDeg: 0,
                speed: 100,
                intervalMs: 100,
                maxShots: 1,
                core: {
                    radius: 15,
                    color: 0xcc66cc,
                    speedMultiplier: 0.6,
                },
                orbit: {
                    count: 10,
                    radius: 4,
                    color: 0xcc66cc,
                    orbitRadius: 30,
                    orbitSpeedRadPerSec: 3,
                    spinForwardSpeed: 80,
                    spinSideSpeed: 100,
                },
            },
        },
        { type: 'pause', durationMs: 4000 },
    ],
};

// 순수 데이터 (JSON 직렬화 가능해야 함 — 함수 없음)
const GuguData = {
    id: 'gugu',
    name: '구구',
    rewardWeapon: 'spread',
    maxHp: 600,
    size: 60,
    color: 0xffaadd,
    startY: 140,
    movement: {
        type: 'pendulum',
        speedRadPerSec: Math.PI / 5,
        rangePx: 130,
    },
    baseAttack: {
        intervalMs: 500,
        angles: [-15, 0, 15],
        bulletSpec: {
            shape: 'circle',
            speed: 200,
            radius: 6,
            color: 0xffcc44,
        },
    },
    phases: [
        {
            hpEnterRatio: 1.0,
            interludeOnExit: 'bird_burst',
            sequence: GuguPhase1Sequence,
        },
        {
            hpEnterRatio: 2 / 3,
            interludeOnExit: 'bird_burst',
            endpointDecelSpiral: {
                triggerCount: 1,
                count: 5,
                spreadDeg: 15,
                centerAngleDeg: 90,
                initSpeed: 180,
                speedAccel: -100,
                initAngularRate: 0,
                angularAccelMagnitude: 0.3,
            },
        },
        {
            hpEnterRatio: 1 / 3,
            sequence: GuguPhase1Sequence,
            baseAttack: {
                intervalMs: 500,
                angles: [-45, -15, 15, 45],
                bulletSpec: {
                    shape: 'circle',
                    speed: 200,
                    radius: 6,
                    color: 0xffcc44,
                    sinX: {
                        amplitude: 15,
                        frequency: 1,
                        amplitudeRandomRange: 5,
                    },
                },
            },
        },
    ],
    interludes: [
        {
            name: 'bird_burst',
            spec: GuguBirdBurst,
        },
    ],
};

const Gugu = {
    ...GuguData,

    // 레벨 적용된 데이터 반환 (딥클론).
    // 페이즈1·3은 원본에서 같은 sequence 를 공유했지만, 클론 후에는 별도 객체.
    // 궤도미사일·pause 스케일은 두 페이즈 모두에 명시적으로 적용.
    buildLevelData(level) {
        const d = JSON.parse(JSON.stringify(GuguData));
        const lv = Math.max(1, level);
        const scale = Math.pow(1.20, lv - 1);
        d.maxHp = Math.round(d.maxHp * scale);

        if (lv >= 2) {
            // 궤도미사일 개수 +5 (10→15)
            d.phases[0].sequence.steps[0].spec.orbit.count += 5;
            d.phases[2].sequence.steps[0].spec.orbit.count += 5;
        }
        if (lv >= 3) {
            // 이동속도 +30%, 기본공격 주기 -10%
            d.movement.speedRadPerSec *= 1.3;
            d.baseAttack.intervalMs = Math.round(d.baseAttack.intervalMs * 0.9);
            if (d.phases[2].baseAttack) {
                d.phases[2].baseAttack.intervalMs = Math.round(d.phases[2].baseAttack.intervalMs * 0.9);
            }
        }
        if (lv >= 4) {
            // 궤도미사일 시퀀스 pause -0.5초 (4000→3500)
            d.phases[0].sequence.steps[1].durationMs -= 500;
            d.phases[2].sequence.steps[1].durationMs -= 500;
        }
        if (lv >= 5) {
            // 기본공격 탄환수 +1 (3→4), 페이즈 3은 4→5로 등간격 확장
            d.baseAttack.angles = [-22.5, -7.5, 7.5, 22.5];
            if (d.phases[2].baseAttack) {
                d.phases[2].baseAttack.angles = [-60, -30, 0, 30, 60];
            }
        }

        return d;
    },

    // 전 레벨 대비 변화 라벨. Lv1은 baseline이라 빈 배열.
    getLevelUpLabels(level) {
        if (level <= 1) return [];
        const labels = ['HP +25%'];
        if (level === 2) {
            labels.push('궤도미사일 개수 +5 (10→15)');
        } else if (level === 3) {
            labels.push('이동속도 +30%');
            labels.push('기본공격 주기 -10%');
        } else if (level === 4) {
            labels.push('궤도미사일 pause -0.5초 (4→3.5초)');
        } else if (level === 5) {
            labels.push('기본공격 탄환수 +1 (3→4발)');
            labels.push('페이즈 3 기본공격 탄환수 +1 (4→5발)');
        }
        return labels;
    },
};
