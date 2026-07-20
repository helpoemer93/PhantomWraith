const MetagrossData = {
    id: 'metagross',
    name: '메타그로스',
    rewardWeapon: 'basicLinear',
    maxHp: 600,
    size: 70,
    color: 0xaaccdd,
    startY: 140,
    movement: {
        type: 'pendulum',
        speedRadPerSec: Math.PI / 5,
        rangePx: 130,
    },
    baseAttack: {
        type: 'gearMultiTarget',
        intervalMs: 700,
        gear: {
            radius: 22,
            color: 0x888888,
            speed: 200,
            rotationRadPerSec: Math.PI,
        },
    },
    phases: [
        {
            hpEnterRatio: 1.0,
            interludeOnExit: 'electric_field',
            turretSpawner: {
                intervalMs: 5000,
                area: { xMin: 60, xMax: 420, yMin: 180, yMax: 380 },
                turret: {
                    radius: 12,
                    color: 0x999999,
                    strokeColor: 0x666666,
                    maxHp: 40,
                    decayPercentPerSec: 2.5,
                    fireIntervalMs: 1000,
                    shotsPerBurst: 3,
                    shotIntervalMs: 200,
                    missile: {
                        radius: 4,
                        color: 0xff8844,
                        speed: 200,
                    },
                },
            },
        },
        {
            hpEnterRatio: 2 / 3,
            interludeOnExit: 'spark_link',
            suicideDroneSpawner: {
                intervalMs: 4000,
                drone: {
                    radius: 15,
                    color: 0x666666,
                    strokeColor: 0x333333,
                    maxHp: 20,
                    decayPercentPerSecPerDrone: 5,
                    centerX: 240,
                    centerY: 420,
                    orbitRadius: 150,
                    orbitSpeedRadPerSec: Math.PI / 3,
                    detectionAngleDeg: 60,
                    detectionRadius: 110,
                    pauseMs: 500,
                    chargeSpeed: 500,
                    fanColor: 0xff4444,
                    fanAlpha: 0.3,
                    fanAlphaPaused: 0.7,
                },
            },
            harvesterDroneSpawner: {
                cyclesPerSpawn: 3,
                drone: {
                    radius: 14,
                    color: 0xccaa44,
                    strokeColor: 0x664422,
                    maxHp: 15,
                    decayPercentPerSecPerDrone: 2.5,
                    speed: 250,
                    healPercent: 1,
                    carriedGearColor: 0x888888,
                    carriedGearRadius: 8,
                },
            },
        },
        {
            hpEnterRatio: 1 / 3,
            turretSpawnerOverride: {
                intervalMs: 4500,
            },
            turretMotion: {
                angularSpeedRadPerSec: Math.PI / 2,
                radiusGrowRatePxPerSec: 10,
                aimEveryShot: true,
            },
            turretConnections: {
                lineColor: 0xffdd44,
                lineWidth: 1.5,
                alphaMin: 0.4,
                alphaMax: 1.0,
                blinkPeriodMs: 400,
                damageThreshold: 8,
            },
        },
    ],
    interludes: [
        {
            name: 'electric_field',
            spec: {
                type: 'electricField',
                durationMs: 3500,
                field: {
                    width: 480,
                    height: 22,
                    color: 0x88ccff,
                    strokeColor: 0xffffff,
                    initialY: -20,
                    speed: 235,
                },
                turretsToSpawn: 3,
            },
        },
        {
            name: 'spark_link',
            spec: {
                type: 'sparkLink',
                durationMs: 5000,
                field: {
                    width: 480,
                    height: 22,
                    color: 0xffdd44,
                    strokeColor: 0xffffff,
                    initialY: -20,
                    speed: 235,
                },
                turretsToSpawn: 3,
                previewConnection: {
                    lineColor: 0xffdd44,
                    lineWidth: 1.5,
                    alphaStart: 0,
                    alphaEnd: 0.5,
                },
            },
        },
    ],
};

const Metagross = {
    ...MetagrossData,

    buildLevelData(level) {
        const d = JSON.parse(JSON.stringify(MetagrossData));
        const lv = Math.max(1, level);
        const scale = Math.pow(1.20, lv - 1);
        d.maxHp = Math.round(d.maxHp * scale);
        for (const phase of d.phases) {
            if (phase.turretSpawner?.turret?.maxHp) {
                phase.turretSpawner.turret.maxHp = Math.round(phase.turretSpawner.turret.maxHp * scale);
            }
            if (phase.suicideDroneSpawner?.drone?.maxHp) {
                phase.suicideDroneSpawner.drone.maxHp = Math.round(phase.suicideDroneSpawner.drone.maxHp * scale);
            }
            if (phase.harvesterDroneSpawner?.drone?.maxHp) {
                phase.harvesterDroneSpawner.drone.maxHp = Math.round(phase.harvesterDroneSpawner.drone.maxHp * scale);
            }
        }

        if (lv >= 2) {
            d.baseAttack.gear.radius = Math.round(d.baseAttack.gear.radius * 1.3);
        }
        if (lv >= 3) {
            for (const phase of d.phases) {
                if (phase.turretSpawner?.turret) {
                    phase.turretSpawner.turret.fireIntervalMs = Math.round(phase.turretSpawner.turret.fireIntervalMs * 0.8);
                }
            }
        }
        if (lv >= 4) {
            for (const phase of d.phases) {
                if (phase.suicideDroneSpawner?.drone) {
                    const drone = phase.suicideDroneSpawner.drone;
                    drone.approachSpeed = Math.round((drone.approachSpeed ?? 250) * 1.2);
                    drone.chargeSpeed = Math.round((drone.chargeSpeed ?? 500) * 1.2);
                    drone.orbitSpeedRadPerSec = (drone.orbitSpeedRadPerSec ?? Math.PI / 3) * 1.2;
                }
                if (phase.harvesterDroneSpawner?.drone) {
                    phase.harvesterDroneSpawner.drone.speed = Math.round((phase.harvesterDroneSpawner.drone.speed ?? 250) * 1.2);
                }
            }
        }
        if (lv >= 5) {
            for (const phase of d.phases) {
                if (phase.turretMotion) {
                    phase.invincibleTurret = {
                        spawnX: 240,
                        spawnY: 300,
                        radius: 80,
                        angularSpeedRadPerSec: Math.PI / 2,
                        color: 0xccccdd,
                        strokeColor: 0x4488ff,
                    };
                }
            }
        }
        return d;
    },

    getLevelUpLabels(level) {
        if (level <= 1) return [];
        const labels = ['HP +25%'];
        if (level === 2) {
            labels.push('기어 크기 +30%');
        } else if (level === 3) {
            labels.push('포탑 공격속도 +20%');
        } else if (level === 4) {
            labels.push('드론 이동속도 +20%');
        } else if (level === 5) {
            labels.push('무적포탑 1대 (3페이즈)');
        }
        return labels;
    },
};
