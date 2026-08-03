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
        intervalMs: 600,
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
};

const BASIC_WEAPON_IDS = ['basicLinear', 'piercing', 'spread', 'homing', 'orbit'];
const MAX_WEAPON_LEVEL = 5;

// 각 무기 레벨업 시 오르는 스탯 한 줄 요약. LoadoutScene 미리보기 밑에 표시.
const WEAPON_LEVEL_UP_DESCRIPTIONS = {
    basicLinear: '발사간격 Lv당 -13%',
    piercing: '데미지 +15%/Lv, 탄 크기 +5%/Lv',
    spread: '탄수 +1 (2Lv마다), 데미지 +7.5%/Lv',
    homing: '데미지 +15%/Lv',
    orbit: '궤도수 +1 (2Lv마다), 데미지 +7.5%/Lv',
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
