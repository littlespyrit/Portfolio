import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { ControlsConfig, ControlPreset, type ControlScheme } from '../config/controls';
import { audioManager } from '../systems/ui/AudioManager';
import { eventBus } from '../systems/core/EventBus';

const C = {
    PANEL:        0x12122a,
    BORDER:       0x8e44ad,
    TAB_INACTIVE: 0x1a1a3a,
    TAB_ACTIVE:   0x2a1a4a,
    ROW_ODD:      0x0f0f24,
    ACCENT:       '#c084fc',
    GOLD:         '#f1c40f',
    DIM:          '#888899',
    WHITE:        '#ccccdd',
    SELECTED:     '#a855f7',
    REBIND_BG:    0x1e0033,
    ORANGE:       '#ff9900',
};
const FONT = 'monospace';

const PW = 540;
const PH = 460;
const PX = (GAME_WIDTH  - PW) / 2;
const PY = (GAME_HEIGHT - PH) / 2;
const CX = GAME_WIDTH / 2;
const CY = GAME_HEIGHT / 2;
const TAB_H = 40;

const CT_Y = PY + TAB_H + 1;

const COL_L = PX + 44;
const COL_K = PX + 310;
const COL_B = PX + 430;
const ROW_H = 38;

const ACTIONS: Array<{ key: keyof ControlScheme; label: string }> = [
    { key: 'up',     label: 'Haut'    },
    { key: 'down',   label: 'Bas'     },
    { key: 'left',   label: 'Gauche'  },
    { key: 'right',  label: 'Droite'  },
    { key: 'attack', label: 'Attaque' },
    { key: 'defend', label: 'Roulade' },
    { key: 'parade',   label: 'Parade'        },
    { key: 'charMenu', label: 'Fiche perso'   },
];

type Tab = 'controls' | 'audio';

export class OptionsScene extends Phaser.Scene {
    private activeTab:    Tab = 'controls';
    private listeningFor: keyof ControlScheme | null = null;
    private caller: string = 'TitleScene';

    private tabControls!: Phaser.GameObjects.Container;
    private tabAudio!:    Phaser.GameObjects.Container;

    private tabCtrlBg!:  Phaser.GameObjects.Graphics;
    private tabCtrlTxt!: Phaser.GameObjects.Text;
    private tabAudBg!:   Phaser.GameObjects.Graphics;
    private tabAudTxt!:  Phaser.GameObjects.Text;

    private bindingTexts:  Map<keyof ControlScheme, Phaser.GameObjects.Text> = new Map();
    private presetBtns:    Map<ControlPreset, { bg: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text }> = new Map();

    private listenOverlay!: Phaser.GameObjects.Container;
    private backBtn!:       Phaser.GameObjects.Text;
    private resetBtn!:      Phaser.GameObjects.Text;

    constructor() { super({ key: 'OptionsScene' }); }

    init(data: { caller?: string }): void {
        this.caller = data?.caller ?? 'TitleScene';
    }

    create(): void {
        this.bindingTexts = new Map();
        this.presetBtns   = new Map();
        this.listeningFor = null;
        this.activeTab    = 'controls';

        this.drawBg();
        this.buildTabs();
        this.buildControlsTab();
        this.buildAudioTab();
        this.buildBottomBar();
        this.buildListenOverlay();
        this.setupEscapeKey();

        this.switchTab('controls');
        this.cameras.main.fadeIn(250, 0, 0, 0);
    }

    // ── Fond et panel ─────────────────────────────────────────

    private drawBg(): void {
        this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75);
        const g = this.add.graphics();
        g.fillStyle(C.PANEL, 1);
        g.fillRoundedRect(PX, PY, PW, PH, 10);
        g.lineStyle(2, C.BORDER, 1);
        g.strokeRoundedRect(PX, PY, PW, PH, 10);
    }

    // ── Onglets ───────────────────────────────────────────────

    private buildTabs(): void {
        const TW = PW / 2;

        this.tabCtrlBg = this.add.graphics();
        this.tabCtrlTxt = this.add.text(PX + TW / 2, PY + TAB_H / 2, 'CONTROLES', {
            fontSize: '14px', fontFamily: FONT, color: C.WHITE,
        }).setOrigin(0.5);

        const zCtrl = this.add.zone(PX, PY, TW, TAB_H).setOrigin(0).setInteractive({ useHandCursor: true });
        zCtrl.on('pointerdown', () => this.switchTab('controls'));
        zCtrl.on('pointerover', () => { if (this.activeTab !== 'controls') this.tabCtrlTxt.setColor(C.GOLD); });
        zCtrl.on('pointerout',  () => this.refreshTabStyles());

        this.tabAudBg = this.add.graphics();
        this.tabAudTxt = this.add.text(PX + TW + TW / 2, PY + TAB_H / 2, 'AUDIO', {
            fontSize: '14px', fontFamily: FONT, color: C.WHITE,
        }).setOrigin(0.5);

        const zAud = this.add.zone(PX + TW, PY, TW, TAB_H).setOrigin(0).setInteractive({ useHandCursor: true });
        zAud.on('pointerdown', () => this.switchTab('audio'));
        zAud.on('pointerover', () => { if (this.activeTab !== 'audio') this.tabAudTxt.setColor(C.GOLD); });
        zAud.on('pointerout',  () => this.refreshTabStyles());

        const sep = this.add.graphics();
        sep.lineStyle(1, C.BORDER, 0.3);
        sep.lineBetween(PX, PY + TAB_H, PX + PW, PY + TAB_H);
    }

    private switchTab(tab: Tab): void {
        this.activeTab = tab;
        this.tabControls.setVisible(tab === 'controls');
        this.tabAudio.setVisible(tab === 'audio');
        this.resetBtn.setVisible(tab === 'controls');
        this.refreshTabStyles();
    }

    private refreshTabStyles(): void {
        const TW = PW / 2;

        this.tabCtrlBg.clear();
        this.tabCtrlBg.fillStyle(this.activeTab === 'controls' ? C.TAB_ACTIVE : C.TAB_INACTIVE, 1);
        this.tabCtrlBg.fillRect(PX + 2, PY + 2, TW - 4, TAB_H - 2);
        this.tabCtrlTxt.setColor(this.activeTab === 'controls' ? C.ACCENT : C.WHITE);

        this.tabAudBg.clear();
        this.tabAudBg.fillStyle(this.activeTab === 'audio' ? C.TAB_ACTIVE : C.TAB_INACTIVE, 1);
        this.tabAudBg.fillRect(PX + TW + 2, PY + 2, TW - 4, TAB_H - 2);
        this.tabAudTxt.setColor(this.activeTab === 'audio' ? C.ACCENT : C.WHITE);
    }

    // ── Onglet CONTROLES ─────────────────────────────────────

    private buildControlsTab(): void {
        const items: Phaser.GameObjects.GameObject[] = [];
        let y = CT_Y + 16;

        // ── Preset ────────────────────────────────────────────
        items.push(this.add.text(CX, y, 'DISPOSITION', {
            fontSize: '11px', fontFamily: FONT, color: C.DIM, letterSpacing: 3,
        }).setOrigin(0.5, 0));
        y += 22;

        const presets = [ControlPreset.AZERTY, ControlPreset.QWERTY];
        const BW = 90; const BH = 26; const BGAP = 14;
        const totalW = presets.length * BW + (presets.length - 1) * BGAP;
        const bx0    = CX - totalW / 2;

        presets.forEach((preset, i) => {
            const bx = bx0 + i * (BW + BGAP);
            const bg  = this.add.graphics();
            const txt = this.add.text(bx + BW / 2, y + BH / 2, preset, {
                fontSize: '13px', fontFamily: FONT, color: C.WHITE,
            }).setOrigin(0.5);
            const zone = this.add.zone(bx, y, BW, BH).setOrigin(0).setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => {
                ControlsConfig.setPreset(preset);
                this.refreshPresetBtns();
                this.refreshBindingTexts();
            });
            zone.on('pointerover', () => { if (ControlsConfig.getPreset() !== preset) txt.setColor(C.GOLD); });
            zone.on('pointerout',  () => this.refreshPresetBtns());
            this.presetBtns.set(preset, { bg, txt });
            items.push(bg, txt, zone);
        });
        y += BH + 18;

        // ── En-têtes ──────────────────────────────────────────
        items.push(
            this.add.text(COL_L, y, 'ACTION',  { fontSize: '11px', fontFamily: FONT, color: C.DIM }),
            this.add.text(COL_K, y, 'TOUCHE',  { fontSize: '11px', fontFamily: FONT, color: C.DIM }).setOrigin(0.5, 0),
            this.add.text(COL_B, y, 'MODIFIER',{ fontSize: '11px', fontFamily: FONT, color: C.DIM }).setOrigin(0.5, 0),
        );
        y += 16;
        const sepHdr = this.add.graphics();
        sepHdr.lineStyle(1, 0x2a2a4a, 1);
        sepHdr.lineBetween(PX + 12, y, PX + PW - 12, y);
        items.push(sepHdr);
        y += 8;

        // ── Lignes actions ────────────────────────────────────
        const scheme = ControlsConfig.getCurrentScheme();
        ACTIONS.forEach((action, i) => {
            const ry = y + i * ROW_H;

            if (i % 2 === 0) {
                const rowBg = this.add.graphics();
                rowBg.fillStyle(C.ROW_ODD, 1);
                rowBg.fillRect(PX + 4, ry - 2, PW - 8, ROW_H - 2);
                items.push(rowBg);
            }

            items.push(this.add.text(COL_L, ry + ROW_H / 2 - 8, action.label, {
                fontSize: '14px', fontFamily: FONT, color: C.WHITE,
            }));

            const kbg = this.add.graphics();
            kbg.fillStyle(0x0d0d1e, 1);
            kbg.fillRoundedRect(COL_K - 38, ry + 4, 76, 22, 4);
            kbg.lineStyle(1, 0x3a1a5a, 1);
            kbg.strokeRoundedRect(COL_K - 38, ry + 4, 76, 22, 4);
            items.push(kbg);

            const bindTxt = this.add.text(COL_K, ry + ROW_H / 2 - 7, this.formatKey(scheme[action.key]), {
                fontSize: '13px', fontFamily: FONT, color: C.GOLD,
            }).setOrigin(0.5, 0);
            this.bindingTexts.set(action.key, bindTxt);
            items.push(bindTxt);

            const chgTxt = this.add.text(COL_B, ry + ROW_H / 2 - 7, '[ changer ]', {
                fontSize: '12px', fontFamily: FONT, color: C.DIM,
            }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
            chgTxt.on('pointerover', () => chgTxt.setColor(C.GOLD));
            chgTxt.on('pointerout',  () => chgTxt.setColor(C.DIM));
            chgTxt.on('pointerdown', () => this.startListening(action.key));
            items.push(chgTxt);
        });

        y += ACTIONS.length * ROW_H + 6;

        items.push(this.add.text(COL_L, y + 4, 'Clic droit', { fontSize: '11px', fontFamily: FONT, color: '#444455' }));
        items.push(this.add.text(COL_K, y + 5, '→ Parade aussi', { fontSize: '11px', fontFamily: FONT, color: '#444455' }).setOrigin(0.5, 0));

        this.tabControls = this.add.container(0, 0, items);
        this.refreshPresetBtns();
    }

    private refreshPresetBtns(): void {
        const current = ControlsConfig.getPreset();
        const BW = 90; const BH = 26; const BGAP = 14;
        const totalW = 2 * BW + BGAP;
        const bx0    = CX - totalW / 2;
        const by     = CT_Y + 16 + 22;

        this.presetBtns.forEach(({ bg, txt }, preset) => {
            const i   = preset === ControlPreset.AZERTY ? 0 : 1;
            const bx  = bx0 + i * (BW + BGAP);
            const sel = preset === current;
            bg.clear();
            bg.fillStyle(sel ? 0x3a1a5a : 0x1a1a3a, 1);
            bg.fillRoundedRect(bx, by, BW, BH, 5);
            bg.lineStyle(1, sel ? 0xa855f7 : 0x2a2a4a, 1);
            bg.strokeRoundedRect(bx, by, BW, BH, 5);
            txt.setColor(sel ? C.SELECTED : C.WHITE);
        });
    }

    private refreshBindingTexts(): void {
        const scheme = ControlsConfig.getCurrentScheme();
        this.bindingTexts.forEach((t, k) => t.setText(this.formatKey(scheme[k])));
    }

    private formatKey(key: string | undefined): string {
        if (!key) return '—';
        if (key === '_UNSET_') return '⚠ ???';
        const MAP: Record<string, string> = {
            SPACE: 'Espace', SHIFT: 'Shift', ALT: 'Alt G',
            UP: 'Haut', DOWN: 'Bas', LEFT: 'Gauche', RIGHT: 'Droite',
        };
        return MAP[key.toUpperCase()] ?? key.toUpperCase();
    }

    // ── Onglet AUDIO ─────────────────────────────────────────

    private buildAudioTab(): void {
        const items: Phaser.GameObjects.GameObject[] = [];
        let y = CT_Y + 40;

        items.push(this.add.text(CX, y, 'PARAMETRES AUDIO', {
            fontSize: '15px', fontFamily: FONT, color: C.ACCENT, letterSpacing: 3,
        }).setOrigin(0.5, 0));
        y += 60;

        // ── Musique ───────────────────────────────────────────
        this.buildVolumeRow(items, y, 'Musique',
            () => audioManager.musicVol,
            (v) => audioManager.setMusicVol(v),
        );
        y += 54;

        // ── SFX ───────────────────────────────────────────────
        this.buildVolumeRow(items, y, 'Effets (SFX)',
            () => audioManager.sfxVol,
            (v) => audioManager.setSfxVol(v),
        );
        y += 54;

        // ── Mute ──────────────────────────────────────────────
        y += 10;
        const muteBg = this.add.graphics();
        const muteTxt = this.add.text(CX, y, '', {
            fontSize: '14px', fontFamily: FONT, color: '#44ff88',
        }).setOrigin(0.5);

        const refreshMute = () => {
            const on = !audioManager.muted;
            muteBg.clear();
            muteBg.fillStyle(on ? 0x0a2a0a : 0x2a0a0a, 1);
            muteBg.fillRoundedRect(CX - 120, y - 16, 240, 32, 6);
            muteBg.lineStyle(1, on ? 0x228822 : 0x882222, 1);
            muteBg.strokeRoundedRect(CX - 120, y - 16, 240, 32, 6);
            muteTxt.setText(on ? '🔊  Son activé' : '🔇  Son coupé');
            muteTxt.setColor(on ? '#44ff88' : '#ff4444');
        };
        refreshMute();

        const muteZone = this.add.text(CX, y, '                                        ', {
            fontSize: '14px', fontFamily: FONT, color: '#00000000',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        muteZone.on('pointerdown', () => { audioManager.toggleMute(); refreshMute(); });

        items.push(muteBg, muteTxt, muteZone);

        this.tabAudio = this.add.container(0, 0, items);
    }

    private buildVolumeRow(
        items: Phaser.GameObjects.GameObject[],
        y: number,
        label: string,
        getVol: () => number,
        setVol: (v: number) => void,
    ): void {
        const LBLX = PX + 36;
        const STEP = 0.05;

        items.push(this.add.text(LBLX, y, label, {
            fontSize: '14px', fontFamily: FONT, color: C.WHITE,
        }).setOrigin(0, 0.5));

        const btnMinus = this.add.text(CX - 60, y, '[ − ]', {
            fontSize: '16px', fontFamily: FONT, color: C.DIM,
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const valTxt = this.add.text(CX, y, `${Math.round(getVol() * 100)}%`, {
            fontSize: '15px', fontFamily: FONT, color: C.GOLD,
        }).setOrigin(0.5);

        const btnPlus = this.add.text(CX + 60, y, '[ + ]', {
            fontSize: '16px', fontFamily: FONT, color: C.DIM,
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const update = () => valTxt.setText(`${Math.round(getVol() * 100)}%`);

        btnMinus.on('pointerover',  () => btnMinus.setColor(C.GOLD));
        btnMinus.on('pointerout',   () => btnMinus.setColor(C.DIM));
        btnMinus.on('pointerdown',  () => { setVol(Math.max(0, getVol() - STEP)); update(); });

        btnPlus.on('pointerover',   () => btnPlus.setColor(C.GOLD));
        btnPlus.on('pointerout',    () => btnPlus.setColor(C.DIM));
        btnPlus.on('pointerdown',   () => { setVol(Math.min(1, getVol() + STEP)); update(); });

        items.push(btnMinus, valTxt, btnPlus);
    }

    // ── Overlay rebind ────────────────────────────────────────

    private buildListenOverlay(): void {
        const bg  = this.add.rectangle(CX, CY, 340, 110, C.REBIND_BG, 0.97);
        const bdr = this.add.graphics();
        bdr.lineStyle(2, C.BORDER, 1);
        bdr.strokeRoundedRect(CX - 170, CY - 55, 340, 110, 6);
        const l1  = this.add.text(CX, CY - 18, 'Appuie sur une touche...', {
            fontSize: '16px', fontFamily: FONT, color: C.ORANGE,
        }).setOrigin(0.5);
        const l2  = this.add.text(CX, CY + 18, '(Echap pour annuler)', {
            fontSize: '12px', fontFamily: FONT, color: C.DIM,
        }).setOrigin(0.5);
        this.listenOverlay = this.add.container(0, 0, [bg, bdr, l1, l2]);
        this.listenOverlay.setVisible(false).setDepth(20);
    }

    private startListening(action: keyof ControlScheme): void {
        this.listeningFor = action;
        this.listenOverlay.setVisible(true);
        this.input.keyboard!.once('keydown', (e: KeyboardEvent) => {
            if (!this.listeningFor) return;
            if (e.key === 'Escape') {
                this.listeningFor = null;
                this.listenOverlay.setVisible(false);
                return;
            }
            const newKey = this.eventToKey(e);
            const scheme = ControlsConfig.getCurrentScheme();

            const conflictAction = (Object.keys(scheme) as (keyof ControlScheme)[])
                .find(k => k !== this.listeningFor && scheme[k] === newKey);

            if (conflictAction) {
                ControlsConfig.setCustomControl(conflictAction, '_UNSET_');
                this.showConflictWarning(conflictAction);
            }

            ControlsConfig.setCustomControl(this.listeningFor, newKey);
            this.refreshBindingTexts();
            this.refreshPresetBtns();
            this.listeningFor = null;
            this.listenOverlay.setVisible(false);

            eventBus.emit('CONTROLS_CHANGED', {});
        });
    }

    private showConflictWarning(disabledAction: keyof ControlScheme): void {
        const label = ACTIONS.find(a => a.key === disabledAction)?.label ?? disabledAction;
        const warn = this.add.text(CX, CY + 70,
            `⚠ "${label}" n'a plus de touche — définissez-la`,
            { fontSize: '12px', color: '#ff8844', fontFamily: FONT }
        ).setOrigin(0.5).setDepth(25);
        this.time.delayedCall(3000, () => warn.destroy());
    }

    private eventToKey(e: KeyboardEvent): string {
        if (e.code === 'Space')                                  return 'SPACE';
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight')  return 'SHIFT';
        if (e.code === 'ArrowUp')    return 'UP';
        if (e.code === 'ArrowDown')  return 'DOWN';
        if (e.code === 'ArrowLeft')  return 'LEFT';
        if (e.code === 'ArrowRight') return 'RIGHT';
        if (e.key.length === 1)      return e.key.toUpperCase();
        return e.code;
    }

    // ── Barre du bas ──────────────────────────────────────────

    private buildBottomBar(): void {
        const barY = PY + PH - 40;

        const bar = this.add.graphics();
        bar.fillStyle(0x0d0d1e, 1);
        bar.fillRoundedRect(PX + 2, barY, PW - 4, 38, { tl: 0, tr: 0, bl: 10, br: 10 });
        bar.lineStyle(1, 0x2a2a4a, 1);
        bar.lineBetween(PX + 12, barY, PX + PW - 12, barY);

        this.resetBtn = this.add.text(PX + 90, barY + 19, 'Reinitialiser', {
            fontSize: '13px', fontFamily: FONT, color: C.DIM,
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.resetBtn.on('pointerover', () => this.resetBtn.setColor(C.GOLD));
        this.resetBtn.on('pointerout',  () => this.resetBtn.setColor(C.DIM));
        this.resetBtn.on('pointerdown', () => {
            ControlsConfig.resetToPreset(ControlPreset.AZERTY);
            this.refreshPresetBtns();
            this.refreshBindingTexts();
        });

        this.backBtn = this.add.text(PX + PW - 70, barY + 19, 'Retour', {
            fontSize: '13px', fontFamily: FONT, color: C.WHITE,
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.backBtn.on('pointerover', () => this.backBtn.setColor(C.GOLD));
        this.backBtn.on('pointerout',  () => this.backBtn.setColor(C.WHITE));
        this.backBtn.on('pointerdown', () => this.closeOptions());
    }

    // ── Escape ────────────────────────────────────────────────

    private setupEscapeKey(): void {
        this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
            if (this.listeningFor) {
                this.listeningFor = null;
                this.listenOverlay.setVisible(false);
            } else {
                this.closeOptions();
            }
        });
    }

    private hasUnsetKeys(): boolean {
        const scheme = ControlsConfig.getCurrentScheme();
        return (Object.values(scheme) as string[]).some(v => v === '_UNSET_');
    }

    private closeOptions(): void {
        if (this.hasUnsetKeys()) {
            const warn = this.add.text(CX, CY + 70,
                '⚠ Toutes les actions doivent avoir une touche avant de fermer',
                { fontSize: '12px', color: '#ff4444', fontFamily: FONT }
            ).setOrigin(0.5).setDepth(25);
            this.time.delayedCall(2500, () => warn.destroy());
            return;
        }
        this.cameras.main.fadeOut(200, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.stop('OptionsScene');
            if (this.caller === 'PauseScene') {
            } else {
                this.scene.resume('TitleScene');
            }
        });
    }
}