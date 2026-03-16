import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/gameConfig';
import { eventBus } from '../core/EventBus';
import { audioManager } from '../ui/AudioManager';
import { DialogueHandler } from '../ui/DialogueHandler';
import { metaProgress } from '../core/MetaProgress';
import type { RoomNode } from '../../types';

export class MornCinematic {
    private scene:   Phaser.Scene;
    private dialogueHandler: DialogueHandler;

    public onSetupKillListener: (() => void) | null = null;
    public onSpawnRoomEnemies:  ((room: RoomNode, isFirst: boolean) => void) | null = null;

    constructor(scene: Phaser.Scene) {
        this.scene           = scene;
        this.dialogueHandler = new DialogueHandler(scene);
    }

    public launchMornFinalCinematic(room: RoomNode, isFirstVisit: boolean): void {

        const scene  = this.scene as any;
        const cx     = GAME_WIDTH  / 2;
        const cy     = GAME_HEIGHT / 2;
        const player = scene.player;

        player.frozenForCinematic = true;
        (player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

        const mornGfx = scene.add.graphics().setDepth(6);
        const mornX   = cx;
        const mornY   = cy - 80;
        this.drawMornBossPlaceholder(mornGfx, mornX, mornY, 1);

        // ── Phase 1 : Trixx marche vers Morn (~1.5s) via body.reset ──
        const startX  = player.x;
        const startY  = player.y;
        const targetX = mornX - 90;
        const targetY = mornY + 40;
        const WALK_MS = 1500;
        const startTime = Date.now();

        const walk = () => {
            const elapsed = Date.now() - startTime;
            const t = Math.min(elapsed / WALK_MS, 1);
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            const nx = startX + (targetX - startX) * ease;
            const ny = startY + (targetY - startY) * ease;
            (player.body as Phaser.Physics.Arcade.Body).reset(nx, ny);

            if (t < 1) {
                requestAnimationFrame(walk);
            } else {
                // Zone 4 : jouer le dialogue de confrontation directement ici,
                // sans passer par MornShopScene (qui n'existe pas en zone finale)
                if (metaProgress.currentZone >= 4) {
                    this.dialogueHandler.play('zone4', () => {
                        this.launchMornTransformation(scene, mornGfx, mornX, mornY, room, isFirstVisit, player);
                    });
                } else {
                    eventBus.once('MORN_FINAL_DIALOGUE_DONE', () => {
                        scene.scene.resume('ArenaScene');
                        this.launchMornTransformation(scene, mornGfx, mornX, mornY, room, isFirstVisit, player);
                    });
                    eventBus.emit('MORN_START_FINAL_DIALOGUE');
                }
            }
        };
        requestAnimationFrame(walk);
    }

    public launchMornTransformation(
        scene: any,
        mornGfx: Phaser.GameObjects.Graphics,
        mornX: number, mornY: number,
        room: RoomNode, isFirstVisit: boolean,
        player: any,
    ): void {
        const cam = scene.cameras.main;

        // ── Zoom sur Morn pour la transformation ───────────────
        cam.pan(mornX, mornY, 600, 'Sine.easeInOut');
        cam.zoomTo(2.2, 600, 'Sine.easeInOut');
        audioManager.playSfx('sfx_morn', 3.0);

        // Utiliser setTimeout (natif) plutôt que scene.time pour éviter
        // les problèmes liés à l'état pause/resume de Phaser
        setTimeout(() => {
            if (!scene.scene || !scene.add) return; // scène détruite entre-temps
            for (let i = 0; i < 18; i++) {
                const angle = (i / 18) * Math.PI * 2;
                const dist  = 180 + Math.random() * 80;
                const px    = mornX + Math.cos(angle) * dist;
                const py    = mornY + Math.sin(angle) * dist;
                const particle = scene.add.graphics().setDepth(7);
                particle.fillStyle(0x1a1a1a, 1);
                particle.fillCircle(0, 0, 6);
                particle.x = px; particle.y = py;
                scene.tweens.add({
                    targets: particle,
                    x: mornX, y: mornY,
                    duration: 800 + i * 40,
                    ease: 'Sine.easeIn',
                    delay: i * 30,
                    onComplete: () => particle.destroy(),
                });
            }

            let phase = 0;
            const pulseTicker = scene.time.addEvent({
                delay: 16, loop: true,
                callback: () => {
                    phase += 0.15;
                    const scale = 1 + 0.15 * Math.sin(phase);
                    mornGfx.clear();
                    this.drawMornBossPlaceholder(mornGfx, mornX, mornY, scale);
                },
            });

            setTimeout(() => {
                if (!scene.scene) return;
                pulseTicker.remove();
                cam.shake(600, 0.025);
                audioManager.playSfx('sfx_boss_spawn', 1.0);

                const flash = scene.add.rectangle(mornX, mornY, GAME_WIDTH, GAME_HEIGHT, 0xcc0000, 0)
                    .setDepth(15);
                scene.tweens.add({
                    targets: flash, alpha: 0.7, duration: 120,
                    yoyo: true,
                    onComplete: () => {
                        flash.destroy();
                        mornGfx.destroy();

                        // ── Phase 4 : zoom out puis spawn boss ────────
                        cam.zoomTo(1, 500, 'Sine.easeInOut');
                        cam.pan(GAME_WIDTH / 2, GAME_HEIGHT / 2, 500, 'Sine.easeInOut');

                        setTimeout(() => {
                            if (!scene.scene) return;
                            player.frozenForCinematic = false;
                            this.onSetupKillListener?.();
                            this.onSpawnRoomEnemies?.(room, isFirstVisit);
                            audioManager.playSfx('sfx_boss_spawn', 1.0);
                            cam.shake(400, 0.018);
                        }, 500);
                    },
                });
            }, 1400);
        }, 600);
    }



    public drawMornBossPlaceholder(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number): void {
        const r = 34 * scale;
        g.fillStyle(0xcc0000, 0.18);
        g.fillCircle(x, y, r * 1.7);
        g.fillStyle(0x660022, 1);
        g.fillCircle(x, y, r);
        g.lineStyle(3, 0xff0033, 1);
        g.strokeCircle(x, y, r);
        g.fillStyle(0x330011, 0.9);
        g.fillTriangle(x - r * 0.6, y, x + r * 0.6, y, x, y - r * 1.2);
        g.fillStyle(0xff0000, 1);
        g.fillCircle(x - r * 0.3, y - r * 0.15, 4 * scale);
        g.fillCircle(x + r * 0.3, y - r * 0.15, 4 * scale);
        g.lineStyle(2, 0xcc0000, 0.5);
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            g.lineBetween(x + Math.cos(a) * r, y + Math.sin(a) * r,
                x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5);
        }
    }
}