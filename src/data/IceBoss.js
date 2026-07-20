const IceBossData = {
    id: 'iceBoss',
    name: '설원의 얼음왕',
    rewardWeapon: 'piercing',
    maxHp: 600,
    size: 80,
    color: 0x88ccff,
    startY: 120,
    movement: { type: 'fixed' },
    phases: [
        {
            hpEnterRatio: 1.0,
            interludeOnExit: 'snowflake_burst',
            sequence: {
                loop: true,
                steps: [
                    {
                        type: 'pattern',
                        spec: {
                            name: 'p1_wave12',
                            shape: 'triangle',
                            triangleWidth: 6,
                            triangleHeight: 18,
                            bulletColor: 0xbbeeff,
                            count: 12,
                            startAngleDeg: 0,
                            angleSpreadDeg: 30,
                            speed: 180,
                            intervalMs: 350,
                            maxShots: 8,
                            rotationPerShotDeg: 15,
                        },
                    },
                    { type: 'pause', durationMs: 350 },
                    {
                        type: 'pattern',
                        spec: {
                            name: 'p1_wall360',
                            shape: 'triangle',
                            triangleWidth: 6,
                            triangleHeight: 18,
                            bulletColor: 0xbbeeff,
                            count: 360,
                            startAngleDeg: 0,
                            angleSpreadDeg: 1,
                            speed: 180,
                            intervalMs: 100,
                            maxShots: 1,
                        },
                    },
                    { type: 'pause', durationMs: 1000 },
                ],
            },
        },
        {
            hpEnterRatio: 2 / 3,
            interludeOnExit: 'snowflake_burst',
            resetSideDirection: true,
            clouds: {
                items: [
                    { startX: 0, y: 100 },
                    { startX: 240, y: 100 },
                ],
                width: 60,
                height: 40,
                color: 0xaaaaaa,
                moveSpeed: 100,
                cloudFireIntervalMs: 1400,
                bullet: {
                    shape: 'snowflake',
                    speed: 180,
                    angleDeg: 90,
                    radius: 6,
                    color: 0xddf4ff,
                },
            },
            sequence: {
                loop: true,
                onLoop: 'toggleSideDirection',
                steps: [
                    {
                        type: 'pattern',
                        spec: {
                            name: 'p2_wave12',
                            shape: 'triangle',
                            triangleWidth: 6,
                            triangleHeight: 18,
                            bulletColor: 0xbbeeff,
                            count: 12,
                            startAngleDeg: 0,
                            angleSpreadDeg: 30,
                            speed: 180,
                            intervalMs: 350,
                            maxShots: 8,
                            rotationPerShotDeg: 15,
                            dynamicSideDirection: true,
                            sideSpeed: 90,
                        },
                    },
                    { type: 'pause', durationMs: 350 },
                    {
                        type: 'pattern',
                        spec: {
                            name: 'p2_wall360',
                            shape: 'triangle',
                            triangleWidth: 6,
                            triangleHeight: 18,
                            bulletColor: 0xbbeeff,
                            count: 360,
                            startAngleDeg: 0,
                            angleSpreadDeg: 1,
                            speed: 180,
                            intervalMs: 100,
                            maxShots: 1,
                            dynamicSideDirection: true,
                            sideSpeed: 90,
                        },
                    },
                    { type: 'pause', durationMs: 1000 },
                ],
            },
        },
        {
            hpEnterRatio: 1 / 3,
            resetSideDirection: true,
            clouds: {
                items: [
                    { startX: 0, y: 100 },
                    { startX: 240, y: 100 },
                ],
                width: 60,
                height: 40,
                color: 0xaaaaaa,
                moveSpeed: 100,
                cloudFireIntervalMs: 1400,
                bullet: {
                    shape: 'snowflake',
                    speed: 180,
                    angleDeg: 90,
                    radius: 6,
                    color: 0xddf4ff,
                },
            },
            sequence: {
                loop: true,
                onLoop: 'toggleSideDirection',
                steps: [
                    {
                        type: 'pattern',
                        spec: {
                            name: 'p3_blade',
                            shape: 'blade',
                            aimAtActivePlayer: true,
                            count: 1,
                            startAngleDeg: 90,
                            angleSpreadDeg: 0,
                            speed: 240,
                            intervalMs: 100,
                            maxShots: 1,
                            bladeWidth: 10,
                            bladeHeight: 30,
                            bladeColor: 0x77bbee,
                            derive: {
                                intervalMs: 100,
                                angleOffsetDeg: 30,
                                childrenPerBurst: 2,
                                initSpeed: 200,
                                decelPerSec: 400,
                                maxReverseSpeed: 200,
                                childWidth: 6,
                                childHeight: 18,
                                childColor: 0xbbeeff,
                            },
                        },
                    },
                    { type: 'pause', durationMs: 1500 },
                    {
                        type: 'pattern',
                        spec: {
                            name: 'p3_blade',
                            shape: 'blade',
                            aimAtActivePlayer: true,
                            count: 1,
                            startAngleDeg: 90,
                            angleSpreadDeg: 0,
                            speed: 240,
                            intervalMs: 100,
                            maxShots: 1,
                            bladeWidth: 10,
                            bladeHeight: 30,
                            bladeColor: 0x77bbee,
                            derive: {
                                intervalMs: 100,
                                angleOffsetDeg: 30,
                                childrenPerBurst: 2,
                                initSpeed: 200,
                                decelPerSec: 400,
                                maxReverseSpeed: 200,
                                childWidth: 6,
                                childHeight: 18,
                                childColor: 0xbbeeff,
                            },
                        },
                    },
                    { type: 'pause', durationMs: 1500 },
                    {
                        type: 'pattern',
                        spec: {
                            name: 'p3_blade',
                            shape: 'blade',
                            aimAtActivePlayer: true,
                            count: 1,
                            startAngleDeg: 90,
                            angleSpreadDeg: 0,
                            speed: 240,
                            intervalMs: 100,
                            maxShots: 1,
                            bladeWidth: 10,
                            bladeHeight: 30,
                            bladeColor: 0x77bbee,
                            derive: {
                                intervalMs: 100,
                                angleOffsetDeg: 30,
                                childrenPerBurst: 2,
                                initSpeed: 200,
                                decelPerSec: 400,
                                maxReverseSpeed: 200,
                                childWidth: 6,
                                childHeight: 18,
                                childColor: 0xbbeeff,
                            },
                        },
                    },
                    { type: 'pause', durationMs: 500 },
                    {
                        type: 'pattern',
                        spec: {
                            name: 'p3_wave12',
                            shape: 'triangle',
                            triangleWidth: 6,
                            triangleHeight: 18,
                            bulletColor: 0xbbeeff,
                            count: 12,
                            startAngleDeg: 0,
                            angleSpreadDeg: 30,
                            speed: 180,
                            intervalMs: 350,
                            maxShots: 8,
                            rotationPerShotDeg: 15,
                            dynamicSideDirection: true,
                            sideSpeed: 180,
                        },
                    },
                    { type: 'pause', durationMs: 350 },
                    {
                        type: 'pattern',
                        spec: {
                            name: 'p3_wall360',
                            shape: 'triangle',
                            triangleWidth: 6,
                            triangleHeight: 18,
                            bulletColor: 0xbbeeff,
                            count: 360,
                            startAngleDeg: 0,
                            angleSpreadDeg: 1,
                            speed: 180,
                            intervalMs: 100,
                            maxShots: 1,
                            dynamicSideDirection: true,
                            sideSpeed: 180,
                        },
                    },
                    { type: 'pause', durationMs: 1000 },
                ],
            },
        },
    ],
    interludes: [
        {
            name: 'snowflake_burst',
            spec: {
                shape: 'snowflake',
                count: 6,
                startAngleDeg: 0,
                angleSpreadDeg: 60,
                speed: 100,
                intervalMs: 300,
                maxShots: 10,
                snowflake: {
                    burstDistance: 150,
                    maxGeneration: 4,
                    childrenPerBurst: 2,
                    childAngleOffsetDeg: 60,
                    radius: 8,
                    color: 0xddf4ff,
                },
                freezeAtMs: 3000,
                reverseInitSpeed: 300,
                reverseMinSpeed: 60,
                reverseHalfLifeMs: 1000,
            },
        },
    ],
};

const IceBoss = {
    ...IceBossData,

    buildLevelData(level) {
        const d = JSON.parse(JSON.stringify(IceBossData));
        const lv = Math.max(1, level);
        const scale = Math.pow(1.25, lv - 1);
        d.maxHp = Math.round(d.maxHp * scale);

        if (lv >= 2) {
            // 구름 2→3, 텔레포트 주기(540px) 고려 균등 분배 (startX 180 간격)
            const cloudItems3 = [
                { startX: 0, y: 100 },
                { startX: 180, y: 100 },
                { startX: 360, y: 100 },
            ];
            if (d.phases[1].clouds) d.phases[1].clouds.items = cloudItems3;
            if (d.phases[2].clouds) d.phases[2].clouds.items = cloudItems3;
        }
        if (lv >= 3) {
            // wave12 count 12→15 + 각도 360/15=24° 로 좁혀서 전체 원주 유지
            for (const phase of d.phases) {
                if (!phase.sequence) continue;
                for (const step of phase.sequence.steps) {
                    if (step.type === 'pattern' && step.spec.name &&
                        step.spec.name.endsWith('wave12')) {
                        step.spec.count = 15;
                        step.spec.angleSpreadDeg = 24;
                    }
                }
            }
        }
        if (lv >= 4) {
            // wall360 을 0.5초 뒤 한 번 더 발사
            // 원본: [..., wall, pause 1000]
            // 신규: [..., wall, pause 500, wall_clone, pause 1000]
            for (const phase of d.phases) {
                if (!phase.sequence) continue;
                const steps = phase.sequence.steps;
                for (let i = 0; i < steps.length; i += 1) {
                    const step = steps[i];
                    if (step.type === 'pattern' && step.spec.name &&
                        step.spec.name.endsWith('wall360')) {
                        if (i + 1 < steps.length && steps[i + 1].type === 'pause') {
                            steps[i + 1].durationMs = 500;
                        }
                        const wallClone = JSON.parse(JSON.stringify(step));
                        steps.splice(i + 2, 0,
                            wallClone,
                            { type: 'pause', durationMs: 1000 },
                        );
                        break; // 페이즈당 하나만
                    }
                }
            }
        }
        if (lv >= 5) {
            // 파생탄에 각속도 π/6 rad/s (30°/s, 좌우 반대, 바깥으로 벌어짐)
            // 누적 30°에서 freeze (childAngularMaxRotationRad = π/6)
            const phase3 = d.phases[2];
            if (phase3.sequence) {
                for (const step of phase3.sequence.steps) {
                    if (step.type === 'pattern' && step.spec.shape === 'blade' &&
                        step.spec.derive) {
                        step.spec.derive.childAngularRate = Math.PI / 6;
                        step.spec.derive.childAngularMaxRotationRad = Math.PI / 6;
                    }
                }
            }
        }

        return d;
    },

    getLevelUpLabels(level) {
        if (level <= 1) return [];
        const labels = ['HP +25%'];
        if (level === 2) {
            labels.push('구름 2→3개 (눈송이 실질 1.5배)');
        } else if (level === 3) {
            labels.push('wave 패턴 12→15발');
        } else if (level === 4) {
            labels.push('360도 벽 0.5초 뒤 한 번 더 (총 2회)');
        } else if (level === 5) {
            labels.push('파생탄 각속도 30°/s, 30°까지 curve (좌우 반대, 바깥으로)');
        }
        return labels;
    },
};
