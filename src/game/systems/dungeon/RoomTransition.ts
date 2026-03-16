import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/gameConfig';
import { eventBus } from '../core/EventBus';
import { DialogueHandler } from '../ui/DialogueHandler';
import type { DungeonGraph } from './DungeonGraph';
import type { EnemyManager } from '../combat/EnemyManager';
import type { BreakableManager } from '../../entities/Breakable';
import type { Direction, GameEvent } from '../../types';

export class RoomTransition {
    private scene:          Phaser.Scene;
    private graph:          DungeonGraph;
    private enemyManager:   EnemyManager;
    private breakables:     BreakableManager;
    private dialogueHandler: DialogueHandler;

    public transitioning:   boolean = false;
    public holePending:     boolean = false;
    public bossConfirmPending: boolean = false;

    public onLoadRoom:          ((destId: number) => void) | null = null;
    public onGetPlayerSprite:   (() => unknown) | null = null;
    public onGetCurrentRoomId:  (() => number) | null = null;
    public onSpawnPlayer:       ((x: number, y: number) => void) | null = null;
    public onEnemyKilled:       ((e: GameEvent) => void) | null = null;
    public onEnteredFromDir:    ((dir: Direction | null) => void) | null = null;
    public onReculer:           (() => void) | null = null;
    private _enteredFromDir:    Direction | null = null;

    constructor(
        scene:        Phaser.Scene,
        graph:        DungeonGraph,
        enemyManager: EnemyManager,
        breakables:   BreakableManager,
    ) {
        this.scene          = scene;
        this.graph          = graph;
        this.enemyManager   = enemyManager;
        this.breakables     = breakables;
        this.dialogueHandler = new DialogueHandler(scene);
    }

    public showHoleConfirm(destId: number): void {
        this.holePending = true;

        const player = (this.onGetPlayerSprite?.() as any);
        if (player) player.frozenForCinematic = true;

        if (!this.dialogueHandler) {
            this.dialogueHandler = new DialogueHandler(this.scene);
        }

        this.dialogueHandler.play('hole_confirm', () => {
            this.showHoleChoice(destId);
        });
    }

    public showHoleChoice(destId: number): void {
        const cx   = GAME_WIDTH  / 2;
        const cy   = GAME_HEIGHT / 2;
        const FONT = 'monospace';
        const DEPTH = 36;

        const box = this.scene.add.graphics().setDepth(DEPTH);
        box.fillStyle(0x0a0010, 0.96);
        box.fillRect(cx - 180, cy - 54, 360, 80);
        box.lineStyle(2, 0x880000, 1);
        box.lineBetween(cx - 180, cy - 54, cx + 180, cy - 54);

        const question = this.scene.add.text(cx, cy - 36,
            'Sauter quand même ?',
            { fontSize: '13px', color: '#cc4444', fontFamily: FONT }
        ).setOrigin(0.5).setDepth(DEPTH + 1);

        const btnSauter = this.scene.add.text(cx - 60, cy - 8,
            '[E]  Sauter',
            { fontSize: '13px', color: '#ff4444', fontFamily: FONT, fontStyle: 'bold' }
        ).setOrigin(0.5).setDepth(DEPTH + 1).setInteractive({ useHandCursor: true });

        const btnReculer = this.scene.add.text(cx + 60, cy - 8,
            '[F]  Reculer',
            { fontSize: '13px', color: '#888899', fontFamily: FONT }
        ).setOrigin(0.5).setDepth(DEPTH + 1).setInteractive({ useHandCursor: true });

        btnSauter.on('pointerover', () => btnSauter.setColor('#ff8888'));
        btnSauter.on('pointerout',  () => btnSauter.setColor('#ff4444'));
        btnReculer.on('pointerover', () => btnReculer.setColor('#aaaacc'));
        btnReculer.on('pointerout',  () => btnReculer.setColor('#888899'));

        const allObjs = [box, question, btnSauter, btnReculer];

        const cleanup = () => {
            allObjs.forEach(o => o.destroy());
            // holePending sera remis à false par animateJump une fois la transition terminée
            // Ne pas le remettre à false ici pour éviter un re-déclenchement entre cleanup et animateJump
        };

        const cleanupAndReset = () => {
            allObjs.forEach(o => o.destroy());
            this.holePending = false;
        };

        const player = (this.onGetPlayerSprite?.() as any);

        const kb   = this.scene.input.keyboard!;
        const keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        const keyF = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F);

        const onSauter = () => {
            kb.removeKey(keyE); kb.removeKey(keyF);
            cleanup(); // holePending reste true jusqu'à la fin de la transition
            if (player) player.frozenForCinematic = false;
            this.animateJump(destId);
        };
        const onReculer = () => {
            kb.removeKey(keyE); kb.removeKey(keyF);
            cleanupAndReset(); // holePending remis à false car on annule
            if (player) {
                player.frozenForCinematic = false;
                const body = player.body as Phaser.Physics.Arcade.Body;
                if (body) {
                    body.setVelocity(0, -220);
                    this.scene.time.delayedCall(300, () => { if (body) body.setVelocity(0, 0); });
                }
            }
            this.onReculer?.();
        };

        keyE.once('down', onSauter);
        keyF.once('down', onReculer);
        btnSauter.once('pointerdown', onSauter);
        btnReculer.once('pointerdown', onReculer);
    }

    public showBossConfirm(destId: number): void {
        this.bossConfirmPending = true;
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT / 2;
        const overlay  = this.scene.add.rectangle(cx, cy, 440, 130, 0x000000, 0.88).setDepth(20);
        const border   = this.scene.add.graphics().setDepth(20);
        border.lineStyle(2, 0xff6600, 1);
        border.strokeRect(cx - 220, cy - 65, 440, 130);
        const title    = this.scene.add.text(cx, cy - 28, '⚠  SALLE DU BOSS',
            { fontSize: '20px', color: '#ff6600', fontFamily: 'monospace', fontStyle: 'bold' }
        ).setOrigin(0.5).setDepth(21);
        const subtitle = this.scene.add.text(cx, cy + 4, 'Es-tu prêt(e) à affronter le boss ?',
            { fontSize: '13px', color: '#ccccdd', fontFamily: 'monospace' }
        ).setOrigin(0.5).setDepth(21);
        const hint     = this.scene.add.text(cx, cy + 32, '[E]  Entrer          [F]  Fuir',
            { fontSize: '14px', color: '#888899', fontFamily: 'monospace' }
        ).setOrigin(0.5).setDepth(21);
        const cleanup = () => {
            [overlay, border, title, subtitle, hint].forEach(o => o.destroy());
            this.bossConfirmPending = false;
        };
        const kb   = this.scene.input.keyboard!;
        const keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        const keyF = kb.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        keyE.once('down', () => { kb.removeKey(keyE); kb.removeKey(keyF); cleanup(); this.enterRoom(destId, this.onGetCurrentRoomId?.() ?? -1); });
        keyF.once('down', () => { kb.removeKey(keyE); kb.removeKey(keyF); cleanup(); });
    }

    public animateJump(destId: number): void {
        this.transitioning = true;

        eventBus.emit('PLAYER_JUMP_HOLE', {});

        const playerSprite = (this.onGetPlayerSprite?.() as Phaser.GameObjects.Components.Transform & { setScale: (s: number) => void } | null);

        if (playerSprite) {
            this.scene.tweens.add({
                targets: playerSprite,
                x: GAME_WIDTH / 2,
                y: GAME_HEIGHT / 2,
                scaleX: 0.05,
                scaleY: 0.05,
                duration: 600,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    this.holePending = false; // sûr de remettre ici : transitioning est déjà true
                    this.scene.cameras.main.fadeOut(300, 0, 0, 0);
                    this.scene.cameras.main.once('camerafadeoutcomplete', () => {
                        (playerSprite as any).setScale(1);
                        this.enemyManager.clearAll();
                        this.breakables.clearAll();
                        if (this.onEnemyKilled) {
                            eventBus.off('ENEMY_KILLED', this.onEnemyKilled);
                            this.onEnemyKilled = null;
                        }
                        this._enteredFromDir = null;
                        this.onEnteredFromDir?.(null);
                        this.onLoadRoom?.(destId);
                        if (this.onSpawnPlayer) {
                            this.onSpawnPlayer(GAME_WIDTH / 2, GAME_HEIGHT * 0.72);
                        }
                        this.transitioning = false;
                        this.scene.input.keyboard!.resetKeys();
                        this.scene.cameras.main.fadeIn(400, 0, 0, 0);
                        eventBus.emit('PLAYER_LAND_HOLE', {});
                    });
                },
            });
        } else {
            this.holePending = false;
            this.scene.cameras.main.fadeOut(500, 0, 0, 0);
            this.scene.cameras.main.once('camerafadeoutcomplete', () => {
                this.enemyManager.clearAll();
                this.breakables.clearAll();
                this.onLoadRoom?.(destId);
                this.transitioning = false;
                this.scene.cameras.main.fadeIn(400, 0, 0, 0);
            });
        }
    }

    public enterRoom(destId: number, fromRoomId: number): void {
        if (this.transitioning) return;
        this.transitioning = true;

        if (this.onEnemyKilled) {
            eventBus.off('ENEMY_KILLED', this.onEnemyKilled);
            this.onEnemyKilled = null;
        }

        this.scene.cameras.main.fadeOut(280, 0, 0, 0);
        this.scene.cameras.main.once('camerafadeoutcomplete', () => {
            this.enemyManager.clearAll();
            this.breakables.clearAll();

            const destRoom = this.graph.getRoom(destId);
            this._enteredFromDir = null;
            if (destRoom) {
                destRoom.connections.forEach((neighborId, dir) => {
                    if (neighborId === fromRoomId) { this._enteredFromDir = dir; this.onEnteredFromDir?.(dir); }
                });
            }

            this.onLoadRoom?.(destId);
            this.transitioning = false;
            this.scene.input.keyboard!.resetKeys();
            this.scene.cameras.main.fadeIn(280, 0, 0, 0);
        });
    }

}