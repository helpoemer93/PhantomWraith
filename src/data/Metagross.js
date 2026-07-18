const MetagrossData = {
    id: 'metagross',
    name: '메타그로스',
    rewardWeapon: 'basicLinear',
    maxHp: 700,
    size: 70,
    color: 0xaaccdd,
    startY: 140,
    movement: {
        type: 'pendulum',
        speedRadPerSec: Math.PI / 5,
        rangePx: 130,
    },
    baseAttack: {
        type: 'gearMultiTarget',
        intervalMs: 700,
        gear: {
            radius: 22,
            color: 0x888888,
            speed: 200,
            rotationRadPerSec: Math.PI,
        },
    },
    phases: [
        {
            hpEnter: 700,
            interludeOnExit: 'electric_field',
            turretSpawner: {
                intervalMs: 5000,
                area: { xMin: 60, xMax: 420, yMin: 180, yMax: 380 },
                turret: {
                    radius: 12,
                    color: 0x999999,
                    strokeColor: 0x666666,
                    maxHp: 50,
                    decayPercentPerSec: 2.5,
                    fireIntervalMs: 1000,
                    shotsPerBurst: 3,
                    shotIntervalMs: 200,
                    missile: {
                        radius: 4,
                        color: 0xff8844,
                        speed: 200,
                    },
                },
            },
        },
        {
            hpEnter: 462,
            suicideDroneSpawner: {
                intervalMs: 4000,
                drone: {
                    radius: 15,
                    color: 0x666666,
                    strokeColor: 0x333333,
                    maxHp: 20,
                    decayPercentPerSecPerDrone: 5,
                    centerX: 240,
                    centerY: 420,
                    orbitRadius: 150,
                    orbitSpeedRadPerSec: Math.PI / 3,
                    detectionAngleDeg: 60,
                    detectionRadius: 110,
                    pauseMs: 500,
                    chargeSpeed: 500,
                    fanColor: 0xff4444,
                    fanAlpha: 0.3,
                    fanAlphaPaused: 0.7,
                },
            },
        },
    ],
    interludes: [
        {
            name: 'electric_field',
            spec: {
                type: 'electricField',
                durationMs: 3500,
                field: {
                    width: 480,
                    height: 22,
                    color: 0x88ccff,
                    strokeColor: 0xffffff,
                    initialY: -20,
                    speed: 235,
                },
                turretsToSpawn: 3,
            },
        },
    ],
};

const Metagross = {
    ...MetagrossData,

    buildLevelData(level) {
        const d = JSON.parse(JSON.stringify(MetagrossData));
        const lv = Math.max(1, level);
        d.maxHp = Math.round(d.maxHp * Math.pow(1.25, lv - 1));
        return d;
    },

    getLevelUpLabels(level) {
        if (level <= 1) return [];
        return ['HP +25%'];
    },
};
