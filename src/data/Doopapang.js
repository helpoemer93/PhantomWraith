// 시계·반시계 방향 번갈아 발사. speedSign: +1(시계) / -1(반시계).
const makeDoopaOrbSpec = (speedSign) => ({
    name: 'd_doopaOrb',
    shape: 'doopaOrb',
    aimAtActivePlayer: true,
    count: 1,
    intervalMs: 0,
    maxShots: 1,
    core: {
        speed: 200,
        transitionMs: 300,
    },
    orbit: {
        count: 3,
        radius: 12,
        color: 0x88ff88,
        orbitRadius: 60,
        orbitSpeedRadPerSec: 1.2 * speedSign,
    },
});

const DoopapangBaseSequence = {
    loop: true,
    steps: [
        { type: 'pattern', spec: makeDoopaOrbSpec(1) },
        { type: 'pause', durationMs: 1000 },
        { type: 'pattern', spec: makeDoopaOrbSpec(-1) },
        { type: 'pause', durationMs: 1000 },
    ],
};

// 페이즈2 스파이럴 구체 3발 (방향 번갈아). HP 15로 격파 가능.
const makeDoopaSpiralSpec = (rotSign) => ({
    name: 'd_doopaSpiral',
    shape: 'doopaSpiral',
    count: 1,
    intervalMs: 0,
    maxShots: 1,
    spiral: {
        count: 3,
        radius: 10,
        color: 0x88ff88,
        hp: 15,
        angularSpeedRadPerSec: 2.5 * rotSign,
        radiusGrowthPxPerSec: 60,
        initialRadius: 0,
    },
});

const DoopapangPhase2Sequence = {
    loop: true,
    steps: [
        { type: 'pattern', spec: makeDoopaSpiralSpec(1) },
        { type: 'pause', durationMs: 2000 },
        { type: 'pattern', spec: makeDoopaSpiralSpec(-1) },
        { type: 'pause', durationMs: 2000 },
    ],
};

// 4개 홀 배치·색·오실레이션·360발 사양. 인터루드와 페이즈2 모두 이 사양 참조.
// 배치: BH(0°) - WH(90°) - BH(180°) - WH(270°) 교차. 페어: (0°BH↔90°WH), (180°BH↔270°WH).
// 각 홀 반경 = radiusBase + radiusAmp * sin(radiusOmega*t + holeIdx * radiusPhaseStep) — 웨이브 오실.
const DoopaHolesSpec = {
    centerX: 240,
    centerY: 400,
    radiusBase: 140,
    radiusAmp: 40,
    radiusOmegaRadPerSec: 1.5,
    radiusPhaseStepRad: Math.PI / 2,   // 홀 인덱스당 위상 오프셋 (웨이브 느낌)
    holeRadius: 24,
    orbitalSpeedRadPerSec: Math.PI / 12,
    // BH 접촉 시 대응 WH에서 사출: 360°/10발.
    wh360Count: 10,
    wh360BulletSpeed: 220,
    wh360BulletRadius: 6,
    wh360BulletColor: 0xff88ff,
    wh360FlashMs: 100,
    // 시각.
    bhColor: 0x111111,
    bhStrokeColor: 0x8844ff,
    whColor: 0xffffff,
    whStrokeColor: 0xff88ff,
    ringLineWidth: 2,
    // 페어 연결 직사각형 (두꺼운 라인).
    connectorColor: 0x88ccff,
    connectorAlpha: 0.2,
    connectorWidth: 30,
};

const DoopapangData = {
    id: 'doopapang',
    name: '두파팡',
    rewardWeapon: 'orbit',
    maxHp: 600,
    size: 60,
    color: 0x66aa77,
    startY: 140,
    phaseTransitionMs: 3000,
    movement: {
        type: 'pendulum',
        speedRadPerSec: Math.PI / 5,
        rangePx: 130,
    },
    phases: [
        {
            hpEnterRatio: 1.0,
            sequence: DoopapangBaseSequence,
            interludeOnExit: 'doopa_holes',
            ceilingOrbits: {
                cx: 240, cy: 60,
                a: 190, b: 25,
                count: 9,
                orbSize: 12,
                color: 0xff8844,
                rotationSpeedRadPerSec: 1.0,
                chargeIntervalMs: 3000,
                chargeCount: 2,
                chargeMinXGap: 150,
                warningMs: 500,
                chargeStayMs: 200,
                returnSpeedPxPerSec: 120,
                floorY: 800,
                afterimageCount: 5,
                afterimageFadeMs: 300,
                warningColor: 0xff3333,
                warningAlpha: 0.35,
            },
        },
        {
            hpEnterRatio: 0.66,
            sequence: DoopapangPhase2Sequence,
            movementFrozen: true,
            doopaHoles: DoopaHolesSpec,
            // ceilingOrbits는 페이즈1에서 이어짐 (재초기화 안 함)
        },
    ],
    interludes: [
        {
            name: 'doopa_holes',
            spec: {
                type: 'doopaCentering',
                descentMs: 1500,
                centerX: 240,
                centerY: 400,
                holeFadeInMs: 1500,
                invincibleMs: 5000,
                holes: DoopaHolesSpec,
            },
        },
    ],
};

const Doopapang = {
    ...DoopapangData,

    buildLevelData(level) {
        const d = JSON.parse(JSON.stringify(DoopapangData));
        const lv = Math.max(1, level);
        const scale = Math.pow(1.20, lv - 1);
        d.maxHp = Math.round(d.maxHp * scale);
        return d;
    },

    getLevelUpLabels(level) {
        if (level <= 1) return [];
        return ['HP +20%'];
    },
};
