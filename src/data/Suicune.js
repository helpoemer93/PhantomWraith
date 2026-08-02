// 스이쿤 (유도탄/파도 컨셉).
// - 페이즈 1: 스이쿤 상단 중앙 정지, 라이코가 목줄로 연결. 라이코 4회 돌진 → 스이쿤 복귀 + 파도미사일 90발.
// - 페이즈 2: 라이코 사라지고 엔테이 등장 (현재 스텁).
// - 페이즈 3: 스이쿤 단독. 소사이클(돌진→파도→물대포×3)×3 → 그랜드(중앙 돌진→파도 9연발)→ 상단 복귀 → 반복.
// - 페이즈 1 동안 라이코 살아있으면 스이쿤 몸통 피격 데미지 1/2, 라이코 피격은 100%.
const SuicuneData = {
    id: 'suicune',
    name: '스이쿤',
    rewardWeapon: 'homing',
    maxHp: 450,
    size: 44, // 반경 22
    color: 0x88aacc,
    startY: 140,
    movement: {
        type: 'fixed',
    },
    phases: [
        {
            hpEnterRatio: 1.0,
            interludeOnExit: 'roaring_waves',
            raikouSpawner: {
                raikou: {
                    radius: 18,
                    color: 0xffcc44,
                    strokeColor: 0x886600,
                    aimIntervalMs: 1000,          // 조준 사이클 총 주기 (조준 0.5초 + 대기 0.5초 → 돌진)
                    warnBeforeChargeMs: 500,      // 돌진 직전 몇 ms 이내에 경고 굵어짐(현재 사양은 처음부터 굵음이지만 인터페이스로 남김)
                    chargesPerCycle: 4,           // 4회 돌진 후 복귀
                    warnColor: 0xff2222,
                    warnAlpha: 0.55,
                    returnSpeed: 250,             // 채취드론 정도 속도
                    afterimageCount: 5,
                    afterimageFadeMs: 300,
                    chargeDamage: 1,              // 라이프 1
                },
                leash: {
                    color: 0xcccccc,
                    width: 2,
                    alpha: 0.7,
                },
                waveMissile: {
                    // 라이코 복귀 시작 시 스이쿤 중심에서 단발 90발 360도
                    bulletCount: 90,
                    radius: 6,
                    color: 0x66ccff,
                    strokeColor: 0x2266aa,
                    a: 100,                       // v = a + 2a·sin(2π·t)
                    startFromZero: true,          // 초기속도 0에서 시작 (sin phase 자동 계산)
                    periodSec: 1.0,               // sin 주기 (t 초 단위, 2π·t/periodSec)
                    lifespanMs: 8000,             // 최대 수명 (안전장치)
                    damage: 1,
                },
                lightningMissile: {
                    // 돌진 도착 시점에 라이코 뒤쪽으로 5발 발사. 0.1초마다 A±30도 랜덤 재각도.
                    // 5발 균등 30도 간격 = 총 스프레드 120도 (spreadDeg는 반절 60도).
                    // 수명 없음 — 화면 밖 벗어나면 기본 bossBullets 정리 로직이 destroy 처리.
                    bulletCount: 5,
                    spreadDeg: 60,                // 5발이 [-60, -30, 0, +30, +60]도로 발사
                    redirectIntervalMs: 100,
                    redirectRangeDeg: 30,         // A ± 30도 랜덤
                    speed: 220,
                    color: 0xffff44,
                    strokeColor: 0xaa8800,
                    damage: 1,
                },
            },
        },
        {
            hpEnterRatio: 2 / 3,
            // TODO: 엔테이 패턴. 현재는 진입만 되도록 빈 페이즈.
            enteiStub: true,
            interludeOnExit: 'converging_waves',
        },
        {
            hpEnterRatio: 1 / 3,
            // 정식 페이즈 3: 소사이클(돌진 → 파도 90발 → 물대포×3) × 3 → 그랜드(중앙 돌진 → 파도 9연발) → 상단 복귀 → 반복.
            suicunePhase3: {
                subCyclesPerGrand: 3,        // 소사이클 3회 뒤 그랜드
                subCycleDelayMs: 700,        // 물대포 마지막 발사 → 다음 조준까지 딜링 창
                // 소사이클 돌진 (기존과 동일 규칙)
                aimIntervalMs: 1000,
                warnColor: 0xff2222,         // 붉은 경고선 (돌진)
                warnAlpha: 0.55,
                afterimageCount: 5,
                afterimageFadeMs: 300,
                chargeDamage: 1,
                bodySize: 44,                // 스이쿤 몸통 사이즈 (충돌·경고선 두께)
                color: 0x88aacc,             // 잔상 색
                waveMissile: {
                    bulletCount: 90,
                    radius: 6,
                    color: 0x66ccff,
                    strokeColor: 0x2266aa,
                    a: 100,
                    startFromZero: true,
                    periodSec: 1.0,
                    lifespanMs: 8000,
                    damage: 1,
                },
                // 물대포 3연발 — 조준 시작 간격 0.5초, 조준 후 0.5초에 발사 (3개 조준선 동시 진행 가능).
                waterCannon: {
                    count: 3,
                    aimStartIntervalMs: 500,
                    fuseMs: 500,
                    beamWidth: 24,           // 경고선·판정 두께 (스이쿤 44보다 얇게)
                    warnColor: 0x44aaff,     // 푸른 경고선
                    warnAlpha: 0.55,
                    damage: 1,
                    // 발사 순간 워터빔 잔상 — "쏟아진다" 느낌 (판정은 즉시대미지에서 끝, 잔상은 순수 시각).
                    beamAfterMs: 500,        // 총 지속 시간 (hold + fade)
                    beamAfterHoldMs: 100,    // 처음 이 시간 동안 알파 1.0 유지 → 이후 페이드
                    beamAfterWidth: 44,      // 잔상 두께 (조준선 24보다 굵게, 스이쿤 몸통과 같은 44)
                    beamAfterColor: 0x88ccff,// 밝은 하늘색
                    // 발사 시 벽 접점에서 물방울 확산탄 스폰 (벽 반대편 180도 부채꼴).
                    droplet: {
                        bulletCount: 5,
                        spreadDeg: 90,       // ±90도 = 180도 반원
                        speedMin: 200,
                        speedMax: 320,
                        radius: 4,
                        color: 0xaaddff,     // 하늘색
                        strokeColor: 0x4477aa,
                        damage: 1,
                    },
                },
                // 그랜드: 맵 중앙(xy)으로 돌진 → 파도 9연발 (인터루드처럼) → 상단 복귀.
                grand: {
                    aimIntervalMs: 1000,
                    warnColor: 0xff2222,
                    warnAlpha: 0.55,
                    afterimageCount: 5,
                    afterimageFadeMs: 300,
                    chargeDamage: 1,
                    waveBurst: {
                        count: 9,
                        intervalMs: 200,
                    },
                    returnSpeed: 180,        // 상단 복귀 속도 (딜타이밍)
                },
            },
        },
    ],
    interludes: [
        {
            name: 'roaring_waves',
            spec: {
                type: 'roaringWaves',
                durationMs: 5000,             // phaseTransitionMs와 동기
                // 파도미사일 5연발 (0.2초 간격) — 페이즈1 단발과 동일 스펙 재사용
                waveBurst: {
                    count: 9,
                    intervalMs: 200,
                    delayMs: 0,
                    missile: {
                        bulletCount: 90,
                        radius: 6,
                        color: 0x66ccff,
                        strokeColor: 0x2266aa,
                        a: 100,
                        startFromZero: true,
                        periodSec: 1.0,
                        lifespanMs: 8000,
                        damage: 1,
                    },
                },
                // 인터루드 시작 시 엔테이 스이쿤 뒤에서 등장. 인터루드 끝에 목표 위치 도달.
                entei: {
                    // 등장 애니메이션 스펙
                    radius: 18,
                    color: 0xff6644,
                    strokeColor: 0x883322,
                    startOffsetY: -30,        // 스이쿤 위쪽 30px에서 시작 (뒤편 느낌)
                    targetOffsetY: 34,        // 스이쿤 아래쪽 34px 목표 (라이코 자리와 유사)
                    entranceMs: 5000,
                    startAlpha: 0.25,
                    endAlpha: 1.0,
                    // 활성화 이후 사이클 (라이코 미러 + 화염방사)
                    aimIntervalMs: 1000,      // 라이코와 동일
                    chargesPerCycle: 3,       // 3회 돌진 후 복귀
                    flamesPerCharge: 3,       // 각 돌진 후 화방 3회
                    flameIntervalMs: 500,     // 화방 start-to-start 0.5초
                    warnColor: 0xff2222,
                    warnAlpha: 0.55,
                    returnSpeed: 250,
                    afterimageCount: 5,
                    afterimageFadeMs: 300,
                    chargeDamage: 1,
                    // 화염방사 스펙
                    flamethrower: {
                        bulletCount: 30,
                        spreadDeg: 8,         // 조준각 ±8도 랜덤 (좁게)
                        a: 180,               // 속도 [a, 3a] = [180, 540] 랜덤 (빠르게)
                        radius: 5,
                        color: 0xff6644,
                        strokeColor: 0x883322,
                        damage: 1,
                    },
                    // 복귀 시 스이쿤 위치에서 파도미사일 (페이즈1과 동일 스펙)
                    waveMissile: {
                        bulletCount: 90,
                        radius: 6,
                        color: 0x66ccff,
                        strokeColor: 0x2266aa,
                        a: 100,
                        startFromZero: true,
                        periodSec: 1.0,
                        lifespanMs: 8000,
                        damage: 1,
                    },
                },
            },
        },
        {
            name: 'converging_waves',
            spec: {
                type: 'convergingWaves',
                durationMs: 5000,            // Boss.phaseTransitionMs 와 sync
                slideMs: 3000,               // 스이쿤 슬라이딩 시간 (완료 후 파도 시작)
                waveBurst: {
                    count: 9,
                    intervalMs: 200,
                    missile: {
                        bulletCount: 90,
                        radius: 6,
                        color: 0x66ccff,
                        strokeColor: 0x2266aa,
                        a: 100,
                        startFromZero: true,
                        periodSec: 1.0,
                        lifespanMs: 8000,
                        damage: 1,
                    },
                },
            },
        },
    ],
};

const Suicune = {
    ...SuicuneData,

    buildLevelData(level) {
        const d = JSON.parse(JSON.stringify(SuicuneData));
        const lv = Math.max(1, level);
        const scale = Math.pow(1.20, lv - 1);
        d.maxHp = Math.round(d.maxHp * scale);

        // 모든 파도미사일 spec (페이즈·인터루드 통틀어) 순회용
        const forEachWaveMissile = (fn) => {
            for (const phase of d.phases) {
                if (phase.raikouSpawner?.waveMissile) fn(phase.raikouSpawner.waveMissile);
                if (phase.suicunePhase3?.waveMissile) fn(phase.suicunePhase3.waveMissile);
            }
            for (const inter of (d.interludes ?? [])) {
                if (inter.spec?.waveBurst?.missile) fn(inter.spec.waveBurst.missile);
                if (inter.spec?.entei?.waveMissile) fn(inter.spec.entei.waveMissile);
            }
        };
        // 모든 aim 시간 spec 순회용 (Lv5 돌진 경고)
        const forEachAim = (fn) => {
            for (const phase of d.phases) {
                if (phase.raikouSpawner?.raikou) fn(phase.raikouSpawner.raikou, 'aimIntervalMs');
                if (phase.suicunePhase3) fn(phase.suicunePhase3, 'aimIntervalMs');
                if (phase.suicunePhase3?.grand) fn(phase.suicunePhase3.grand, 'aimIntervalMs');
            }
            for (const inter of (d.interludes ?? [])) {
                if (inter.spec?.entei) fn(inter.spec.entei, 'aimIntervalMs');
            }
        };

        // Lv2: 번개미사일 5→7, spreadDeg 60→90 (라이코 원뿔 확장)
        if (lv >= 2) {
            for (const phase of d.phases) {
                if (phase.raikouSpawner?.lightningMissile) {
                    phase.raikouSpawner.lightningMissile.bulletCount = 7;
                    phase.raikouSpawner.lightningMissile.spreadDeg = 90;
                }
            }
        }
        // Lv3: 화방 폭 8→10도, 미사일 30→38 (엔테이 화염방사)
        if (lv >= 3) {
            for (const inter of (d.interludes ?? [])) {
                const flame = inter.spec?.entei?.flamethrower;
                if (flame) {
                    flame.spreadDeg = 10;
                    flame.bulletCount = 38;
                }
            }
        }
        // Lv4: 파도미사일 진폭 (sin계수) 2→2.4
        if (lv >= 4) {
            forEachWaveMissile((w) => { w.waveCoef = 2.4; });
        }
        // Lv5: 모든 돌진 조준 시간 1000→700ms
        if (lv >= 5) {
            forEachAim((obj, key) => { obj[key] = 700; });
        }
        return d;
    },

    getLevelUpLabels(level) {
        if (level <= 1) return [];
        const labels = ['HP +25%'];
        if (level === 2) labels.push('번개 5→7발, 원뿔 확장');
        else if (level === 3) labels.push('화염방사 폭 25%, 개수 30→38');
        else if (level === 4) labels.push('파도 진폭 1.2배');
        else if (level === 5) labels.push('모든 돌진 경고 1s→0.7s');
        return labels;
    },
};
