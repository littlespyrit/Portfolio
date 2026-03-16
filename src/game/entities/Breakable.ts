import * as Phaser from 'phaser';
import type { RoomBreakable, BreakableVariant } from '../types';
import type { EmotionType } from '../systems/core/RunStats';

// ── Config visuelle ───────────────────────────────────────────

interface VariantCfg {
    color:       number;
    borderColor: number;
    halfSize:    number;
}

const VARIANT_CFG: Record<BreakableVariant, VariantCfg> = {
    crate:  { color: 0x7a5c1e, borderColor: 0xd4a030, halfSize: 14 },
    barrel: { color: 0x4a2e10, borderColor: 0xb06030, halfSize: 13 },
    urn:    { color: 0x3a2050, borderColor: 0xaa66ee, halfSize: 11 },
};

const DROP_EMOTIONS: EmotionType[] = [
    'rage', 'peur', 'desespoir', 'tristesse', 'envie', 'anxiete', 'rancoeur',
];

// ── Breakable ─────────────────────────────────────────────────

export class Breakable extends Phaser.Physics.Arcade.Sprite {
    public  roomBreakable:     RoomBreakable;
    public  pendingHealDrop:   HealDrop | null    = null;
    public  pendingOrbEmotion: EmotionType | null = null;

    private gfx: Phaser.GameObjects.Graphics;
    private cfg: VariantCfg;

    constructor(scene: Phaser.Scene, x: number, y: number, rb: RoomBreakable) {
        super(scene, x, y, '');
        this.roomBreakable = rb;
        this.cfg           = VARIANT_CFG[rb.variant];

        scene.add.existing(this);
        // ── STATIC body — ne bouge JAMAIS ──────────────────────
        scene.physics.add.existing(this, true);

        const body = this.body as Phaser.Physics.Arcade.StaticBody;
        const h    = this.cfg.halfSize;
        body.setSize(h * 2, h * 2);
        body.reset(x, y);

        this.setVisible(false);

        this.gfx = scene.add.graphics().setDepth(3);
        this.gfx.x = x;
        this.gfx.y = y;
        this.drawLocal();
    }

    // ── Dessin en coordonnées locales (centré sur 0,0) ────────

    private drawLocal(): void {
        this.gfx.clear();
        const { color, borderColor, halfSize: h } = this.cfg;

        switch (this.roomBreakable.variant) {

            case 'crate':
                this.gfx.fillStyle(color, 1);
                this.gfx.lineStyle(3, borderColor, 1);
                this.gfx.fillRect(-h, -h, h * 2, h * 2);
                this.gfx.strokeRect(-h, -h, h * 2, h * 2);
                this.gfx.lineStyle(2, borderColor, 0.7);
                this.gfx.lineBetween(-h + 4, -h + 4, h - 4, h - 4);
                this.gfx.lineBetween(h - 4, -h + 4, -h + 4, h - 4);
                this.gfx.fillStyle(borderColor, 0.5);
                this.gfx.fillCircle(0, 0, 2);
                break;

            case 'barrel':
                this.gfx.fillStyle(color, 1);
                this.gfx.lineStyle(3, borderColor, 1);
                this.gfx.fillEllipse(0, 0, h * 1.4, h * 2.2);
                this.gfx.strokeEllipse(0, 0, h * 1.4, h * 2.2);
                this.gfx.lineStyle(2, borderColor, 0.85);
                this.gfx.lineBetween(-h * 0.55, -h * 0.3, h * 0.55, -h * 0.3);
                this.gfx.lineBetween(-h * 0.55,  h * 0.3, h * 0.55,  h * 0.3);
                break;

            case 'urn':
                this.gfx.fillStyle(color, 1);
                this.gfx.lineStyle(3, borderColor, 1);
                this.gfx.fillTriangle(
                    0,    -h * 1.2,
                    h,     0,
                    -h,     0,
                );
                this.gfx.fillTriangle(
                    -h,     0,
                    h,     0,
                    0,    h * 1.2,
                );
                this.gfx.beginPath();
                this.gfx.moveTo(0, -h * 1.2);
                this.gfx.lineTo(h, 0);
                this.gfx.lineTo(0, h * 1.2);
                this.gfx.lineTo(-h, 0);
                this.gfx.closePath();
                this.gfx.strokePath();
                break;
        }
    }

    // ── Destruction ───────────────────────────────────────────

    public hit(): boolean {
        if (this.roomBreakable.broken) return false;
        this.roomBreakable.broken = true;

        this.spawnDebris();
        this.rollDrop();

        const healDrop   = this.pendingHealDrop;
        const orbEmotion = this.pendingOrbEmotion;
        this.pendingHealDrop   = null;
        this.pendingOrbEmotion = null;

        this.gfx.destroy();
        this.destroy();

        Breakable._lastHealDrop   = healDrop;
        Breakable._lastOrbEmotion = orbEmotion;
        return true;
    }

    static _lastHealDrop:   HealDrop | null    = null;
    static _lastOrbEmotion: EmotionType | null = null;

    private spawnDebris(): void {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
            const speed = 55 + Math.random() * 70;
            const sz    = 2 + Math.random() * 5;
            const d     = this.scene.add.graphics();
            d.fillStyle(this.cfg.color, 1);
            d.fillRect(-sz / 2, -sz / 2, sz, sz);
            d.x = this.x;
            d.y = this.y;
            this.scene.tweens.add({
                targets:    d,
                x:          d.x + Math.cos(angle) * speed * 0.4,
                y:          d.y + Math.sin(angle) * speed * 0.4,
                alpha:      0,
                duration:   260 + Math.random() * 140,
                ease:       'Power2',
                onComplete: () => d.destroy(),
            });
        }
    }

    private rollDrop(): void {
        const roll = Math.random();
        if (roll < 0.25) {
            this.spawnHealDrop();
        } else if (roll < 0.65) {
            this.pendingOrbEmotion = DROP_EMOTIONS[Math.floor(Math.random() * DROP_EMOTIONS.length)];
        }
    }

    private spawnHealDrop(): void {
        const gfx = this.scene.add.graphics().setDepth(3);
        gfx.fillStyle(0x2ecc71, 1);
        gfx.fillCircle(0, 0, 10);
        gfx.lineStyle(2, 0xffffff, 0.9);
        gfx.lineBetween(-5, 0, 5, 0);
        gfx.lineBetween(0, -5, 0, 5);
        gfx.x = this.x;
        gfx.y = this.y;
        this.scene.tweens.add({
            targets: gfx, y: gfx.y - 8, duration: 600,
            ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        });
        this.scene.time.delayedCall(8000, () => {
            if (gfx.active && gfx.scene) gfx.destroy();
        });
        this.pendingHealDrop = gfx as HealDrop;
    }

    destroyBreakable(): void {
        this.gfx?.destroy();
        this.pendingHealDrop   = null;
        this.pendingOrbEmotion = null;
        if (this.active) this.destroy();
    }
}

export interface HealDrop extends Phaser.GameObjects.Graphics {
    isHealDrop: boolean;
}

// ── BreakableManager ─────────────────────────────────────────

export class BreakableManager {
    private scene:       Phaser.Scene;
    public  group:       Phaser.Physics.Arcade.StaticGroup;
    private healDrops:   HealDrop[] = [];
    private pendingOrbs: { emotion: EmotionType; x: number; y: number }[] = [];

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.group = scene.physics.add.staticGroup();
    }

    /**
     * Charge les breakables d'une salle.
     * Ne crée pas les objets déjà cassés (broken === true).
     */
    loadForRoom(
        roomBreakables: RoomBreakable[],
        arenaX: number, arenaY: number,
        arenaW: number, arenaH: number,
    ): void {
        this.clearAll();
        for (const rb of roomBreakables) {
            if (rb.broken) continue;
            const px = arenaX + rb.x * arenaW;
            const py = arenaY + rb.y * arenaH;
            const b  = new Breakable(this.scene, px, py, rb);
            this.group.add(b);
        }
        this.group.refresh();
    }

    /**
     * Détecte si l'arc d'attaque touche un breakable.
     */
    checkAttack(
        playerX: number, playerY: number,
        facingAngle: number, range: number, halfArc: number,
        onBreak?: () => void,
    ): void {
        const children = this.group.getChildren() as Breakable[];
        for (const b of children) {
            if (!b.active || b.roomBreakable.broken) continue;
            const dx   = b.x - playerX;
            const dy   = b.y - playerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > range + 20) continue;
            const angle = Math.atan2(dy, dx);
            let diff    = angle - facingAngle;
            while (diff >  Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            if (Math.abs(diff) <= halfArc && dist <= range + 18) {
                const bx = b.x;
                const by = b.y;
                const broken = b.hit();
                if (broken) {
                    onBreak?.();
                    if (Breakable._lastHealDrop)   this.healDrops.push(Breakable._lastHealDrop);
                    if (Breakable._lastOrbEmotion) this.pendingOrbs.push({ emotion: Breakable._lastOrbEmotion, x: bx, y: by });
                    Breakable._lastHealDrop   = null;
                    Breakable._lastOrbEmotion = null;
                }
            }
        }
    }

    /**
     * Vérifie si un point (projectile) touche un breakable.
     * Retourne true si un breakable a été cassé.
     */
    checkPoint(x: number, y: number, radius: number, onBreak?: () => void): boolean {
        const children = this.group.getChildren() as Breakable[];
        for (const b of children) {
            if (!b.active || b.roomBreakable.broken) continue;
            const dist = Phaser.Math.Distance.Between(x, y, b.x, b.y);
            if (dist <= radius + 16) {
                const bx = b.x;
                const by = b.y;
                const broken = b.hit();
                if (broken) {
                    onBreak?.();
                    if (Breakable._lastHealDrop)   this.healDrops.push(Breakable._lastHealDrop);
                    if (Breakable._lastOrbEmotion) this.pendingOrbs.push({ emotion: Breakable._lastOrbEmotion, x: bx, y: by });
                    Breakable._lastHealDrop   = null;
                    Breakable._lastOrbEmotion = null;
                    return true;
                }
            }
        }
        return false;
    }

    /** Collecte les drops et vérifie la ramasse par le joueur. */
    updateDrops(
        playerX: number, playerY: number,
        onHeal: () => void,
        onOrb:  (emotion: EmotionType, x: number, y: number) => void,
    ): void {
        for (const o of this.pendingOrbs) onOrb(o.emotion, o.x, o.y);
        this.pendingOrbs = [];

        for (let i = this.healDrops.length - 1; i >= 0; i--) {
            const drop = this.healDrops[i];
            if (!drop.active || !drop.scene) { this.healDrops.splice(i, 1); continue; }
            const dist = Phaser.Math.Distance.Between(drop.x, drop.y, playerX, playerY);
            if (dist < 30) {
                drop.destroy();
                this.healDrops.splice(i, 1);
                onHeal();
            }
        }
    }

    clearAll(): void {
        const children = this.group.getChildren().slice() as Breakable[];
        for (const b of children) {
            this.group.remove(b, true, false);
            b.destroyBreakable();
        }
        for (const d of this.healDrops) { try { d.destroy(); } catch { /**/ } }
        this.healDrops   = [];
        this.pendingOrbs = [];
        Breakable._lastHealDrop   = null;
        Breakable._lastOrbEmotion = null;
    }

    destroy(): void { this.clearAll(); }
}