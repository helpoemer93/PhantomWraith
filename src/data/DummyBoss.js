const DummyBoss = {
    name: '테스트 더미 보스',
    maxHp: 200,
    size: 60,
    color: 0xaa66ff,
    startY: 140,
    movement: {
        type: 'pendulum',
        speedRadPerSec: 0.9,
        rangePx: 130,
    },
    phases: [
        {
            hpEnter: 200,
            patterns: [
                {
                    count: 12,
                    startAngleDeg: 90,
                    angleSpreadDeg: 30,
                    speed: 140,
                    intervalMs: 1500,
                    rotationPerShotDeg: 15,
                },
            ],
        },
        {
            hpEnter: 133,
            patterns: [
                {
                    count: 8,
                    startAngleDeg: 90,
                    angleSpreadDeg: 45,
                    speed: 170,
                    intervalMs: 1100,
                    rotationPerShotDeg: 20,
                },
                {
                    count: 1,
                    startAngleDeg: 90,
                    angleSpreadDeg: 0,
                    speed: 240,
                    intervalMs: 600,
                    rotationPerShotDeg: 0,
                },
            ],
        },
        {
            hpEnter: 66,
            patterns: [
                {
                    count: 16,
                    startAngleDeg: 90,
                    angleSpreadDeg: 22.5,
                    speed: 190,
                    intervalMs: 700,
                    rotationPerShotDeg: 30,
                },
            ],
        },
    ],
};
