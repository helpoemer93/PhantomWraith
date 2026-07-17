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
        color: 0xffee88,
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
        color: 0x88ffff,
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
        color: 0xff88ff,
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
        color: 0xffaa66,
        radius: 5,
    },
    orbit: {
        id: 'orbit',
        name: '궤도탄',
        type: 'orbit',
        radius: 44,
        rotationSpeedRadPerSec: Math.PI * 2,
        damage: 2,
        contactCooldownMs: 220,
        orbCount: 1,
        color: 0x88ff88,
        orbSize: 8,
    },
};

const BASIC_WEAPON_IDS = ['basicLinear', 'piercing', 'spread', 'homing', 'orbit'];
const MAX_WEAPON_LEVEL = 5;

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
    }
    w.name = `${base.name} Lv${lv}`;
    w.color = brightenColorForLevel(base.color, lv);
    return w;
}
