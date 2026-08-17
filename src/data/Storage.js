const Storage = {
    KEY: 'pw_save_v6',
    LEGACY_KEYS: ['pw_save_v5'],

    load() {
        try {
            let raw = localStorage.getItem(this.KEY);
            if (!raw) {
                // v5 이하 마이그레이션 (challengeProgress만 빈 값으로 추가되고 나머지는 그대로)
                for (const legacyKey of this.LEGACY_KEYS) {
                    const legacy = localStorage.getItem(legacyKey);
                    if (legacy) { raw = legacy; break; }
                }
            }
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || !data.weaponLevels || !data.loadout || !data.bossProgress) return null;
            if (typeof data.crystals !== 'number') data.crystals = 0;
            if (!data.upgrades) data.upgrades = makeInitialUpgrades();
            if (!data.challengeProgress) data.challengeProgress = makeInitialChallengeProgress();
            if (typeof data.loadout.mirror !== 'boolean') data.loadout.mirror = true;
            return data;
        } catch (e) {
            return null;
        }
    },

    save(weaponLevels, loadout, bossProgress, crystals, upgrades, challengeProgress) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify({
                weaponLevels,
                loadout,
                bossProgress,
                crystals: crystals ?? 0,
                upgrades: upgrades ?? makeInitialUpgrades(),
                challengeProgress: challengeProgress ?? makeInitialChallengeProgress(),
            }));
        } catch (e) {
            // 저장 실패는 무시 (용량 초과 등)
        }
    },

    clear() {
        try {
            localStorage.removeItem(this.KEY);
            for (const legacyKey of this.LEGACY_KEYS) localStorage.removeItem(legacyKey);
        } catch (e) {
            // 무시
        }
    },
};

function makeInitialSaveData() {
    const weaponLevels = {};
    for (const id of BASIC_WEAPON_IDS) weaponLevels[id] = 0;
    return {
        weaponLevels,
        loadout: {
            p1: ['basicLinear', null, null, null],
            p2: ['basicLinear', null, null, null],
            mirror: true,
        },
        bossProgress: {},
        crystals: 0,
        upgrades: makeInitialUpgrades(),
        challengeProgress: makeInitialChallengeProgress(),
    };
}
