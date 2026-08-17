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
        count: 4,
        radius: 12,
        color: 0x88ff88,
        orbitRadius: 75,
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

// 페이즈2 스파이럴 구체 4발 (방향 번갈아). HP 15로 격파 가능.
const makeDoopaSpiralSpec = (rotSign) => ({
    name: 'd_doopaSpiral',
    shape: 'doopaSpiral',
    count: 1,
    intervalMs: 0,
    maxShots: 1,
    spiral: {
        count: 4,
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

// 페이즈2 → 페이즈3 인터루드. 두파팡이 6초에 걸쳐 페이즈1 위치로 상승. 새 소환은 없음.
// 상승 종료 시 페이즈3 진입 → 천장 궤도 9개가 두파팡 주변으로 모여드는 gathered orbs 패턴이 발동.
const DoopaAscentSpec = {
    type: 'doopaAscent',
    ascendMs: 6000,
    targetX: 240,
    targetY: 140, // 페이즈1 startY
};

// 페이즈3 skeleton — 사용자가 이어 짤 예정. 위성 궤도구체 12개는 이 페이즈까지 유지됨.
const DoopapangPhase3Sequence = {
    loop: true,
    steps: [
        { type: 'pause', durationMs: 2000 }, // TODO: 사용자 페이즈3 패턴 정의
    ],
};

// 4개 홀 배치·색·오실레이션·360발 사양. 인터루드와 페이즈2 모두 이 사양 참조.
// 배치: BH(0°) - WH(90°) - BH(180°) - WH(270°) 교차. 페어: (0°BH↔90°WH), (180°BH↔270°WH).
// 각 홀 반경 = radiusBase + radiusAmp * sin(radiusOmega*t + holeIdx * radiusPhaseStep) — 웨이브 오실.
const DoopaHolesSpec = {
    centerX: 240,
    centerY: 400,
    pairCount: 2,     // BH-WH 쌍 개수 (기본 2쌍=4홀). Lv5에서 3쌍=6홀로 확장
    radiusBase: 120,   // 최소 40 확보 (스파이럴이 두파팡 정중앙에서 나가는 초입 40px는 홀 없음 → 흡수 유예)
    radiusAmp: 80,     // 반경 40~200 오실. 무적 저격 봉인은 유지(두파팡 몸통 30 안까지 홀 가장자리 침투)
    radiusOmegaRadPerSec: 1.5,
    radiusPhaseStepRad: Math.PI / 2,   // 홀 인덱스당 위상 오프셋 (웨이브 느낌)
    holeRadius: 26,   // 10% 증가 (24→26). BH/WH 공용
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
                count: 12,
                orbSize: 12,
                color: 0xff8844,
                rotationSpeedRadPerSec: 1.0,
                chargeIntervalMs: 2000,
                chargeCount: 2,
                chargeMinXGap: 150,
                warningMs: 500,
                chargeStayMs: 200,
                returnSpeedPxPerSec: 180,
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
            interludeOnExit: 'doopa_ascent',
            // ceilingOrbits는 페이즈1에서 이어짐 (재초기화 안 함)
        },
        {
            hpEnterRatio: 0.33,
            sequence: DoopapangPhase3Sequence,
            movementFrozen: true,
            // 홀·위성 구체 12개는 페이즈2 → 인터루드 → 페이즈3까지 전부 유지.
            // 페이즈1부터 있던 천장 타원 궤도 9개는 페이즈3 진입 순간 두파팡 주변으로 모여든다 (돌진은 정지).
            doopaGatheredOrbs: {
                orbitRadius: 100,          // 두파팡 주변 반경 (몸통 감싸는 근접)
                spinSpeedRadPerSec: 0.5,   // 궤도 회전 각속도
                tweenMs: 2000,             // 각 orb가 두파팡 슬롯 위치로 모여드는 시간 (매 프레임 lerp)
                // 모여든 후 두파팡 좌우 pendulum. Boss.js pendulum은 spawnTime 기준이라 위치 튐 방지 위해 씬 로직에서 직접 처리.
                pendulum: {
                    speedRadPerSec: Math.PI / 5,   // 페이즈1과 동일 리듬
                    rangePx: 130,
                },
                // 무적(=일반이 아닌) 캐릭터 저격. 첫 회차만 두파팡→무적 방향 절대각 스냅샷,
                // 이후 3회는 같은 각도로 반복 (무적 이동해도 라인은 첫 방향 유지).
                // 순차 돌진과 독립 쿨타임 — 병렬로 진행.
                snipe: {
                    cycleMs: 7000,          // 사이클 주기 (다음 사이클 시작 시각 기준)
                    firstDelayMs: 3000,     // gathering 완료 후 첫 사이클까지 대기
                    volleyCount: 4,         // 4회 발사
                    volleyIntervalMs: 200,  // 발사 사이 텀
                    pellets: 15,            // 발당 15발
                    spreadDeg: 2,           // 인접 미사일 각도차 (총 28° 부채꼴)
                    bulletSpeed: 300,
                    bulletRadius: 4,        // 작게
                    bulletColor: 0xff88cc,  // 핑크 강조 (무적 저격 시각 신호)
                },
                // 순차 돌진. 궤도 순서대로(0→1→...→8→0) 하나씩 일반 상태 캐릭터로 순간이동 라인 판정.
                charge: {
                    intervalMs: 500,               // 돌진 쿨타임 (연속성)
                    warningMs: 350,                // 경고 표시 시간
                    stayMs: 150,                   // 도달점 정지
                    returnSpeedPxPerSec: 200,      // 슬롯 복귀 속도 (페이즈1 120보다 빠름)
                    warningColor: 0xff3333,
                    warningAlpha: 0.35,
                    lineWidth: 24,                 // 경고/판정 라인 폭 (orb 지름 근처)
                    afterimageCount: 5,            // 순간이동 잔상 개수
                    afterimageFadeMs: 300,
                },
            },
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
        {
            name: 'doopa_ascent',
            spec: DoopaAscentSpec,
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

        // Lv2: 무적저격 사이클 쿨타임 7s → 6s
        if (lv >= 2) {
            d.phases[2].doopaGatheredOrbs.snipe.cycleMs = 6000;
        }
        // Lv3: 천장궤도 돌진 2 → 3 (그 중 1개는 일반 상태 캐릭터 최근접 orb)
        if (lv >= 3) {
            d.phases[0].ceilingOrbits.chargeCount = 3;
            d.phases[0].ceilingOrbits.chargeAimNormalCount = 1;
        }
        // Lv4: 궤도구체 격발 2번 중 1번(-1 방향)은 무적 상태 캐릭터에게 추가 궤도구체 발사
        if (lv >= 4) {
            d.phases[0].sequence.steps[2].spec.alsoAimAtInvincible = true;
        }
        // Lv5: 홀 4 → 6 (BH·WH 쌍 2 → 3). phases[1].doopaHoles + 인터루드 doopa_holes 둘 다 갱신
        if (lv >= 5) {
            d.phases[1].doopaHoles.pairCount = 3;
            const holesInterlude = (d.interludes ?? []).find((it) => it.name === 'doopa_holes');
            if (holesInterlude?.spec?.holes) holesInterlude.spec.holes.pairCount = 3;
        }
        return d;
    },

    getLevelUpLabels(level) {
        if (level <= 1) return [];
        const labels = ['HP +20%'];
        if (level === 2) labels.push('무적저격 쿨 7s → 6s');
        else if (level === 3) labels.push('천장궤도 돌진 2→3 (1개는 일반 상태 캐릭터 최근접)');
        else if (level === 4) labels.push('궤도구체 격발 중 1회는 무적 상태 캐릭터에게도 추가 발사');
        else if (level === 5) labels.push('홀 4→6 (BH·WH 쌍 +1)');
        return labels;
    },
};
