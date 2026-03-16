import * as Phaser from 'phaser';
import type { EnemyConfig } from '../types';
import enemiesData from '../data/enemies.json';
import { eventBus } from '../systems/core/EventBus';
import { GAME_WIDTH, GAME_HEIGHT, ARENA } from '../config/gameConfig';

// ── Constantes de séparation ──────────────────────────────────
export const SEPARATION_RADIUS = 28;
export const SEPARATION_FORCE  = 90;

const APPROACH_SLOW_RADIUS = 20;

const KNOCKBACK_STUN_MS = 220;

// ── Boss phases ───────────────────────────────────────────────

export class Enemy extends Phaser.Physics.Arcade.Sprite {
    public readonly config: EnemyConfig;
    public hp: number;
    public roomIndex: number = -1;

    private attackCooldown: number = 0;
    private isDead:         boolean = false;
    private isDying:        boolean = false;
    private bossLastPhase:  number  = 1;
    public  isBossAdd:      boolean = false;

    // ── Poison DOT ────────────────────────────────────────────
    private poisonTimer:     number = 0;
    private poisonTickTimer: number = 0;
    private readonly POISON_DURATION_MS  = 5000;
    private readonly POISON_TICK_MS      = 1000;
    private readonly POISON_DMG_PER_TICK = 3;

    private aggroTimer: number;

    private knockbackTimer: number = 0;

    private graphic!: Phaser.GameObjects.Graphics;

    private flankerOffset: number;
    private flankerSide: 1 | -1;

    private dasherPhase:  'stalk' | 'windup' | 'dash' = 'stalk';
    private dasherTimer:  number = 0;
    private dasherDirX:   number = 0;
    private dasherDirY:   number = 0;

    private static readonly DASHER_STALK_MS   = 1800;
    private static readonly DASHER_WINDUP_MS  =  700;
    private static readonly DASHER_DASH_MS    =  350;
    private static readonly DASHER_DASH_SPEED =  520;

    private ghostPhase:  'stalk' | 'phase' | 'dash' = 'stalk';
    private ghostTimer:  number = 0;
    private ghostAlpha:  number = 1;

    private static readonly GHOST_STALK_MS      = 2200;
    private static readonly GHOST_PHASE_MS      =  900;
    private static readonly GHOST_DASH_MS       =  180;
    private static readonly GHOST_DASH_SPEED    = 1100;
    private static readonly GHOST_PHASE_SPEED   =  200;
    private static readonly GHOST_PHASE_ALPHA   = 0.22;

    private bossPhase:        'orbit' | 'shoot' | 'charge' = 'orbit';
    private bossPhaseTimer:   number = 0;
    private bossOrbitAngle:   number = 0;
    private projectileCooldown: number = 0;

    private static readonly BOSS_ORBIT_DIST   = 200;
    private static readonly BOSS_ORBIT_SPEED  = 0.9;
    private static readonly BOSS_SHOOT_MS     = 1800;
    private static readonly BOSS_ORBIT_MS     = 2200;
    private static readonly BOSS_CHARGE_MS    =  600;
    private static readonly BOSS_CHARGE_SPEED =  340;

    constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig) {
        super(scene, x, y, '');
        this.config = config;
        this.hp     = config.hp;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setCollideWorldBounds(true);
        body.setCircle(config.size * 0.45);

        this.aggroTimer = config.aggroDelayMs ?? 0;

        this.flankerOffset = Phaser.Math.Between(60, 140);
        this.flankerSide   = Math.random() < 0.5 ? 1 : -1;

        this.dasherTimer = Enemy.DASHER_STALK_MS * (0.4 + Math.random() * 0.6);

        this.ghostTimer = Enemy.GHOST_STALK_MS * (0.3 + Math.random() * 0.7);

        this.bossOrbitAngle     = Math.random() * Math.PI * 2;
        this.bossPhaseTimer     = Enemy.BOSS_ORBIT_MS;
        this.projectileCooldown = (config.projectileCooldownMs ?? 1400) * Math.random();

        this.graphic = scene.add.graphics();
        this.redrawGraphic();
    }

    // ── Visuel ────────────────────────────────────────────────

    private redrawGraphic(): void {
        this.graphic.clear();
        const color = parseInt(this.config.color.replace('#', ''), 16);

        const isKnocked   = this.knockbackTimer > 0;
        const isAggro     = this.aggroTimer > 0;
        const isPoisoned  = this.poisonTimer > 0;
        const isWindup    = this.config.behavior === 'dasher' && this.dasherPhase === 'windup';
        const isGhostPhase = this.config.behavior === 'ghost' && this.ghostPhase === 'phase';
        const isGhostDash  = this.config.behavior === 'ghost' && this.ghostPhase === 'dash';
        const isBossShoot  = this.config.behavior === 'boss' && this.bossPhase === 'shoot';

        const blinkRate = 100;
        const blinkOn   = (isWindup || isBossShoot)
            ? Math.floor(this.dasherTimer / blinkRate) % 2 === 0
            : true;
        if (!blinkOn) return;

        let baseAlpha: number;
        if (isAggro)          baseAlpha = 0.35;
        else if (isGhostPhase) baseAlpha = this.ghostAlpha;
        else if (isGhostDash)  baseAlpha = 0.08;
        else if (isKnocked)    baseAlpha = 0.5 + 0.5 * (1 - this.knockbackTimer / KNOCKBACK_STUN_MS);
        else if (isWindup || isBossShoot) baseAlpha = 0.85;
        else                   baseAlpha = 1;

        const drawColor = isPoisoned
            ? 0x44dd44
            : isKnocked || isWindup || isBossShoot ? 0xffffff
                : isGhostPhase || isGhostDash ? color
                    : color;

        if (this.config.behavior === 'boss') {
            this.drawBossShape(drawColor, baseAlpha);
        } else if (this.config.behavior === 'ghost') {
            this.drawGhostShape(drawColor, baseAlpha, isGhostPhase);
        } else {
            this.graphic.fillStyle(drawColor, baseAlpha);
            this.graphic.lineStyle(2, isKnocked || isWindup ? 0xffffff : isPoisoned ? 0x00ff88 : 0x000000, 0.5);
            this.graphic.fillRect(
                this.x - this.config.size / 2,
                this.y - this.config.size / 2,
                this.config.size,
                this.config.size,
            );
            this.graphic.strokeRect(
                this.x - this.config.size / 2,
                this.y - this.config.size / 2,
                this.config.size,
                this.config.size,
            );
        }

        if (isPoisoned) {
            const pulse = 0.3 + 0.3 * Math.sin(Date.now() / 200);
            this.graphic.lineStyle(2, 0x00ff88, pulse);
            this.graphic.strokeCircle(this.x, this.y, this.config.size * 0.9);
        }

        if (isAggro) {
            this.graphic.lineStyle(1, 0xffffff, 0.3);
            this.graphic.strokeCircle(this.x, this.y, this.config.size);
        }
    }

    /** Visuel ghost : cercle flou + contour pulsant + traîne en phase */
    private drawGhostShape(color: number, alpha: number, isPhase: boolean): void {
        const r = this.config.size / 2;

        if (isPhase) {
            const haloR  = r * (1.4 + 0.4 * Math.sin(Date.now() / 180));
            this.graphic.fillStyle(color, alpha * 0.15);
            this.graphic.fillCircle(this.x, this.y, haloR);

            for (let i = 1; i <= 3; i++) {
                const ringAlpha = alpha * (0.4 - i * 0.1) * (0.6 + 0.4 * Math.sin(Date.now() / 120 + i));
                this.graphic.lineStyle(1.5, color, ringAlpha);
                this.graphic.strokeCircle(this.x, this.y, r * (0.5 + i * 0.4));
            }
        }

        this.graphic.fillStyle(color, alpha * 0.85);
        this.graphic.fillCircle(this.x, this.y, r);

        const outlineAlpha = isPhase ? alpha * 1.2 : alpha * 0.6;
        this.graphic.lineStyle(isPhase ? 2.5 : 1.5, isPhase ? 0xffffff : color, Math.min(outlineAlpha, 1));
        this.graphic.strokeCircle(this.x, this.y, r);
    }

    private drawBossShape(color: number, alpha: number): void {
        const r = this.config.size / 2;

        const haloR = r * (1.6 + 0.4 * Math.sin(Date.now() / 300));
        this.graphic.fillStyle(color, alpha * 0.15);
        this.graphic.fillCircle(this.x, this.y, haloR);

        const sides  = 8;
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i < sides; i++) {
            const a = (i / sides) * Math.PI * 2 - Math.PI / 8;
            points.push({ x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r });
        }
        this.graphic.fillStyle(color, alpha);
        this.graphic.lineStyle(3, 0xffffff, alpha * 0.9);
        this.graphic.beginPath();
        this.graphic.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) this.graphic.lineTo(points[i].x, points[i].y);
        this.graphic.closePath();
        this.graphic.fillPath();
        this.graphic.strokePath();
    }

    // ── Update ────────────────────────────────────────────────

    update(delta: number, playerX: number, playerY: number): void {
        if (this.isDead) return;

        if (this.attackCooldown     > 0) this.attackCooldown     -= delta;
        if (this.knockbackTimer     > 0) this.knockbackTimer     -= delta;
        if (this.projectileCooldown > 0) this.projectileCooldown -= delta;

        if (this.poisonTimer > 0) {
            this.poisonTimer     -= delta;
            this.poisonTickTimer -= delta;
            if (this.poisonTickTimer <= 0) {
                this.poisonTickTimer = this.POISON_TICK_MS;
                const died = this.receiveDamage(this.POISON_DMG_PER_TICK);
                if (died) return;
            }
        }

        if (this.aggroTimer > 0) {
            this.aggroTimer -= delta;
            this.setVelocity(0, 0);
            this.redrawGraphic();
            return;
        }

        if (this.knockbackTimer > 0) {
            this.redrawGraphic();
            return;
        }

        if (this.config.behavior === 'dasher') this.dasherTimer   -= delta;
        if (this.config.behavior === 'ghost')  this.ghostTimer    -= delta;
        if (this.config.behavior === 'boss')   this.bossPhaseTimer -= delta;

        this.moveTowardPlayer(playerX, playerY);
        this.redrawGraphic();
    }

    private moveTowardPlayer(playerX: number, playerY: number): void {
        const dist     = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
        const stopDist = this.config.attackRange + APPROACH_SLOW_RADIUS;

        const behavior = this.config.behavior;

        if (behavior === 'boss') {
            this.updateBoss(playerX, playerY, dist);
            return;
        }

        if (dist <= this.config.attackRange) {
            this.setVelocity(0, 0);
            return;
        }

        if (behavior === 'chase') {
            const speed = dist <= stopDist
                ? this.config.speed * ((dist - this.config.attackRange) / APPROACH_SLOW_RADIUS)
                : this.config.speed;
            this.scene.physics.moveTo(this, playerX, playerY, speed);

        } else if (behavior === 'erratic') {
            const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
            const noise = Phaser.Math.Between(-60, 60) * Phaser.Math.DEG_TO_RAD;
            const speed = dist <= stopDist ? this.config.speed * 0.4 : this.config.speed;
            this.setVelocity(
                Math.cos(angle + noise) * speed,
                Math.sin(angle + noise) * speed,
            );

        } else if (behavior === 'ghost') {
            this.updateGhost(playerX, playerY);

        } else if (behavior === 'dasher') {
            this.updateDasher(playerX, playerY);

        } else if (behavior === 'flanker') {
            const angle     = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
            const perpAngle = angle + (Math.PI / 2) * this.flankerSide;
            const targetX   = playerX + Math.cos(perpAngle) * this.flankerOffset;
            const targetY   = playerY + Math.sin(perpAngle) * this.flankerOffset;
            const speed     = dist <= stopDist ? this.config.speed * 0.3 : this.config.speed;

            this.scene.physics.moveTo(this, targetX, targetY, speed);

            const distTarget = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
            if (distTarget < 20) {
                this.flankerSide   = this.flankerSide === 1 ? -1 : 1;
                this.flankerOffset = Phaser.Math.Between(60, 140);
            }
        }
    }

    // ── Ghost ─────────────────────────────────────────────────

    private updateGhost(playerX: number, playerY: number): void {
        switch (this.ghostPhase) {

            case 'stalk': {
                const angle      = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
                const jitter     = Math.sin(Date.now() / 320) * 1.1;
                const orbitAngle = angle + jitter;
                const orbitDist  = 90 + Math.sin(Date.now() / 600) * 30;
                const targetX    = playerX + Math.cos(orbitAngle + Math.PI) * orbitDist;
                const targetY    = playerY + Math.sin(orbitAngle + Math.PI) * orbitDist;

                this.scene.physics.moveTo(this, targetX, targetY, this.config.speed * 0.75);

                this.ghostAlpha = Math.min(this.ghostAlpha + 0.04, 1);

                if (this.ghostTimer <= 0) {
                    this.ghostPhase = 'phase';
                    this.ghostTimer = Enemy.GHOST_PHASE_MS;
                    try {
                        this.scene.sound.play('sfx_dash', { volume: 0.18 });
                    } catch { }
                    this.scene.tweens.add({
                        targets: this.graphic, alpha: 1.5, duration: 80,
                        yoyo: true,
                    });
                }
                break;
            }

            case 'phase': {
                this.ghostAlpha = Math.max(
                    Enemy.GHOST_PHASE_ALPHA,
                    this.ghostAlpha - 0.06,
                );

                this.scene.physics.moveTo(this, playerX, playerY, Enemy.GHOST_PHASE_SPEED);

                if (this.ghostTimer <= 0) {
                    const dist = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
                    this.dasherDirX = dist > 0 ? (playerX - this.x) / dist : 1;
                    this.dasherDirY = dist > 0 ? (playerY - this.y) / dist : 0;

                    this.ghostPhase = 'dash';
                    this.ghostTimer = Enemy.GHOST_DASH_MS;

                    const cam = this.scene.cameras.main;
                    if (cam) cam.shake(120, 0.004);

                    this.setVelocity(
                        this.dasherDirX * Enemy.GHOST_DASH_SPEED,
                        this.dasherDirY * Enemy.GHOST_DASH_SPEED,
                    );
                }
                break;
            }

            case 'dash': {
                this.ghostAlpha = Enemy.GHOST_PHASE_ALPHA * 0.3;

                this.setVelocity(
                    this.dasherDirX * Enemy.GHOST_DASH_SPEED,
                    this.dasherDirY * Enemy.GHOST_DASH_SPEED,
                );

                if (this.ghostTimer <= 0) {
                    this.ghostPhase = 'stalk';
                    this.ghostTimer = Enemy.GHOST_STALK_MS * (0.6 + Math.random() * 0.8);
                    this.ghostAlpha = Enemy.GHOST_PHASE_ALPHA;
                    this.setVelocity(0, 0);

                    this.spawnGhostArrivalFx();
                }
                break;
            }
        }
    }

    /** Effet visuel : petits éclats violets à l'atterrissage du dash ghost. */
    private spawnGhostArrivalFx(): void {
        const color = parseInt(this.config.color.replace('#', ''), 16);
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const gfx   = this.scene.add.graphics();
            gfx.fillStyle(color, 0.9);
            gfx.fillCircle(0, 0, 3);
            gfx.x = this.x;
            gfx.y = this.y;
            gfx.setDepth(4);
            this.scene.tweens.add({
                targets: gfx,
                x: this.x + Math.cos(angle) * (20 + Math.random() * 15),
                y: this.y + Math.sin(angle) * (20 + Math.random() * 15),
                alpha: 0, scaleX: 0.3, scaleY: 0.3,
                duration: 280 + Math.random() * 100,
                onComplete: () => gfx.destroy(),
            });
        }
    }

    // ── Dasher ────────────────────────────────────────────────

    private updateDasher(playerX: number, playerY: number): void {
        switch (this.dasherPhase) {
            case 'stalk': {
                this.scene.physics.moveTo(this, playerX, playerY, this.config.speed * 0.55);
                if (this.dasherTimer <= 0) {
                    const angle     = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
                    this.dasherDirX = Math.cos(angle);
                    this.dasherDirY = Math.sin(angle);
                    this.dasherPhase = 'windup';
                    this.dasherTimer = Enemy.DASHER_WINDUP_MS;
                    this.setVelocity(0, 0);
                }
                break;
            }
            case 'windup': {
                this.setVelocity(0, 0);
                if (this.dasherTimer <= 0) {
                    this.dasherPhase = 'dash';
                    this.dasherTimer = Enemy.DASHER_DASH_MS;
                    this.setVelocity(
                        this.dasherDirX * Enemy.DASHER_DASH_SPEED,
                        this.dasherDirY * Enemy.DASHER_DASH_SPEED,
                    );
                }
                break;
            }
            case 'dash': {
                this.setVelocity(
                    this.dasherDirX * Enemy.DASHER_DASH_SPEED,
                    this.dasherDirY * Enemy.DASHER_DASH_SPEED,
                );
                if (this.dasherTimer <= 0) {
                    this.dasherPhase = 'stalk';
                    this.dasherTimer = Enemy.DASHER_STALK_MS * (0.6 + Math.random() * 0.8);
                    this.setVelocity(0, 0);
                }
                break;
            }
        }
    }

    // ── Boss ──────────────────────────────────────────────────

    private updateBoss(playerX: number, playerY: number, dist: number): void {
        const hp01      = this.hp / this.config.hp;
        const bossPhase = hp01 > 0.6 ? 1 : hp01 > 0.3 ? 2 : 3;

        if (bossPhase !== this.bossLastPhase) {
            if (this.config.id === 'morn_boss') {
                if (bossPhase === 2) {
                    eventBus.emit('BOSS_SPAWN_ADDS', { count: 2, types: ['speeder', 'grunt'] });
                } else if (bossPhase === 3) {
                    eventBus.emit('BOSS_SPAWN_ADDS', { count: 3, types: ['flanker', 'speeder', 'grunt'] });
                }
            }
            this.bossLastPhase = bossPhase;
        }

        switch (this.bossPhase) {

            case 'orbit': {
                const deltaTime = this.scene.game.loop.delta / 1000;
                const dir       = bossPhase === 3 ? -1.6 : 1;
                this.bossOrbitAngle += Enemy.BOSS_ORBIT_SPEED * dir * deltaTime * (bossPhase === 2 ? 1.4 : 1);

                const rawTargetX = playerX + Math.cos(this.bossOrbitAngle) * Enemy.BOSS_ORBIT_DIST;
                const rawTargetY = playerY + Math.sin(this.bossOrbitAngle) * Enemy.BOSS_ORBIT_DIST;
                const BOSS_MARGIN = ARENA.MARGIN + ARENA.WALL_THICKNESS + this.config.size;
                const targetX = Phaser.Math.Clamp(rawTargetX, BOSS_MARGIN, GAME_WIDTH  - BOSS_MARGIN);
                const targetY = Phaser.Math.Clamp(rawTargetY, BOSS_MARGIN, GAME_HEIGHT - BOSS_MARGIN);
                this.scene.physics.moveTo(this, targetX, targetY, this.config.speed);

                if (this.projectileCooldown <= 0) {
                    this.shootAtPlayer(playerX, playerY, bossPhase);
                    const cd = this.config.projectileCooldownMs ?? 1400;
                    this.projectileCooldown = bossPhase === 3 ? cd * 0.55 : bossPhase === 2 ? cd * 0.75 : cd;
                }

                if (this.bossPhaseTimer <= 0) {
                    this.bossPhase      = bossPhase === 3 ? 'charge' : 'shoot';
                    this.bossPhaseTimer = bossPhase === 3 ? Enemy.BOSS_CHARGE_MS : Enemy.BOSS_SHOOT_MS;
                    this.setVelocity(0, 0);
                }
                break;
            }

            case 'shoot': {
                this.setVelocity(0, 0);
                if (this.projectileCooldown <= 0) {
                    this.shootPattern(playerX, playerY, bossPhase);
                    const cd = this.config.projectileCooldownMs ?? 1400;
                    this.projectileCooldown = bossPhase === 2 ? cd * 0.6 : cd * 0.85;
                }
                if (this.bossPhaseTimer <= 0) {
                    this.bossPhase      = 'orbit';
                    this.bossPhaseTimer = Enemy.BOSS_ORBIT_MS * (bossPhase === 3 ? 0.6 : 1);
                }
                break;
            }

            case 'charge': {
                if (dist > this.config.attackRange) {
                    const BOSS_MARGIN = ARENA.MARGIN + ARENA.WALL_THICKNESS + this.config.size;
                    const chargeX = Phaser.Math.Clamp(playerX, BOSS_MARGIN, GAME_WIDTH  - BOSS_MARGIN);
                    const chargeY = Phaser.Math.Clamp(playerY, BOSS_MARGIN, GAME_HEIGHT - BOSS_MARGIN);
                    this.scene.physics.moveTo(this, chargeX, chargeY, Enemy.BOSS_CHARGE_SPEED);
                } else {
                    this.setVelocity(0, 0);
                }
                if (this.bossPhaseTimer <= 0) {
                    this.bossPhase      = 'orbit';
                    this.bossPhaseTimer = Enemy.BOSS_ORBIT_MS * 0.5;
                }
                break;
            }
        }
    }

    private shootAtPlayer(playerX: number, playerY: number, phase: number): void {
        const angle  = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
        const spread = phase >= 2 ? (Math.random() - 0.5) * 0.35 : 0;
        this.spawnProjectile(angle + spread);
    }

    private shootPattern(playerX: number, playerY: number, phase: number): void {
        const aimed = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
        if (phase === 1) {
            this.spawnProjectile(aimed);
            this.spawnProjectile(aimed + 0.3);
        } else if (phase === 2) {
            this.spawnProjectile(aimed);
            for (let i = 0; i < 4; i++) this.spawnProjectile((i / 4) * Math.PI * 2);
        } else {
            for (let i = 0; i < 8; i++) this.spawnProjectile((i / 8) * Math.PI * 2);
            this.spawnProjectile(aimed);
        }
    }

    private spawnProjectile(angle: number): void {
        const speed  = this.config.projectileSpeed ?? 280;
        const vx     = Math.cos(angle) * speed;
        const vy     = Math.sin(angle) * speed;
        const damage = this.config.projectileDamage ?? 1;
        const color  = parseInt(this.config.color.replace('#', ''), 16);

        const gfx = this.scene.add.graphics();
        gfx.fillStyle(color, 1);
        gfx.lineStyle(2, 0xffffff, 0.8);
        gfx.fillCircle(0, 0, 7);
        gfx.strokeCircle(0, 0, 7);
        gfx.x = this.x;
        gfx.y = this.y;

        const LIFETIME = 1800;
        const tween = this.scene.tweens.add({
            targets:  gfx,
            x:        gfx.x + vx * (LIFETIME / 1000),
            y:        gfx.y + vy * (LIFETIME / 1000),
            duration: LIFETIME,
            ease:     'Linear',
            onComplete: () => gfx.destroy(),
        });

        (gfx as unknown as Record<string, unknown>)['vx']     = vx;
        (gfx as unknown as Record<string, unknown>)['vy']     = vy;
        (gfx as unknown as Record<string, unknown>)['damage'] = damage;
        (gfx as unknown as Record<string, unknown>)['tween']  = tween;
        (gfx as unknown as Record<string, unknown>)['active'] = true;

        this.projectiles.push(gfx as BossProjectile);
    }

    public readonly projectiles: BossProjectile[] = [];

    public cleanupProjectiles(): void {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (!p.active || !p.scene) this.projectiles.splice(i, 1);
        }
    }

    // ── Combat ────────────────────────────────────────────────

    public applyPoison(): void {
        this.poisonTimer     = this.POISON_DURATION_MS;
        this.poisonTickTimer = this.POISON_TICK_MS;
    }

    public receiveDamage(amount: number, knockbackX = 0, knockbackY = 0): boolean {
        if (this.isDead) return false;

        const isPhasing = this.config.behavior === 'ghost' && this.ghostPhase === 'phase';
        if (isPhasing) {
            this.hp -= amount;
        } else {
            this.hp -= amount;
            if (knockbackX !== 0 || knockbackY !== 0) {
                const resist = this.config.knockbackResist ?? 0;
                const scale  = 1 - resist;
                this.setVelocity(knockbackX * scale, knockbackY * scale);
                this.knockbackTimer = KNOCKBACK_STUN_MS * scale;
            }
        }

        if (this.hp <= 0) {
            if (this.config.behavior === 'boss' && !this.isDying) {
                this.isDying = true;
                this.isDead  = true;
                this.setVelocity(0, 0);
                this.knockbackTimer = 0;
                for (const p of this.projectiles) { try { p.destroy(); } catch { } }
                this.projectiles.length = 0;
            } else if (!this.isDying) {
                this.die();
            }
            return true;
        }
        return false;
    }

    private die(): void {
        this.isDead = true;
        for (const p of this.projectiles) {
            try { p.destroy(); } catch { }
        }
        this.projectiles.length = 0;
        this.spawnDeathParticles();
        this.graphic.destroy();
        this.graphic = null!;
        this.setVelocity(0, 0);
        this.setActive(false).setVisible(false);
        (this.body as Phaser.Physics.Arcade.Body).enable = false;
    }

    public dieNow(): void {
        this.spawnDeathParticles();
        if (this.graphic) { this.graphic.destroy(); this.graphic = null!; }
        this.setVelocity(0, 0);
        this.setActive(false).setVisible(false);
        (this.body as Phaser.Physics.Arcade.Body).enable = false;
    }

    private spawnDeathParticles(): void {
        const color        = parseInt(this.config.color.replace('#', ''), 16);
        const isGhost      = this.config.behavior === 'ghost';
        const isBoss       = this.config.behavior === 'boss';
        const count        = isBoss ? 20 : isGhost ? 10 : 8;
        const speed        = isBoss ? 200 : isGhost ? 110 : 140;
        const particleSize = Math.max(3, this.config.size * 0.25);
        const duration     = isBoss ? 600 + Math.random() * 200
            : isGhost ? 500 + Math.random() * 200
                : 380 + Math.random() * 120;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const vx    = Math.cos(angle) * speed * (0.7 + Math.random() * 0.6);
            const vy    = Math.sin(angle) * speed * (0.7 + Math.random() * 0.6);

            const gfx = this.scene.add.graphics();
            gfx.fillStyle(color, isGhost ? 0.8 : 1);

            if (isGhost) {
                gfx.fillCircle(0, 0, particleSize);
                gfx.fillStyle(color, 0.2);
                gfx.fillCircle(0, 0, particleSize * 2.2);
            } else {
                gfx.fillRect(-particleSize / 2, -particleSize / 2, particleSize, particleSize);
            }

            gfx.x = this.x;
            gfx.y = this.y;

            this.scene.tweens.add({
                targets:  gfx,
                x:        gfx.x + vx * (isGhost ? 0.55 : 0.4),
                y:        gfx.y + vy * (isGhost ? 0.55 : 0.4),
                alpha:    0,
                scaleX:   0.2,
                scaleY:   0.2,
                duration,
                ease:     isGhost ? 'Sine.easeOut' : 'Power2',
                onComplete: () => gfx.destroy(),
            });
        }
    }

    public get dead():           boolean { return this.isDead; }
    public get dying():          boolean { return this.isDying; }
    public get isInSpawnDelay(): boolean { return this.aggroTimer > 0; }
    /** @deprecated use isInSpawnDelay */
    public get isAggro():        boolean { return this.aggroTimer > 0; }

    /** Vrai si le ghost est en phase immatérielle (ignore la séparation physique). */
    public get isGhostPhasing(): boolean {
        return this.config.behavior === 'ghost' && (this.ghostPhase === 'phase' || this.ghostPhase === 'dash');
    }

    destroyEnemy(): void {
        for (const p of this.projectiles) {
            try {
                if (p.scene) p.scene.tweens.killTweensOf(p);
                p.destroy();
            } catch { }
        }
        this.projectiles.length = 0;
        this.graphic?.destroy();
        this.destroy();
    }

    canAttack(playerX: number, playerY: number): boolean {
        if (this.aggroTimer > 0) return false;
        const dist = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
        return dist <= this.config.attackRange && this.attackCooldown <= 0;
    }

    resetAttackCooldown(): void {
        this.attackCooldown = this.config.attackCooldownMs;
    }
}

export interface BossProjectile extends Phaser.GameObjects.Graphics {
    vx:     number;
    vy:     number;
    damage: number;
}

// ── EnemyFactory ──────────────────────────────────────────────

export class EnemyFactory {
    private static configs: Map<string, EnemyConfig> = new Map(
        (enemiesData.enemies as EnemyConfig[]).map((e) => [e.id, e]),
    );

    static create(scene: Phaser.Scene, x: number, y: number, enemyId: string): Enemy {
        const config = this.configs.get(enemyId);
        if (!config) throw new Error(`EnemyFactory: unknown enemy id "${enemyId}"`);
        return new Enemy(scene, x, y, config);
    }

    static getConfig(enemyId: string): EnemyConfig | undefined {
        return this.configs.get(enemyId);
    }

    static getAllConfigs(): EnemyConfig[] {
        return Array.from(this.configs.values());
    }

    static weightedRandomId(availableIds?: string[], rng?: { next(): number }): string {
        const configs = availableIds
            ? this.getAllConfigs().filter((c) => availableIds.includes(c.id))
            : this.getAllConfigs();

        if (configs.length === 0) return 'grunt';

        const totalWeight = configs.reduce((sum, c) => sum + c.spawnWeight, 0);
        const rand = rng ? rng.next() : Math.random();
        let cursor = rand * totalWeight;
        for (const config of configs) {
            cursor -= config.spawnWeight;
            if (cursor <= 0) return config.id;
        }
        return configs[0].id;
    }
}