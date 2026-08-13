// 페이즈1 좌우 벽 (오른쪽에서 왼쪽으로 시작). 페이즈2까지 유지됨.
// 색: 하늘색 계열 (피카츄 아이덴티티 노란색과 분리 — 페이즈3 자기력선 색 배치용)
const ThunderLaserWallHSpec = {
    width: 16,
    color: 0x66ccff,
    strokeColor: 0xccf2ff,
    speed: 150,
    startX: 440,           // 우측 시작 (왼쪽 캐릭터 반응 유예)
    minX: 40,
    maxX: 440,
    initialDir: -1,        // -1 = 왼쪽으로 시작
    damage: 1,
};

// 페이즈2 위아래 벽 (인터루드에서 사전 소환).
const ThunderLaserWallSpec = {
    height: 16,
    color: 0x66ccff,
    strokeColor: 0xccf2ff,
    speed: 150,
    startY: 40,
    minY: 40,
    maxY: 760,
    initialDir: 1,
    damage: 1,
};

const ThunderData = {
    id: 'thunder',
    name: '썬더',
    rewardWeapon: 'chain',
    maxHp: 1200,
    size: 80,
    color: 0xffee44,
    startY: 120,
    movement: { type: 'fixed' },
    phaseTransitionMs: 4500,
    phases: [
        {
            hpEnterRatio: 1.0,
            // 좌우 벽 (우측 시작 → 좌측 왕복). 페이즈2까지 유지.
            laserWallH: ThunderLaserWallHSpec,
            // 자포코일: x=240 고정, y축 왕복. 6초마다 6방향 코일 스폰.
            magneton: {
                radius: 22,
                spriteKey: 'magneton',
                animKey: 'magneton-idle',
                fixedX: 240,           // 좌우 고정
                yMin: 80,              // 세로 왕복 상한
                yMax: 720,             // 세로 왕복 하한
                moveSpeed: 200,        // px/s
                initialDir: 1,         // +1 = 아래로 시작
                contactDamage: 1,
                warnOverlayColor: 0xffffff,
                warnMaxAlpha: 1.0,
            },
            // 코일 폭발 스폰: 자포코일 위치에서 6방향으로 6마리 동시 발사.
            // 첫 스폰은 자포코일 등장 즉시. 이후 6초마다 반복.
            coilBurstSpawner: {
                intervalMs: 6000,
                immediate: true,
                // 절대 각도 (codebase: 0=우, 시계방향). 6방향 = 60° 간격, 위/아래 정중앙 제외.
                // 우중(0), 우하(60), 좌하(120), 좌중(180), 좌상(240), 우상(300)
                directionsDeg: [0, 60, 120, 180, 240, 300],
                coil: {
                    radius: 14,
                    moveSpeed: 100,
                    lifetimeMs: 12000,     // 2세대 공존을 위한 수명
                    contactDamage: 1,
                },
                // 자기력선: 매 프레임 각 코일이 가장 가까운 K기와 링크 (동적)
                web: {
                    linkPerCoil: 2,
                    lineColor: 0xaaddff,
                    lineAlpha: 0.55,
                    lineWidth: 2,
                    contactDamage: 1,
                },
            },
            // 4벽 전체 전기장 (DVD 캠핑 봉쇄용). 화면 테두리에 붙으면 데미지 1.
            // 시각: 파란 지직지직 라인 + 안쪽 밝은 코어 라인.
            edgeFields: {
                // 코어 라인 (안쪽 밝은 선)
                coreThickness: 2,
                coreColor: 0xccf2ff,
                coreAlpha: 0.85,
                // 지직 라인 (바깥 흔들리는 선)
                arcThickness: 2,
                arcColor: 0x66ccff,
                arcAlpha: 0.7,
                arcSegLen: 12,          // 세그먼트 길이 (px)
                arcJitter: 14,          // 수직 방향 최대 흔들림 (px) — 크게
                arcCount: 3,            // 겹칠 지직 라인 개수
                // 공통 pulse (알파 사인파)
                pulseAmp: 0.15,
                pulsePeriodMs: 700,
                hitThreshold: 2,
                damage: 1,
            },
            interludeOnExit: 'thunder_phase2_transition',
        },
        {
            // 페이즈2: 좌우 벽(페이즈1부터 유지) + 위아래 벽(인터루드 소환) + 찌리리공 2마리(페이즈2 진입 시 소환).
            hpEnterRatio: 0.66,
            // 찌리리공 등장 후 첫 자폭은 쿨타임 지난 뒤(4s move + 2s warn = 6s 후 첫 발사).
            voltorbs: {
                count: 2,
                radius: 14,
                spriteKey: 'voltorb',
                animKey: 'voltorb-spin',
                moveSpeed: 200,
                contactDamage: 1,
                initialAngleDegs: [135, 45],  // [좌하, 우하]
                burstCycleMs: 6000,
                burstWarnMs: 2000,
                burstBullets: 90,
                burstBullet: {
                    radius: 3,
                    color: 0xffffdd,
                    speed: 140,
                    damage: 1,
                },
                warnOverlayColor: 0xffffff,
                warnMaxAlpha: 1.0,
            },
            interludeOnExit: 'thunder_phase3_transition',
        },
        {
            // 페이즈3: 좌우 벽(유지) + 위아래 벽(유지) + 피카츄 2마리(4벽 시계방향 순환) + 피카츄 자기력선 + 썬더 라이더 모드.
            hpEnterRatio: 0.33,
            pikachus: {
                count: 2,
                radius: 16,
                spriteKey: 'pikachu-tumble',   // Tumble-Anim 재포장 (40×40 6프레임, 데굴데굴)
                animKey: 'pikachu-tumble-roll',
                color: 0xffee44,               // fallback (스프라이트 없을 때)
                strokeColor: 0x333333,
                orbitSpeed: 240,               // px/s
                edgeInset: 24,                 // 4벽에서 안쪽으로 들여쓰기 (px). 벽에 붙어서 안 보이는 이슈 해소
                contactDamage: 1,
                // 시작 위치: 축소된 사각형(perimeter) 기준 진행률 s.
                // 두 마리는 대각 반대편 (0 vs 0.5)
                initialProgressRatios: [0, 0.5],
            },
            pikachuWeb: {
                lineWidth: 2,
                lineColor: 0xffee44,        // 피카츄 노랑
                lineAlpha: 0.75,
                contactDamage: 1,
            },
            thunderRider: {
                speed: 120,                 // 자기력선 위 이동 속도 (px/s)
                switchCooldownMs: 1000,     // 갈아탄 뒤 이 시간 동안 다른 선 갈아타기 금지
                proximityThreshold: 4,      // 다른 선과 이 거리 이내면 교차로 간주 (px)
                fireIntervalMs: 1000,       // 8방향 미사일 주기
                bullet: {
                    radius: 5,
                    color: 0xffee44,
                    strokeColor: 0xfff8b0,
                    speed: 150,
                    damage: 1,
                },
            },
        },
    ],
    interludes: [
        {
            name: 'thunder_phase2_transition',
            spec: {
                type: 'thunderPhase2',
                durationMs: 4500,
                magnetonSelfDestruct: {
                    warnMs: 2000,
                    burstBullets: 90,
                    burstBullet: {
                        radius: 3,
                        color: 0xffffdd,
                        speed: 140,
                        damage: 1,
                    },
                },
                // 코일 도망: 자포코일 위치 기준 방사형, 가까울수록 빠름. 벽 튕김 없이 화면 밖으로.
                // 인터루드 동안 코일 수명 타이머는 무시됨 (도망 컷 훼손 방지).
                coilsFlee: {
                    maxSpeed: 100,
                    minSpeed: 30,
                    farDist: 400,
                },
                // 위아래 벽 사전 소환. 좌우 벽은 페이즈1부터 유지.
                laserWall: ThunderLaserWallSpec,
            },
        },
        {
            name: 'thunder_phase3_transition',
            spec: {
                type: 'thunderPhase3',
                durationMs: 4500,
                // 찌리리공은 벽 튕김을 그만두고 관성대로 화면 밖 이탈 (자폭 없음). 로직은 GameScene.startThunderPhase3Interlude.
            },
        },
    ],
};

const Thunder = {
    ...ThunderData,

    buildLevelData(level) {
        const d = JSON.parse(JSON.stringify(ThunderData));
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
