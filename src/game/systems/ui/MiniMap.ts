import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/gameConfig';
import { DungeonGraph } from '../dungeon/DungeonGraph';
import type { RoomNode } from '../../types';

// ── Constantes visuelles ──────────────────────────────────────

const COMPACT = {
    X:         16,
    Y:         16,
    NODE_SIZE: 8,
    GAP:       18,
    BG_ALPHA:  0.55,
};

const FULL = {
    NODE_SIZE: 22,
    GAP:       48,
    BG_ALPHA:  0.88,
};

const NODE_COLOR: Record<string, number> = {
    start:      0x2d7a3a,   // vert foncé — point de départ
    normal:     0x2d7a3a,   // vert foncé — salle normale
    trap:       0xcc6b1a,   // orange — piège
    boss:       0xcc2222,   // rouge — boss
    boss_final: 0xff0044,   // rouge vif — boss final
    pre_boss:   0xcc2222,   // rouge — antichambre
    npc:        0x8e44ad,   // violet — Morn
    empty:      0x2a2a3a,   // gris très sombre — vide
};

const COLOR_CURRENT   = 0x2d7a3a;  // même que normal
const COLOR_CLEARED   = 0x888899;  // gris clair — salle vidée
const COLOR_CORRIDOR  = 0x444466;
const COLOR_BORDER    = 0x8e44ad;

export class MiniMap {
    private scene:      Phaser.Scene;
    private graph:      DungeonGraph;
    private currentId:  number;

    private compactGfx!: Phaser.GameObjects.Graphics;
    private fullContainer!: Phaser.GameObjects.Container;
    private isFullOpen:  boolean = false;
    private isHidden:    boolean = false;
    private allRevealed: boolean = false;

    get isOpen(): boolean { return this.isFullOpen; }
    close(): void { this.isFullOpen = false; this.fullContainer.setVisible(false); }

    revealAll(): void {
        this.allRevealed = true;
        this.graph.getAllRooms().forEach((r: RoomNode) => {
            if (r.state === 'unvisited') r.state = 'active';
        });
        this.redrawCompact();
        if (this.isFullOpen) this.redrawFull();
    }

    setHidden(hidden: boolean): void {
        this.isHidden = hidden;
        this.compactGfx.setVisible(!hidden);
        if (hidden && this.isFullOpen) this.close();
    }

    private layout: Map<number, { gx: number; gy: number }> = new Map();

    constructor(scene: Phaser.Scene, graph: DungeonGraph, startId: number) {
        this.scene     = scene;
        this.graph     = graph;
        this.currentId = startId;

        this.computeLayout();
        this.buildCompact();
        this.buildFullOverlay();
        this.setupInput();
    }

    // ── API publique ──────────────────────────────────────────

    /** Appelé quand le joueur entre dans une nouvelle salle. */
    setCurrentRoom(id: number): void {
        this.currentId = id;
        const room = this.graph.getRoom(id);
        if (room && room.state === 'unvisited') room.state = 'active';
        if (room) {
            room.connections.forEach((neighborId: number, dir) => {
                if (room.hiddenConnections?.has(dir)) return;
                const neighbor = this.graph.getRoom(neighborId);
                if (neighbor && neighbor.state === 'unvisited') {
                    neighbor.state = 'active';
                }
            });
        }
        const hide = !!(room && ['boss','boss_final','npc'].includes(room.type));
        this.setHidden(hide);
        this.redrawCompact();
        if (this.isFullOpen) this.redrawFull();
    }

    /** Appelé quand une salle est cleared (tous ennemis morts). */
    onRoomCleared(id: number): void {
        this.redrawCompact();
        if (this.isFullOpen) this.redrawFull();
    }

    destroy(): void {
        this.compactGfx.destroy();
        this.fullContainer.destroy();
    }

    // ── Layout ────────────────────────────────────────────────

    /**
     * Utilise directement les coordonnées col/row de chaque salle.
     * La minimap reflète exactement la géographie spatiale du donjon.
     */
    private computeLayout(): void {
        this.graph.getAllRooms().forEach((room: RoomNode) => {
            this.layout.set(room.id, { gx: room.col, gy: room.row });
        });
    }

    // ── Mini-map compacte ─────────────────────────────────────

    private buildCompact(): void {
        this.compactGfx = this.scene.add.graphics().setDepth(15).setScrollFactor(0);
        this.redrawCompact();
    }

    private redrawCompact(): void {
        const g    = this.compactGfx;
        const ns   = COMPACT.NODE_SIZE;
        const gap  = COMPACT.GAP;
        g.clear();

        const { minGx, minGy, maxGx, maxGy } = this.layoutBounds();
        const cols = maxGx - minGx + 1;
        const rows = maxGy - minGy + 1;
        const w    = cols * gap + ns;
        const h    = rows * gap + ns;

        const ox = GAME_WIDTH - w - COMPACT.X;
        const oy = COMPACT.Y;

        g.fillStyle(0x0a0a1a, COMPACT.BG_ALPHA);
        g.fillRoundedRect(ox - 6, oy - 6, w + 12, h + 12, 4);
        g.lineStyle(1, COLOR_BORDER, 0.5);
        g.strokeRoundedRect(ox - 6, oy - 6, w + 12, h + 12, 4);

        this.drawRooms(g, ox, oy, minGx, minGy, gap, ns, false);
    }

    // ── Mini-map plein écran ──────────────────────────────────

    private buildFullOverlay(): void {
        this.fullContainer = this.scene.add.container(0, 0).setDepth(30).setVisible(false);
        this.redrawFull();
    }

    private redrawFull(): void {
        this.fullContainer.removeAll(true);

        const ns   = FULL.NODE_SIZE;
        const gap  = FULL.GAP;

        const { minGx, minGy, maxGx, maxGy } = this.layoutBounds();
        const cols = maxGx - minGx + 1;
        const rows = maxGy - minGy + 1;
        const w    = cols * gap + ns;
        const h    = rows * gap + ns;

        const ox = GAME_WIDTH  / 2 - w / 2;
        const oy = GAME_HEIGHT / 2 - h / 2;

        const bg = this.scene.add.rectangle(
            GAME_WIDTH / 2, GAME_HEIGHT / 2,
            GAME_WIDTH, GAME_HEIGHT,
            0x000000, FULL.BG_ALPHA,
        ).setInteractive();
        bg.on('pointerdown', () => {
            this.isFullOpen = false;
            this.fullContainer.setVisible(false);
        });
        this.fullContainer.add(bg);

        const panel = this.scene.add.graphics();
        panel.fillStyle(0x0a0a1a, 0.95);
        panel.fillRoundedRect(ox - 20, oy - 30, w + 40, h + 60, 8);
        panel.lineStyle(2, COLOR_BORDER, 0.8);
        panel.strokeRoundedRect(ox - 20, oy - 30, w + 40, h + 60, 8);
        this.fullContainer.add(panel);

        const title = this.scene.add.text(GAME_WIDTH / 2, oy - 16, 'CARTE', {
            fontSize: '13px', fontFamily: 'monospace', color: '#888899', letterSpacing: 4,
        }).setOrigin(0.5);
        this.fullContainer.add(title);

        const roomsGfx = this.scene.add.graphics();
        this.fullContainer.add(roomsGfx);
        this.drawRooms(roomsGfx, ox, oy, minGx, minGy, gap, ns, true);

        const CORRIDOR_TYPES_LBL = ['start','normal','trap','empty','pre_boss'];
        this.graph.getAllRooms().forEach((room: RoomNode) => {
            if (room.state === 'unvisited') return;
            if (!CORRIDOR_TYPES_LBL.includes(room.type)) return;
            const sx = ox + (room.col - minGx) * gap + ns / 2;
            const sy = oy + (room.row - minGy) * gap + ns / 2;
            const label = this.roomLabel(room);
            if (label) {
                const txt = this.scene.add.text(sx, sy + ns / 2 + 4, label, {
                    fontSize: '9px', fontFamily: 'monospace', color: '#aaaaaa',
                }).setOrigin(0.5, 0);
                this.fullContainer.add(txt);
            }
        });

        const hint = this.scene.add.text(GAME_WIDTH / 2, oy + h + 16, '[M] ou [Échap] pour fermer  •  clic fond pour fermer', {
            fontSize: '12px', fontFamily: 'monospace', color: '#444466',
        }).setOrigin(0.5);
        this.fullContainer.add(hint);
    }

    // ── Dessin commun ─────────────────────────────────────────

    private drawRooms(
        g: Phaser.GameObjects.Graphics,
        ox: number, oy: number,
        minGx: number, minGy: number,
        gap: number, ns: number,
        showAll: boolean,
    ): void {
        const rooms = this.graph.getAllRooms();
        const half  = ns / 2;
        const CORRIDOR_TYPES = ['start','normal','trap','empty','pre_boss'];

        const sx = (room: RoomNode) => ox + (room.col - minGx) * gap;
        const sy = (room: RoomNode) => oy + (room.row - minGy) * gap;
        const cx = (room: RoomNode) => sx(room) + half;
        const cy = (room: RoomNode) => sy(room) + half;

        const drawn = new Set<string>();
        rooms.forEach((room: RoomNode) => {
            if (room.state === 'unvisited') return;
            if (!CORRIDOR_TYPES.includes(room.type)) return;
            room.connections.forEach((neighborId: number, dir) => {
                if (room.hiddenConnections?.has(dir)) return;
                const neighbor = this.graph.getRoom(neighborId);
                if (!neighbor || neighbor.state === 'unvisited') return;
                const key = [Math.min(room.id, neighborId), Math.max(room.id, neighborId)].join('-');
                if (drawn.has(key)) return;
                drawn.add(key);
                g.lineStyle(showAll ? 3 : 1, COLOR_CORRIDOR, 0.6);
                g.lineBetween(cx(room), cy(room), cx(neighbor), cy(neighbor));
            });
        });

        rooms.forEach((room: RoomNode) => {
            if (room.state === 'unvisited') return;
            if (!CORRIDOR_TYPES.includes(room.type)) return;
            const x = sx(room);
            const y = sy(room);

            const isCurrent = room.id === this.currentId;
            const color = room.state === 'cleared'
                ? COLOR_CLEARED
                : (NODE_COLOR[room.type] ?? 0x8e44ad);

            if (showAll) {
                g.fillStyle(0x000000, 0.4);
                g.fillRect(x + 2, y + 2, ns, ns);
            }

            g.fillStyle(color, 1);
            g.fillRect(x, y, ns, ns);

            // Salle courante : bordure blanche bien visible
            if (isCurrent) {
                g.lineStyle(showAll ? 2 : 1.5, 0xffffff, 1);
                g.strokeRect(x - 1, y - 1, ns + 2, ns + 2);
            }
        });
    }

    // ── Helpers ───────────────────────────────────────────────

    private layoutBoundsSize(): { w: number; h: number } {
        const b = this.layoutBounds();
        const cols = b.maxGx - b.minGx + 1;
        const rows = b.maxGy - b.minGy + 1;
        return { w: cols * COMPACT.GAP, h: rows * COMPACT.GAP };
    }

    private layoutBounds(): { minGx: number; minGy: number; maxGx: number; maxGy: number } {
        const CORRIDOR_TYPES = ['start','normal','trap','empty','pre_boss'];
        let minGx = Infinity, minGy = Infinity, maxGx = -Infinity, maxGy = -Infinity;
        this.graph.getAllRooms().forEach((room: RoomNode) => {
            if (!CORRIDOR_TYPES.includes(room.type)) return;
            if (room.col < minGx) minGx = room.col;
            if (room.row < minGy) minGy = room.row;
            if (room.col > maxGx) maxGx = room.col;
            if (room.row > maxGy) maxGy = room.row;
        });
        if (!isFinite(minGx)) return { minGx: 0, minGy: 0, maxGx: 0, maxGy: 0 };
        return { minGx, minGy, maxGx, maxGy };
    }

    private roomLabel(room: RoomNode): string {
        switch (room.type) {
            case 'boss':       return 'BOSS';
            case 'boss_final': return 'MORN';
            case 'pre_boss':   return '⚠';
            case 'npc':        return 'PNJ';
            case 'start':      return 'START';
            case 'empty':      return 'VIDE';
            default:           return '';
        }
    }

    // ── Input ─────────────────────────────────────────────────

    private setupInput(): void {
        this.scene.input.keyboard!.addKey('M').on('down', () => {
            this.isFullOpen = !this.isFullOpen;
            this.fullContainer.setVisible(this.isFullOpen);
            if (this.isFullOpen) this.redrawFull();
        });
    }
}