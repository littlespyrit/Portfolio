import * as Phaser from 'phaser';
import { runStats, EMOTION_DEFS, type EmotionType } from '../systems/core/RunStats';
import { eventBus } from '../systems/core/EventBus';

const ORB_LIFETIME_MS = 3500;
const ORB_RADIUS      = 10;
const COLLECT_DIST    = 42;

export class EmotionOrb {
    private scene:     Phaser.Scene;
    private gfx:       Phaser.GameObjects.Graphics;
    private glowGfx:   Phaser.GameObjects.Graphics;
    private type:      EmotionType;
    private color:     number;
    private x:         number;
    private y:         number;

    private age:       number  = 0;
    private collected: boolean = false;
    private dead:      boolean = false;

    private pulseT:    number  = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, type: EmotionType) {
        this.scene = scene;
        this.x     = x;
        this.y     = y;
        this.type  = type;
        this.color = EMOTION_DEFS[type].color;

        this.glowGfx = scene.add.graphics().setDepth(3);
        this.gfx     = scene.add.graphics().setDepth(4);

        this.draw(1);

        scene.tweens.add({
            targets:  { v: 0 },
            v:        1,
            duration: 300,
            ease:     'Back.easeOut',
            onUpdate: (tween) => {
                const s = 0.5 + (tween.getValue() ?? 0) * 0.5;
                this.gfx.setScale(s);
                this.glowGfx.setScale(s);
            },
        });
    }

    // ── Update (appelé par RoomScene chaque frame) ────────────

    update(delta: number, playerX: number, playerY: number): void {
        if (this.dead) return;

        this.age    += delta;
        this.pulseT += delta;

        const lifeRatio = this.age / ORB_LIFETIME_MS;

        const alpha = lifeRatio > 0.6
            ? 1 - ((lifeRatio - 0.6) / 0.4)
            : 1;

        if (this.age >= ORB_LIFETIME_MS) {
            this.destroy();
            return;
        }

        this.draw(Math.max(0.05, alpha));

        const dx   = playerX - this.x;
        const dy   = playerY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < COLLECT_DIST && !this.collected) {
            this.collect();
        }
    }

    get isDead(): boolean { return this.dead; }

    /**
     * Force la collecte de l'orbe sans vérification de distance.
     * Utilisé par BossHandler pendant la cinématique haine pour garantir
     * que l'orbe est bien ramassée même si le joueur n'est pas exactement dessus.
     */
    forceCollect(): void {
        if (this.collected || this.dead) return;
        this.collect();
    }

    // ── Rendu ────────────────────────────────────────────────

    private draw(alpha: number): void {
        const pulse = 1 + Math.sin(this.pulseT * 0.005) * 0.1;

        this.gfx.clear();
        this.glowGfx.clear();

        this.glowGfx.fillStyle(this.color, alpha * 0.18);
        this.glowGfx.fillCircle(this.x, this.y, ORB_RADIUS * 2.2 * pulse);

        this.gfx.fillStyle(this.color, alpha * 0.85);
        this.gfx.fillCircle(this.x, this.y, ORB_RADIUS * pulse);

        this.gfx.fillStyle(0xffffff, alpha * 0.4);
        this.gfx.fillCircle(
            this.x - ORB_RADIUS * 0.28 * pulse,
            this.y - ORB_RADIUS * 0.28 * pulse,
            ORB_RADIUS * 0.35 * pulse,
        );

        this.gfx.lineStyle(1, 0xffffff, alpha * 0.3);
        this.gfx.strokeCircle(this.x, this.y, ORB_RADIUS * pulse);
    }

    // ── Collecte ─────────────────────────────────────────────

    private collect(): void {
        this.collected = true;

        runStats.absorb(this.type);

        eventBus.emit('ORB_COLLECTED', {
            type:     this.type,
            absorbed: EMOTION_DEFS[this.type].absorbed,
            x:        this.x,
            y:        this.y,
        });

        this.scene.tweens.add({
            targets:  { v: 1 },
            v:        0,
            duration: 200,
            ease:     'Power2',
            onUpdate: (tween) => {
                const s = (tween.getValue() ?? 0) as number;
                this.gfx.setScale(s * 1.5);
                this.glowGfx.setScale(s * 2);
            },
            onComplete: () => this.destroy(),
        });
    }

    destroy(): void {
        if (this.dead) return;
        this.dead = true;
        this.gfx.destroy();
        this.glowGfx.destroy();
    }
}