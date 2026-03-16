import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ARENA, PLAYER } from '../../config/gameConfig';
import { runStats, EMOTION_DEFS } from '../core/RunStats';
import { buffManager } from '../core/BuffManager';
import { metaProgress } from '../core/MetaProgress';
import { HighScoreManager } from '../core/HighScoreManager';
import { ControlsConfig } from '../../config/controls';
import type { ScoreManager } from '../core/ScoreManager';
import type { Enemy } from '../../entities/Enemy';
import type { EmotionType } from '../core/RunStats';

const UI_STYLE_LARGE = { fontSize: '26px', color: '#f1c40f', fontFamily: 'monospace' };
const UI_STYLE_HEAD  = { fontSize: '18px', color: '#ffffff', fontFamily: 'monospace' };
const FONT = 'monospace';
const HEART_FULL  = '♥';
const HEART_EMPTY = '♡';

const EMOTION_LABELS: Record<string, string> = {
    rage:      'Rage',
    peur:      'Peur',
    desespoir: 'Désespoir',
    tristesse: 'Tristesse',
    envie:     'Envie',
    anxiete:   'Anxiété',
    rancoeur:  'Rancœur',
};
const EMOTION_EFFECTS: Record<string, string> = {
    rage:      'ATK +12%',
    peur:      'Vitesse +8%',
    desespoir: 'Portée +10%',
    tristesse: '+1 PV max',
    envie:     'Régén passive',
    anxiete:   'Dash -8%',
    rancoeur:  'Invincib. +15%',
};

export class UIManager {
    private scene: Phaser.Scene;

    private uiHearts!:   Phaser.GameObjects.Text;
    private uiScore!:    Phaser.GameObjects.Text;
    private uiRoom!:     Phaser.GameObjects.Text;
    private uiCombo!:    Phaser.GameObjects.Text;
    private uiMessage!:  Phaser.GameObjects.Text;
    private uiSeed!:     Phaser.GameObjects.Text;
    private uiEmotions!: Phaser.GameObjects.Text;
    private uiHaine!:    Phaser.GameObjects.Text;
    private uiBuffs!:    Phaser.GameObjects.Text;

    private uiBossBarBg!:   Phaser.GameObjects.Graphics;
    private uiBossBarFill!: Phaser.GameObjects.Graphics;
    private uiBossLabel!:   Phaser.GameObjects.Text;
    private uiBossName!:    Phaser.GameObjects.Text;

    private charMenuGroup:   Phaser.GameObjects.GameObject[] = [];
    private charMenuVisible: boolean = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    // ── Création ──────────────────────────────────────────────

    create(seed: number): void {
        const pad = 8;

        this.uiHearts = this.scene.add.text(
            ARENA.MARGIN + pad, ARENA.MARGIN + pad,
            this.buildHeartsString(PLAYER.MAX_HP),
            { fontSize: '22px', color: '#e74c3c', fontFamily: FONT },
        ).setDepth(5);

        this.uiScore = this.scene.add.text(
            GAME_WIDTH / 2, ARENA.MARGIN + pad,
            '', UI_STYLE_HEAD,
        ).setOrigin(0.5, 0).setDepth(5);

        this.uiRoom = this.scene.add.text(
            ARENA.MARGIN + pad, GAME_HEIGHT - ARENA.MARGIN - pad - 50,
            '', { fontSize: '12px', color: '#444466', fontFamily: FONT },
        ).setDepth(5);

        this.uiCombo = this.scene.add.text(
            ARENA.MARGIN + pad, GAME_HEIGHT - ARENA.MARGIN - pad - 24,
            '', UI_STYLE_HEAD,
        ).setDepth(5);

        this.uiEmotions = this.scene.add.text(
            ARENA.MARGIN + pad, GAME_HEIGHT - ARENA.MARGIN - pad - 72,
            '', { fontSize: '12px', color: '#c084fc', fontFamily: FONT },
        ).setDepth(5);

        this.uiHaine = this.scene.add.text(
            GAME_WIDTH - ARENA.MARGIN - pad, GAME_HEIGHT - ARENA.MARGIN - pad - 24,
            '', { fontSize: '14px', color: '#555566', fontFamily: FONT },
        ).setOrigin(1, 0).setDepth(5);

        this.uiBuffs = this.scene.add.text(
            ARENA.MARGIN + pad, GAME_HEIGHT - ARENA.MARGIN - pad - 96,
            '', { fontSize: '11px', color: '#44dd88', fontFamily: FONT },
        ).setDepth(5);

        this.uiMessage = this.scene.add.text(
            GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80,
            '', UI_STYLE_LARGE,
        ).setOrigin(0.5).setDepth(5).setAlpha(0);

        this.uiSeed = this.scene.add.text(
            GAME_WIDTH - ARENA.MARGIN - 8, GAME_HEIGHT - ARENA.MARGIN - 8,
            `seed: ${seed}`,
            { fontSize: '11px', color: '#444466', fontFamily: FONT },
        ).setOrigin(1, 1).setDepth(5);

        this.createBossBar();
    }

    private createBossBar(): void {
        const BAR_W = 400;
        const BAR_H = 22;
        const BAR_X = GAME_WIDTH / 2 - BAR_W / 2;
        const BAR_Y = ARENA.MARGIN + 8;

        this.uiBossName = this.scene.add.text(GAME_WIDTH / 2, BAR_Y - 1,
            '', { fontSize: '13px', color: '#ff6644', fontFamily: FONT, letterSpacing: 3 },
        ).setOrigin(0.5, 1).setDepth(6).setAlpha(0);

        this.uiBossBarBg = this.scene.add.graphics().setDepth(6);
        this.uiBossBarBg.fillStyle(0x1a0000, 0.92);
        this.uiBossBarBg.lineStyle(2, 0x660000, 1);
        this.uiBossBarBg.fillRect(BAR_X - 2, BAR_Y, BAR_W + 4, BAR_H);
        this.uiBossBarBg.strokeRect(BAR_X - 2, BAR_Y, BAR_W + 4, BAR_H);
        this.uiBossBarBg.setAlpha(0);

        this.uiBossBarFill = this.scene.add.graphics().setDepth(7).setAlpha(0);

        this.uiBossLabel = this.scene.add.text(GAME_WIDTH / 2, BAR_Y + BAR_H / 2,
            '', { fontSize: '12px', color: '#ffffff', fontFamily: FONT },
        ).setOrigin(0.5, 0.5).setDepth(8).setAlpha(0);
    }

    // ── Refresh chaque frame ──────────────────────────────────

    refresh(scoreManager: ScoreManager, roomNumber: number, playerHp: number, aliveBoss: Enemy | undefined): void {
        const snap = scoreManager.snapshot;
        this.uiHearts.setText(this.buildHeartsString(playerHp));
        this.uiScore.setText(`Score: ${snap.total}`);
        this.uiRoom.setText(`Salle ${roomNumber}`);
        this.uiCombo.setText(snap.combo > 1 ? `x${snap.combo} (x${snap.multiplier})` : '');
        this.uiEmotions.setText(this.buildEmotionsString());
        this.uiHaine.setText(runStats.haineCollected > 0 ? `Haine: ${runStats.haineCollected}` : '');

        const activeBuffs = buffManager.getActive();
        if (activeBuffs.length > 0) {
            const buffStr = activeBuffs.map(b => {
                const secLeft = Math.ceil(b.remainingMs / 1000);
                return b.totalMs > 90000
                    ? `✦ ${b.label}`
                    : `✦ ${b.label} (${secLeft}s)`;
            }).join('  ');
            this.uiBuffs.setText(buffStr);
        } else {
            this.uiBuffs.setText('');
        }

        this.refreshBossBar(aliveBoss);
    }

    private refreshBossBar(boss: Enemy | undefined): void {
        const BAR_W = 400;
        const BAR_H = 22;
        const BAR_X = GAME_WIDTH / 2 - BAR_W / 2;
        const BAR_Y = ARENA.MARGIN + 8;

        if (boss) {
            const hp01    = Math.max(0, boss.hp / boss.config.hp);
            const hpColor = hp01 > 0.6 ? 0xff2222 : hp01 > 0.3 ? 0xff7700 : 0xff0066;

            this.uiBossBarFill.clear();
            this.uiBossBarFill.fillStyle(hpColor, 1);
            this.uiBossBarFill.fillRect(BAR_X, BAR_Y + 1, BAR_W * hp01, BAR_H - 2);
            this.uiBossBarFill.fillStyle(0xffffff, 0.08);
            this.uiBossBarFill.fillRect(BAR_X, BAR_Y + 1, BAR_W * hp01, (BAR_H - 2) * 0.4);

            this.uiBossLabel.setText(`${boss.hp} / ${boss.config.hp}`);
            this.uiBossName.setText(`✦  ${boss.config.label.toUpperCase()}  ✦`);

            if (this.uiBossBarBg.alpha < 1) {
                this.scene.tweens.add({
                    targets: [this.uiBossBarBg, this.uiBossBarFill, this.uiBossLabel, this.uiBossName],
                    alpha: 1, duration: 300,
                });
            }
        } else {
            if (this.uiBossBarBg.alpha > 0) {
                this.scene.tweens.add({
                    targets: [this.uiBossBarBg, this.uiBossBarFill, this.uiBossLabel, this.uiBossName],
                    alpha: 0, duration: 400,
                });
                this.uiBossBarFill.clear();
            }
        }
    }

    // ── Message flash ─────────────────────────────────────────

    showMessage(text: string, durationMs: number): void {
        this.uiMessage.setText(text).setAlpha(1);
        this.scene.tweens.add({ targets: this.uiMessage, alpha: 0, duration: durationMs, ease: 'Power2' });
    }

    /** Pulse l'indicateur de cœurs (utilisé sur PLAYER_HIT et PLAYER_HEALED). */
    pulseHearts(): void {
        this.scene.tweens.add({
            targets: this.uiHearts, scaleX: 1.3, scaleY: 1.3,
            duration: 100, yoyo: true, ease: 'Power2',
        });
    }

    // ── Menu personnage ───────────────────────────────────────

    get isCharMenuOpen(): boolean { return this.charMenuVisible; }

    openCharMenu(playerHp: number): void {
        if (this.charMenuVisible) return;
        this.charMenuVisible = true;

        const F = 'monospace';
        const D = 30;
        const W = 420, H = 460;
        const X = GAME_WIDTH  / 2 - W / 2;
        const Y = GAME_HEIGHT / 2 - H / 2;
        const o: Phaser.GameObjects.GameObject[] = [];
        const t = (x: number, y: number, txt: string, size: string, col: string, orig: [number,number] = [0,0]) =>
            this.scene.add.text(x, y, txt, { fontSize: size, color: col, fontFamily: F }).setOrigin(...orig).setDepth(D + 1);

        o.push(this.scene.add.rectangle(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setDepth(D));
        const g = this.scene.add.graphics().setDepth(D);
        g.fillStyle(0x0d0d1a, 1); g.fillRect(X, Y, W, H);
        o.push(g);

        o.push(t(X + W/2, Y + 16, 'TRIXX', '16px', '#c084fc', [0.5, 0]));

        const maxHp = runStats.maxHp;
        o.push(t(X + 20, Y + 48, HEART_FULL.repeat(playerHp) + HEART_EMPTY.repeat(maxHp - playerHp), '18px', '#e74c3c'));
        o.push(t(X + W - 20, Y + 52, `${playerHp} / ${maxHp}`, '11px', '#666677', [1, 0]));

        const sep = (y: number) => {
            const sg = this.scene.add.graphics().setDepth(D + 1);
            sg.lineStyle(1, 0x1a1a2e, 1);
            sg.lineBetween(X + 16, y, X + W - 16, y);
            o.push(sg);
        };
        sep(Y + 74);

        let y = Y + 82;
        const row = (label: string, value: string, col = '#ccccdd', bold = false) => {
            o.push(t(X + 20, y, label, '11px', '#555566'));
            o.push(t(X + W - 20, y, value, bold ? '13px' : '12px', col, [1, 0]));
            y += 19;
        };

        o.push(t(X + 20, y, 'STATS', '10px', '#333344')); y += 14;
        const atkPct = Math.round(runStats.attackMultiplier * 100);
        row('Attaque',  `${atkPct}%`, atkPct > 100 ? '#44dd88' : '#ccccdd');
        row('Vitesse',  `${Math.round(runStats.speed)} px/s`, runStats.speed > 300 ? '#44dd88' : '#ccccdd');
        row('PV max',   `${maxHp}`);
        if (metaProgress.poisonUnlocked) row('Poison', 'actif', '#88ff44');

        sep(y + 2); y += 10;

        const buffs = buffManager.getActive().filter(b => b.totalMs <= 90000);
        if (buffs.length > 0) {
            o.push(t(X + 20, y, 'BUFFS', '10px', '#333344')); y += 14;
            for (const b of buffs) {
                row(b.label, `${Math.ceil(b.remainingMs / 1000)}s`, '#44dd88');
            }
            sep(y + 2); y += 10;
        }

        const haineRun   = runStats.haineCollected;
        const haineStock = metaProgress.haineStored;
        if (haineRun > 0 || haineStock > 0) {
            o.push(t(X + 20, y, 'HAINE', '10px', '#333344')); y += 14;
            if (haineRun > 0)   row('Ce run',  `${haineRun}`,   '#ff8888');
            if (haineStock > 0) {
                const am = Math.round((1 - metaProgress.haineAttackMalus) * 100);
                const sm = Math.round((1 - metaProgress.haineSpeedMalus)  * 100);
                row('Stockée', `${haineStock}  ⚠ ATK-${am}%  Vit-${sm}%`, '#cc4422');
            }
            sep(y + 2); y += 10;
        }

        const types = runStats.absorbedTypes;
        if (types.length > 0) {
            o.push(t(X + 20, y, 'ÉMOTIONS', '10px', '#333344')); y += 14;
            for (const type of types) {
                const n   = runStats.stackCount(type);
                const def = EMOTION_DEFS[type];
                o.push(t(X + 20,       y, EMOTION_LABELS[type] ?? type, '12px', def.colorHex));
                o.push(t(X + 120,      y, EMOTION_EFFECTS[type] ?? '',  '11px', '#445544'));
                o.push(t(X + W - 20,   y, `×${n}`, '13px', def.colorHex, [1, 0]));
                y += 19;
            }
        }

        const key = ControlsConfig.getCurrentScheme().charMenu ?? 'C';
        o.push(t(X + W/2, Y + H - 14, `[${key}] fermer`, '10px', '#333344', [0.5, 1]));

        this.charMenuGroup = o;
    }

    closeCharMenu(): void {
        this.charMenuGroup.forEach(o => (o as Phaser.GameObjects.GameObject & { destroy: () => void }).destroy());
        this.charMenuGroup   = [];
        this.charMenuVisible = false;
    }

    // ── Écran Game Over ───────────────────────────────────────

    showGameOver(
        scoreManager: ScoreManager,
        seed: number,
        onRestart: () => void,
        onMenu: () => void,
    ): void {
        const snap      = scoreManager.snapshot;
        const isNewBest = HighScoreManager.submit(snap.total, snap.room, metaProgress.currentZone, seed);        const topScores = HighScoreManager.load();

        this.scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.82).setDepth(10);

        this.scene.add.text(GAME_WIDTH / 2, 38,
            isNewBest ? '✦  NOUVEAU RECORD  ✦' : 'GAME OVER',
            { ...UI_STYLE_LARGE, color: isNewBest ? '#f1c40f' : '#c084fc' },
        ).setOrigin(0.5).setDepth(11);

        this.scene.add.text(GAME_WIDTH / 2, 76, `Score : ${snap.total}`, UI_STYLE_LARGE)
            .setOrigin(0.5).setDepth(11);

        const statsY   = 118;
        const col1     = GAME_WIDTH / 2 - 170;
        const col2     = GAME_WIDTH / 2 + 40;
        const rowH     = 22;
        const lblStyle = { fontSize: '13px', color: '#888899', fontFamily: FONT };
        const valStyle = { fontSize: '13px', color: '#ddddee', fontFamily: FONT };

        const killPct  = runStats.totalEnemies > 0 ? Math.round((runStats.totalKills   / runStats.totalEnemies)    * 100) : 0;
        const breakPct = runStats.totalBreakables > 0 ? Math.round((runStats.totalBroken / runStats.totalBreakables) * 100) : 0;

        const haineTotal  = metaProgress.haineStored;
        const malusAtkPct = Math.round((1 - metaProgress.haineAttackMalus) * 100);
        const malusSpdPct = Math.round((1 - metaProgress.haineSpeedMalus)  * 100);
        const haineStr    = haineTotal > 0
            ? `${runStats.haineCollected}  (stockée : ${haineTotal}  |  ATK -${malusAtkPct}%  Vit -${malusSpdPct}%)`
            : `${runStats.haineCollected}`;

        const statsRows: [string, string][] = [
            ['Ennemis tués',      `${runStats.totalKills} / ${runStats.totalEnemies}  (${killPct}%)`],
            ['Résidus collectés', `${runStats.totalOrbs}`],
            ['Haine accumulée',   haineStr],
            ['Caisses cassées',   `${runStats.totalBroken} / ${runStats.totalBreakables}  (${breakPct}%)`],
            ['Salle atteinte',    `${snap.room}`],
            ['Seed',              `${seed}`],
        ];
        statsRows.forEach(([lbl, val], i) => {
            this.scene.add.text(col1, statsY + i * rowH, lbl, lblStyle).setDepth(11);
            this.scene.add.text(col2, statsY + i * rowH, val, valStyle).setDepth(11);
        });

        const absorbed = runStats.absorbedTypes;
        if (absorbed.length > 0) {
            const str = absorbed
                .map(t => `${EMOTION_DEFS[t].label} ×${runStats.stackCount(t)}`)
                .join('   ');
            this.scene.add.text(GAME_WIDTH / 2, statsY + statsRows.length * rowH + 4, str, {
                fontSize: '11px', color: '#9966cc', fontFamily: FONT,
            }).setOrigin(0.5).setDepth(11);
        }

        const sepY = statsY + (statsRows.length + 1) * rowH + 14;
        const sep  = this.scene.add.graphics().setDepth(11);
        sep.lineStyle(1, 0x444466, 1);
        sep.lineBetween(GAME_WIDTH / 2 - 200, sepY, GAME_WIDTH / 2 + 200, sepY);

        this.scene.add.text(GAME_WIDTH / 2, sepY + 8, 'TOP SCORES', {
            fontSize: '12px', color: '#666677', fontFamily: FONT, letterSpacing: 4,
        }).setOrigin(0.5).setDepth(11);

        topScores.forEach((entry, i) => {
            const isCurrent = entry.score === snap.total && entry.seed === seed;
            const medal     = i === 0 ? '★' : `${i + 1}.`;
            const line      = `${medal}  ${String(entry.score).padStart(7)}   salle ${entry.room}   ${entry.date}`;
            this.scene.add.text(GAME_WIDTH / 2, sepY + 30 + i * 24, line, {
                fontSize: '13px', color: isCurrent ? '#f1c40f' : '#aaaacc', fontFamily: FONT,
            }).setOrigin(0.5).setDepth(11);
        });

        this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 38, '[R] Rejouer   [M] Menu', {
            fontSize: '16px', color: '#888899', fontFamily: FONT,
        }).setOrigin(0.5).setDepth(11);

        this.scene.input.keyboard!.once('keydown-R', onRestart);
        this.scene.input.keyboard!.once('keydown-M', onMenu);
    }

    // ── Écran scores inter-zones ──────────────────────────────

    showZoneScoreScreen(
        scoreManager: ScoreManager,
        zone: number,
        nextZone: number,
        onContinue: () => void,
    ): void {
        const snap = scoreManager.snapshot;
        const cx   = GAME_WIDTH  / 2;
        const cy   = GAME_HEIGHT / 2;

        this.scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.92).setDepth(40);

        this.scene.add.text(cx, cy - 130, `✦  ZONE ${zone - 1} TERMINÉE  ✦`, {
            fontSize: '22px', color: '#c084fc', fontFamily: FONT, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(41);

        this.scene.add.text(cx, cy - 96, `Score de la zone : ${snap.total}`, {
            fontSize: '16px', color: '#f1c40f', fontFamily: FONT,
        }).setOrigin(0.5).setDepth(41);

        const rows: [string, string][] = [
            ['Ennemis éliminés', `${runStats.totalKills}`],
            ['Haine échangée',   `${runStats.haineCollected}`],
            ['Salle atteinte',   `${snap.room}`],
        ];
        rows.forEach(([lbl, val], i) => {
            this.scene.add.text(cx - 120, cy - 50 + i * 24, lbl, { fontSize: '13px', color: '#888899', fontFamily: FONT }).setDepth(41);
            this.scene.add.text(cx + 120, cy - 50 + i * 24, val, { fontSize: '13px', color: '#ddddee', fontFamily: FONT }).setOrigin(1, 0).setDepth(41);
        });

        const label = nextZone > 3
            ? '✦  ZONE FINALE — MORN VOUS ATTEND  ✦'
            : `Prochaine zone : ${nextZone}`;
        this.scene.add.text(cx, cy + 40, label, {
            fontSize: '14px', color: nextZone > 3 ? '#ff4444' : '#aaaacc', fontFamily: FONT,
        }).setOrigin(0.5).setDepth(41);

        this.scene.add.text(cx, cy + 80, '[Espace] Continuer', {
            fontSize: '14px', color: '#555566', fontFamily: FONT,
        }).setOrigin(0.5).setDepth(41);

        this.scene.input.keyboard!.once('keydown-SPACE', onContinue);
    }

    // ── Helpers ───────────────────────────────────────────────

    private buildHeartsString(hp: number): string {
        const maxHp = runStats.maxHp;
        return HEART_FULL.repeat(Math.max(0, hp)) + HEART_EMPTY.repeat(Math.max(0, maxHp - hp));
    }

    private buildEmotionsString(): string {
        const types = runStats.absorbedTypes;
        if (types.length === 0) return '';
        return types.map(t => {
            const n = runStats.stackCount(t);
            return n > 1
                ? `${EMOTION_DEFS[t].label.slice(0, 3)}x${n}`
                : EMOTION_DEFS[t].label.slice(0, 3);
        }).join(' ');
    }

    /** Rafraîchit le texte de la seed (utile après restart). */
    updateSeed(seed: number): void {
        this.uiSeed?.setText(`seed: ${seed}`);
    }
}
