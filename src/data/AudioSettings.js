// 오디오 설정: 마스터/BGM/SFX 3단계 볼륨 스케일.
// - 마스터: Phaser SoundManager.volume 에 적용 (모든 소리 곱해짐)
// - BGM: 각 BGM 인스턴스에 __baseVolume 태그 저장, setVolume(base * bgmFactor)
// - SFX: playSfx 헬퍼가 base * sfxFactor 로 재생
// 저장은 게임 진행과 분리된 별도 키 (pw_audio_v1) — 게임 초기화 시 영향 없음.
const AudioSettings = {
    KEY: 'pw_audio_v1',
    _cache: null,

    _clamp(v) {
        const n = Number(v);
        if (!isFinite(n)) return 1.0;
        return Math.max(0, Math.min(1, n));
    },

    load() {
        if (this._cache) return this._cache;
        try {
            const raw = localStorage.getItem(this.KEY);
            if (raw) {
                const data = JSON.parse(raw);
                this._cache = {
                    master: this._clamp(data.master ?? 1.0),
                    bgm: this._clamp(data.bgm ?? 1.0),
                    sfx: this._clamp(data.sfx ?? 1.0),
                };
            } else {
                this._cache = { master: 1.0, bgm: 1.0, sfx: 1.0 };
            }
        } catch (e) {
            this._cache = { master: 1.0, bgm: 1.0, sfx: 1.0 };
        }
        return this._cache;
    },

    save() {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(this._cache));
        } catch (e) { /* 무시 */ }
    },

    get(category) {
        return this.load()[category];
    },

    set(category, value) {
        const s = this.load();
        s[category] = this._clamp(value);
        this.save();
    },

    // Phaser 마스터 볼륨 반영 (씬 어디에서든 호출 가능)
    applyMaster(scene) {
        scene.sound.volume = this.load().master;
    },

    // BGM 재생 시 실제 볼륨 계산 (base * bgmFactor). 마스터는 Phaser가 곱함.
    bgmVolume(baseVolume) {
        return baseVolume * this.load().bgm;
    },

    // 활성 BGM 볼륨 즉시 갱신 (설정창에서 슬라이더 조정 시).
    // __baseVolume 태그된 인스턴스만 처리 — BGM 아닌 사운드 무관.
    refreshActiveBgm(scene) {
        const bgmFactor = this.load().bgm;
        const sounds = scene.sound.sounds || [];
        for (const s of sounds) {
            if (s && s.__baseVolume !== undefined && s.setVolume) {
                s.setVolume(s.__baseVolume * bgmFactor);
            }
        }
    },

    // SFX 재생 헬퍼. config.volume 을 sfxFactor 로 스케일.
    playSfx(scene, key, config = {}) {
        if (!scene.cache.audio.exists(key)) return;
        const sfxFactor = this.load().sfx;
        const base = config.volume ?? 1.0;
        scene.sound.play(key, { ...config, volume: base * sfxFactor });
    },
};
