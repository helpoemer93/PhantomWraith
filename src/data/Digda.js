// 디그다: 시한지뢰와 연계된 굴 순간이동 보스.
// - 시작 위치에 무적 굴 1개.
// - 5초마다 파괴 가능 굴 1개 스폰(캐릭터 100px·기존 굴 60px 최소거리, 시도 20회).
// - 파괴 가능 굴은 초당 자연 피해(시간 지나면 자동 소멸) — 무한 누적 방지.
// - 1초마다 무작위 굴로 순간이동.
// - 이동 직후 모든 굴에서 8방향 미사일 발사 (0번째 발이 플레이어를 향하도록 회전).
// - 6초 쿨마다 디그다 본체가 "땅가르기 미사일" 짝 2발을 발사 (일반 플레이어 방향 + 정반대).
//   · 각 미사일은 독립적으로 진행 중 0.1초마다 여진 미사일 2발을 그 자리에 정지 스폰.
//   · 1초마다 45~90° 무작위 각도로 회전 (좌·우 번갈아. 첫 회전은 좌).
//   · 벽 도달 시 그 자리에 정지·대기. 짝 미사일도 벽에 닿으면 그때 둘 다 릴리즈:
//     소환위치→현재위치 각도 + 90° 계산 → 여진 각 쌍의 0번째는 그 각도, 1번째는 반대 각도로 발사. 미사일은 소멸.

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

    // 공격/이동 사이클. intervalMs마다 공격, moveEveryN번 공격당 1번 순간이동.
    teleport: {
        intervalMs: 1200,
        moveEveryN: 2,
    },

    // 미사일 발사 (매 이동 직후, 0번째 발이 플레이어를 향하도록 회전).
    // 디그다 본체가 위치한 굴은 촘촘하게 12발, 나머지 굴은 성기게 4발.
    burst: {
        countAtBoss: 12,
        countAtOther: 4,
        aimAtPlayer: true,
        waveOffsetsDeg: [0],
        waveSpeeds: [140],
        waveIntervalMs: 150,
        bullet: {
            radius: 4,
            color: 0xffaa66,
            damage: 1,
        },
    },

    // 땅가르기 미사일 사이클 (별도, 기존 burst와 독립).
    groundSplit: {
        cooldownMs: 6000,   // 첫 발도 이 쿨 지나야 발사.
        missile: {
            radius: 6,
            color: 0xffaa66,
            damage: 1,
            speed: 100,
        },
        rotationIntervalMs: 1000,
        rotationDegMin: 45,
        rotationDegMax: 90,
        firstRotationDeg: 45,   // 첫 회전은 이 값 고정 (이후는 min~max 랜덤).
        outsideSimMs: 3000,     // 벽 도달 시 이 시간만큼 미래 궤적 시뮬레이션 → 벽 밖 여진 즉시 배치.
        aftershock: {
            spawnIntervalMs: 100,
            countPerSpawn: 2,
            radius: 3,
            color: 0xffaa66,
            damage: 1,
            speed: 120,
        },
    },

};

// 페이즈 2 추가 패턴: 바위기둥 사이클 (기존 phase 1 패턴과 병행).
// 3초 사이클: 플레이어 조준 위치에 1초간 경고 원 → 경고 사라짐과 동시에 바위기둥 스폰.
// 바위기둥은 HP 30, 접촉 데미지, 플레이어 총알 차단. 자연 소멸 없음 — 파괴돼야 사라짐.
const DigdaRockPillarSpec = {
    cycleMs: 3000,       // 경고 시작~다음 경고 시작 간격.
    warnMs: 1000,        // 경고 → 발사까지 시간.
    pillar: {
        radius: 20,      // 보스 size 40 기준 반경.
        color: 0x8B4513, // 갈색 (디그다 컬러).
        strokeColor: 0x000000,
        strokeWidth: 2,
        hp: 20,
        contactDamage: 1,
    },
    warning: {
        color: 0xff4400,
        alphaStart: 0.1,
        alphaEnd: 0.45,     // 플레이어 위 레이어라 알파 낮게 유지 (플레이어 시인성 보존).
        strokeColor: 0xff4400,
        strokeWidth: 2,
        strokeAlpha: 0.85,
    },
};

// 페이즈 2→3 인터루드: 투명 미사일 벽 러너 (digda_wall_run)
// - 디그다 중앙 무적굴로 순간이동. 진행 중이던 페이즈2 패턴(땅가르기·여진·바위기둥 경고)은 그대로 진행.
// - 화면 최상단(12시)에서 아래방향 투명 미사일 1발. 페이즈1 땅가르기 패턴처럼 1초마다 랜덤 45~90° 회전(좌우 번갈아).
// - 초기방향(아래) 대비 편차 절대값 > 90°이면 그 다음 1회 회전만 × 1.5 (편향 방지).
// - 좌·우·위 벽 반사(입사각=반사각). 아래 벽 도달 시 인터루드 종료.
// - 이동 중 매 프레임 "이번 인터루드로 소환된" 최근접 바위기둥과의 거리 > 지름이면 그 자리에 즉시 소환.
//   기존 페이즈2 사이클로 만들어진 바위기둥과는 겹칠 수 있음.
// - 인터루드 종료 후에도 남긴 바위기둥 유지. durationMs 없음 — 미사일 벽 도달 이벤트 기반.
const DigdaWallRunInterlude = {
    name: 'digda_wall_run',
    spec: {
        type: 'digdaWallRun',
        centerX: 240,               // 디그다 순간이동 대상 (기존 중앙 무적굴 위치)
        centerY: 400,
        spawnX: 240,                // 미사일 스폰 x (화면 12시)
        spawnY: 20,                 // 미사일 스폰 y (상단 벽 안쪽)
        missileRadius: 4,           // 벽 반사 판정용
        missileSpeed: 150,          // 페이즈1 땅가르기(100) × 1.5
        rotationIntervalMs: 1000,
        rotationDegMin: 30,
        rotationDegMax: 60,
        firstRotationDeg: 30,       // 첫 회전은 랜덤 아닌 고정값
        rotateOnSpawn: true,        // true이면 스폰 즉시 첫 회전 발동 (1초 대기 없이)
        correctionMultiplier: 1.5,  // |편차| > 90°일 때 그 다음 1회 회전만 이 배수 곱함
        maxDurationMs: 30000,       // 안전망: 이 시간 넘으면 강제 종료 (일반적으로 필요 없음)
    },
};

// 페이즈 1→2 인터루드: 지진 (digda_quake)
// - 신규 패턴 발사 일시정지 (진행 중 땅가르기·여진은 계속). 굴은 유지, 본체 무적.
// - 디그다 중앙 순간이동 → 사방 90발 방사 → 500ms 후 100ms마다 랜덤 3발 회수(잔상)
//   → 4000ms 시점 전 방향으로 재발사(수직 sin 진동 velocity) → 인터루드 종료.
const DigdaQuakeInterlude = {
    name: 'digda_quake',
    spec: {
        type: 'digdaQuake',
        durationMs: 5800,
        centerX: 240,       // GAME_WIDTH / 2
        centerY: 400,       // GAME_HEIGHT / 2
        count: 90,          // 방사 개수 (4° 균등)
        missile: {
            radius: 4,
            color: 0xff8844,
            damage: 1,
        },
        outboundSpeed: 60,  // 초기 방사 속도 — 회수 완료 전까지 벽 밖으로 못 나가는 값. 60×(1s+2.7s)=222px < 240px.
        recallStartMs: 1000, // 발사 후 회수 시작 전 대기.
        recallBatchMs: 30,   // 회수 배치 간격 — 촘촘한 스트림.
        recallBatchSize: 1,  // 배치당 회수 개수 (총 90개 × 30ms = 2700ms).
        recallSpeed: 500,   // 회수 속도 (매 프레임 중앙으로 재조준).
        afterimageIntervalMs: 40,
        afterimageFadeMs: 150,
        // 재발사는 시간이 아니라 "모든 미사일이 중앙 도달(gathered)" 조건으로 트리거.
        // 참고 계산: 회수 완료 ~3700ms + 마지막 미사일 이동 ~500ms → 실제 재발사 시점 ~4200ms.
        refireSpeed: 250,   // 재발사 전진 속도.
        perpAmp: 500,       // 진행축 수직 sin 진동 진폭 (velocity 성분).
        perpFreq: 25,       // sin 각속도 rad/s (~4Hz — 와아아악).
    },
};

// 페이즈 3 신규: 바위기둥 파괴 사이클 (digdaPillarBurst)
// - 8초마다 무작위 바위기둥 선택 → 1초 경고 (해당 기둥만 무적) → 파괴.
// - 파괴 시 8발 방사 (1→2 인터루드 재발사와 같은 sin 진동 궤적, 속도·진폭 절반).
// - 파괴된 자리에 파괴 가능 굴 생성 (디그다 순간이동 가능).
// - 바위기둥이 하나도 없으면 사이클 스킵 후 다음 8초 대기.
// - 첫 사이클 카운트다운은 페이즈 3 진입(=digdaWallRunCycle 첫 트리거) 시점부터.
const DigdaPillarBurstSpec = {
    cycleMs: 8000,
    warnMs: 1000,
    burstCount: 8,
    missile: {
        radius: 4,
        color: 0xff8844,
        damage: 1,
        speed: 125,     // 1→2 인터루드 refireSpeed 250 × 0.5
        perpAmp: 250,   // 1→2 인터루드 perpAmp 500 × 0.5
        perpFreq: 25,   // 1→2 인터루드와 동일 (진동 주파수)
    },
    warning: {
        color: 0xff4400,
        alphaStart: 0.5,        // 시작부터 진하게 (플레이어 위 아니라 시인성 걱정 없음).
        alphaEnd: 1.0,
        strokeColor: 0xffff00,  // 노랑 스트로크로 갈색 바위기둥과 대비.
        strokeWidth: 4,
        strokeAlpha: 1.0,
        radiusMultiplier: 1.5,  // 바위기둥보다 크게 → 링이 밖으로 튀어나옴.
    },
};

// 페이즈 3 신규: wallrun 인터루드 반복 사이클 (digdaWallRunCycle)
// - 페이즈 3 진입 즉시 첫 wallrun 트리거. 순간이동·보스 무적·패턴 정지 없음.
// - wallrun 미사일 바닥 도달 후 13초 뒤 다음 wallrun 트리거.
// - wallrun 스펙 자체는 페이즈 2→3 인터루드 재활용 (12시 스폰 · 반사 · 기둥 소환).
const DigdaWallRunCycleSpec = {
    postEndCooldownMs: 13000,
    wallRunSpec: DigdaWallRunInterlude.spec,
};

const DigdaData = {
    id: 'digda',
    name: '디그다',
    rewardWeapon: 'mine',
    maxHp: 800,
    size: 40,
    color: 0x8B4513,
    startY: 140,
    phaseTransitionMs: 5800,
    movement: { type: 'fixed' },
    phases: [
        {
            hpEnterRatio: 1.0,
            movementFrozen: true,
            digda: DigdaSpec,
            interludeOnExit: 'digda_quake',
        },
        // 페이즈 2: phase 1 패턴(스프레드/순간이동/땅가르기) 그대로 유지 + 바위기둥 사이클 추가.
        // digda 필드 없음 → startDigdaPhase 미호출로 phase1 상태 유지. digdaRockPillar 훅으로 신규 사이클만 시작.
        {
            hpEnterRatio: 0.66,
            movementFrozen: true,
            digdaRockPillar: DigdaRockPillarSpec,
            interludeOnExit: 'digda_wall_run',
        },
        // 페이즈 3: 페이즈1·2 패턴 그대로 유지 + 바위기둥 파괴 사이클(8s) + wallrun 반복(바닥+13s).
        {
            hpEnterRatio: 0.33,
            movementFrozen: true,
            digdaPillarBurst: DigdaPillarBurstSpec,
            digdaWallRunCycle: DigdaWallRunCycleSpec,
        },
    ],
    interludes: [DigdaQuakeInterlude, DigdaWallRunInterlude],
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
