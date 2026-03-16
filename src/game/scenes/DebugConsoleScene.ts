import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { runStats } from '../systems/core/RunStats';
import { buffManager } from '../systems/core/BuffManager';
import { metaProgress } from '../systems/core/MetaProgress';
import { eventBus } from '../systems/core/EventBus';
import { debugOverrides } from '../systems/core/DebugOverrides';
import { debugSetMornDialogueZone } from '../scenes/MornShopScene';
import type { IArenaScene } from './IArenaScene';
import type { RoomNode } from '../types';

const FONT       = 'monospace';
const MAX_LINES  = 14;
const CON_W      = 580;
const CON_H      = 320;
const CON_X      = GAME_WIDTH  / 2 - CON_W / 2;
const CON_Y      = GAME_HEIGHT / 2 - CON_H / 2;
const INPUT_H    = 28;

export class DebugConsoleScene extends Phaser.Scene {
    private history:      string[] = [];
    private inputStr:     string   = '';
    private historyIdx:   number   = -1;
    private inputHistory: string[] = [];

    private bgGfx!:      Phaser.GameObjects.Graphics;
    private outputText!: Phaser.GameObjects.Text;
    private inputText!:  Phaser.GameObjects.Text;
    private cursorText!: Phaser.GameObjects.Text;
    private cursorBlink: number = 0;

    constructor() { super({ key: 'DebugConsoleScene' }); }

    create(): void {
        this.bgGfx = this.add.graphics().setDepth(0);
        this.drawBg();

        this.outputText = this.add.text(CON_X + 10, CON_Y + 10, '', {
            fontSize: '12px', color: '#aaffaa', fontFamily: FONT,
            wordWrap: { width: CON_W - 20 },
        }).setDepth(1);

        this.add.text(CON_X + 10, CON_Y + CON_H - INPUT_H + 6, '>', {
            fontSize: '13px', color: '#44ff44', fontFamily: FONT, fontStyle: 'bold',
        }).setDepth(1);

        this.inputText = this.add.text(CON_X + 22, CON_Y + CON_H - INPUT_H + 6, '', {
            fontSize: '13px', color: '#ffffff', fontFamily: FONT,
        }).setDepth(1);

        this.cursorText = this.add.text(CON_X + 22, CON_Y + CON_H - INPUT_H + 6, '_', {
            fontSize: '13px', color: '#44ff44', fontFamily: FONT,
        }).setDepth(1);

        this.add.text(CON_X + CON_W - 8, CON_Y + 6, '[Échap] pour fermer', {
            fontSize: '10px', color: '#336633', fontFamily: FONT,
        }).setOrigin(1, 0).setDepth(1);

        this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.handleKey(e));

        this.log('§ Console de debug WindlessLand');
        this.log('Tape "help" pour la liste des commandes.');
        this.log('─────────────────────────────────────');
    }

    update(_t: number, delta: number): void {
        this.cursorBlink += delta;
        const visible = Math.floor(this.cursorBlink / 400) % 2 === 0;
        this.cursorText.setAlpha(visible ? 1 : 0);
        this.cursorText.setX(CON_X + 22 + this.inputText.width + 2);
    }

    // ── Rendu fond ────────────────────────────────────────────

    private drawBg(): void {
        this.bgGfx.clear();
        this.bgGfx.fillStyle(0x000000, 0.88);
        this.bgGfx.fillRoundedRect(CON_X, CON_Y, CON_W, CON_H + INPUT_H, 8);
        this.bgGfx.lineStyle(2, 0x00cc44, 1);
        this.bgGfx.strokeRoundedRect(CON_X, CON_Y, CON_W, CON_H + INPUT_H, 8);
        this.bgGfx.lineStyle(1, 0x225522, 1);
        this.bgGfx.lineBetween(CON_X, CON_Y + CON_H, CON_X + CON_W, CON_Y + CON_H);
    }

    // ── Log ───────────────────────────────────────────────────

    private log(msg: string, _color: string = '#aaffaa'): void {
        this.history.push(msg);
        if (this.history.length > MAX_LINES) this.history.shift();
        this.refreshOutput();
    }

    private logOk(msg: string):   void { this.log(`✓ ${msg}`); }
    private logErr(msg: string):  void { this.log(`✗ ${msg}`); }
    private logInfo(msg: string): void { this.log(`  ${msg}`); }

    private refreshOutput(): void {
        this.outputText.setText(this.history.join('\n'));
    }

    // ── Input clavier ─────────────────────────────────────────

    private handleKey(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            this.close();
            return;
        }

        if (e.key === 'Enter') {
            if (this.inputStr.trim()) {
                this.inputHistory.unshift(this.inputStr);
                this.historyIdx = -1;
                this.log(`> ${this.inputStr}`);
                this.execute(this.inputStr);
                this.inputStr = '';
                this.inputText.setText('');
            }
            return;
        }

        if (e.key === 'Backspace') {
            this.inputStr = this.inputStr.slice(0, -1);
            this.inputText.setText(this.inputStr);
            return;
        }

        if (e.key === 'ArrowUp') {
            this.historyIdx = Math.min(this.historyIdx + 1, this.inputHistory.length - 1);
            if (this.inputHistory[this.historyIdx]) {
                this.inputStr = this.inputHistory[this.historyIdx];
                this.inputText.setText(this.inputStr);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            this.historyIdx = Math.max(this.historyIdx - 1, -1);
            this.inputStr = this.historyIdx >= 0 ? (this.inputHistory[this.historyIdx] ?? '') : '';
            this.inputText.setText(this.inputStr);
            return;
        }

        if (e.key.length === 1) {
            this.inputStr += e.key;
            this.inputText.setText(this.inputStr);
        }
    }

    // ── Exécution des commandes ───────────────────────────────

    private execute(raw: string): void {
        const parts = raw.trim().toLowerCase().split(/\s+/);
        const cmd   = parts[0];
        const args  = parts.slice(1);

        switch (cmd) {

            case 'heal': {
                const arena = this.getArena();
                if (!arena) return this.logErr('ArenaScene non trouvée');
                const player = arena.player;
                player.hp = runStats.maxHp;
                // Mettre à jour l'UI
                eventBus.emit('PLAYER_HEALED', { hp: player.hp });
                this.logOk(`PV remis à ${runStats.maxHp}`);
                break;
            }

            case 'kill': {
                this.logErr('Commande désactivée');
                break;
            }

            case 'tp': {
                const sub = args[0];
                if (!sub) return this.logErr('Usage : tp pre [1|2|3|f] | tp boss [f] | tp morn');
                const arena = this.getArena();
                if (!arena) return this.logErr('ArenaScene non trouvée');
                if (sub === 'morn') {
                    this.tpMorn(arena, args[1]);
                } else if (sub === 'boss' || sub === 'pre') {
                    this.tpBoss(arena, sub as 'boss' | 'pre', args[1]);
                } else {
                    this.logErr(`Sous-commande inconnue : ${sub}`);
                }
                break;
            }

            case 'speed': {
                const val = parseFloat(args[0]);
                if (isNaN(val)) return this.logErr('Usage : speed [pourcentage] (ex: speed 150, speed 0 = reset)');
                // 0 = reset à normal
                debugOverrides.speedOverride = val === 0 ? 1 : val / 100;
                this.logOk(val === 0 ? 'Vitesse remise à la normale' : `Vitesse forcée à ${val}%`);
                break;
            }

            case 'atk': {
                const val = parseFloat(args[0]);
                if (isNaN(val)) return this.logErr('Usage : atk [pourcentage] (ex: atk 200, atk 0 = reset)');
                // 0 = reset à normal
                debugOverrides.atkOverride = val === 0 ? 1 : val / 100;
                this.logOk(val === 0 ? 'Attaque remise à la normale' : `Attaque forcée à ${val}%`);
                break;
            }

            case 'god': {
                debugOverrides.godMode = !debugOverrides.godMode;
                this.logOk(`Mode dieu : ${debugOverrides.godMode ? 'ON' : 'OFF'}`);
                // En godMode, ouvrir les portes de la salle courante si elle a des ennemis
                if (debugOverrides.godMode) {
                    const arena = this.getArena();
                    if (arena) arena.roomManager.refreshDoors();
                }
                break;
            }

            case 'free': {
                debugOverrides.freeShop = !debugOverrides.freeShop;
                this.logOk(`Shop gratuit : ${debugOverrides.freeShop ? 'ON' : 'OFF'}`);
                break;
            }

            case 'revealmap': {
                const arena = this.getArena();
                if (!arena) return this.logErr('ArenaScene non trouvée');
                arena.miniMap.revealAll();
                this.logOk('Minimap complète révélée');
                break;
            }

            case 'unlock': {
                const arena = this.getArena();
                if (!arena) return this.logErr('ArenaScene non trouvée');
                arena.dungeonGraph.getAllRooms().forEach((r: RoomNode) => {
                    r.hiddenConnections.clear();
                    if (r.state === 'unvisited') r.state = 'active';
                });
                arena.miniMap.revealAll();
                arena.roomManager.refreshDoors();
                this.logOk('Toutes les salles débloquées + minimap révélée');
                break;
            }

            case 'haine': {
                const n = parseInt(args[0] ?? '1');
                if (isNaN(n) || n < 0) return this.logErr('Usage : haine [n] (entier positif)');
                for (let i = 0; i < n; i++) runStats.absorb('haine');
                this.logOk(`+${n} haine pure  (total ce run : ${runStats.haineCollected})`);
                break;
            }

            case 'buff': {
                const sub = args[0];
                if (sub === 'atk') {
                    buffManager.apply('gerbil_attack', 'ATK +50%', 30000);
                    this.logOk('Buff ATK +50% appliqué (30s)');
                } else if (sub === 'hp') {
                    buffManager.apply('gerbil_hp', '+1 slot PV', 99999999);
                    this.logOk('+1 slot PV temporaire appliqué');
                } else {
                    this.logErr('Usage : buff atk | buff hp');
                }
                break;
            }

            case 'clear':
                this.history = [];
                this.refreshOutput();
                break;

            case 'help':
                this.log('─── Commandes WindlessLand ──────────────');
                this.logInfo('heal                  — soigne Trixx au max');
                this.logInfo('tp pre  [1|2|3|f]     — TP antichambre (zone 1-3 ou f=final)');
                this.logInfo('tp boss [f]           — TP salle boss directement');
                this.logInfo('tp morn [1|2|3]       — TP salle Morn');
                this.logInfo('speed [%]             — force la vitesse (0=reset)');
                this.logInfo('atk   [%]             — force l\'attaque (0=reset)');
                this.logInfo('god                   — invincibilité + portes ouvertes');
                this.logInfo('free                  — shop gerbille gratuit toggle');
                this.logInfo('haine [n]             — donne n haine pure ce run');
                this.logInfo('revealmap             — révèle toute la minimap');
                this.logInfo('unlock                — débloque toutes les salles');
                this.logInfo('buff atk | buff hp    — buffs temporaires gerbille');
                this.logInfo('clear                 — vide l\'historique console');
                this.logInfo('help                  — affiche cette aide');
                break;

            default:
                this.logErr(`Commande inconnue : "${cmd}". Tape "help".`);
        }
    }

    // ── Helpers de TP ─────────────────────────────────────────

    private tpBoss(arena: IArenaScene, type: 'boss' | 'pre', idxArg: string | undefined): void {
        // Argument obligatoire
        if (!idxArg) {
            if (type === 'pre') return this.logErr('Usage : tp pre [1|2|3|f]  — zone obligatoire');
            return this.logErr('Usage : tp boss [f]  — argument obligatoire');
        }

        const rooms = arena.dungeonGraph.getAllRooms();
        const preBoss = rooms.find(r => r.type === 'pre_boss');
        const bossId  = arena.dungeonGraph.finalBossId;
        const bossRoomData = bossId >= 0 ? arena.dungeonGraph.getRoom(bossId) : null;

        if (!preBoss) return this.logErr('Aucune salle antichambre (pre_boss) trouvée');
        if (!bossRoomData) return this.logErr('Aucune salle boss trouvée dans ce donjon');

        const wantFinal = idxArg === 'f';
        const zoneNum   = wantFinal ? 4 : parseInt(idxArg);

        if (!wantFinal && (isNaN(zoneNum) || zoneNum < 1 || zoneNum > 3)) {
            return this.logErr(type === 'pre'
                ? 'Usage : tp pre [1|2|3|f]  — zone 1 à 3, ou f pour le boss final'
                : 'Usage : tp boss [f]  — seul "f" est accepté');
        }

        // ── Forcer la zone ────────────────────────────────────
        metaProgress.debugSetZone(zoneNum);
        debugSetMornDialogueZone(zoneNum);
        arena.dungeonGraph.setZone(zoneNum);
        this.logInfo(`Zone forcée à ${zoneNum}`);

        // ── Patcher la salle boss ─────────────────────────────
        if (wantFinal) {
            bossRoomData.type         = 'boss_final';
            bossRoomData.enemies      = null;
            bossRoomData.state        = 'unvisited';
            bossRoomData.ambientColor = 0x0a0a0a;
            bossRoomData.wallColor    = 0xcc0000;
            this.logInfo('Salle boss convertie en boss_final (morn_boss)');
        } else {
            bossRoomData.type    = 'boss';
            bossRoomData.enemies = null;
            bossRoomData.state   = 'unvisited';
        }

        if (type === 'pre') {
            this.logOk(`TP vers antichambre boss (salle #${preBoss.id})`);
            arena.roomManager.debugTeleport(preBoss.id);
            this.close();
        } else {
            if (wantFinal) {
                this.logOk(`TP vers salle boss final (salle #${bossId})`);
                this.scene.stop('DebugConsoleScene');
                this.scene.resume('ArenaScene');
                this.scene.get('ArenaScene').time.delayedCall(100, () => {
                    arena.roomManager.debugTeleport(bossId);
                });
            } else {
                this.logOk(`TP vers salle boss (salle #${bossId})`);
                arena.roomManager.debugTeleport(bossId);
                this.close();
            }
        }
    }

    private tpMorn(arena: IArenaScene, zoneArg: string | undefined): void {
        // Argument obligatoire
        if (!zoneArg) return this.logErr('Usage : tp morn [1|2|3]  — zone obligatoire');

        if (zoneArg === '4') {
            return this.logErr('Zone 4 invalide — Morn est le boss final, utilise tp pre f');
        }

        const zoneNum = parseInt(zoneArg);
        if (isNaN(zoneNum) || zoneNum < 1 || zoneNum > 3) {
            return this.logErr('Usage : tp morn [1|2|3]  — zone 1 à 3 uniquement');
        }

        const rooms = arena.dungeonGraph.getAllRooms();
        const npc   = rooms.find(r => r.type === 'npc');
        if (!npc) return this.logErr('Aucune salle NPC trouvée');

        metaProgress.debugSetZone(zoneNum);
        debugSetMornDialogueZone(zoneNum);
        this.logInfo(`Zone forcée à ${zoneNum}`);

        // Révéler la porte NPC depuis la salle boss
        const bossRoom = rooms.find(r => r.type === 'boss' || r.type === 'boss_final');
        if (bossRoom) {
            arena.dungeonGraph.revealNpcDoor(bossRoom.id);
            runStats.absorb('haine');
            this.logInfo('+1 haine pure simulée (mort boss)');
        }

        this.logOk(`TP vers salle Morn (salle #${npc.id})`);
        arena.roomManager.debugTeleport(npc.id);
        this.close();
    }

    // ── Accès typé à ArenaScene ───────────────────────────────

    private getArena(): IArenaScene | null {
        const scene = this.scene.get('ArenaScene');
        return scene ? (scene as unknown as IArenaScene) : null;
    }

    // ── Fermeture ─────────────────────────────────────────────

    private close(): void {
        this.scene.stop('DebugConsoleScene');
        this.scene.resume('ArenaScene');
    }

    // ── API statique (lue par RunStats / Player) ──────────────

    static get godMode():       boolean { return debugOverrides.godMode; }
    static get freeShop():      boolean { return debugOverrides.freeShop; }
    static get speedOverride(): number  { return debugOverrides.speedOverride; }
    static get atkOverride():   number  { return debugOverrides.atkOverride; }

    static reset(): void {
        debugOverrides.reset();
    }
}