import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ARENA } from '../../config/gameConfig';
import { EnemyManager } from '../combat/EnemyManager';
import { eventBus } from '../core/EventBus';
import { DungeonGraph } from './DungeonGraph';
import { runStats } from '../core/RunStats';
import { audioManager } from '../ui/AudioManager';
import { BreakableManager } from '../../entities/Breakable';
import type { RoomNode, Direction, GameEvent } from '../../types';
import { RoomRenderer } from './RoomRenderer';
import { MornCinematic } from './MornCinematic';
import { RoomTransition } from './RoomTransition';
import { debugOverrides } from '../core/DebugOverrides';

// ── Porte ─────────────────────────────────────────────────────

const DOOR_TRIGGER = 60;
const WALL_TRIGGER = 80;

const DOOR_POS: Record<Direction, { x: number; y: number; w: number; h: number }> = {
    north: { x: GAME_WIDTH / 2 - DOOR_TRIGGER / 2, y: 0,                              w: DOOR_TRIGGER, h: WALL_TRIGGER },
    south: { x: GAME_WIDTH / 2 - DOOR_TRIGGER / 2, y: GAME_HEIGHT - WALL_TRIGGER,     w: DOOR_TRIGGER, h: WALL_TRIGGER },
    east:  { x: GAME_WIDTH - WALL_TRIGGER,          y: GAME_HEIGHT / 2 - DOOR_TRIGGER / 2, w: WALL_TRIGGER, h: DOOR_TRIGGER },
    west:  { x: 0,                                  y: GAME_HEIGHT / 2 - DOOR_TRIGGER / 2, w: WALL_TRIGGER, h: DOOR_TRIGGER },
};

// ── RoomManager ───────────────────────────────────────────────

export class RoomManager {
    private scene:           Phaser.Scene;
    private enemyManager:    EnemyManager;
    private breakableManager: BreakableManager;
    private graph:           DungeonGraph;

    private currentRoomId:       number    = -1;
    private enemyCount:          number    = 0;
    private roomCleared:         boolean   = false;
    private transitioning:       boolean   = false;
    private holePending:         boolean   = false;
    private enteredFromDir: Direction | null = null;
    // true = le joueur était près du trou, false = il s'en est éloigné → dialogue peut se rejouer
    private holeWasNear:         boolean   = false;

    private renderer!:    RoomRenderer;
    private mornCinematic!: MornCinematic;
    private transition!:   RoomTransition;

    private openDoors: Map<Direction, number> = new Map();

    private onEnemyKilled: ((e: GameEvent) => void) | null = null;

    public onRoomChanged:  ((roomId: number) => void) | null = null;
    public onSpawnPlayer:  ((x: number, y: number) => void) | null = null;
    public onGetPlayerSprite: (() => unknown) | null = null;

    constructor(scene: Phaser.Scene, enemyManager: EnemyManager, breakableManager: BreakableManager, graph: DungeonGraph) {
        this.scene            = scene;
        this.enemyManager     = enemyManager;
        this.breakableManager = breakableManager;
        this.graph            = graph;

        this.renderer      = new RoomRenderer(scene, graph);
        this.mornCinematic = new MornCinematic(scene);
        this.transition    = new RoomTransition(scene, graph, enemyManager, breakableManager);

        this.mornCinematic.onSetupKillListener = () => this.setupKillListener();
        this.mornCinematic.onSpawnRoomEnemies  = (room, isFirst) => this.spawnRoomEnemies(room, isFirst);
        this.transition.onLoadRoom         = (id) => this.loadRoom(id);
        this.transition.onSpawnPlayer      = (x, y) => this.onSpawnPlayer?.(x, y);
        this.transition.onGetPlayerSprite  = () => this.onGetPlayerSprite?.();
        this.transition.onGetCurrentRoomId = () => this.currentRoomId;
        this.transition.onEnteredFromDir   = (dir) => { this.enteredFromDir = dir; };
        this.renderer.onGetPlayerSprite   = () => this.onGetPlayerSprite?.();
        this.renderer.onGetCurrentRoomId   = () => this.currentRoomId;
    }

    // ── API publique ──────────────────────────────────────────

    /** Charge la salle de départ (start). */
    loadStartRoom(): void {
        this.loadRoom(this.graph.startId);
    }

    /** Téléportation instantanée vers n'importe quelle salle (debug only). */
    debugTeleport(roomId: number): void {
        if (!this.graph.getRoom(roomId)) return;
        this.enemyManager.clearAll();
        this.breakableManager.clearAll();
        if (this.onEnemyKilled) {
            eventBus.off('ENEMY_KILLED', this.onEnemyKilled);
            this.onEnemyKilled = null;
        }
        this.enteredFromDir = null;
        this.scene.cameras.main.fadeOut(200, 0, 0, 0);
        this.scene.cameras.main.once('camerafadeoutcomplete', () => {
            this.loadRoom(roomId);
            this.transitioning = false;
            this.scene.cameras.main.fadeIn(200, 0, 0, 0);
        });
    }

    get roomNumber(): number { return this.currentRoomId; }

    /** Téléporte directement vers une salle (utilisé par Morn). */
    public teleportToRoom(destId: number): void {
        this.enemyManager.clearAll();
        this.breakableManager.clearAll();
        this.enteredFromDir = null;
        this.loadRoom(destId);
        if (this.onSpawnPlayer) {
            this.onSpawnPlayer(GAME_WIDTH / 2, GAME_HEIGHT * 0.72);
        }
    }

    /** Redessine les portes de la salle courante (après révélation NPC door). */
    public refreshDoors(): void {
        const room = this.graph.getRoom(this.currentRoomId);
        if (!room) return;
        room.connections.forEach((neighborId, dir) => {
            if (!room.hiddenConnections.has(dir)) {
                this.openDoors.set(dir, neighborId);
            }
        });
        this.renderer.drawDoors(room, this.openDoors);
    }

    get currentRoom(): RoomNode | undefined {
        return this.graph.getRoom(this.currentRoomId);
    }

    /**
     * Appelé chaque frame par ArenaScene.
     * Vérifie si le joueur touche une porte ouverte.
     * Si la porte mène à un boss depuis une pre_boss → overlay de confirmation.
     */
    update(playerX: number, playerY: number, delta: number = 16): void {
        if (this.transitioning || this.transition?.holePending) return;

        // ── Détection trou pre_boss ────────────────────────────
        const currRoom = this.graph.getRoom(this.currentRoomId);
        if (currRoom?.type === 'pre_boss') {
            // Ne pas afficher le prompt si le boss a déjà été battu
            const bossRoom = this.graph.getRoom(this.graph.finalBossId);
            if (bossRoom?.state !== 'cleared') {
                const cx = GAME_WIDTH  / 2;
                const cy = GAME_HEIGHT / 2;
                const dist = Math.sqrt((playerX - cx) ** 2 + (playerY - cy) ** 2);
                const isNear = dist < 40;

                // Reset : le joueur s'est éloigné suffisamment (> 90px) → peut re-déclencher
                if (!isNear && dist > 90) {
                    this.holeWasNear = false;
                }

                // Déclencher uniquement si le joueur vient d'entrer dans la zone (transition false→true)
                if (isNear && !this.holeWasNear) {
                    this.holeWasNear = true;
                    const bossDestId = this.graph.finalBossId;
                    if (bossDestId >= 0) {
                        this.transition.onReculer = () => {
                            // Forcer le reset de holeWasNear pour qu'il faille vraiment s'éloigner
                            this.holeWasNear = true;
                        };
                        this.transition.showHoleConfirm(bossDestId);
                        return;
                    }
                }
            }
            this.renderer.updateHolePulse(delta, currRoom);
        }

        // ── Détection portes normales ─────────────────────────
        // Ne pas permettre de sortir si la salle n'est pas terminée
        if (!this.roomCleared && !debugOverrides.godMode) return;

        this.openDoors.forEach((destId, dir) => {
            const dp = DOOR_POS[dir];

            if (playerX >= dp.x && playerX <= dp.x + dp.w &&
                playerY >= dp.y && playerY <= dp.y + dp.h) {
                this.transition.enterRoom(destId, this.currentRoomId);
            }
        });
    }

    // ── Chargement de salle ───────────────────────────────────

    private loadRoom(id: number): void {
        this.currentRoomId = id;
        this.renderer.currentRoomId = id;
        this.roomCleared   = false;
        this.openDoors     = new Map();
        this.enemyCount    = 0;
        this.holeWasNear   = false;

        this.renderer.resetHolePulse();
        for (const obj of this.renderer.roomExtras) {
            try { (obj as any).destroy(); } catch { }
        }
        this.renderer.roomExtras = [];

        const room = this.graph.getRoom(id);
        if (!room) return;

        const wasUnvisited = room.state === 'unvisited';
        if (wasUnvisited) room.state = 'active';

        this.graph.ensureContent(id);

        const ax = ARENA.MARGIN + ARENA.WALL_THICKNESS;
        const ay = ARENA.MARGIN + ARENA.WALL_THICKNESS;
        const aw = GAME_WIDTH  - (ARENA.MARGIN + ARENA.WALL_THICKNESS) * 2;
        const ah = GAME_HEIGHT - (ARENA.MARGIN + ARENA.WALL_THICKNESS) * 2;
        if (room.breakables && room.breakables.length > 0) {
            this.breakableManager.loadForRoom(room.breakables, ax, ay, aw, ah);
            if (wasUnvisited) {
                const newOnes = room.breakables.filter(b => !b.broken).length;
                for (let i = 0; i < newOnes; i++) runStats.recordBreakableSpawn();
            }
        } else {
            this.breakableManager.clearAll();
        }

        this.renderer.drawArena(room);

        this.setupRoom(room, wasUnvisited);

        this.onRoomChanged?.(id);
        eventBus.emit('DOOR_ENTER', { roomNumber: id });

        if (this.onSpawnPlayer) {
            if (!this.enteredFromDir) {
                this.onSpawnPlayer(GAME_WIDTH / 2, GAME_HEIGHT * 0.72);
            } else {
                const pos = this.spawnPositionFromDir(this.enteredFromDir);
                this.onSpawnPlayer(pos.x, pos.y);
            }
        }
    }

    private setupRoom(room: RoomNode, isFirstVisit: boolean): void {
        switch (room.type) {
            case 'start':
            case 'empty':
                this.openAllDoors(room);
                this.roomCleared = true;
                break;

            case 'npc':
                this.openAllDoors(room);
                this.roomCleared = true;
                this.renderer.drawMornNpc();
                break;

            case 'trap':
                if (room.state === 'cleared') {
                    this.openAllDoors(room);
                    this.roomCleared = true;
                } else {
                    this.setupKillListener();
                    this.spawnTrapEnemies(room, isFirstVisit);
                    // En godMode : portes ouvertes, sinon fermées jusqu'au clear
                    if (debugOverrides.godMode) this.openVisitedDoors(room);
                }
                break;

            case 'normal':
                if (room.state === 'cleared') {
                    this.openAllDoors(room);
                    this.roomCleared = true;
                } else {
                    this.setupKillListener();
                    this.spawnRoomEnemies(room, isFirstVisit);
                    // En godMode : portes ouvertes, sinon fermées jusqu'au clear
                    if (debugOverrides.godMode) this.openVisitedDoors(room);
                }
                break;

            case 'boss':
                if (room.state === 'cleared') {
                    this.openAllDoors(room);
                    this.roomCleared = true;
                } else {
                    this.setupKillListener();
                    this.spawnRoomEnemies(room, isFirstVisit);
                }
                break;

            case 'boss_final':
                if (room.state === 'cleared') {
                    this.openAllDoors(room);
                    this.roomCleared = true;
                } else {
                    this.mornCinematic.launchMornFinalCinematic(room, isFirstVisit);
                }
                break;

            case 'pre_boss':
                this.openAllDoors(room);
                this.roomCleared = true;

                this.renderer.updateHolePulse(0, room);
                this.renderer.drawGerbilNpc();
                break;
        }

        this.renderer.drawDoors(room, this.openDoors);
    }

    // ── Spawn ─────────────────────────────────────────────────

    private spawnRoomEnemies(room: RoomNode, isFirstVisit: boolean): void {
        if (!room.enemies) return;
        const alive = room.enemies.filter(e => !room.killedIndices.has(e.index));
        this.enemyCount = alive.length;
        if (alive.length === 0) {
            this.clearRoom();
            return;
        }
        const ax = ARENA.MARGIN + ARENA.WALL_THICKNESS;
        const ay = ARENA.MARGIN + ARENA.WALL_THICKNESS;
        const aw = GAME_WIDTH  - (ARENA.MARGIN + ARENA.WALL_THICKNESS) * 2;
        const ah = GAME_HEIGHT - (ARENA.MARGIN + ARENA.WALL_THICKNESS) * 2;

        // Délai pour laisser le fadeIn de transition se terminer
        this.scene.time.delayedCall(500, () => {
            for (const e of alive) {
                const enemy = this.enemyManager.spawnAtReturn(e.enemyId, ax + e.x * aw, ay + e.y * ah, e.index);
                enemy.setAlpha(0);
                (enemy.body as Phaser.Physics.Arcade.Body).enable = false;
                this.scene.tweens.add({
                    targets: enemy, alpha: 1, duration: 350,
                    onComplete: () => {
                        if (enemy.active && !enemy.dead)
                            (enemy.body as Phaser.Physics.Arcade.Body).enable = true;
                    },
                });
                if (isFirstVisit) runStats.recordSpawn();
            }
        });
    }

    private spawnTrapEnemies(room: RoomNode, isFirstVisit: boolean): void {
        if (!room.enemies) return;
        const alive = room.enemies.filter(e => !room.killedIndices.has(e.index));
        this.enemyCount = alive.length;
        if (alive.length === 0) {
            this.clearRoom();
            return;
        }
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;
        const spread = 40;

        // Délai pour les pièges — légèrement plus long pour l'effet de surprise
        this.scene.time.delayedCall(600, () => {
            alive.forEach((e, i) => {
                const angle = (i / alive.length) * Math.PI * 2;
                const enemy = this.enemyManager.spawnAtReturn(e.enemyId,
                    cx + Math.cos(angle) * spread,
                    cy + Math.sin(angle) * spread,
                    e.index,
                );
                enemy.setAlpha(0);
                (enemy.body as Phaser.Physics.Arcade.Body).enable = false;
                this.scene.tweens.add({
                    targets: enemy, alpha: 1, duration: 300, delay: i * 80,
                    onComplete: () => {
                        if (enemy.active && !enemy.dead)
                            (enemy.body as Phaser.Physics.Arcade.Body).enable = true;
                    },
                });
                if (isFirstVisit) runStats.recordSpawn();
            });
        });
    }

    // ── Kill listener ─────────────────────────────────────────

    private setupKillListener(): void {
        if (this.onEnemyKilled) eventBus.off('ENEMY_KILLED', this.onEnemyKilled);

        this.onEnemyKilled = (e) => {
            const room      = this.graph.getRoom(this.currentRoomId);
            const idx       = e.payload?.enemyIndex as number | undefined;
            const isBossAdd = (idx === -99);

            if (room && idx !== undefined && !isBossAdd) {
                room.killedIndices.add(idx);
            }
            runStats.recordKill();

            if (!isBossAdd) {
                this.enemyCount = Math.max(0, this.enemyCount - 1);
            }

            const roomEnemiesAlive = this.enemyManager.getAlive()
                .filter(en => !en.isBossAdd).length;
            if (this.enemyCount <= 0 && roomEnemiesAlive === 0) this.clearRoom();
        };
        eventBus.on('ENEMY_KILLED', this.onEnemyKilled);
    }

    private clearRoom(): void {
        if (this.onEnemyKilled) {
            eventBus.off('ENEMY_KILLED', this.onEnemyKilled);
            this.onEnemyKilled = null;
        }

        const room = this.graph.getRoom(this.currentRoomId);
        if (!room) return;
        room.state   = 'cleared';
        this.roomCleared = true;

        if (room.type === 'boss_final') {
            eventBus.emit('ROOM_CLEAR', { roomNumber: this.currentRoomId });
            return;
        }

        if (room.type === 'boss') {
            this.graph.revealNpcDoor(this.currentRoomId);
        }

        if (room.type === 'normal' || room.type === 'trap') {
            this.renderer.spawnHealOrbCenter();
        }

        this.openAllDoors(room);
        this.renderer.drawDoors(room, this.openDoors);

        eventBus.emit('ROOM_CLEAR', { roomNumber: this.currentRoomId });
    }

    // ── Portes ────────────────────────────────────────────────

    /** Ouvre toutes les portes connectées, sauf hiddenConnections. */
    private openAllDoors(room: RoomNode): void {
        room.connections.forEach((neighborId, dir) => {
            if (!room.hiddenConnections.has(dir)) {
                this.openDoors.set(dir, neighborId);
            }
        });
    }

    /** Ouvre uniquement les portes vers des salles déjà visitées (retour). */
    private openVisitedDoors(room: RoomNode): void {
        room.connections.forEach((neighborId, dir) => {
            if (room.hiddenConnections.has(dir)) return;
            const neighbor = this.graph.getRoom(neighborId);
            if (neighbor && neighbor.state !== 'unvisited') {
                this.openDoors.set(dir, neighborId);
            }
        });
    }

    // ── Helpers ───────────────────────────────────────────────

    private spawnPositionFromDir(dir: Direction): { x: number; y: number } {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;
        const INNER = ARENA.MARGIN + ARENA.WALL_THICKNESS;
        const OFFSET = 30;
        switch (dir) {
            case 'north': return { x: cx, y: INNER + OFFSET };
            case 'south': return { x: cx, y: GAME_HEIGHT - INNER - OFFSET };
            case 'east':  return { x: GAME_WIDTH - INNER - OFFSET, y: cy };
            case 'west':  return { x: INNER + OFFSET, y: cy };
            default:      return { x: cx, y: cy };
        }
    }

    destroy(): void {
        if (this.onEnemyKilled) eventBus.off('ENEMY_KILLED', this.onEnemyKilled);
        this.renderer.destroy();
    }
}