// 캐릭터 영구 강화 축 정의.
// applied(level) = 실제 게임에 적용되는 값
// describe(level) = 표시용 문자열
// costs[i] = i 레벨에서 i+1 레벨로 갈 때 드는 결정
const Upgrades = {
    maxLives: {
        name: '최대 목숨',
        maxLevel: 3,
        costs: [3, 10, 30],
        applied(level) { return 5 + level; },
        describe(level) { return `${5 + level}개`; },
    },
    moveSpeed: {
        name: '이동속도',
        maxLevel: 3,
        costs: [3, 10, 30],
        applied(level) { return Math.round(260 * (1 + 0.1 * level)); },
        describe(level) {
            const v = Math.round(260 * (1 + 0.1 * level));
            return level === 0 ? `${v}px/s` : `${v}px/s (+${10 * level}%)`;
        },
    },
    hitImmunity: {
        name: '피격 면역',
        maxLevel: 3,
        costs: [3, 10, 30],
        applied(level) { return 1000 + 200 * level; },
        describe(level) { return `${1000 + 200 * level}ms`; },
    },
    hitbox: {
        name: '히트박스',
        maxLevel: 3,
        costs: [5, 15, 50],
        applied(level) { return 24 - 2 * level; },
        describe(level) { return `${24 - 2 * level}px`; },
    },
};

const UPGRADE_IDS = ['maxLives', 'moveSpeed', 'hitImmunity', 'hitbox'];

function makeInitialUpgrades() {
    const u = {};
    for (const id of UPGRADE_IDS) u[id] = 0;
    return u;
}
