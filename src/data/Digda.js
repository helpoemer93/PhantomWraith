// 디그다: 시한지뢰와 연계된 굴 순간이동 보스.
// - 시작 위치에 무적 굴 1개.
// - 5초마다 파괴 가능 굴 1개 스폰(캐릭터 100px·기존 굴 60px 최소거리, 시도 20회).
// - 파괴 가능 굴은 초당 자연 피해(시간 지나면 자동 소멸) — 무한 누적 방지.
// - 1초마다 무작위 굴로 순간이동.
// - 이동 직후 모든 굴에서 8발(45° 균등) × 3웨이브(오프셋 0/22.5/45°, 속도 100/140/180) 미사일 발사.

const DigdaSpec = {
    // 시작 굴 위치 (화면 상단 중앙, 구구·프리져와 동일).
    startHole: { x: 240, y: 140, invincible: true },

    // 굴 사양.
    hole: {
        radius: 18,
        hp: 20,
        decayPerSecond: 1,  // 파괴 가능 굴 HP 자연 감쇠 → HP 20이면 20초 후 자동 소멸.
        ringColor: 0x8B4513,
        invincibleRingColor: 0xaaaaaa,
        innerColor: 0x111111,
    },

    // 스폰 사이클.
    spawn: {
        intervalMs: 5000,
        minDistFromPlayer: 100,
        minDistFromHole: 60,
        maxAttempts: 20,
        // 스폰 가능 영역 (화면 여백).
        marginX: 60,
        marginY: 100,
    },

    // 순간이동 사이클.
    teleport: {
        intervalMs: 1000,
    },

    // 미사일 발사 (매 이동 직후 3웨이브).
    burst: {
        count: 8,                                   // 8발 45° 균등
        waveOffsetsDeg: [0, 22.5, 45],              // 3웨이브 각도 오프셋 (사용자 명시)
        waveSpeeds: [100, 140, 180],                // 웨이브별 속도
        waveIntervalMs: 150,                        // 웨이브 사이 간격
        bullet: {
            radius: 4,
            color: 0xffaa66,
            damage: 1,
        },
    },

};

const DigdaData = {
    id: 'digda',
    name: '디그다',
    rewardWeapon: 'mine',
    maxHp: 800,
    size: 40,
    color: 0x8B4513,
    startY: 140,
    movement: { type: 'fixed' },
    phases: [
        {
            hpEnterRatio: 1.0,
            movementFrozen: true,
            digda: DigdaSpec,
        },
    ],
};

const Digda = {
    ...DigdaData,

    buildLevelData(level) {
        const d = JSON.parse(JSON.stringify(DigdaData));
        const lv = Math.max(1, level);
        const scale = Math.pow(1.20, lv - 1);
        d.maxHp = Math.round(d.maxHp * scale);
        // Lv2~5 세부 스케일링은 실플레이 이후 결정.
        return d;
    },

    getLevelUpLabels(level) {
        if (level <= 1) return [];
        return ['HP +20%'];
    },
};
