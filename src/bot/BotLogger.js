// 봇 러닝 로거.
// - 봇 모드로 진행된 러닝의 피격 이벤트들을 모아서 localStorage에 저장한다.
// - window.botStats() / window.botStatsReset() 로 콘솔에서 조회한다.
// - 실제 데미지 이벤트만 기록(무적 접촉 제외 — 호출부에서 걸러줌).
class BotLogger {
    constructor() {
        this.storageKey = 'phantomWraith_botRuns_v1';
        this.maxRuns = 100;
        this.currentRun = null;
    }

    startRun(meta) {
        this.currentRun = {
            startedAt: Date.now(),
            bossName: meta.bossName ?? 'unknown',
            bossLv: meta.bossLv ?? 1,
            weapons: meta.weapons ?? [],
            startSceneTime: meta.startSceneTime ?? 0,
            endSceneTime: null,
            durationMs: 0,
            result: null,
            swaps: 0,
            hits: [],
        };
    }

    isActive() {
        return this.currentRun !== null;
    }

    setSwaps(n) {
        if (this.currentRun) this.currentRun.swaps = n;
    }

    recordHit(event) {
        if (!this.currentRun) return;
        this.currentRun.hits.push({
            t: Math.round(event.t ?? 0),
            cause: event.cause,
            subType: event.subType ?? null,
            playerIdx: event.playerIdx ?? null,
            x: Math.round(event.x ?? 0),
            y: Math.round(event.y ?? 0),
            phase: event.phase ?? 0,
            livesBefore: event.livesBefore ?? 0,
            predictedDanger: event.predictedDanger ?? null,
        });
    }

    endRun(result, endSceneTime) {
        if (!this.currentRun) return;
        this.currentRun.endSceneTime = endSceneTime;
        this.currentRun.durationMs = Math.max(0, endSceneTime - this.currentRun.startSceneTime);
        this.currentRun.result = result;

        const runs = this.loadRuns();
        runs.push(this.currentRun);
        while (runs.length > this.maxRuns) runs.shift();
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(runs));
        } catch (e) {
            console.warn('[BotLogger] localStorage 저장 실패', e);
        }
        this.currentRun = null;
    }

    getCurrentHitCount() {
        return this.currentRun ? this.currentRun.hits.length : 0;
    }

    collectWeapons(run) {
        const set = new Set();
        const w = run.weapons;
        if (!w) return set;
        const push = (arr) => { if (Array.isArray(arr)) for (const id of arr) if (id) set.add(id); };
        if (Array.isArray(w)) push(w);
        else { push(w.p1); push(w.p2); }
        return set;
    }

    loadRuns() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    reset() {
        try {
            localStorage.removeItem(this.storageKey);
            console.log('[BotLogger] 저장된 러닝 기록 전부 삭제됨');
        } catch (e) {
            console.warn('[BotLogger] reset 실패', e);
        }
    }

    // 원인별 피격 랭킹 집계.
    // opts.recentN: 최근 N판만 대상 (기본 전체)
    // opts.bossName / opts.bossLv: 필터
    // opts.contains: 문자열 또는 배열. p1·p2 어디든 지정 무기 전부 장착돼 있어야 통과 (밸런스 실측용)
    // opts.excludes: 문자열 또는 배열. 지정 무기 중 하나라도 장착돼 있으면 제외
    stats(opts = {}) {
        let runs = this.loadRuns();
        if (opts.bossName) runs = runs.filter((r) => r.bossName === opts.bossName);
        if (opts.bossLv) runs = runs.filter((r) => r.bossLv === opts.bossLv);
        if (opts.contains) {
            const req = Array.isArray(opts.contains) ? opts.contains : [opts.contains];
            runs = runs.filter((r) => {
                const equipped = this.collectWeapons(r);
                return req.every((w) => equipped.has(w));
            });
        }
        if (opts.excludes) {
            const bad = Array.isArray(opts.excludes) ? opts.excludes : [opts.excludes];
            runs = runs.filter((r) => {
                const equipped = this.collectWeapons(r);
                return bad.every((w) => !equipped.has(w));
            });
        }
        if (opts.recentN) runs = runs.slice(-opts.recentN);

        const causeCounts = {};
        let winCount = 0;
        let loseCount = 0;
        let abortCount = 0;
        let totalHits = 0;
        let totalDurationMs = 0;

        for (const run of runs) {
            if (run.result === 'win') winCount += 1;
            else if (run.result === 'lose') loseCount += 1;
            else abortCount += 1;
            totalDurationMs += run.durationMs ?? 0;
            for (const h of run.hits) {
                const key = h.subType ? `${h.cause}:${h.subType}` : h.cause;
                causeCounts[key] = (causeCounts[key] || 0) + 1;
                totalHits += 1;
            }
        }

        const ranking = Object.entries(causeCounts)
            .map(([k, v]) => ({ 원인: k, 횟수: v, 판당평균: +(v / (runs.length || 1)).toFixed(2) }))
            .sort((a, b) => b.횟수 - a.횟수);

        return {
            총러닝수: runs.length,
            승: winCount,
            패: loseCount,
            중단: abortCount,
            총피격수: totalHits,
            판당평균피격: runs.length ? +(totalHits / runs.length).toFixed(2) : 0,
            평균러닝시간초: runs.length ? +(totalDurationMs / runs.length / 1000).toFixed(1) : 0,
            원인별랭킹: ranking,
        };
    }

    // 편의: 콘솔에 표로 출력
    printStats(opts = {}) {
        const s = this.stats(opts);
        console.log(`=== 봇 통계 (총 ${s.총러닝수}판) ===`);
        console.log(`승 ${s.승} / 패 ${s.패} / 중단 ${s.중단}`);
        console.log(`총 피격 ${s.총피격수}회, 판당 평균 ${s.판당평균피격}회, 평균 러닝 ${s.평균러닝시간초}초`);
        console.log('원인별 랭킹:');
        console.table(s.원인별랭킹);
        return s;
    }

    // 여러 무기 조합 한 번에 비교. 각 무기별 contains 필터 스탯을 표로.
    // opts.bossName / opts.bossLv: 공통 필터
    // opts.weapons: 비교할 무기 ID 배열 (기본 9종 전부)
    compare(opts = {}) {
        const list = opts.weapons ?? [
            'basicLinear', 'piercing', 'spread', 'homing', 'orbit',
            'boomerang', 'chain', 'beam', 'mine',
        ];
        const rows = list.map((w) => {
            const s = this.stats({
                bossName: opts.bossName,
                bossLv: opts.bossLv,
                contains: w,
            });
            return {
                무기: w,
                판수: s.총러닝수,
                승률: s.총러닝수 ? `${Math.round(s.승 / s.총러닝수 * 100)}%` : '-',
                평균초: s.평균러닝시간초,
                판당피격: s.판당평균피격,
            };
        });
        const tag = [];
        if (opts.bossName) tag.push(opts.bossName);
        if (opts.bossLv) tag.push(`Lv${opts.bossLv}`);
        console.log(`=== 무기 비교 ${tag.length ? '('+tag.join(' ')+')' : ''} ===`);
        console.table(rows);
        return rows;
    }

    // 한 줄 요약. 복사·붙여넣기용. copy() 로 감싸면 클립보드로 들어감.
    shortStats(opts = {}) {
        const s = this.stats(opts);
        const tag = [];
        if (opts.bossName) tag.push(opts.bossName);
        if (opts.bossLv) tag.push(`Lv${opts.bossLv}`);
        const label = tag.length ? tag.join(' ') : '전체';
        const abortPart = s.중단 ? `/A${s.중단}` : '';
        const top3 = s.원인별랭킹.slice(0, 3)
            .map((r) => `${r.원인}(${r.판당평균})`)
            .join(', ');
        return `${label} | ${s.총러닝수}판 W${s.승}/L${s.패}${abortPart} | 판당 피격 ${s.판당평균피격} | 평균 ${s.평균러닝시간초}s | top: ${top3 || '없음'}`;
    }
}

// 스크립트 로드 즉시 콘솔 명령 등록. GameScene 진입 여부와 무관하게 사용 가능.
if (typeof window !== 'undefined') {
    if (!window.__botLoggerInstance) {
        window.__botLoggerInstance = new BotLogger();
    }
    window.botStats = (opts) => window.__botLoggerInstance.printStats(opts);
    window.botStatsReset = () => window.__botLoggerInstance.reset();
    // 무기 조합 한 번에 비교 (표). ex: botCompare({ bossName:'구구', bossLv:1 })
    window.botCompare = (opts) => window.__botLoggerInstance.compare(opts);
    // 한 줄 요약. `copy(botStatsShort({...}))` 로 클립보드 복사.
    window.botStatsShort = (opts) => {
        const line = window.__botLoggerInstance.shortStats(opts);
        console.log(line);
        return line;
    };
}
