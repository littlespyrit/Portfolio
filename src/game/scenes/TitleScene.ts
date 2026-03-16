import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { runStats } from '../systems/core/RunStats';
import { metaProgress } from '../systems/core/MetaProgress';
import { resetMornSession } from './MornShopScene';
import { audioManager } from '../systems/ui/AudioManager';

const COLOR = {
    BG:          0x0d0d1a,
    ACCENT:      0x8e44ad,
    ACCENT_GLOW: 0xb05fe0,
    TEXT_DIM:    '#888899',
    TEXT_ACCENT: '#c084fc',
    ITEM_IDLE:   '#ccccdd',
    ITEM_HOVER:  '#f1c40f',
    SEED_BG:     0x0d0d24,
    SEED_BORDER: 0x3a1a5a,
    SEED_ACTIVE: 0x6a2a9a,
    SEED_TEXT:   '#c084fc',
    SEED_HINT:   '#444466',
    SEED_VALID:  '#44ff88',
    SEED_LABEL:  '#666677',
};
const FONT = 'monospace';

interface MenuItem { label: string; action: () => void; }

export class TitleScene extends Phaser.Scene {
    private menuItems:      Phaser.GameObjects.Text[] = [];
    private selectedIndex:  number = 0;
    private upKey!:         Phaser.Input.Keyboard.Key;
    private downKey!:       Phaser.Input.Keyboard.Key;
    private confirmKey!:    Phaser.Input.Keyboard.Key;
    private particles: Array<{
        x: number; y: number; vy: number; alpha: number;
        gfx: Phaser.GameObjects.Graphics;
    }> = [];

    // ── Seed field ────────────────────────────────────────────
    private seedStr:         string  = '';
    private seedFocused:     boolean = false;
    private seedBgGfx!:      Phaser.GameObjects.Graphics;
    private seedValueText!:  Phaser.GameObjects.Text;
    private seedStatusText!: Phaser.GameObjects.Text;
    private seedCursorText!: Phaser.GameObjects.Text;
    private seedCursorBlink: number  = 0;
    private keydownListener: ((e: KeyboardEvent) => void) | null = null;

    private sfX = 0; private sfY = 0; private sfW = 0; private sfH = 0;

    constructor() { super({ key: 'TitleScene' }); }

    preload(): void {
        audioManager.preloadAssets(this);
        this.load.spritesheet('gerbille', '/sprites/Gerbille.png', {
            frameWidth:  64,
            frameHeight: 64,
        });
    }

    create(): void {
        this.menuItems      = [];
        this.particles      = [];
        this.selectedIndex  = 0;
        this.seedStr        = '';
        this.seedFocused    = false;
        this.seedCursorBlink = 0;

        this.drawBackground();
        this.createParticles();
        this.drawLogo();
        this.buildMenu();
        this.buildSeedField();
        this.setupInput();
        this.highlightSelected();
        this.cameras.main.fadeIn(600, 0, 0, 0);

        audioManager.init(this);
        audioManager.playMusic();

        this.keydownListener = (e: KeyboardEvent) => this.handleSeedKey(e);
        window.addEventListener('keydown', this.keydownListener, { capture: true });

        const cleanup = () => {
            if (this.keydownListener) {
                window.removeEventListener('keydown', this.keydownListener, { capture: true } as EventListenerOptions);
                this.keydownListener = null;
            }
        };
        this.events.once('destroy',  cleanup);
        this.events.once('shutdown', cleanup);
    }

    update(_time: number, delta: number): void {
        this.animateParticles(delta);
        if (this.seedFocused) {
            this.seedCursorBlink += delta;
            const vis = Math.floor(this.seedCursorBlink / 530) % 2 === 0;
            this.seedCursorText.setAlpha(vis ? 1 : 0);
            this.seedCursorText.setX(this.sfX + 12 + this.seedValueText.width + 1);
        }
    }

    // ── Background ────────────────────────────────────────────

    private drawBackground(): void {
        const gfx = this.add.graphics();
        gfx.fillStyle(COLOR.BG);
        gfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        gfx.lineStyle(1, 0x1a1a3a, 0.6);
        const step = 50;
        for (let x = 0; x <= GAME_WIDTH; x += step) gfx.lineBetween(x, 0, x, GAME_HEIGHT);
        for (let y = 0; y <= GAME_HEIGHT; y += step) gfx.lineBetween(0, y, GAME_WIDTH, y);
        gfx.lineStyle(2, COLOR.ACCENT, 0.5);
        gfx.lineBetween(GAME_WIDTH * 0.2, 200, GAME_WIDTH * 0.8, 200);
    }

    // ── Particules ────────────────────────────────────────────

    private createParticles(): void {
        for (let i = 0; i < 20; i++) {
            const gfx = this.add.graphics();
            const p = {
                x:     Phaser.Math.Between(0, GAME_WIDTH),
                y:     Phaser.Math.Between(0, GAME_HEIGHT),
                vy:    -(Phaser.Math.Between(15, 40) / 100),
                alpha: Phaser.Math.FloatBetween(0.1, 0.5),
                gfx,
            };
            this.particles.push(p);
            this.drawParticle(p);
        }
    }

    private drawParticle(p: { x: number; y: number; alpha: number; gfx: Phaser.GameObjects.Graphics }): void {
        p.gfx.clear();
        p.gfx.fillStyle(COLOR.ACCENT_GLOW, p.alpha);
        p.gfx.fillCircle(p.x, p.y, 2);
    }

    private animateParticles(delta: number): void {
        for (const p of this.particles) {
            p.y += p.vy * delta;
            if (p.y < -5) p.y = GAME_HEIGHT + 5;
            this.drawParticle(p);
        }
    }

    // ── Logo ──────────────────────────────────────────────────

    private drawLogo(): void {
        this.add.text(GAME_WIDTH / 2 + 4, 64, 'WINDLESS LAND', {
            fontSize: '48px', fontFamily: FONT, color: '#2a004a',
        }).setOrigin(0.5);
        this.add.text(GAME_WIDTH / 2, 60, 'WINDLESS LAND', {
            fontSize: '48px', fontFamily: FONT, color: COLOR.TEXT_ACCENT,
        }).setOrigin(0.5);
        this.add.text(GAME_WIDTH / 2, 118, '— FIND YOUR WAY BACK —', {
            fontSize: '13px', fontFamily: FONT, color: COLOR.TEXT_DIM, letterSpacing: 5,
        }).setOrigin(0.5);
    }

    // ── Menu ──────────────────────────────────────────────────

    private buildMenu(): void {
        const items: MenuItem[] = [
            { label: 'JOUER',   action: () => this.startGame() },
            { label: 'OPTIONS', action: () => this.openOptions() },
            { label: 'QUITTER', action: () => this.quitGame() },
        ];
        const startY = 230, spacingY = 54;
        items.forEach((item, i) => {
            const text = this.add.text(GAME_WIDTH / 2, startY + i * spacingY, item.label, {
                fontSize: '22px', fontFamily: FONT, color: COLOR.ITEM_IDLE,
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            text.on('pointerover', () => { this.selectedIndex = i; this.highlightSelected(); });
            text.on('pointerdown', () => {
                this.seedFocused = false;
                this.refreshSeedField();
                items[i].action();
            });
            this.menuItems.push(text);
        });
        this.registry.set('menuActions', items.map(i => i.action));
    }

    private highlightSelected(): void {
        this.menuItems.forEach((item, i) => {
            item.setColor(i === this.selectedIndex ? COLOR.ITEM_HOVER : COLOR.ITEM_IDLE);
            item.setScale(i === this.selectedIndex ? 1.05 : 1);
        });
    }

    // ── Champ Seed ────────────────────────────────────────────

    private buildSeedField(): void {
        const FW = 340;
        const FH = 36;
        const FX = GAME_WIDTH / 2 - FW / 2;
        const FY = 430;

        this.sfX = FX; this.sfY = FY; this.sfW = FW; this.sfH = FH;

        this.add.text(GAME_WIDTH / 2, FY - 16,
            'SEED  —  laisser vide pour aléatoire',
            { fontSize: '11px', fontFamily: FONT, color: COLOR.SEED_LABEL, letterSpacing: 2 },
        ).setOrigin(0.5, 1).setDepth(2);

        this.seedBgGfx = this.add.graphics().setDepth(2);

        this.seedValueText = this.add.text(FX + 12, FY + FH / 2, '', {
            fontSize: '15px', fontFamily: FONT, color: COLOR.SEED_TEXT,
        }).setOrigin(0, 0.5).setDepth(3);

        this.seedCursorText = this.add.text(FX + 12, FY + FH / 2, '|', {
            fontSize: '16px', fontFamily: FONT, color: COLOR.SEED_TEXT,
        }).setOrigin(0, 0.5).setDepth(3).setAlpha(0);

        this.seedStatusText = this.add.text(FX + FW - 10, FY + FH / 2, '', {
            fontSize: '11px', fontFamily: FONT, color: COLOR.SEED_VALID,
        }).setOrigin(1, 0.5).setDepth(3);

        const zone = this.add.zone(FX, FY, FW, FH)
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(4);

        zone.on('pointerdown', () => {
            this.seedFocused = true;
            this.seedCursorBlink = 0;
            this.refreshSeedField();
        });

        this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
            if (!this.seedFocused) return;
            const inside = ptr.x >= FX && ptr.x <= FX + FW &&
                ptr.y >= FY && ptr.y <= FY + FH;
            if (!inside) {
                this.seedFocused = false;
                this.refreshSeedField();
            }
        });

        this.refreshSeedField();
    }

    private refreshSeedField(): void {
        const { sfX: FX, sfY: FY, sfW: FW, sfH: FH } = this;

        this.seedBgGfx.clear();
        this.seedBgGfx.fillStyle(COLOR.SEED_BG, 1);
        this.seedBgGfx.fillRoundedRect(FX, FY, FW, FH, 5);
        this.seedBgGfx.lineStyle(this.seedFocused ? 2 : 1,
            this.seedFocused ? COLOR.SEED_ACTIVE : COLOR.SEED_BORDER, 1);
        this.seedBgGfx.strokeRoundedRect(FX, FY, FW, FH, 5);

        if (this.seedStr === '' && !this.seedFocused) {
            this.seedValueText.setText('cliquer ici pour saisir une seed...');
            this.seedValueText.setColor(COLOR.SEED_HINT);
        } else {
            this.seedValueText.setText(this.seedStr);
            this.seedValueText.setColor(COLOR.SEED_TEXT);
        }

        if (this.seedStr !== '') {
            const n = parseInt(this.seedStr, 10);
            const valid = !isNaN(n) && n > 0 && n <= 0xFFFFFFFF;
            this.seedStatusText.setText(valid ? '✓ valide' : '⚠ invalide');
            this.seedStatusText.setColor(valid ? COLOR.SEED_VALID : '#ff8844');
        } else {
            this.seedStatusText.setText('aléatoire');
            this.seedStatusText.setColor(COLOR.SEED_HINT);
        }

        this.seedCursorText.setAlpha(this.seedFocused ? 1 : 0);
        this.seedCursorText.setX(FX + 12 + this.seedValueText.width + 1);
    }

    // ── Gestion clavier seed ──────────────────────────────────

    private handleSeedKey(e: KeyboardEvent): void {
        if (!this.seedFocused) return;

        e.stopPropagation();

        if (e.key === 'Escape') {
            this.seedFocused = false;
            this.refreshSeedField();
            return;
        }

        if (e.key === 'Enter') {
            this.seedFocused = false;
            this.refreshSeedField();
            this.startGame();
            return;
        }

        if (e.key === 'Backspace') {
            this.seedStr = this.seedStr.slice(0, -1);
            this.seedCursorBlink = 0;
            this.refreshSeedField();
            return;
        }

        if (/^[0-9]$/.test(e.key) && this.seedStr.length < 10) {
            this.seedStr += e.key;
            this.seedCursorBlink = 0;
            this.refreshSeedField();
        }
    }

    /** Retourne la seed parsée, ou undefined si vide/invalide. */
    private getParsedSeed(): number | undefined {
        if (this.seedStr === '') return undefined;
        const n = parseInt(this.seedStr, 10);
        if (isNaN(n) || n <= 0 || n > 0xFFFFFFFF) return undefined;
        return n;
    }

    // ── Input menu clavier ────────────────────────────────────

    private setupInput(): void {
        const kb = this.input.keyboard!;
        this.upKey      = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        this.downKey    = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        this.confirmKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        kb.addKey('Z').on('down', () => { if (!this.seedFocused) this.moveSelection(-1); });
        kb.addKey('W').on('down', () => { if (!this.seedFocused) this.moveSelection(-1); });
        kb.addKey('S').on('down', () => { if (!this.seedFocused) this.moveSelection(1); });
        this.upKey.on('down',      () => { if (!this.seedFocused) this.moveSelection(-1); });
        this.downKey.on('down',    () => { if (!this.seedFocused) this.moveSelection(1); });
        this.confirmKey.on('down', () => { if (!this.seedFocused) this.confirmSelection(); });

        kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => {
            if (!this.seedFocused && this.selectedIndex === 0) this.startGame();
        });
    }

    private moveSelection(dir: -1 | 1): void {
        this.selectedIndex = Phaser.Math.Wrap(this.selectedIndex + dir, 0, this.menuItems.length);
        this.highlightSelected();
    }

    private confirmSelection(): void {
        const actions = this.registry.get('menuActions') as Array<() => void>;
        actions?.[this.selectedIndex]?.();
    }

    // ── Actions ───────────────────────────────────────────────

    private startGame(): void {
        metaProgress.resetRun();
        runStats.reset();
        runStats.clearHaine();
        resetMornSession();
        const seed = this.getParsedSeed();

        if (seed !== undefined) {
            this.registry.set('currentSeed', seed);
        } else {
            this.registry.remove('currentSeed');
        }

        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('ArenaScene');
        });
    }

    private openOptions(): void {
        this.seedFocused = false;
        this.refreshSeedField();
        this.scene.pause();
        this.scene.run('OptionsScene', { caller: 'TitleScene' });
    }

    private quitGame(): void {
        const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "Ferme l'onglet pour quitter :)", {
            fontSize: '13px', fontFamily: FONT, color: COLOR.TEXT_DIM,
        }).setOrigin(0.5);
        this.tweens.add({ targets: msg, alpha: 0, duration: 3000, ease: 'Power2' });
    }
}