import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';

// ── Constantes visuelles ──────────────────────────────────────
const COLOR = {
    OVERLAY:    0x000000,
    PANEL:      0x12122a,
    BORDER:     0x8e44ad,
    TEXT_TITLE: '#c084fc',
    BTN_IDLE:   '#ccccdd',
    BTN_HOVER:  '#f1c40f',
    BTN_QUIT:   '#e74c3c',
    BTN_QUIT_HOVER: '#ff6b6b',
};

const FONT       = 'monospace';
const PANEL_W    = 320;
const PANEL_H    = 280;
const PANEL_X    = (GAME_WIDTH  - PANEL_W) / 2;
const PANEL_Y    = (GAME_HEIGHT - PANEL_H) / 2;
const BTN_W      = 220;
const BTN_H      = 44;
const BTN_X      = GAME_WIDTH / 2;
const BTN_Y_BASE = PANEL_Y + 110;
const BTN_GAP    = 56;

export class PauseScene extends Phaser.Scene {
    private escKey!: Phaser.Input.Keyboard.Key;

    constructor() {
        super({ key: 'PauseScene' });
    }

    create(): void {
        this.drawOverlay();
        this.drawPanel();
        this.createButtons();
        this.setupEscapeKey();
    }

    // ── Fond ──────────────────────────────────────────────────

    private drawOverlay(): void {
        this.add.rectangle(
            GAME_WIDTH / 2, GAME_HEIGHT / 2,
            GAME_WIDTH, GAME_HEIGHT,
            COLOR.OVERLAY, 0.65,
        ).setDepth(0);
    }

    private drawPanel(): void {
        const gfx = this.add.graphics().setDepth(1);

        gfx.fillStyle(COLOR.PANEL, 1);
        gfx.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 10);

        gfx.lineStyle(2, COLOR.BORDER, 1);
        gfx.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 10);

        this.add.text(GAME_WIDTH / 2, PANEL_Y + 40, '— PAUSE —', {
            fontSize:   '22px',
            fontFamily: FONT,
            color:      COLOR.TEXT_TITLE,
        }).setOrigin(0.5).setDepth(2);
    }

    // ── Boutons ───────────────────────────────────────────────

    private createButtons(): void {
        this.createBtn(
            BTN_X, BTN_Y_BASE,
            '▶  Reprendre',
            COLOR.BTN_IDLE, COLOR.BTN_HOVER,
            () => this.resume(),
        );

        this.createBtn(
            BTN_X, BTN_Y_BASE + BTN_GAP,
            '⚙  Options',
            COLOR.BTN_IDLE, COLOR.BTN_HOVER,
            () => this.openOptions(),
        );

        this.createBtn(
            BTN_X, BTN_Y_BASE + BTN_GAP * 2,
            '✕  Quitter',
            COLOR.BTN_QUIT, COLOR.BTN_QUIT_HOVER,
            () => this.quitToTitle(),
        );
    }

    private createBtn(
        x: number, y: number,
        label: string,
        colorIdle: string, colorHover: string,
        onClick: () => void,
    ): void {
        const bg = this.add.graphics().setDepth(2);
        bg.fillStyle(0x1a1a3a, 1);
        bg.fillRoundedRect(x - BTN_W / 2, y - BTN_H / 2, BTN_W, BTN_H, 6);
        bg.lineStyle(1, 0x3a3a5a, 1);
        bg.strokeRoundedRect(x - BTN_W / 2, y - BTN_H / 2, BTN_W, BTN_H, 6);

        const txt = this.add.text(x, y, label, {
            fontSize:   '16px',
            fontFamily: FONT,
            color:      colorIdle,
        })
            .setOrigin(0.5)
            .setDepth(3)
            .setInteractive({ useHandCursor: true });

        txt.on('pointerover', () => {
            txt.setColor(colorHover);
            bg.clear();
            bg.fillStyle(0x2a1a4a, 1);
            bg.fillRoundedRect(x - BTN_W / 2, y - BTN_H / 2, BTN_W, BTN_H, 6);
            bg.lineStyle(1, COLOR.BORDER, 1);
            bg.strokeRoundedRect(x - BTN_W / 2, y - BTN_H / 2, BTN_W, BTN_H, 6);
        });

        txt.on('pointerout', () => {
            txt.setColor(colorIdle);
            bg.clear();
            bg.fillStyle(0x1a1a3a, 1);
            bg.fillRoundedRect(x - BTN_W / 2, y - BTN_H / 2, BTN_W, BTN_H, 6);
            bg.lineStyle(1, 0x3a3a5a, 1);
            bg.strokeRoundedRect(x - BTN_W / 2, y - BTN_H / 2, BTN_W, BTN_H, 6);
        });

        txt.on('pointerdown', onClick);
    }

    // ── Actions ───────────────────────────────────────────────

    private resume(): void {
        this.scene.stop();
        this.scene.resume('ArenaScene');
    }

    private openOptions(): void {
        this.scene.setVisible(false, 'PauseScene');
        this.scene.run('OptionsScene', { caller: 'PauseScene' });
        this.scene.bringToTop('OptionsScene');
    }

    private quitToTitle(): void {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.stop('ArenaScene');
            this.scene.stop('PauseScene');
            this.scene.start('TitleScene');
        });
    }

    // ── Échap ─────────────────────────────────────────────────

    private setupEscapeKey(): void {
        this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.escKey.on('down', () => this.resume());
    }
}