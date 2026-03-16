import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { audioManager } from '../systems/ui/AudioManager';
import { DialogueHandler } from '../systems/ui/DialogueHandler';

const FONT = 'monospace';

export class EndingScene extends Phaser.Scene {
    private dialogueHandler!: DialogueHandler;

    constructor() { super({ key: 'EndingScene' }); }

    create(): void {
        audioManager.init(this);
        audioManager.stopMusic();
        this.dialogueHandler = new DialogueHandler(this);

        this.cameras.main.setBackgroundColor('#000000');
        this.cameras.main.fadeIn(1200, 0, 0, 0);

        this.runCinematic();
    }

    private runCinematic(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        const trixx = this.add.graphics().setDepth(5);
        this.drawTrixx(trixx, cx - 120, cy + 40);

        const door = this.add.graphics().setDepth(4);
        this.drawGlowDoor(door, cx + 80, cy - 20);

        this.tweens.add({
            targets: trixx,
            x: 80,
            duration: 2800,
            ease: 'Sine.easeInOut',
            onUpdate: (tween) => {
                const newX = cx - 120 + (200 * tween.progress);
                trixx.clear();
                this.drawTrixx(trixx, newX, cy + 40);
            },
        });

        this.time.delayedCall(1200, () => {
            this.dialogueHandler.play('ending_trixx', () => {}, true);
        });

        this.time.delayedCall(3200, () => {
            this.dialogueHandler.abort();
            const flash = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0).setDepth(20);
            this.tweens.add({
                targets: flash, alpha: 1, duration: 400,
                yoyo: true,
                onComplete: () => {
                    trixx.destroy();
                    door.destroy();
                    flash.destroy();
                    this.showCredits();
                },
            });
        });
    }

    private showCredits(): void {
        const cx = GAME_WIDTH / 2;

        this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x04040c).setDepth(0);

        this.add.text(cx, 40, '✦  WindlessLand  ✦', {
            fontSize: '22px', color: '#cc4444', fontFamily: FONT, fontStyle: 'bold', letterSpacing: 4,
        }).setOrigin(0.5, 0).setDepth(1);

        this.add.text(cx, 74, "Merci d'avoir joué !", {
            fontSize: '13px', color: '#888899', fontFamily: FONT, fontStyle: 'italic',
        }).setOrigin(0.5, 0).setDepth(1);

        const sep = this.add.graphics().setDepth(1);
        sep.lineStyle(1, 0x330022, 1);
        sep.lineBetween(60, 102, GAME_WIDTH - 60, 102);

        const credits = [
            ['Code & Sprites',  'Cloé Charotte'],
            ['Musique',         'Xplosn\n(avec son aimable autorisation)'],
            ['',                ''],
            ['Moteur',          'Phaser 3  ·  TypeScript  ·  Next.js'],
            ['',                ''],
            ['',                '~ Trixx a retrouvé les siens ~'],
        ];

        let y = 126;
        for (const [label, value] of credits) {
            if (!label && !value) { y += 10; continue; }
            if (!label) {
                this.add.text(cx, y, value, {
                    fontSize: '13px', color: '#cc4444', fontFamily: FONT, fontStyle: 'italic',
                }).setOrigin(0.5, 0).setDepth(1);
                y += 26;
                continue;
            }
            this.add.text(cx - 20, y, label, {
                fontSize: '12px', color: '#666677', fontFamily: FONT,
            }).setOrigin(1, 0).setDepth(1);
            this.add.text(cx, y, value, {
                fontSize: '12px', color: '#ccccdd', fontFamily: FONT, lineSpacing: 4,
            }).setOrigin(0, 0).setDepth(1);
            y += value.includes('\n') ? 38 : 22;
        }

        sep.lineBetween(60, y + 10, GAME_WIDTH - 60, y + 10);

        const replayBtn = this.add.text(cx, y + 28, '[Rejouer]', {
            fontSize: '16px', color: '#aa3333', fontFamily: FONT, fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(2).setInteractive({ useHandCursor: true });
        replayBtn.on('pointerover', () => replayBtn.setColor('#ff5555'));
        replayBtn.on('pointerout',  () => replayBtn.setColor('#aa3333'));
        replayBtn.once('pointerdown', () => {
            this.cameras.main.fadeOut(600, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TitleScene'));
        });

        (this.children.list as (Phaser.GameObjects.GameObject & { setAlpha?: (a: number) => void })[])
            .forEach((child, i) => {
                if (!child.setAlpha) return;
                child.setAlpha(0);
                this.tweens.add({ targets: child, alpha: 1, duration: 500, delay: 200 + i * 60 });
            });
    }

    private drawTrixx(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
        g.clear();
        g.fillStyle(0x4a2a6a, 1);
        g.fillCircle(x, y - 10, 14);
        g.lineStyle(2, 0xc084fc, 1);
        g.strokeCircle(x, y - 10, 14);
        g.fillStyle(0x3a1a5a, 1);
        g.fillRect(x - 10, y + 2, 8, 14);
        g.fillRect(x + 2,  y + 2, 8, 14);
    }

    private drawGlowDoor(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
        g.clear();
        g.fillStyle(0xffffff, 0.08);
        g.fillCircle(x, y, 70);
        g.fillStyle(0xffeebb, 0.15);
        g.fillCircle(x, y, 50);
        g.lineStyle(3, 0xffd080, 1);
        g.strokeRect(x - 20, y - 45, 40, 90);
        g.fillStyle(0xffeebb, 0.6);
        g.fillRect(x - 18, y - 43, 36, 86);
        this.time.addEvent({
            delay: 50, loop: true, callback: () => {
                g.clear();
                const pulse = 0.1 + 0.06 * Math.sin(Date.now() / 300);
                g.fillStyle(0xffffff, pulse);
                g.fillCircle(x, y, 70);
                g.fillStyle(0xffeebb, pulse * 2);
                g.fillCircle(x, y, 48);
                g.lineStyle(3, 0xffd080, 1);
                g.strokeRect(x - 20, y - 45, 40, 90);
                g.fillStyle(0xffeebb, 0.5 + pulse * 3);
                g.fillRect(x - 18, y - 43, 36, 86);
            },
        });
    }
}
