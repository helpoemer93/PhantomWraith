const Storage = {
    KEY: 'pw_save_v4',

    load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || !data.weaponLevels || !data.loadout || !data.bossProgress) return null;
            return data;
        } catch (e) {
            return null;
        }
    },

    save(weaponLevels, loadout, bossProgress) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify({
                weaponLevels,
                loadout,
                bossProgress,
            }));
        } catch (e) {
            // 저장 실패는 무시 (용량 초과 등)
        }
    },

    clear() {
        try {
            localStorage.removeItem(this.KEY);
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
        },
        bossProgress: {},
    };
}
