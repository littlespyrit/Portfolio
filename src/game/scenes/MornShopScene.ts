import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { runStats } from '../systems/core/RunStats';
import { metaProgress } from '../systems/core/MetaProgress';
import { audioManager } from '../systems/ui/AudioManager';
import { eventBus } from '../systems/core/EventBus';
import dialoguesData from '../data/dialogues.json';
import { DialogueHandler } from '../systems/ui/DialogueHandler';
import type { DialogueLine as DlgLine } from '../systems/ui/DialogueHandler';

const FONT = 'monospace';

// ── Layout box dialogue (Stardew style) ───────────────────────
const BOX_H    = 180;
const BOX_Y    = GAME_HEIGHT - BOX_H;
const BOX_PAD  = 12;
const PORT_W   = 80;
const PORT_H      = BOX_H - BOX_PAD * 2 - 22;
const LABEL_H     = 20;
const LABEL_Y     = BOX_Y + BOX_PAD + PORT_H;
const TRIXX_PORT_X = BOX_PAD;
const MORN_PORT_X  = GAME_WIDTH - BOX_PAD - PORT_W;
const TEXT_X   = TRIXX_PORT_X + PORT_W + 12;
const TEXT_W   = MORN_PORT_X - TEXT_X - 12;

interface DialogueLine {
    speaker: 'morn' | 'trixx';
    text:    string;
}

interface MornOffer {
    id:          string;
    label:       string;
    description: string;
    cost:        number;
    available:   () => boolean;
    action:      () => boolean;
}

let DIALOGUE_LINES: DialogueLine[] = [];
let NEXT_PROMPT: string | null = null;
let lastDialogueZone = -1;

export function resetMornSession(): void {
    lastDialogueZone = -1;
}

/** Force le prochain dialogue à être celui de la zone donnée (debug). */
export function debugSetMornDialogueZone(zone: number): void {
    lastDialogueZone = zone - 1;
}

type DialogueZoneKey = 'zone1' | 'zone2' | 'zone3' | 'zone4';
interface ZoneDialogueData {
    lines:       DialogueLine[];
    nextPrompt?: string | null;
}
type DialoguesJson = Record<DialogueZoneKey, ZoneDialogueData>;

function loadDialoguesForZone(zone: number): void {
    const key     = `zone${Math.min(zone, 4)}` as DialogueZoneKey;
    const zoneData = (dialoguesData as unknown as DialoguesJson)[key];
    if (zoneData) {
        DIALOGUE_LINES = zoneData.lines ?? [];
        NEXT_PROMPT    = zoneData.nextPrompt ?? null;
    } else {
        DIALOGUE_LINES = [];
        NEXT_PROMPT    = null;
    }
}

export class MornShopScene extends Phaser.Scene {
    private dialogueHandler!: DialogueHandler;

    private overlay!: Phaser.GameObjects.Rectangle;

    constructor() { super({ key: 'MornShopScene' }); }

    create(): void {
        audioManager.init(this);
        audioManager.playShopMusic();

        this.dialogueHandler = new DialogueHandler(this);

        const zone = metaProgress.currentZone;
        loadDialoguesForZone(zone);

        if (lastDialogueZone < zone) {
            lastDialogueZone = zone;
        } else {
            DIALOGUE_LINES = [];
        }

        this.startScene();
    }

    private startScene(): void {
        this.overlay = this.add.rectangle(
            GAME_WIDTH / 2, GAME_HEIGHT / 2,
            GAME_WIDTH, GAME_HEIGHT,
            0x000000, 0.45
        ).setDepth(0);

        if (DIALOGUE_LINES.length > 0) {
            this.dialogueHandler.playLines(DIALOGUE_LINES as DlgLine[], () => {
                this.showShop();
            });
        } else {
            this.showShop();
        }
    }

    // ── Box dialogue (Stardew style) ──────────────────────────

    private drawBox(speaker: 'morn' | 'trixx'): Phaser.GameObjects.Graphics {
        const g = this.add.graphics().setDepth(1);

        g.fillStyle(0x0a0010, 0.96);
        g.fillRect(0, BOX_Y, GAME_WIDTH, BOX_H);

        g.lineStyle(2, speaker === 'morn' ? 0xcc2244 : 0xc084fc, 1);
        g.lineBetween(0, BOX_Y, GAME_WIDTH, BOX_Y);

        this.drawPortraitFrames(g, speaker);
        return g;
    }

    private drawPortraitFrames(g: Phaser.GameObjects.Graphics, speaker: 'morn' | 'trixx'): void {
        // ── Trixx (gauche) ────────────────────────────────────
        const trixxActive = speaker === 'trixx';
        g.fillStyle(0x12082a, 1);
        g.fillRect(TRIXX_PORT_X, BOX_Y + BOX_PAD, PORT_W, PORT_H);
        g.lineStyle(2, trixxActive ? 0xc084fc : 0x221133, 1);
        g.strokeRect(TRIXX_PORT_X, BOX_Y + BOX_PAD, PORT_W, PORT_H);
        g.fillStyle(0x0c0520, 1);
        g.fillRect(TRIXX_PORT_X, LABEL_Y, PORT_W, LABEL_H);
        g.lineStyle(1, trixxActive ? 0x8050c0 : 0x1a1030, 1);
        g.strokeRect(TRIXX_PORT_X, LABEL_Y, PORT_W, LABEL_H);

        // ── Morn (droite) ─────────────────────────────────────
        const mornActive = speaker === 'morn';
        g.fillStyle(0x1a0008, 1);
        g.fillRect(MORN_PORT_X, BOX_Y + BOX_PAD, PORT_W, PORT_H);
        g.lineStyle(2, mornActive ? 0xcc2244 : 0x330011, 1);
        g.strokeRect(MORN_PORT_X, BOX_Y + BOX_PAD, PORT_W, PORT_H);
        g.fillStyle(0x180008, 1);
        g.fillRect(MORN_PORT_X, LABEL_Y, PORT_W, LABEL_H);
        g.lineStyle(1, mornActive ? 0x880022 : 0x220010, 1);
        g.strokeRect(MORN_PORT_X, LABEL_Y, PORT_W, LABEL_H);
    }

    private drawBothPortraits(speaker: 'morn' | 'trixx'): void {
        this.drawSinglePortrait('trixx', speaker === 'trixx');
        this.drawSinglePortrait('morn',  speaker === 'morn');
    }

    private drawSinglePortrait(who: 'morn' | 'trixx', active: boolean): void {
        const isMorn = who === 'morn';
        const portX  = isMorn ? MORN_PORT_X : TRIXX_PORT_X;
        const cx     = portX + PORT_W / 2;
        const cy     = BOX_Y + BOX_PAD + PORT_H / 2;
        const alpha  = active ? 1 : 0.28;
        const g      = this.add.graphics().setDepth(2).setAlpha(alpha);

        if (isMorn) {
            g.fillStyle(0x660022, 1);
            g.fillCircle(cx, cy - 4, 22);
            g.lineStyle(2, 0xcc2244, 1);
            g.strokeCircle(cx, cy - 4, 22);
            g.fillStyle(0x330011, 0.8);
            g.fillTriangle(cx - 18, cy - 4, cx + 18, cy - 4, cx, cy - 30);
            g.fillStyle(0xff2244, 1);
            g.fillCircle(cx - 7, cy - 6, 2.5);
            g.fillCircle(cx + 7, cy - 6, 2.5);
        } else {
            g.fillStyle(0x4a2a6a, 1);
            g.fillCircle(cx, cy - 4, 22);
            g.lineStyle(2, 0xc084fc, 1);
            g.strokeCircle(cx, cy - 4, 22);
            g.fillStyle(0x2a1a4a, 0.8);
            g.fillEllipse(cx, cy - 22, 32, 16);
            g.fillStyle(0xe0b0ff, 1);
            g.fillCircle(cx - 7, cy - 6, 2.5);
            g.fillCircle(cx + 7, cy - 6, 2.5);
        }

        const labelColor = active ? (isMorn ? '#cc4444' : '#c084fc') : '#444455';
        this.add.text(cx, LABEL_Y + LABEL_H / 2, isMorn ? 'Morn' : 'Trixx', {
            fontSize: '10px', color: labelColor, fontFamily: FONT, fontStyle: 'italic',
        }).setOrigin(0.5, 0.5).setDepth(3).setAlpha(active ? 1 : 0.35);
    }

    // ── Dialogue ──────────────────────────────────────────────

    // ── Shop ──────────────────────────────────────────────────

    private showShop(): void {
        this.dialogueHandler?.abort();

        // Sécurité : le shop ne doit jamais s'afficher en zone 4
        // (le dialogue de confrontation est géré par MornCinematic directement)
        if (metaProgress.currentZone >= 4) {
            audioManager.stopShopMusic();
            this.scene.stop('MornShopScene');
            this.scene.resume('ArenaScene');
            return;
        }

        // ── Box bas avec portraits (Morn actif, Trixx grisée) ─
        const boxBg = this.add.graphics().setDepth(1);
        boxBg.fillStyle(0x0a0010, 0.96);
        boxBg.fillRect(0, BOX_Y, GAME_WIDTH, BOX_H);
        boxBg.lineStyle(2, 0xcc2244, 1);
        boxBg.lineBetween(0, BOX_Y, GAME_WIDTH, BOX_Y);
        this.drawPortraitFrames(boxBg, 'morn');
        this.drawSinglePortrait('trixx', false);
        this.drawSinglePortrait('morn',  true);

        // ── Panel shop au-dessus de la box ─────────────────────
        const PW = GAME_WIDTH - (TRIXX_PORT_X + PORT_W + BOX_PAD) * 2;
        const PH = BOX_Y - 8;
        const PX = TRIXX_PORT_X + PORT_W + BOX_PAD;
        const PY = 4;

        const bg = this.add.graphics().setDepth(1);
        bg.fillStyle(0x080810, 0.97);
        bg.fillRect(PX, PY, PW, PH);
        bg.lineStyle(1, 0x440022, 1);
        bg.strokeRect(PX, PY, PW, PH);

        this.add.text(GAME_WIDTH / 2, PY + 10, '✦  MORN  ✦', {
            fontSize: '14px', color: '#cc4444', fontFamily: FONT, fontStyle: 'bold', letterSpacing: 6,
        }).setOrigin(0.5, 0).setDepth(2);

        const haine = runStats.haineCollected;
        this.add.text(GAME_WIDTH / 2, PY + 32, `Haine disponible : ${haine}`, {
            fontSize: '12px', color: '#aa3333', fontFamily: FONT,
        }).setOrigin(0.5, 0).setDepth(2);

        this.drawOffers(this.buildOffers(), haine, PX, PY, PW);

        this.drawShopFooter(PX, PY, PW, PH);

        this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).once('down', () => this.close());
    }

    private buildOffers(): MornOffer[] {
        return [
            {
                id: 'dagger',
                label: 'Dagues de Trixx',
                description: metaProgress.daggerUnlocked
                    ? 'Déjà débloqué — Clic droit pour lancer une dague'
                    : 'Débloque le lancer de dagues (clic droit).',
                cost: 1, available: () => !metaProgress.daggerUnlocked,
                action: () => metaProgress.buyDaggerUnlock(),
            },
            {
                id: 'poison',
                label: 'Poison de lame',
                description: metaProgress.poisonUnlocked
                    ? 'Déjà débloqué — Chaque coup empoisonne'
                    : 'Chaque coup inflige un poison (DOT 5s).',
                cost: 1, available: () => !metaProgress.poisonUnlocked,
                action: () => metaProgress.buyPoisonUnlock(),
            },
            {
                id: 'hp',
                label: '+2 PV max',
                description: `Ce run — Total actuel : +${metaProgress.mornMaxHpBonus}`,
                cost: 1, available: () => true,
                action: () => metaProgress.buyMaxHpUpgrade(),
            },
        ];
    }

    private drawOffers(offers: MornOffer[], haineAvail: number, PX: number, PY: number, PW: number): void {
        const CARD_H = 54;
        const CARD_W = PW - 80;
        const CARD_X = PX + 72;
        const START_Y = PY + 62;

        offers.forEach((offer, i) => {
            const cardY   = START_Y + i * (CARD_H + 6);
            const isAvail = offer.available();
            const canBuy  = isAvail && haineAvail >= offer.cost;
            const bought  = !isAvail;

            const bg = this.add.graphics().setDepth(2);
            bg.fillStyle(bought ? 0x080808 : canBuy ? 0x180808 : 0x0c0808, 1);
            bg.fillRect(CARD_X, cardY, CARD_W, CARD_H);
            if (canBuy) {
                bg.lineStyle(1, 0x662222, 1);
                bg.strokeRect(CARD_X, cardY, CARD_W, CARD_H);
            }

            const costColor = bought ? '#334433' : canBuy ? '#ff4444' : '#443333';
            this.add.text(CARD_X + 20, cardY + CARD_H / 2,
                bought ? '✓' : `${offer.cost}♦`,
                { fontSize: '14px', color: costColor, fontFamily: FONT, fontStyle: 'bold' }
            ).setOrigin(0.5).setDepth(3);

            const sg = this.add.graphics().setDepth(3);
            sg.lineStyle(1, 0x1a1a2a, 1);
            sg.lineBetween(CARD_X + 38, cardY + 8, CARD_X + 38, cardY + CARD_H - 8);

            this.add.text(CARD_X + 50, cardY + 10, offer.label, {
                fontSize: '12px',
                color: bought ? '#555555' : canBuy ? '#ffffff' : '#665555',
                fontFamily: FONT, fontStyle: canBuy ? 'bold' : 'normal',
            }).setDepth(3);

            this.add.text(CARD_X + 50, cardY + 28, offer.description, {
                fontSize: '10px',
                color: bought ? '#444444' : canBuy ? '#999999' : '#554444',
                fontFamily: FONT,
            }).setDepth(3);

            if (canBuy) {
                const btn = this.add.text(CARD_X + CARD_W - 10, cardY + CARD_H / 2, '[Acheter]', {
                    fontSize: '11px', color: '#cc3333', fontFamily: FONT,
                }).setOrigin(1, 0.5).setDepth(4).setInteractive({ useHandCursor: true });
                btn.on('pointerover', () => btn.setColor('#ff5555'));
                btn.on('pointerout',  () => btn.setColor('#cc3333'));
                btn.once('pointerdown', () => {
                    const success = offer.action();
                    if (success) {
                        runStats.spendHaine(offer.cost);
                        audioManager.playSfx('sfx_powerup', 0.4);
                        DIALOGUE_LINES = [];
                        this.dialogueHandler.abort();
                        this.children.removeAll(true);
                        this.startScene();
                    }
                });
            }
        });
    }

    private drawShopFooter(PX: number, PY: number, PW: number, PH: number): void {
        const CX   = GAME_WIDTH / 2;
        const botY = PY + PH - 52;
        const zone = metaProgress.currentZone;

        const sg = this.add.graphics().setDepth(2);
        sg.lineStyle(1, 0x221111, 1);
        sg.lineBetween(PX + 16, botY - 6, PX + PW - 16, botY - 6);

        if (zone < 4) {
            const nextLabel = `→  Continuer vers la zone ${zone + 1}`;
            const teleBtn = this.add.text(CX, botY + 6, nextLabel, {
                fontSize: '13px', color: '#cc3333', fontFamily: FONT, fontStyle: 'bold',
            }).setOrigin(0.5, 0).setDepth(4).setInteractive({ useHandCursor: true });
            teleBtn.on('pointerover', () => teleBtn.setColor('#ff5555'));
            teleBtn.on('pointerout',  () => teleBtn.setColor('#cc3333'));
            teleBtn.once('pointerdown', () => this.proposeNextZone());
        }

        const leaveBtn = this.add.text(CX, botY + (zone < 4 ? 30 : 12), '[Rester dans ce donjon]', {
            fontSize: '10px', color: '#444455', fontFamily: FONT,
        }).setOrigin(0.5, 0).setDepth(4).setInteractive({ useHandCursor: true });
        leaveBtn.on('pointerover', () => leaveBtn.setColor('#888899'));
        leaveBtn.on('pointerout',  () => leaveBtn.setColor('#444455'));
        leaveBtn.once('pointerdown', () => this.close());
    }

    // ── Zone suivante ─────────────────────────────────────────

    private proposeNextZone(): void {
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT / 2 - 40;

        const ov = this.add.rectangle(cx, cy, 480, 110, 0x0a0010, 0.97).setDepth(20);
        const g  = this.add.graphics().setDepth(20);
        g.lineStyle(1, 0x550000, 1);
        g.strokeRect(cx - 240, cy - 55, 480, 110);

        const msg = NEXT_PROMPT ? `${NEXT_PROMPT}` : '"Je connais le chemin. Tu me suis ?"';
        this.add.text(cx, cy - 36, msg, {
            fontSize: '12px', color: '#cc4444', fontFamily: FONT, fontStyle: 'italic',
        }).setOrigin(0.5).setDepth(21);

        const oui = this.add.text(cx - 50, cy - 10, '[Oui]', {
            fontSize: '14px', color: '#88ff88', fontFamily: FONT,
        }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });
        const non = this.add.text(cx + 50, cy - 10, '[Non]', {
            fontSize: '14px', color: '#888888', fontFamily: FONT,
        }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });

        oui.on('pointerover', () => oui.setColor('#aaffaa'));
        oui.on('pointerout',  () => oui.setColor('#88ff88'));
        non.on('pointerover', () => non.setColor('#aaaaaa'));
        non.on('pointerout',  () => non.setColor('#888888'));

        oui.once('pointerdown', () => {
            [ov, g, oui, non].forEach(o => o.destroy());
            metaProgress.advanceZone();
            this.close(true);
        });
        non.once('pointerdown', () => {
            [ov, g, oui, non].forEach(o => o.destroy());
        });
    }

    // ── Close ─────────────────────────────────────────────────

    private close(goToNextBoss: boolean = false): void {
        audioManager.stopShopMusic();
        this.scene.stop('MornShopScene');
        this.scene.resume('ArenaScene');
        if (goToNextBoss) {
            eventBus.emit('MORN_TELEPORT_NEXT_BOSS', {});
        }
    }
}