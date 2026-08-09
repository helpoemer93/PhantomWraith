// 무기 정의. 각 무기의 baseline (Lv0) 스탯.
// 레벨별 스탯은 getWeapon(id, level) 로 계산.
const Weapons = {
    basicLinear: {
        id: 'basicLinear',
        name: '직선탄',
        type: 'linear',
        intervalMs: 250,
        damage: 1,
        bulletSpeed: 520,
        pierce: false,
        color: 0xaaffff,
        width: 6,
        height: 14,
    },
    piercing: {
        id: 'piercing',
        name: '관통탄',
        type: 'linear',
        intervalMs: 400,
        damage: 3,
        bulletSpeed: 500,
        pierce: true,
        contactCooldownMs: 100,
        color: 0x66ccff,
        width: 10,
        height: 22,
    },
    spread: {
        id: 'spread',
        name: '확산탄',
        type: 'spread',
        intervalMs: 550,
        damage: 1,
        bulletSpeed: 480,
        pierce: false,
        pellets: 3,
        angleSpreadDeg: 10,
        color: 0xbbffdd,
        width: 6,
        height: 12,
    },
    homing: {
        id: 'homing',
        name: '유도탄',
        type: 'homing',
        intervalMs: 333,
        damage: 1,
        bulletSpeed: 380,
        turnRateDegPerSec: 180,
        accel: 100,
        pierce: false,
        color: 0xccddff,
        radius: 5,
    },
    orbit: {
        id: 'orbit',
        name: '궤도탄',
        type: 'orbit',
        radius: 99,
        rotationSpeedRadPerSec: Math.PI * 2,
        rotationSlowMultiplier: 0.1,
        rotationSlowDurationMs: 100,
        damage: 1,
        contactCooldownMs: 500,
        orbCount: 1,
        color: 0xccff66,
        orbSize: 15,
        // 저점보장용 자동 미사일. 궤도체마다 가장 가까운 적으로 발사.
        missileDamage: 3,
        missileIntervalMs: 500,
        missileSpeed: 380,
        missileSize: 6,
    },
    boomerang: {
        id: 'boomerang',
        name: '부메랑탄',
        type: 'boomerang',
        intervalMs: 500,
        damage: 1,
        returnDamageMul: 1.5,       // 회귀 시 데미지 배율
        bulletSpeed: 400,           // 상승 속도
        returnSpeedMul: 1.5,        // 회귀 속도 배율 (600)
        turnAroundY: 40,            // 이 Y 이하에 도달하면 회귀 시작
        catchRadius: 24,            // 캐릭터 반경 + 여유
        catchCooldownReduceMs: 200, // 잡으면 다음 발사 앞당김
        pierce: true,               // 재히트는 contactCooldown 으로 관리 (턴 시 리셋)
        contactCooldownMs: 200,
        color: 0xff9944,
        width: 8,
        height: 20,
    },
    chain: {
        id: 'chain',
        name: '연쇄번개',
        type: 'chain',
        intervalMs: 975,
        damage: 1,
        damageFalloffPerBounce: 0.10,  // 튕길 때마다 데미지 -10% (1st=1.0, 2nd=0.9, 3rd=0.81…)
        maxTargets: 5,              // 첫 타겟(최근접) + 나머지 랜덤
        linkColor: 0xffee44,
        linkWidth: 2,
        linkFadeMs: 220,
        color: 0xffee44,
    },
    beam: {
        id: 'beam',
        name: '지속광선',
        type: 'beam',
        // 광선은 프레임 지속형. tick 마다 판정.
        tickIntervalMs: 100,
        damage: 0.7,                // 틱당 대상당 데미지 (순간 7 dps)
        // 오버히트: 광선이 준 누적 데미지가 threshold 도달 시 offDurationMs 강제 오프.
        overheatThreshold: 4,       // 4 데미지 누적 = ~5.7틱(571ms) 후 오프 → 500ms 오프 → 사이클 ~1.07s → 실효 3.73 dps
        offDurationMs: 500,
        // 시각 vs 판정 폭 분리 (시각이 더 굵음)
        visualWidth: 14,
        hitWidth: 8,
        color: 0xff44ff,
    },
    mine: {
        id: 'mine',
        name: '시한지뢰',
        type: 'mine',
        intervalMs: 1200,
        // 지뢰 자체 이동: 위로 발사 → 감속 → 최소 속도 유지 (제자리 근처 부유)
        mineSpeed: 480,             // 초기 상승 속도
        mineDecelPxPerSec: 500,     // 감속률 (velocityY += decel * dt)
        mineMinSpeed: 60,           // 최소 상승 속도 (이 이하로는 안 느려짐)
        mineTriggerY: 140,          // 이 Y 이하 도달 시 자동 폭발
        mineRadius: 8,
        mineStrokeColor: 0xff8844,
        // 폭발 시 사방으로 미사일 N발 발사
        explosionBullets: 8,
        explosionBulletSpeed: 300,
        explosionBulletRadius: 3,      // 시각 반경 (작게)
        explosionBulletAlpha: 0.3,     // 파편 투명도 (기본 playerBullet 0.6보다 더 흐림)
        // 판정 반경(18)을 시각과 분리. 접촉 폭발 시 지뢰 중심이 보스 body 바깥 (mine_r 8 + 첫 프레임 이동 ~5)px 지점이라
        // 반경 13 이상이어야 아래로 튀는 파편도 프레임 0에 걸림. 여유 두고 18.
        explosionBulletHitRadius: 18,
        explosionBulletDamage: 1,
        color: 0xaacc44,
    },
};

const BASIC_WEAPON_IDS = [
    'basicLinear', 'piercing', 'spread', 'homing', 'orbit',
    'boomerang', 'chain', 'beam', 'mine',
];
const MAX_WEAPON_LEVEL = 5;

// 각 무기 레벨업 시 오르는 스탯 한 줄 요약. LoadoutScene 미리보기 밑에 표시.
const WEAPON_LEVEL_UP_DESCRIPTIONS = {
    basicLinear: '발사간격 Lv당 -13%',
    piercing: '데미지 +15%/Lv, 탄 크기 +5%/Lv',
    spread: '탄수 +1 (2Lv마다), 데미지 +7.5%/Lv',
    homing: '데미지 +15%/Lv',
    orbit: '궤도수 +1 (2Lv마다), 데미지 +7.5%/Lv',
    boomerang: '(레벨업 미정)',
    chain: '(레벨업 미정)',
    beam: '(레벨업 미정)',
    mine: '(레벨업 미정)',
};

function getWeaponLevelUpDescription(id) {
    return WEAPON_LEVEL_UP_DESCRIPTIONS[id] ?? '';
}

function isBasicWeapon(id) {
    return BASIC_WEAPON_IDS.includes(id);
}

// hex 색상을 밝게 shift. 레벨당 12씩 각 채널 상승.
function brightenColorForLevel(hex, level) {
    if (!level || level <= 0) return hex;
    const shift = Math.min(level * 12, 60);
    const r = Math.min(255, ((hex >> 16) & 0xff) + shift);
    const g = Math.min(255, ((hex >> 8) & 0xff) + shift);
    const b = Math.min(255, (hex & 0xff) + shift);
    return (r << 16) | (g << 8) | b;
}

// 무기 id 와 level 로 스펙 계산. level 0 이면 base 그대로.
function getWeapon(id, level) {
    const base = Weapons[id];
    if (!base) return null;
    const lv = Math.max(0, Math.min(level ?? 0, MAX_WEAPON_LEVEL));
    if (lv === 0) return { ...base, level: 0 };

    const w = { ...base, level: lv };
    if (id === 'basicLinear') {
        w.intervalMs = Math.round(base.intervalMs / Math.pow(1.15, lv));
    } else if (id === 'piercing') {
        w.damage = base.damage * Math.pow(1.15, lv);
        w.width = base.width * Math.pow(1.05, lv);
        w.height = base.height * Math.pow(1.05, lv);
    } else if (id === 'spread') {
        w.pellets = base.pellets + Math.floor(lv / 2);
        w.damage = base.damage * Math.pow(1.075, lv);
    } else if (id === 'homing') {
        w.damage = base.damage * Math.pow(1.15, lv);
    } else if (id === 'orbit') {
        w.orbCount = base.orbCount + Math.floor(lv / 2);
        w.damage = base.damage * Math.pow(1.075, lv);
        w.missileDamage = base.missileDamage * Math.pow(1.075, lv);
    }
    w.name = `${base.name} Lv${lv}`;
    w.color = brightenColorForLevel(base.color, lv);
    return w;
}
