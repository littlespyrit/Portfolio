import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ARENA, PLAYER } from '../config/gameConfig';
import { Player, ATTACK_HALF_ARC } from '../entities/Player';
import { Enemy, BossProjectile } from '../entities/Enemy';
import { EmotionOrb } from '../entities/EmotionOrb';
import { EnemyManager } from '../systems/combat/EnemyManager';
import { RoomManager } from '../systems/dungeon/RoomManager';
import { DungeonGraph } from '../systems/dungeon/DungeonGraph';
import { MiniMap } from '../systems/ui/MiniMap';
import { ScoreManager } from '../systems/core/ScoreManager';
import { SeededRNG } from '../systems/core/SeededRNG';
import { UIManager } from '../systems/ui/UIManager';
import { BossHandler } from '../systems/combat/BossHandler';
import { DialogueHandler } from '../systems/ui/DialogueHandler';
import { runStats } from '../systems/core/RunStats';
import { buffManager } from '../systems/core/BuffManager';
import { metaProgress } from '../systems/core/MetaProgress';
import { resetMornSession } from '../scenes/MornShopScene';
import { BreakableManager } from '../entities/Breakable';
import { eventBus } from '../systems/core/EventBus';
import type { EmotionType } from '../systems/core/RunStats';
import { DebugConsoleScene } from './DebugConsoleScene';
import { audioManager } from '../systems/ui/AudioManager';
import { ControlsConfig } from '../config/controls';

const KNOCKBACK_FORCE = 380;

export class ArenaScene extends Phaser.Scene {
    public player!:        Player;
    public enemyManager!:  EnemyManager;
    public roomManager!:   RoomManager;
    public dungeonGraph!:  DungeonGraph;
    public miniMap!:       MiniMap;

    private scoreManager!: ScoreManager;
    private rng!:          SeededRNG;
    private breakables!:   BreakableManager;
    private ui!:           UIManager;
    private bossHandler!:  BossHandler;
    private dialogueHandler!: DialogueHandler;

    private orbs: EmotionOrb[] = [];

    private isGameOver:        boolean    = false;
    private hitThisSwing:      Set<Enemy> = new Set();
    private wasAttacking:      boolean    = false;
    private wasDodging:        boolean    = false;
    private runSound:          Phaser.Sound.BaseSound | null = null;
    private escKey!:           Phaser.Input.Keyboard.Key;
    private _debugKeyListener: ((e: KeyboardEvent) => void) | null = null;

    constructor() { super({ key: 'ArenaScene' }); }

    // ── Lifecycle ─────────────────────────────────────────────

    create(): void {
        this.isGameOver   = false;
        this.hitThisSwing = new Set();
        this.wasAttacking = false;
        this.wasDodging   = false;
        this.orbs         = [];

        audioManager.init(this);
        audioManager.playMusic();

        this.createSystems();
        this.createPlayer();
        this.registry.set('currentSeed', this.rng.seed);
        this.setupCollisions();
        this.setupEventListeners();

        this.ui = new UIManager(this);
        this.ui.create(this.rng.seed);

        this.bossHandler = new BossHandler(
            this,
            this.player,
            this.dungeonGraph,
            this.roomManager,
            this.orbs,
            (text, ms) => this.ui.showMessage(text, ms),
        );

        this.events.on('pause', () => {
            if (this.runSound?.isPlaying) this.runSound.stop();
        });

        this.events.on('resume', () => {
            // Réinitialiser l'état des touches ET l'état d'input du joueur
            // pour éviter les inputs fantômes après la pause (attaque en boucle, etc.)
            this.input.keyboard!.resetKeys();
            this.player?.resetInputState();
        });

        this.roomManager.loadStartRoom();
        this.cameras.main.fadeIn(400, 0, 0, 0);

        this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.setupInputListeners();

        this.dialogueHandler = new DialogueHandler(this);
        const zoneIntroKey: Record<number, string> = {
            1: 'intro',
            2: 'zone2_intro',
            3: 'zone3_intro',
            4: 'zone4_intro',
        };
        const introKey = zoneIntroKey[metaProgress.currentZone];
        if (introKey) {
            this.player.frozenForCinematic = true;
            this.time.delayedCall(600, () => {
                this.dialogueHandler.play(introKey, () => {
                    this.player.frozenForCinematic = false;
                });
            });
        }
    }

    update(_time: number, delta: number): void {
        if (this.isGameOver) return;

        this.player.update(delta);
        this.scoreManager.update(delta);
        this.enemyManager.update(delta, this.player.x, this.player.y);
        this.roomManager.update(this.player.x, this.player.y, delta);
        buffManager.update(delta);

        const alive = this.enemyManager.getAlive();
        for (const enemy of alive) this.checkEnemyAttack(enemy);
        if (this.player.isAttacking) {
            this.checkPlayerAttack(alive);
            this.breakables.checkAttack(
                this.player.x, this.player.y,
                this.player.attackFacingAngle,
                this.player.effectiveAttackRange,
                ATTACK_HALF_ARC,
                () => { runStats.recordBroken(); audioManager.playSfx('sfx_break'); },
            );
        }
        this.checkBossProjectiles(alive);

        if (this.wasAttacking && !this.player.isAttacking) this.hitThisSwing.clear();
        if (!this.wasAttacking && this.player.isAttacking) audioManager.playSfx('sfx_sword', 0.35);
        this.wasAttacking = this.player.isAttacking;

        if (!this.wasDodging && this.player.isDodging) audioManager.playSfx('sfx_dash', 0.35);
        this.wasDodging = this.player.isDodging;

        const body      = this.player.body as Phaser.Physics.Arcade.Body;
        const isMoving  = (Math.abs(body.velocity.x) > 10 || Math.abs(body.velocity.y) > 10)
            && this.player.active
            && !this.isGameOver;
        if (isMoving && (!this.runSound || !this.runSound.isPlaying)) {
            if (this.game.cache.audio.has('sfx_run')) {
                this.runSound = this.sound.add('sfx_run', { loop: true, volume: audioManager.sfxVol * 0.6 });
                this.runSound.play();
            }
        } else if (!isMoving && this.runSound?.isPlaying) {
            this.runSound.stop();
        }

        this.orbs = this.orbs.filter((orb) => {
            orb.update(delta, this.player.x, this.player.y);
            return !orb.isDead;
        });

        this.breakables.updateDrops(
            this.player.x, this.player.y,
            () => { this.player.heal(1); },
            (emotion, x, y) => {
                const orb = new EmotionOrb(this, x, y, emotion as EmotionType);
                this.orbs.push(orb);
            },
        );

        const aliveBoss = alive.find(e => e.config.behavior === 'boss');
        this.ui.refresh(this.scoreManager, this.roomManager.roomNumber, this.player.hp, aliveBoss);
    }

    // ── Création ──────────────────────────────────────────────

    private createPlayer(): void {
        this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2);
        this.physics.world.setBounds(
            ARENA.MARGIN + ARENA.WALL_THICKNESS,
            ARENA.MARGIN + ARENA.WALL_THICKNESS,
            GAME_WIDTH  - (ARENA.MARGIN + ARENA.WALL_THICKNESS) * 2,
            GAME_HEIGHT - (ARENA.MARGIN + ARENA.WALL_THICKNESS) * 2,
        );
    }

    private createSystems(): void {
        this.rng          = new SeededRNG(this.registry.get('currentSeed') ?? undefined);
        this.enemyManager = new EnemyManager(this, this.rng);
        this.dungeonGraph = new DungeonGraph(this.rng, metaProgress.currentZone);
        this.breakables   = new BreakableManager(this);
        this.roomManager  = new RoomManager(this, this.enemyManager, this.breakables, this.dungeonGraph);
        this.scoreManager = new ScoreManager();
        this.miniMap      = new MiniMap(this, this.dungeonGraph, this.dungeonGraph.startId);

        this.roomManager.onRoomChanged = (id) => {
            this.miniMap.setCurrentRoom(id);
        };
        this.roomManager.onSpawnPlayer = (x, y) => {
            this.player.setPosition(x, y);
            this.player.setVelocity(0, 0);
        };
        this.roomManager.onGetPlayerSprite = () => this.player;

        if (process.env.NODE_ENV === 'development') {
            this.dungeonGraph.debugPrint();
        }
    }

    private setupCollisions(): void {
        this.physics.add.collider(this.enemyManager.group, this.enemyManager.group);
        this.physics.add.collider(this.player, this.breakables.group);
        this.physics.add.collider(this.enemyManager.group, this.breakables.group);
    }

    // ── Input ─────────────────────────────────────────────────

    private setupInputListeners(): void {
        const openDebugConsole = () => {
            if (this.isGameOver) return;
            if (!this.scene.isActive('DebugConsoleScene')) {
                this.scene.pause('ArenaScene');
                this.scene.launch('DebugConsoleScene');
            } else {
                this.scene.stop('DebugConsoleScene');
                this.scene.resume('ArenaScene');
            }
        };
        this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F2).on('down', openDebugConsole);
        this._debugKeyListener = (e: KeyboardEvent) => {
            if (e.key === '²' || e.key === '`') openDebugConsole();
        };
        window.addEventListener('keydown', this._debugKeyListener);

        this.escKey.on('down', () => {
            if (this.isGameOver) return;
            if (this.ui.isCharMenuOpen) { this.ui.closeCharMenu(); return; }
            if (this.miniMap.isOpen) {
                this.miniMap.close();
            } else {
                this.scene.launch('PauseScene');
                this.scene.pause();
                if (this.runSound?.isPlaying) this.runSound.stop();
            }
        });

        const bindCharMenu = () => {
            const key = ControlsConfig.getCurrentScheme().charMenu ?? 'C';
            const kc  = Phaser.Input.Keyboard.KeyCodes[key as keyof typeof Phaser.Input.Keyboard.KeyCodes]
                ?? Phaser.Input.Keyboard.KeyCodes.C;
            this.input.keyboard!.addKey(kc).on('down', () => {
                if (this.isGameOver) return;
                if (this.ui.isCharMenuOpen) this.ui.closeCharMenu();
                else                        this.ui.openCharMenu(this.player.hp);
            });
        };
        bindCharMenu();
        eventBus.on('CONTROLS_CHANGED', () => bindCharMenu());
    }

    // ── Combat ────────────────────────────────────────────────

    private checkPlayerAttack(alive: Enemy[]): void {
        const facing = this.player.attackFacingAngle;
        const range  = this.player.effectiveAttackRange;
        const damage = Math.floor(PLAYER.ATTACK_DAMAGE * this.player.attackMultiplier);

        for (const enemy of alive) {
            if (enemy.dead || this.hitThisSwing.has(enemy)) continue;
            if (enemy.isAggro) continue;

            const dx   = enemy.x - this.player.x;
            const dy   = enemy.y - this.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > range) continue;

            const angleToEnemy = Math.atan2(dy, dx);
            let diff = angleToEnemy - facing;
            while (diff >  Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            if (Math.abs(diff) > ATTACK_HALF_ARC) continue;

            const nx   = dist > 0 ? dx / dist : 0;
            const ny   = dist > 0 ? dy / dist : -1;
            const died = enemy.receiveDamage(damage, nx * KNOCKBACK_FORCE, ny * KNOCKBACK_FORCE);
            this.hitThisSwing.add(enemy);

            if (!died && runStats.poisonUnlocked) {
                enemy.applyPoison();
            }

            if (died) {
                if (enemy.config.behavior === 'boss') {
                    this.bossHandler.triggerBossDeathCinematic(enemy.x, enemy.y, enemy);
                } else {
                    const orb = new EmotionOrb(this, enemy.x, enemy.y, enemy.config.emotion as EmotionType);
                    this.orbs.push(orb);
                    eventBus.emit('ENEMY_KILLED', {
                        scoreValue: enemy.config.scoreValue,
                        enemyId:    enemy.config.id,
                        enemyIndex: enemy.roomIndex,
                        isBoss:     false,
                    });
                }
            }
        }
    }

    private checkEnemyAttack(enemy: Enemy): void {
        if (enemy.canAttack(this.player.x, this.player.y)) {
            this.player.receiveHit(1);
            enemy.resetAttackCooldown();
        }
    }

    private checkBossProjectiles(alive: Enemy[]): void {
        for (const enemy of alive) {
            if (enemy.config.behavior !== 'boss') continue;
            enemy.cleanupProjectiles();
            for (const proj of enemy.projectiles as BossProjectile[]) {
                if (!proj.active || !proj.scene) continue;
                const dist = Phaser.Math.Distance.Between(proj.x, proj.y, this.player.x, this.player.y);
                if (dist < 12) {
                    this.player.receiveHit(proj.damage);
                    try { proj.destroy(); } catch { }
                }
            }
        }
    }

    // ── Events ────────────────────────────────────────────────

    private setupEventListeners(): void {
        eventBus.on('PLAYER_DEAD', () => this.triggerGameOver());
        eventBus.on('CONTROLS_CHANGED', () => { this.player?.rebindKeys?.(); });

        eventBus.on('BOSS_SPAWN_ADDS', (e) => {
            const { count, types } = e.payload as { count: number; types: string[] };
            const cx = GAME_WIDTH  / 2;
            const cy = GAME_HEIGHT / 2;
            const radius = 180;
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
                const x = Phaser.Math.Clamp(cx + Math.cos(angle) * radius, 80, GAME_WIDTH  - 80);
                const y = Phaser.Math.Clamp(cy + Math.sin(angle) * radius, 80, GAME_HEIGHT - 80);
                const type = types[i % types.length];
                const add = this.enemyManager.spawnAtReturn(type, x, y, -99);
                if (add) {
                    add.isBossAdd = true;
                    add.setAlpha(0);
                    this.tweens.add({ targets: add, alpha: 1, duration: 400 });
                }
            }
        });

        eventBus.on('ROOM_CLEAR', (e) => {
            const room   = this.dungeonGraph.getRoom(e.payload?.roomNumber as number);
            const isBoss = room?.type === 'boss' || room?.type === 'boss_final';
            this.miniMap.onRoomCleared(e.payload?.roomNumber as number);
            audioManager.playSfx(isBoss ? 'sfx_boss' : 'sfx_door');
        });

        eventBus.on('DOOR_ENTER', (e) => {
            const id   = e.payload?.roomNumber as number;
            const room = this.dungeonGraph.getRoom(id);
            if (room?.type === 'boss') {
                this.bossHandler.triggerBossSpawnCinematic();
            } else if (room?.type === 'pre_boss') {
                this.ui.showMessage('⚠ Antichambre du boss', 1500);
            }
        });

        eventBus.on('MORN_TELEPORT_NEXT_BOSS', () => {
            this.showZoneScoreScreen();
        });

        eventBus.on('PLAYER_JUMP_HOLE', () => {
            this.cameras.main.shake(200, 0.005);
            audioManager.playSfx('sfx_jump_hole');
        });

        eventBus.on('PLAYER_LAND_HOLE', () => {
            this.cameras.main.shake(300, 0.012);
            audioManager.playSfx('sfx_land_hole');
        });

        eventBus.on('MORN_START_FINAL_DIALOGUE', () => {
            // En zone 4, le dialogue de confrontation est géré directement par MornCinematic
            if (metaProgress.currentZone >= 4) return;
            if (this.scene.isActive('MornShopScene')) {
                this.scene.stop('MornShopScene');
            }
            this.time.delayedCall(300, () => {
                this.scene.launch('MornShopScene');
                this.scene.pause('ArenaScene');
            });
        });

        eventBus.on('ORB_COLLECTED', (e) => {
            const type = e.payload?.type as EmotionType;
            if (type === 'haine') {
                audioManager.playSfx('sfx_haine_gain');
            }
        });

        this.events.on('DAGGER_UPDATE', (data: {
            x: number; y: number; damage: number; poison: boolean; onHit?: () => void;
        }) => {
            const HIT_RADIUS = 18;
            const alive = this.enemyManager.getAlive();
            for (const enemy of alive) {
                const dist = Phaser.Math.Distance.Between(data.x, data.y, enemy.x, enemy.y);
                if (dist < HIT_RADIUS + enemy.config.size / 2) {
                    const died = enemy.receiveDamage(data.damage);
                    if (data.poison) enemy.applyPoison();
                    data.onHit?.();
                    if (died) {
                        if (enemy.config.behavior === 'boss') {
                            this.bossHandler.triggerBossDeathCinematic(enemy.x, enemy.y, enemy);
                        } else {
                            const orb = new EmotionOrb(this, enemy.x, enemy.y, enemy.config.emotion as EmotionType);
                            this.orbs.push(orb);
                            eventBus.emit('ENEMY_KILLED', {
                                scoreValue: enemy.config.scoreValue,
                                enemyId:    enemy.config.id,
                                enemyIndex: enemy.roomIndex,
                                isBoss:     false,
                            });
                        }
                    }
                    return;
                }
            }
            const broke = this.breakables.checkPoint(data.x, data.y, HIT_RADIUS);
            if (broke) data.onHit?.();
        });

        eventBus.on('PLAYER_HEALED', () => { this.ui.pulseHearts(); });
        eventBus.on('PLAYER_HIT',    () => { this.ui.pulseHearts(); audioManager.playSfx('sfx_hurt'); });

        eventBus.on('PERFECT_PARRY', () => {
            this.ui.showMessage('PERFECT PARRY', 1000);
            audioManager.playSfx('sfx_parade');
        });

        eventBus.on('HEAL_ORB_COLLECT', () => {
            this.player.heal(1);
            this.ui.showMessage('+ Soin', 800);
        });
    }

    // ── Game Over ─────────────────────────────────────────────

    private triggerGameOver(): void {
        this.isGameOver = true;
        if (this.runSound?.isPlaying) this.runSound.stop();
        this.runSound = null;
        this.physics.pause();
        this.orbs.forEach((o) => o.destroy());
        this.orbs = [];

        if (runStats.haineCollected > 0) {
            metaProgress.addHaine(runStats.haineCollected);
        }

        this.ui.showGameOver(
            this.scoreManager,
            this.rng.seed,
            () => this.doRestart(),
            () => this.doReturnToMenu(),
        );
    }

    private doRestart(): void {
        eventBus.clear();
        this.scoreManager.destroy();
        this.roomManager.destroy();
        this.miniMap.destroy();
        this.breakables.destroy();
        runStats.reset();
        metaProgress.resetRun();
        resetMornSession();
        DebugConsoleScene.reset();
        if (this._debugKeyListener) {
            window.removeEventListener('keydown', this._debugKeyListener);
            this._debugKeyListener = null;
        }
        audioManager.stopMusic();
        this.scene.restart();
    }

    private doReturnToMenu(): void {
        eventBus.clear();
        this.scoreManager.destroy();
        this.roomManager.destroy();
        this.miniMap.destroy();
        this.breakables.destroy();
        this.registry.remove('currentSeed');
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TitleScene'));
    }

    // ── Tableau des scores inter-zones ────────────────────────

    private showZoneScoreScreen(): void {
        this.isGameOver = true;
        if (this.runSound?.isPlaying) this.runSound.stop();

        const zone = metaProgress.currentZone;

        this.ui.showZoneScoreScreen(
            this.scoreManager,
            zone,
            zone,
            () => {
                eventBus.clear();
                this.scoreManager.destroy();
                this.roomManager.destroy();
                this.miniMap.destroy();
                this.breakables.destroy();
                runStats.resetZoneStats();
                if (this._debugKeyListener) {
                    window.removeEventListener('keydown', this._debugKeyListener);
                    this._debugKeyListener = null;
                }
                this.scene.restart();
            },
        );
    }
}