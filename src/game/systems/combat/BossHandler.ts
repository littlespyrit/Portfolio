import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ARENA } from '../../config/gameConfig';
import { EmotionOrb } from '../../entities/EmotionOrb';
import { eventBus } from '../core/EventBus';
import { audioManager } from '../ui/AudioManager';
import { DialogueHandler } from '../ui/DialogueHandler';
import type { Enemy } from '../../entities/Enemy';
import type { Player } from '../../entities/Player';
import type { DungeonGraph } from '../dungeon/DungeonGraph';
import type { RoomManager } from '../dungeon/RoomManager';

export class BossHandler {
    private scene:        Phaser.Scene;
    private player:       Player;
    private dungeonGraph:     DungeonGraph;
    private roomManager:      RoomManager;
    private dialogueHandler:  DialogueHandler;

    /** Référence vers le tableau d'orbes actifs de ArenaScene (partagé, pas cloné). */
    private orbs: EmotionOrb[];

    /** Callback pour afficher un message flash via UIManager. */
    private showMessage: (text: string, ms: number) => void;

    constructor(
        scene:        Phaser.Scene,
        player:       Player,
        dungeonGraph: DungeonGraph,
        roomManager:  RoomManager,
        orbs:         EmotionOrb[],
        showMessage:  (text: string, ms: number) => void,
    ) {
        this.scene            = scene;
        this.player           = player;
        this.dungeonGraph     = dungeonGraph;
        this.roomManager      = roomManager;
        this.orbs             = orbs;
        this.showMessage      = showMessage;
        this.dialogueHandler  = new DialogueHandler(scene);
    }

    // ── Cinématique spawn boss ────────────────────────────────

    triggerBossSpawnCinematic(): void {
        this.scene.time.delayedCall(150, () => {
            const boss = this.scene.children.list
                .find((c): c is Enemy => (c as Enemy).config?.behavior === 'boss' && (c as Enemy).active && !(c as Enemy).dead && !(c as Enemy).dying);
            if (!boss) return;

            audioManager.playSfx('sfx_boss_spawn');
            const cam = this.scene.cameras.main;

            this.player.makeInvincible(5000);
            this.player.frozenForCinematic = true;
            (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

            const targetX = boss.x;
            const targetY = boss.y;
            boss.y = -80;

            cam.pan(targetX, GAME_HEIGHT / 2, 400, 'Sine.easeIn');

            this.scene.tweens.add({
                targets: boss,
                y: targetY,
                duration: 700,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    cam.shake(500, 0.028);
                    for (let i = 0; i < 12; i++) {
                        const angle = (i / 12) * Math.PI * 2;
                        const g = this.scene.add.graphics();
                        g.fillStyle(0xff2200, 1);
                        g.fillCircle(0, 0, 4);
                        g.x = targetX; g.y = targetY + 24;
                        g.setDepth(10);
                        this.scene.tweens.add({
                            targets: g,
                            x: targetX + Math.cos(angle) * (50 + Math.random() * 40),
                            y: targetY + 24 + Math.sin(angle) * 35,
                            alpha: 0, duration: 600,
                            onComplete: () => g.destroy(),
                        });
                    }
                    cam.pan(targetX, targetY, 400, 'Sine.easeOut');
                    cam.zoomTo(2.2, 400, 'Sine.easeOut');
                },
            });

            this.scene.time.delayedCall(1300, () => {
                cam.zoomTo(1, 600, 'Sine.easeInOut');
                cam.pan(GAME_WIDTH / 2, GAME_HEIGHT / 2, 600, 'Sine.easeInOut');
                this.scene.time.delayedCall(650, () => {
                    cam.stopFollow();
                    cam.setScroll(0, 0);
                    cam.setZoom(1);
                    this.player.frozenForCinematic = false;
                });
            });
        });
    }

    // ── Cinématique mort boss ─────────────────────────────────

    triggerBossDeathCinematic(bossX: number, bossY: number, enemy: Enemy): void {
        this.player.frozenForCinematic = true;
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        this.player.makeInvincible(15000);
        const cam = this.scene.cameras.main;

        cam.pan(bossX, bossY, 400, 'Sine.easeOut');
        cam.zoomTo(2.4, 400, 'Sine.easeOut');

        this.scene.time.delayedCall(500, () => {
            const shakeTween = this.scene.tweens.add({
                targets: enemy,
                x: { from: bossX - 5, to: bossX + 5 },
                duration: 65, yoyo: true, repeat: -1,
                ease: 'Linear',
            });

            const spawnParticles = this.scene.time.addEvent({
                delay: 90, repeat: 33,
                callback: () => {
                    for (let i = 0; i < 3; i++) {
                        const g = this.scene.add.graphics();
                        g.fillStyle(0xff2200, 1);
                        g.fillCircle(0, 0, 3 + Math.random() * 6);
                        g.x = bossX + (Math.random() - 0.5) * 55;
                        g.y = bossY + (Math.random() - 0.5) * 55;
                        g.setDepth(15);
                        this.scene.tweens.add({
                            targets: g, alpha: 0,
                            y: g.y - 50 - Math.random() * 60,
                            duration: 800 + Math.random() * 400,
                            onComplete: () => g.destroy(),
                        });
                    }
                },
            });

            this.scene.time.addEvent({
                delay: 500, repeat: 5,
                callback: () => cam.shake(180, 0.007),
            });

            this.scene.time.delayedCall(3000, () => {
                shakeTween.stop();
                spawnParticles.remove();
                enemy.x = bossX;

                const flash = this.scene.add.rectangle(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0).setDepth(20);
                this.scene.tweens.add({
                    targets: flash, alpha: 0.8, duration: 80,
                    yoyo: true, onComplete: () => flash.destroy(),
                });

                cam.shake(800, 0.035);

                for (let i = 0; i < 30; i++) {
                    const angle = (i / 30) * Math.PI * 2;
                    const spd   = 140 + Math.random() * 200;
                    const g = this.scene.add.graphics();
                    g.fillStyle(i % 3 === 0 ? 0xff0000 : 0xff4400, 1);
                    g.fillRect(-5, -5, 10, 10);
                    g.x = bossX; g.y = bossY;
                    g.setDepth(15);
                    this.scene.tweens.add({
                        targets: g,
                        x: bossX + Math.cos(angle) * spd,
                        y: bossY + Math.sin(angle) * spd,
                        alpha: 0, duration: 1000 + Math.random() * 400,
                        onComplete: () => g.destroy(),
                    });
                }

                this.scene.children.list
                    .filter((c): c is Enemy => !!(c as Enemy).isBossAdd && (c as Enemy).active && !(c as Enemy).dead)
                    .forEach(add => {
                        (add.body as Phaser.Physics.Arcade.Body).enable = false;
                        this.scene.tweens.add({ targets: add, alpha: 0, duration: 300,
                            onComplete: () => add.dieNow() });
                    });

                enemy.dieNow();

                eventBus.emit('ENEMY_KILLED', {
                    scoreValue: enemy.config?.scoreValue ?? 0,
                    enemyId:    enemy.config?.id ?? 'boss',
                    enemyIndex: enemy.roomIndex ?? 0,
                    isBoss:     true,
                });

                this.scene.time.delayedCall(500, () => {
                    const isMornBoss = enemy.config?.id === 'morn_boss';
                    cam.zoomTo(1.4, 500, 'Sine.easeInOut');

                    if (isMornBoss) {
                        this.triggerMornDeathItem(bossX, bossY);
                    } else {
                        const orbLandX = bossX;
                        const orbLandY = bossY + 60;
                        const orb = new EmotionOrb(this.scene, bossX, bossY - 30, 'haine');
                        this.orbs.push(orb);
                        this.scene.tweens.add({
                            targets: orb, x: orbLandX, y: orbLandY,
                            duration: 600, ease: 'Bounce.easeOut',
                        });
                        this.scene.time.delayedCall(700, () => {
                            this.triggerHaineCinematic(orbLandX, orbLandY, false);
                        });
                    }
                });
            });
        });
    }

    // ── Drop mort Morn : morceau de tissu ─────────────────────

    private triggerMornDeathItem(bossX: number, bossY: number): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;
        const cam = this.scene.cameras.main;

        const cloth = this.scene.add.graphics().setDepth(8);
        cloth.fillStyle(0x330011, 1);
        cloth.fillTriangle(-12, -8, 12, -8, 0, 10);
        cloth.fillStyle(0x660022, 0.7);
        cloth.fillTriangle(-8, -6, 8, -6, 0, 6);
        cloth.x = bossX;
        cloth.y = bossY;

        this.scene.tweens.add({
            targets: cloth, y: bossY + 50, angle: 15,
            duration: 1200, ease: 'Sine.easeIn',
        });

        this.scene.time.delayedCall(1400, () => {
            cam.zoomTo(1, 500, 'Sine.easeInOut');
            cam.pan(cx, cy, 600, 'Sine.easeInOut');

            this.scene.time.delayedCall(600, () => {
                const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, cloth.x, cloth.y);
                const body  = this.player.body as Phaser.Physics.Arcade.Body;
                body.setVelocity(Math.cos(angle) * 160, Math.sin(angle) * 160);
                this.scene.time.delayedCall(900, () => {
                    body.setVelocity(0, 0);
                    cloth.destroy();
                    this.scene.time.delayedCall(400, () => {
                        this.triggerHaineCinematic(bossX, bossY + 50, true);
                    });
                });
            });
        });
    }

    // ── Cinématique haine ─────────────────────────────────────

    private triggerHaineCinematic(orbX: number, orbY: number, isMornBoss: boolean): void {
        const cam = this.scene.cameras.main;

        if (isMornBoss) {
            cam.zoomTo(1, 400, 'Sine.easeInOut');
            this.scene.time.delayedCall(600, () => {
                cam.pan(GAME_WIDTH / 2, ARENA.MARGIN + 20, 600, 'Sine.easeInOut');
                this.scene.time.delayedCall(800, () => this.spawnMornFinalExit(cam));
            });
            return;
        }

        // ── Phase 1 : zoom sur l'orbe ─────────────────────────
        this.player.frozenForCinematic = true;
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        cam.pan(orbX, orbY, 500, 'Sine.easeInOut');
        cam.zoomTo(1.8, 500, 'Sine.easeInOut');

        // ── Phase 2 : Trixx marche vers l'orbe via body.reset() interpolé ─
        this.scene.time.delayedCall(400, () => {
            const startX    = this.player.x;
            const startY    = this.player.y;
            const WALK_MS   = 800;
            const startTime = Date.now();
            const body      = this.player.body as Phaser.Physics.Arcade.Body;
            let   rafHandle = 0;

            const walk = () => {
                const elapsed = Date.now() - startTime;
                const t       = Math.min(elapsed / WALK_MS, 1);
                const ease    = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                const nx      = startX + (orbX - startX) * ease;
                const ny      = startY + (orbY - startY) * ease;
                body.reset(nx, ny);
                cam.pan(nx, ny, 50, 'Linear');

                if (t < 1) {
                    rafHandle = requestAnimationFrame(walk);
                } else {
                    cancelAnimationFrame(rafHandle);
                    const orbsToCollect = this.orbs.filter(o => !o.isDead);
                    for (const o of orbsToCollect) {
                        o.forceCollect();
                    }
                    body.setVelocity(0, 0);
                    cam.zoomTo(1, 500, 'Sine.easeInOut');
                    cam.pan(this.player.x, this.player.y, 500, 'Sine.easeInOut');

                    this.scene.time.delayedCall(550, () => {
                        cam.stopFollow();
                        cam.setScroll(0, 0);
                        cam.setZoom(1);
                        this.showHaineCollectedMessages(cam);
                    });
                }
            };
            rafHandle = requestAnimationFrame(walk);
        });
    }

    /** Lance le monologue haine de Trixx puis enchaîne sur la suite. */
    private showHaineCollectedMessages(cam: Phaser.Cameras.Scene2D.Camera): void {
        this.dialogueHandler.play('haine_pickup', () => {
            this.afterHaineMonologue(cam);
        });
    }

    /** Suite après le monologue haine — slide caméra + porte Morn. */
    private afterHaineMonologue(cam: Phaser.Cameras.Scene2D.Camera): void {
        cam.zoomTo(1, 400, 'Sine.easeInOut');
        this.scene.time.delayedCall(200, () => {
            cam.pan(GAME_WIDTH/2, ARENA.MARGIN + 20, 600, 'Sine.easeInOut');
        });

        this.scene.time.delayedCall(900, () => {
            this.spawnMornDoorAfterBoss();
            this.scene.time.delayedCall(1200, () => {
                cam.pan(this.player.x, this.player.y, 600, 'Sine.easeInOut');
                this.scene.time.delayedCall(620, () => {
                    cam.stopFollow();
                    cam.setScroll(0, 0);
                    cam.setZoom(1);
                    this.player.frozenForCinematic = false;
                    this.player.makeInvincible(0);
                });
            });
        });
    }

    // ── Porte Morn après boss normal ──────────────────────────

    private spawnMornDoorAfterBoss(): void {
        const currentRoom = this.dungeonGraph.getRoom(this.roomManager.roomNumber);
        if (!currentRoom) return;

        currentRoom.connections.forEach((nId) => {
            const neighbor = this.dungeonGraph.getRoom(nId);
            if (neighbor?.type === 'npc') {
                this.scene.time.delayedCall(2200, () => {
                    eventBus.emit('MORN_DOOR_OPEN', { roomId: nId });
                    this.dungeonGraph.revealNpcDoor(this.roomManager.roomNumber);
                    this.roomManager.refreshDoors();
                });
            }
        });
    }

    // ── Sortie finale (boss Morn vaincu) ──────────────────────

    private spawnMornFinalExit(cam: Phaser.Cameras.Scene2D.Camera): void {
        const exitGfx = this.scene.add.graphics().setDepth(10);
        exitGfx.fillStyle(0xffd080, 0.9);
        exitGfx.fillRect(GAME_WIDTH / 2 - 20, ARENA.MARGIN, 40, 60);
        exitGfx.lineStyle(3, 0xffffff, 1);
        exitGfx.strokeRect(GAME_WIDTH / 2 - 20, ARENA.MARGIN, 40, 60);
        const haloTween = this.scene.tweens.add({
            targets: exitGfx, alpha: 0.6, duration: 400, yoyo: true, repeat: -1,
        });
        cam.pan(GAME_WIDTH / 2, GAME_HEIGHT / 2, 600, 'Sine.easeInOut');
        this.scene.time.delayedCall(700, () => {
            cam.stopFollow(); cam.setScroll(0, 0); cam.setZoom(1);
            this.player.frozenForCinematic = false;
            const endZone = this.scene.add.zone(GAME_WIDTH / 2, ARENA.MARGIN + 30, 60, 60).setOrigin(0.5);
            this.scene.physics.add.existing(endZone, false);
            let endingTriggered = false;
            this.scene.physics.add.overlap(this.player, endZone, () => {
                if (endingTriggered) return;
                endingTriggered = true;
                haloTween.stop();
                this.player.frozenForCinematic = true;
                this.player.setVelocity(0, 0);
                this.scene.time.delayedCall(200, () => {
                    this.scene.cameras.main.fadeOut(800, 0, 0, 0);
                    this.scene.cameras.main.once('camerafadeoutcomplete', () => {
                        this.scene.scene.start('EndingScene');
                    });
                });
            });
        });
    }
}