import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { runStats, EMOTION_DEFS } from '../systems/core/RunStats';
import { metaProgress } from '../systems/core/MetaProgress';
import { debugOverrides } from '../systems/core/DebugOverrides';
import { buffManager } from '../systems/core/BuffManager';
import { audioManager } from '../systems/ui/AudioManager';
import type { EmotionType } from '../systems/core/RunStats';
import type { IArenaScene } from './IArenaScene';

const FONT = 'monospace';

interface ShopOffer {
    id:          string;
    label:       string;
    description: string;
    costEmotion: EmotionType;
    costBase:    number;
    action:      () => void;
}

export class GerbilShopScene extends Phaser.Scene {

    constructor() { super({ key: 'GerbilShopScene' }); }

    create(): void {
        audioManager.init(this);
        audioManager.playShopMusic();

        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.80)
            .setDepth(0);

        const PW = 580;
        const PH = 400;
        const PX = GAME_WIDTH  / 2 - PW / 2;
        const PY = GAME_HEIGHT / 2 - PH / 2;

        this.add.rectangle(PX + PW / 2, PY + PH / 2, PW, PH, 0x0d0d0d).setDepth(1);

        // ── Gerbille sprite ───────────────────────────────────
        const spriteX = PX + 70;
        const spriteY = PY + 120;
        if (this.textures.exists('gerbille')) {
            if (!this.anims.exists('gerbille_idle')) {
                this.anims.create({
                    key:       'gerbille_idle',
                    frames:    this.anims.generateFrameNumbers('gerbille', { start: 0, end: 15 }),
                    frameRate: 8,
                    repeat:    -1,
                });
            }
            this.add.sprite(spriteX, spriteY, 'gerbille')
                .setDepth(2)
                .setScale(1.5)
                .play('gerbille_idle');
        } else {
            const g = this.add.graphics().setDepth(2);
            g.fillStyle(0x888888, 1);
            g.fillCircle(spriteX, spriteY, 38);
        }

        // ── Accroche ──────────────────────────────────────────
        this.add.text(PX + 140, PY + 80,
            'Cette gerbille semble disposée à quelques échanges...\nça pourrait vous être utile.',
            { fontSize: '13px', color: '#999999', fontFamily: FONT, lineSpacing: 4 }
        ).setDepth(2);

        // ── Avertissement haine ────────────────────────────────
        if (metaProgress.haineStored > 0) {
            this.add.text(PX + PW / 2, PY + 18,
                `⚠ Haine accumulée : ${metaProgress.haineStored}  →  prix ×${metaProgress.haineShopPriceMult.toFixed(1)}`,
                { fontSize: '11px', color: '#ff8844', fontFamily: FONT }
            ).setOrigin(0.5, 0).setDepth(2);
        }

        // ── Offres ────────────────────────────────────────────
        const offers = this.buildOffers();
        this.drawOffers(offers, PX + 140, PY + 150, PW - 160);

        // ── Inventaire émotions ────────────────────────────────
        this.drawEmotionInventory(PX + 12, PY + PH - 46, PW - 24);

        // ── Fermer ────────────────────────────────────────────
        this.add.text(PX + PW - 12, PY + PH - 14,
            '[Échap / E]  fermer',
            { fontSize: '11px', color: '#555555', fontFamily: FONT }
        ).setOrigin(1, 1).setDepth(2);

        this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => this.closeShop());
        this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E).on('down', () => this.closeShop());
    }

    // ── Offres ────────────────────────────────────────────────

    private buildOffers(): ShopOffer[] {
        return [
            {
                id: 'heal2', label: '❤  +2 PV',
                description: 'Soin immédiat — restaure 2 PV.',
                costEmotion: 'rage', costBase: 2,
                action: () => { this.getPlayer()?.heal(2); },
            },
            {
                id: 'heal1', label: '❤  +1 PV',
                description: 'Petit soin — restaure 1 PV.',
                costEmotion: 'anxiete', costBase: 1,
                action: () => { this.getPlayer()?.heal(1); },
            },
            {
                id: 'atk', label: '⚔  ATK +50%',
                description: 'Temporaire (30s) — vos dégâts augmentent de 50%.',
                costEmotion: 'peur', costBase: 3,
                action: () => { buffManager.apply('gerbil_attack', 'ATK +50%', 30000); },
            },
            {
                id: 'hp_slot', label: '♥  +1 slot PV',
                description: 'Temporaire (ce run) — augmente vos PV max de 1.',
                costEmotion: 'desespoir', costBase: 2,
                action: () => {
                    buffManager.apply('gerbil_hp', '+1 slot PV', 99999999);
                    this.getPlayer()?.heal(1);
                },
            },
        ];
    }

    private drawOffers(offers: ShopOffer[], ox: number, oy: number, width: number): void {
        const priceMult = debugOverrides.freeShop ? 0 : metaProgress.haineShopPriceMult;

        offers.forEach((offer, i) => {
            const y         = oy + i * 54;
            const cost      = Math.ceil(offer.costBase * priceMult);
            const have      = runStats.stackCount(offer.costEmotion);
            const canAfford = have >= cost;
            const def       = EMOTION_DEFS[offer.costEmotion];

            if (i > 0) {
                const sep = this.add.graphics().setDepth(2);
                sep.lineStyle(1, 0x222222, 1);
                sep.lineBetween(ox, y - 4, ox + width, y - 4);
            }

            this.add.text(ox, y + 2, offer.label, {
                fontSize: '14px',
                color: canAfford ? '#dddddd' : '#555555',
                fontFamily: FONT,
            }).setDepth(3);
            this.add.text(ox, y + 20, offer.description, {
                fontSize: '10px',
                color: canAfford ? '#888888' : '#444444',
                fontFamily: FONT,
            }).setDepth(3);

            const costStr = `${cost} ${def.label}  (${have})`;
            this.add.text(ox + width - (canAfford ? 72 : 0) - 8, y + 6, costStr, {
                fontSize: '12px',
                color: canAfford ? def.colorHex : '#444444',
                fontFamily: FONT,
            }).setOrigin(1, 0).setDepth(3);

            if (canAfford) {
                const btnTxt = this.add.text(ox + width, y + 6, '[Acheter]', {
                    fontSize: '12px', color: '#44cc44', fontFamily: FONT,
                }).setOrigin(1, 0).setDepth(4).setInteractive({ useHandCursor: true });

                btnTxt.on('pointerover', () => btnTxt.setColor('#88ff88'));
                btnTxt.on('pointerout',  () => btnTxt.setColor('#44cc44'));
                btnTxt.once('pointerdown', () => {
                    runStats.consumeStack(offer.costEmotion, cost);
                    offer.action();
                    this.scene.restart();
                });
            }
        });
    }

    // ── Inventaire émotions ───────────────────────────────────

    private drawEmotionInventory(ox: number, oy: number, width: number): void {
        const sep = this.add.graphics().setDepth(2);
        sep.lineStyle(1, 0x222222, 1);
        sep.lineBetween(ox, oy, ox + width, oy);

        this.add.text(ox, oy + 8, 'Émotions :', {
            fontSize: '11px', color: '#555555', fontFamily: FONT,
        }).setDepth(2);

        const types = runStats.absorbedTypes;
        if (types.length === 0) {
            this.add.text(ox + 90, oy + 8, 'aucune', {
                fontSize: '11px', color: '#444444', fontFamily: FONT,
            }).setDepth(2);
            return;
        }

        let xCursor = ox + 90;
        for (const t of types) {
            const n   = runStats.stackCount(t);
            const def = EMOTION_DEFS[t];
            this.add.text(xCursor, oy + 8, `${def.label} ×${n}`, {
                fontSize: '11px', color: def.colorHex, fontFamily: FONT,
            }).setDepth(2);
            xCursor += 90;
        }
    }

    // ── Helpers ───────────────────────────────────────────────

    private closeShop(): void {
        audioManager.stopShopMusic();
        this.scene.stop('GerbilShopScene');
        this.scene.resume('ArenaScene');
    }

    /** Accède au joueur via l'interface typée — plus de cast as any. */
    private getPlayer() {
        const arena = this.scene.get('ArenaScene') as unknown as IArenaScene;
        return arena?.player ?? null;
    }
}