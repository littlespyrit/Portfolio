import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/gameConfig';
import { audioManager } from './AudioManager';
import dialoguesData from '../../data/dialogues.json';

// ── Types ─────────────────────────────────────────────────────

export interface DialogueLine {
    speaker: string;
    text:    string;
}

type DialoguesJson = Record<string, DialogueLine[] | { lines: DialogueLine[]; nextPrompt?: string }>;

// ── Layout (identique à MornShopScene) ────────────────────

const FONT      = 'monospace';
const BOX_H     = 180;
const BOX_Y     = GAME_HEIGHT - BOX_H;
const BOX_PAD   = 12;
const PORT_W    = 80;
const PORT_H    = BOX_H - BOX_PAD * 2 - 22;
const LABEL_H   = 20;
const LABEL_Y   = BOX_Y + BOX_PAD + PORT_H;
const TRIXX_PORT_X = BOX_PAD;
const MORN_PORT_X  = GAME_WIDTH - BOX_PAD - PORT_W;

const CHAR_DELAY_MS   = 28;
const AUTO_ADVANCE_MS = 2400;
const DEPTH           = 35;

// ── Speakers connus ───────────────────────────────────────────

const KNOWN_SPEAKERS = ['trixx', 'morn'] as const;
type KnownSpeaker = typeof KNOWN_SPEAKERS[number];

function isKnown(s: string): s is KnownSpeaker {
    return KNOWN_SPEAKERS.includes(s as KnownSpeaker);
}

const SPEAKER_COLOR: Record<KnownSpeaker, string> = {
    trixx: '#c084fc',
    morn:  '#cc4444',
};

const SPEAKER_LABEL: Record<KnownSpeaker, string> = {
    trixx: 'Trixx',
    morn:  'Morn',
};

const SPEAKER_BORDER: Record<KnownSpeaker, number> = {
    trixx: 0xc084fc,
    morn:  0xcc2244,
};

// ── DialogueHandler ───────────────────────────────────────────

export class DialogueHandler {
    private scene:  Phaser.Scene;
    private active: boolean = false;

    private currentObjs:      (Phaser.GameObjects.GameObject & { destroy: () => void })[] = [];
    private currentTicker:    Phaser.Time.TimerEvent | null = null;
    private currentAutoTimer: Phaser.Time.TimerEvent | null = null;
    private _inputKeyListener:   ((e: KeyboardEvent) => void) | null = null;
    private _inputMouseListener: ((e: MouseEvent) => void) | null = null;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    // ── API publique ──────────────────────────────────────────

    play(key: string, onComplete: () => void, skipInput = false): void {
        const data  = (dialoguesData as unknown as DialoguesJson)[key];
        if (!data) { onComplete(); return; }
        const lines: DialogueLine[] = Array.isArray(data)
            ? data
            : (data as { lines: DialogueLine[] }).lines ?? [];
        if (lines.length === 0) { onComplete(); return; }
        this.active = true;
        this.playLine(lines, 0, onComplete, skipInput);
    }

    playLines(lines: DialogueLine[], onComplete: () => void, skipInput = false): void {
        if (lines.length === 0) { onComplete(); return; }
        this.active = true;
        this.playLine(lines, 0, onComplete, skipInput);
    }

    abort(): void {
        this.clearCurrent();
        this.active = false;
    }

    get isActive(): boolean { return this.active; }

    // ── Affichage d'une ligne ─────────────────────────────────

    private playLine(
        lines:      DialogueLine[],
        idx:        number,
        onComplete: () => void,
        skipInput:  boolean,
    ): void {
        if (idx >= lines.length) {
            this.clearCurrent();
            this.active = false;
            onComplete();
            return;
        }

        this.clearCurrent();

        const line    = lines[idx];
        const speaker = line.speaker.toLowerCase();

        const speakerIsKnown = isKnown(speaker);
        const isDuo = lines.some(l => l.speaker.toLowerCase() !== speaker);

        this.buildBox(speaker, isDuo);

        const textX = TRIXX_PORT_X + PORT_W + 12;
        const textW = isDuo ? MORN_PORT_X - textX - 12 : GAME_WIDTH - textX - 16;

        const textT = this.scene.add.text(textX, BOX_Y + BOX_PAD + 10, '', {
            fontSize: '13px', color: '#ddeedd', fontFamily: FONT,
            wordWrap: { width: textW },
            lineSpacing: 4,
        }).setDepth(DEPTH + 1);
        this.currentObjs.push(textT);

        const arrow = this.scene.add.text(
            GAME_WIDTH - BOX_PAD - 4, BOX_Y + BOX_H - BOX_PAD - 2, '▼',
            { fontSize: '12px', color: '#666677', fontFamily: FONT },
        ).setOrigin(1, 1).setDepth(DEPTH + 1).setAlpha(0);
        this.scene.tweens.add({ targets: arrow, y: arrow.y + 4, duration: 500, yoyo: true, repeat: -1 });
        this.currentObjs.push(arrow);

        const hint = this.scene.add.text(
            GAME_WIDTH - BOX_PAD - 20, BOX_Y + BOX_H - BOX_PAD - 2, '[Espace]',
            { fontSize: '10px', color: '#333344', fontFamily: FONT },
        ).setOrigin(1, 1).setDepth(DEPTH + 1);
        this.currentObjs.push(hint);

        const full    = line.text;
        let   charIdx = 0;
        let   done    = false;

        const advance = () => {
            if (!done) {
                charIdx = full.length;
                textT.setText(full);
                this.currentTicker?.remove();
                this.currentTicker = null;
                done = true;
                this.scene.tweens.add({ targets: arrow, alpha: 1, duration: 180 });
                return;
            }
            this.clearAutoTimer();
            this.playLine(lines, idx + 1, onComplete, skipInput);
        };

        this.currentTicker = this.scene.time.addEvent({
            delay: CHAR_DELAY_MS,
            loop:  true,
            callback: () => {
                charIdx = Math.min(charIdx + 1, full.length);
                textT.setText(full.slice(0, charIdx));
                const ch = full[charIdx - 1];
                if (ch && /[a-zA-ZÀ-ÿ]/.test(ch) && charIdx % 2 === 0) {
                    audioManager.playSfx(
                        speaker === 'morn' ? 'sfx_morn' : 'sfx_trixx',
                        speaker === 'morn' ? 3.0 : 0.4,
                    );
                }
                if (charIdx >= full.length && !done) {
                    done = true;
                    this.currentTicker?.remove();
                    this.currentTicker = null;
                    this.scene.tweens.add({ targets: arrow, alpha: 1, duration: 180 });
                }
            },
        });

        if (!skipInput) {

            const onNativeKey = (e: KeyboardEvent) => {
                if (e.code === 'Space' || e.code === 'KeyE') {
                    e.preventDefault();
                    advance();
                }
            };
            const onNativeMouse = (e: MouseEvent) => {
                if (e.button === 0) advance();
            };

            window.addEventListener('keydown', onNativeKey);
            window.addEventListener('mousedown', onNativeMouse);

            this._inputKeyListener   = onNativeKey;
            this._inputMouseListener = onNativeMouse;
        }
    }

    // ── Construction de la box avec portraits ─────────────────

    private buildBox(speaker: string, isDuo: boolean): void {
        const speakerIsKnown = isKnown(speaker);
        const borderColor    = speakerIsKnown ? SPEAKER_BORDER[speaker as KnownSpeaker] : 0xc084fc;

        const box = this.scene.add.graphics().setDepth(DEPTH);
        box.fillStyle(0x0a0010, 0.96);
        box.fillRect(0, BOX_Y, GAME_WIDTH, BOX_H);
        box.lineStyle(2, borderColor, 1);
        box.lineBetween(0, BOX_Y, GAME_WIDTH, BOX_Y);
        this.currentObjs.push(box);

        if (!isDuo) {
            if (speakerIsKnown) {
                this.buildPortrait(speaker as KnownSpeaker, true, false);
            }
            return;
        }

        const frameBg = this.scene.add.graphics().setDepth(DEPTH);
        this.drawPortraitFrames(frameBg, speaker);
        this.currentObjs.push(frameBg);

        this.buildPortrait('trixx', speaker === 'trixx', true);
        this.buildPortrait('morn',  speaker === 'morn',  true);
    }

    private drawPortraitFrames(g: Phaser.GameObjects.Graphics, speaker: string): void {
        const trixxActive = speaker === 'trixx';
        const mornActive  = speaker === 'morn';

        g.fillStyle(0x12082a, 1);
        g.fillRect(TRIXX_PORT_X, BOX_Y + BOX_PAD, PORT_W, PORT_H);
        g.lineStyle(2, trixxActive ? 0xc084fc : 0x221133, 1);
        g.strokeRect(TRIXX_PORT_X, BOX_Y + BOX_PAD, PORT_W, PORT_H);
        g.fillStyle(0x0c0520, 1);
        g.fillRect(TRIXX_PORT_X, LABEL_Y, PORT_W, LABEL_H);
        g.lineStyle(1, trixxActive ? 0x8050c0 : 0x1a1030, 1);
        g.strokeRect(TRIXX_PORT_X, LABEL_Y, PORT_W, LABEL_H);

        g.fillStyle(0x1a0008, 1);
        g.fillRect(MORN_PORT_X, BOX_Y + BOX_PAD, PORT_W, PORT_H);
        g.lineStyle(2, mornActive ? 0xcc2244 : 0x330011, 1);
        g.strokeRect(MORN_PORT_X, BOX_Y + BOX_PAD, PORT_W, PORT_H);
        g.fillStyle(0x180008, 1);
        g.fillRect(MORN_PORT_X, LABEL_Y, PORT_W, LABEL_H);
        g.lineStyle(1, mornActive ? 0x880022 : 0x220010, 1);
        g.strokeRect(MORN_PORT_X, LABEL_Y, PORT_W, LABEL_H);
    }

    /**
     * Dessine le contenu d'un portrait (illustration + label nom).
     * @param who      Quel personnage
     * @param active   Portrait lumineux (true) ou grisé (false)
     * @param withFrame Si true, suppose que les cadres existent déjà (duo).
     *                  Si false (solo), dessine aussi le cadre.
     */
    private buildPortrait(who: KnownSpeaker, active: boolean, withFrame: boolean): void {
        const isMorn = who === 'morn';
        const portX  = isMorn ? MORN_PORT_X : TRIXX_PORT_X;
        const cx     = portX + PORT_W / 2;
        const cy     = BOX_Y + BOX_PAD + PORT_H / 2;
        const alpha  = active ? 1 : 0.28;

        if (!withFrame) {
            const frame = this.scene.add.graphics().setDepth(DEPTH);
            frame.fillStyle(isMorn ? 0x1a0008 : 0x12082a, 1);
            frame.fillRect(portX, BOX_Y + BOX_PAD, PORT_W, PORT_H);
            frame.lineStyle(2, isMorn ? 0xcc2244 : 0xc084fc, 1);
            frame.strokeRect(portX, BOX_Y + BOX_PAD, PORT_W, PORT_H);
            frame.fillStyle(isMorn ? 0x180008 : 0x0c0520, 1);
            frame.fillRect(portX, LABEL_Y, PORT_W, LABEL_H);
            frame.lineStyle(1, isMorn ? 0x880022 : 0x8050c0, 1);
            frame.strokeRect(portX, LABEL_Y, PORT_W, LABEL_H);
            this.currentObjs.push(frame);
        }

        const g = this.scene.add.graphics().setDepth(DEPTH + 1).setAlpha(alpha);
        this.currentObjs.push(g);

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
        const labelT = this.scene.add.text(
            cx, LABEL_Y + LABEL_H / 2,
            isMorn ? 'Morn' : 'Trixx',
            { fontSize: '10px', color: labelColor, fontFamily: FONT, fontStyle: 'italic' },
        ).setOrigin(0.5, 0.5).setDepth(DEPTH + 2).setAlpha(active ? 1 : 0.35);
        this.currentObjs.push(labelT);
    }

    // ── Auto advance ──────────────────────────────────────────

    private scheduleAutoAdvance(
        lines:      DialogueLine[],
        idx:        number,
        onComplete: () => void,
        skipInput:  boolean,
        arrow:      Phaser.GameObjects.Text,
    ): void {
        this.scene.tweens.add({
            targets: arrow, alpha: 0.3,
            duration: AUTO_ADVANCE_MS * 0.8,
        });
        this.currentAutoTimer = this.scene.time.delayedCall(AUTO_ADVANCE_MS, () => {
            this.playLine(lines, idx + 1, onComplete, skipInput);
        });
    }

    // ── Cleanup ───────────────────────────────────────────────

    private clearCurrent(): void {
        this.currentTicker?.remove();
        this.currentTicker = null;
        this.clearAutoTimer();
        for (const o of this.currentObjs) {
            try { o.destroy(); } catch { }
        }
        this.currentObjs = [];
        if (this._inputKeyListener) {
            window.removeEventListener('keydown', this._inputKeyListener);
            this._inputKeyListener = null;
        }
        if (this._inputMouseListener) {
            window.removeEventListener('mousedown', this._inputMouseListener);
            this._inputMouseListener = null;
        }
    }

    private clearAutoTimer(): void {
        if (this.currentAutoTimer) {
            this.currentAutoTimer.remove();
            this.currentAutoTimer = null;
        }
    }
}