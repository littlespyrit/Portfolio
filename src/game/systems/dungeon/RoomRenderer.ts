import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ARENA } from '../../config/gameConfig';
import { eventBus } from '../core/EventBus';
import { runStats } from '../core/RunStats';
import { audioManager } from '../ui/AudioManager';
import type { RoomNode, Direction } from '../../types';
import type { DungeonGraph } from './DungeonGraph';

const DOOR_SIZE  = 40;
const DOOR_THICK = 14;
const DOOR_DRAW: Record<Direction, { x: number; y: number; w: number; h: number }> = {
    north: { x: GAME_WIDTH / 2 - DOOR_SIZE / 2, y: ARENA.MARGIN,                             w: DOOR_SIZE, h: DOOR_THICK },
    south: { x: GAME_WIDTH / 2 - DOOR_SIZE / 2, y: GAME_HEIGHT - ARENA.MARGIN - DOOR_THICK,  w: DOOR_SIZE, h: DOOR_THICK },
    east:  { x: GAME_WIDTH - ARENA.MARGIN - DOOR_THICK, y: GAME_HEIGHT / 2 - DOOR_SIZE / 2,  w: DOOR_THICK, h: DOOR_SIZE },
    west:  { x: ARENA.MARGIN,                   y: GAME_HEIGHT / 2 - DOOR_SIZE / 2,           w: DOOR_THICK, h: DOOR_SIZE },
};

export class RoomRenderer {
    private scene:     Phaser.Scene;
    private graph:     DungeonGraph;
    private bgGfx!:    Phaser.GameObjects.Graphics;
    private wallGfx!:  Phaser.GameObjects.Graphics;
    private doorGfx!:  Phaser.GameObjects.Graphics;
    private holeGfx!:  Phaser.GameObjects.Graphics;
    private gerbilGfx!: Phaser.GameObjects.Graphics;
    private gerbilSprite: Phaser.GameObjects.Sprite | null = null;

    public onGetPlayerSprite: (() => unknown) | null = null;
    public onGetCurrentRoomId: (() => number) | null = null;
    public currentRoomId: number = -1;
    public roomExtras: Phaser.GameObjects.GameObject[] = [];

    private holePulseTimer: number = 0;

    constructor(scene: Phaser.Scene, graph: DungeonGraph) {
        this.scene    = scene;
        this.graph    = graph;
        this.bgGfx    = scene.add.graphics().setDepth(0);
        this.wallGfx  = scene.add.graphics().setDepth(1);
        this.doorGfx  = scene.add.graphics().setDepth(2);
        this.holeGfx  = scene.add.graphics().setDepth(3);
        this.gerbilGfx = scene.add.graphics().setDepth(3);
    }

    clearExtras(): void {
        this.holeGfx.clear();
        this.gerbilGfx.clear();
        for (const obj of this.roomExtras) {
            try { (obj as any).destroy(); } catch { }
        }
        this.roomExtras = [];
        if (this.gerbilSprite) { this.gerbilSprite.destroy(); this.gerbilSprite = null; }
    }

    updateHolePulse(delta: number, room: RoomNode): void {
        this.holePulseTimer += delta;
        this.drawHole(room);
    }

    resetHolePulse(): void {
        this.holePulseTimer = 0;
        this.holeGfx.clear();
    }

    destroy(): void {
        this.bgGfx.destroy();
        this.wallGfx.destroy();
        this.doorGfx.destroy();
        this.holeGfx.destroy();
        this.gerbilGfx.destroy();
        if (this.gerbilSprite) { this.gerbilSprite.destroy(); }
        for (const obj of this.roomExtras) { try { (obj as any).destroy(); } catch { } }
    }

    public drawArena(room: RoomNode): void {
        this.bgGfx.clear();
        this.wallGfx.clear();

        this.bgGfx.fillStyle(room.ambientColor);
        this.bgGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        this.bgGfx.lineStyle(1, 0x2c2c4e, 0.35);
        const gs = 60;
        for (let x = ARENA.MARGIN; x <= GAME_WIDTH - ARENA.MARGIN; x += gs)
            this.bgGfx.lineBetween(x, ARENA.MARGIN, x, GAME_HEIGHT - ARENA.MARGIN);
        for (let y = ARENA.MARGIN; y <= GAME_HEIGHT - ARENA.MARGIN; y += gs)
            this.bgGfx.lineBetween(ARENA.MARGIN, y, GAME_WIDTH - ARENA.MARGIN, y);

        this.wallGfx.lineStyle(ARENA.WALL_THICKNESS, room.wallColor, 1);
        this.wallGfx.strokeRect(
            ARENA.MARGIN, ARENA.MARGIN,
            GAME_WIDTH  - ARENA.MARGIN * 2,
            GAME_HEIGHT - ARENA.MARGIN * 2,
        );

        const label = this.roomTypeLabel(room);
        if (label) {
            this.scene.add.text(GAME_WIDTH / 2, ARENA.MARGIN / 2, label, {
                fontSize: '11px', fontFamily: 'monospace',
                color: room.type.startsWith('boss') ? '#ff6666' : '#444466',
            }).setOrigin(0.5).setDepth(2);
        }
    }

    public drawDoors(room: RoomNode, openDoors?: Map<Direction, number>): void {
        this.doorGfx.clear();

        const directions: Direction[] = ['north', 'south', 'east', 'west'];
        for (const dir of directions) {
            if (!room.connections.has(dir)) continue;
            if (room.hiddenConnections.has(dir)) continue;

            const dp       = DOOR_DRAW[dir];
            const isOpen   = openDoors ? openDoors.has(dir) : false;
            const neighborId = room.connections.get(dir)!;
            const neighbor   = this.graph.getRoom(neighborId);

            if (isOpen) {
                this.doorGfx.fillStyle(0x000000, 1);
                this.doorGfx.fillRect(dp.x - 2, dp.y - 2, dp.w + 4, dp.h + 4);

                const glowColor = neighbor?.type === 'boss' || neighbor?.type === 'boss_final'
                    ? 0xff2200
                    : neighbor?.type === 'pre_boss'
                        ? 0xff6600
                        : neighbor?.type === 'npc'
                            ? 0x4488cc
                            : 0xc084fc;
                this.doorGfx.lineStyle(2, glowColor, 0.9);
                this.doorGfx.strokeRect(dp.x, dp.y, dp.w, dp.h);

                this.doorGfx.fillStyle(glowColor, 0.08);
                this.doorGfx.fillRect(dp.x - 6, dp.y - 6, dp.w + 12, dp.h + 12);
            } else {
                this.doorGfx.fillStyle(0x1a0a2a, 1);
                this.doorGfx.fillRect(dp.x, dp.y, dp.w, dp.h);
                this.doorGfx.lineStyle(1, 0x330044, 0.8);
                this.doorGfx.strokeRect(dp.x, dp.y, dp.w, dp.h);
                this.doorGfx.lineStyle(1, 0x330044, 0.5);
                this.doorGfx.lineBetween(dp.x, dp.y, dp.x + dp.w, dp.y + dp.h);
                this.doorGfx.lineBetween(dp.x + dp.w, dp.y, dp.x, dp.y + dp.h);
            }
        }
    }

    public drawHole(room: RoomNode): void {
        this.holeGfx.clear();
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;
        const pulse = 0.6 + 0.4 * Math.sin(this.holePulseTimer / 300);

        this.holeGfx.fillStyle(0x000000, 1);
        this.holeGfx.fillEllipse(cx, cy, 90, 56);

        this.holeGfx.lineStyle(3, 0x880000, pulse);
        this.holeGfx.strokeEllipse(cx, cy, 90, 56);
        this.holeGfx.lineStyle(6, 0x440000, pulse * 0.4);
        this.holeGfx.strokeEllipse(cx, cy, 110, 70);

        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + this.holePulseTimer / 1000;
            const r     = 50 + 5 * Math.sin(this.holePulseTimer / 400 + i);
            const px    = cx + Math.cos(angle) * r * 1.1;
            const py    = cy + Math.sin(angle) * r * 0.6;
            this.holeGfx.fillStyle(0x660000, 0.25 * pulse);
            this.holeGfx.fillCircle(px, py, 5);
        }

    }

    public drawGerbilNpc(): void {
        this.gerbilGfx.clear();
        const gx = GAME_WIDTH  / 2 - 130;
        const gy = GAME_HEIGHT / 2;

        if (this.gerbilSprite) {
            this.gerbilSprite.destroy();
            this.gerbilSprite = null;
        }

        if (this.scene.textures.exists('gerbille')) {
            if (!this.scene.anims.exists('gerbille_idle')) {
                this.scene.anims.create({
                    key:       'gerbille_idle',
                    frames:    this.scene.anims.generateFrameNumbers('gerbille', { start: 0, end: 15 }),
                    frameRate: 8,
                    repeat:    -1,
                });
            }
            this.gerbilSprite = this.scene.add.sprite(gx, gy, 'gerbille')
                .setDepth(3)
                .setScale(1.5);
            this.gerbilSprite.play('gerbille_idle');
            this.roomExtras.push(this.gerbilSprite);
        } else {
            const g = this.gerbilGfx;
            g.fillStyle(0x888888, 1);
            g.fillCircle(gx, gy, 32);
        }

        const tooltip = this.scene.add.text(gx, gy - 58,
            '[G] Parler',
            { fontSize: '10px', color: '#aaffaa', fontFamily: 'monospace' }
        ).setOrigin(0.5, 1).setDepth(4).setAlpha(0);
        this.roomExtras.push(tooltip);

        const INTERACT_DIST = 80;
        const proximityTimer = this.scene.time.addEvent({
            delay: 80,
            loop:  true,
            callback: () => {
                if (!tooltip.active) return;
                const player = this.onGetPlayerSprite?.() as Phaser.GameObjects.Components.Transform | null;
                if (!player) return;
                const dist = Phaser.Math.Distance.Between(player.x, player.y, gx, gy);
                tooltip.setAlpha(dist < INTERACT_DIST ? 1 : 0);
            },
        });
        this.roomExtras.push({ destroy: () => proximityTimer.remove() } as any);

        const gKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.G);
        gKey.on('down', () => {
            const curr = this.graph.getRoom(this.onGetCurrentRoomId?.() ?? -1);
            if (curr?.type !== 'pre_boss') return;
            if (this.scene.scene.isActive('GerbilShopScene') || this.scene.scene.isPaused('ArenaScene')) return;
            // Vérifier que le joueur est bien à proximité
            const player = this.onGetPlayerSprite?.() as Phaser.GameObjects.Components.Transform | null;
            if (!player) return;
            const dist = Phaser.Math.Distance.Between(player.x, player.y, gx, gy);
            if (dist >= INTERACT_DIST) return;
            this.scene.scene.launch('GerbilShopScene');
            this.scene.scene.pause('ArenaScene');
        });
    }

    public drawMornNpc(): void {
        const mx = GAME_WIDTH  / 2;
        const my = GAME_HEIGHT / 2 - 60;
        const g  = this.scene.add.graphics().setDepth(3);
        g.fillStyle(0x660022, 1);
        g.fillCircle(mx, my, 36);
        g.lineStyle(2, 0xcc2244, 1);
        g.strokeCircle(mx, my, 36);
        this.roomExtras.push(g);

        const lbl = this.scene.add.text(mx, my + 48, 'Morn', {
            fontSize: '12px', color: '#cc4444', fontFamily: 'monospace', fontStyle: 'italic',
        }).setOrigin(0.5, 0).setDepth(3);
        this.roomExtras.push(lbl);

        const tooltip = this.scene.add.text(mx, my - 52, '[F] Parler à Morn', {
            fontSize: '10px', color: '#cc4444', fontFamily: 'monospace',
        }).setOrigin(0.5, 1).setDepth(4).setAlpha(0.5);
        this.roomExtras.push(tooltip);

        const zone = this.scene.add.zone(mx - 40, my - 40, 80, 80)
            .setOrigin(0, 0).setInteractive().setDepth(4);
        this.roomExtras.push(zone);

        zone.on('pointerover', () => tooltip.setAlpha(1));
        zone.on('pointerout',  () => tooltip.setAlpha(0.5));

        const fKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        fKey.on('down', () => {
            const curr = this.graph.getRoom(this.onGetCurrentRoomId?.() ?? -1);
            if (curr?.type !== 'npc') return;
            // Éviter de superposer plusieurs instances de la scène
            if (this.scene.scene.isActive('MornShopScene') || this.scene.scene.isPaused('ArenaScene')) return;
            this.scene.scene.launch('MornShopScene');
            this.scene.scene.pause('ArenaScene');
        });
    }

    public spawnHealOrbCenter(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        const gfx = this.scene.add.graphics().setDepth(4);
        gfx.fillStyle(0x2ecc71, 1);
        gfx.fillCircle(0, 0, 11);
        gfx.lineStyle(2, 0xffffff, 0.9);
        gfx.lineBetween(-6, 0, 6, 0);
        gfx.lineBetween(0, -6, 0, 6);
        gfx.fillStyle(0x2ecc71, 0.18);
        gfx.fillCircle(0, 0, 22);
        gfx.x = cx;
        gfx.y = cy;

        const label = this.scene.add.text(cx, cy - 28, '+ Soin', {
            fontSize: '11px', color: '#2ecc71', fontFamily: 'monospace',
        }).setOrigin(0.5, 1).setDepth(4).setAlpha(0.85);

        // Enregistrer dans roomExtras pour destruction lors du changement de salle
        this.roomExtras.push(gfx);
        this.roomExtras.push(label);

        this.scene.tweens.add({
            targets: gfx,
            y: cy - 7,
            duration: 700,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });

        const COLLECT_DIST = 28;
        const checkTimer = this.scene.time.addEvent({
            delay: 50,
            repeat: 159,
            callback: () => {
                if (!gfx.active || !gfx.scene) return;
                const playerSprite = this.onGetPlayerSprite?.() as
                    Phaser.GameObjects.Components.Transform | null;
                if (!playerSprite) return;
                const dist = Phaser.Math.Distance.Between(
                    gfx.x, gfx.y, playerSprite.x, playerSprite.y,
                );
                if (dist < COLLECT_DIST) {
                    checkTimer.remove();
                    this.scene.tweens.killTweensOf(gfx);
                    gfx.destroy();
                    label.destroy();
                    eventBus.emit('HEAL_ORB_COLLECT', {});
                }
            },
        });

        this.scene.time.delayedCall(8000, () => {
            checkTimer.remove();
            if (gfx.active && gfx.scene) {
                this.scene.tweens.add({
                    targets: [gfx, label],
                    alpha: 0,
                    duration: 600,
                    onComplete: () => { gfx.destroy(); label.destroy(); },
                });
            }
        });
    }



    private roomTypeLabel(room: RoomNode): string {
        switch (room.type) {
            case 'boss':       return 'BOSS';
            case 'boss_final': return 'MORN';
            case 'pre_boss':   return '';
            case 'npc':        return 'PNJ';
            case 'trap':       return '';  // caché intentionnellement
            default:           return '';
        }
    }
}