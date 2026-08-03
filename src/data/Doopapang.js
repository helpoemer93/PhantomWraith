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

const DoopapangData = {
    id: 'doopapang',
    name: '두파팡',
    rewardWeapon: 'orbit',
    maxHp: 600,
    size: 60,
    color: 0x66aa77,
    startY: 140,
    movement: {
        type: 'pendulum',
        speedRadPerSec: Math.PI / 5,
        rangePx: 130,
    },
    phases: [
        {
            hpEnterRatio: 1.0,
            sequence: DoopapangBaseSequence,
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
