const Storage = {
    KEY: 'pw_save_v1',

    load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || !Array.isArray(data.inventory) || !data.loadout) return null;
            return data;
        } catch (e) {
            return null;
        }
    },

    save(inventory, loadout) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify({ inventory, loadout }));
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
