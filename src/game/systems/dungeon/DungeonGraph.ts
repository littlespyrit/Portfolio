import { SeededRNG } from '../core/SeededRNG';
import type { RoomType, Direction, RoomNode, RoomEnemy, RoomBreakable, BreakableVariant } from '../../types';
import { OPPOSITE } from '../../types';

const DIR_DELTA: Record<Direction, { dc: number; dr: number }> = {
    north: { dc:  0, dr: -1 },
    south: { dc:  0, dr:  1 },
    east:  { dc:  1, dr:  0 },
    west:  { dc: -1, dr:  0 },
};

const GRID_COLS   = 7;
const GRID_ROWS   = 5;
const CORRIDOR_MIN = 10;
const CORRIDOR_MAX = 14;
const TRAP_COUNT  = 2;
const EMPTY_COUNT = 1;

const AMBIENT: Record<RoomType, { bg: number; wall: number }> = {
    start:      { bg: 0x1a1a2e, wall: 0x4a3a6a },
    normal:     { bg: 0x1a1a2e, wall: 0x8e44ad },
    trap:       { bg: 0x1a1a2e, wall: 0x8e44ad },
    boss:       { bg: 0x1a0a0a, wall: 0x8b0000 },
    boss_final: { bg: 0x0a0a0a, wall: 0xcc0000 },
    pre_boss:   { bg: 0x1a0a05, wall: 0xff6600 },
    npc:        { bg: 0x12121e, wall: 0x2a4a6a },
    empty:      { bg: 0x141420, wall: 0x2a2a3a },
};

function enemyPool(depth: number): string[] {
    const pool = ['grunt'];
    if (depth >= 2) pool.push('speeder');
    if (depth >= 3) pool.push('brute', 'ghost');
    if (depth >= 4) pool.push('flanker', 'dasher');
    if (depth >= 6) pool.push('tank');
    return pool;
}

function enemyCount(depth: number, rng: SeededRNG): number {
    return Math.min(2 + Math.floor(depth * 0.8) + rng.nextInt(0, 2), 8);
}

export class DungeonGraph {
    private rooms:  Map<number, RoomNode> = new Map();
    private grid:   Map<string, number>   = new Map();
    private rng:    SeededRNG;
    private nextId: number = 0;
    private zone:   number;

    public startId:     number   = 0;
    public finalBossId: number   = -1;
    public bossIds:     number[] = [];

    constructor(rng: SeededRNG, zone: number = 1) {
        this.rng  = rng;
        this.zone = zone;
        this.generate();
    }

    // ── API publique ──────────────────────────────────────────

    getRoom(id: number): RoomNode | undefined { return this.rooms.get(id); }
    getAllRooms(): RoomNode[] { return Array.from(this.rooms.values()); }

    /** Permet de forcer la zone (debug) — affecte la génération des ennemis boss. */
    setZone(zone: number): void { this.zone = zone; }

    getNeighbors(id: number): Array<{ direction: Direction; room: RoomNode }> {
        const room = this.rooms.get(id);
        if (!room) return [];
        const result: Array<{ direction: Direction; room: RoomNode }> = [];
        room.connections.forEach((neighborId: number, dir: Direction) => {
            const neighbor = this.rooms.get(neighborId);
            if (neighbor) result.push({ direction: dir, room: neighbor });
        });
        return result;
    }

    ensureContent(id: number): void {
        const room = this.rooms.get(id);
        if (!room) return;
        if (room.enemies === null) {
            if (['start', 'empty', 'npc', 'pre_boss'].includes(room.type)) {
                room.enemies = [];
            } else if (room.type === 'boss' || room.type === 'boss_final') {
                room.enemies = this.generateBossEnemies();
            } else {
                room.enemies = this.placeEnemies(enemyCount(room.depth, this.rng), enemyPool(room.depth));
            }
        }
        if (room.breakables === null) {
            room.breakables = this.generateBreakables(room.type);
        }
    }

    debugPrint(): void {
        if (process.env.NODE_ENV !== 'development') return;
        console.log(`=== DungeonGraph (${this.rooms.size} salles) ===`);
        this.rooms.forEach((room: RoomNode) => {
            const conns = Array.from(room.connections.entries()).map(([d, id]) => `${d}→${id}`).join(', ');
            console.log(`  [${room.id}] (${room.col},${room.row}) ${room.type.padEnd(10)} depth:${room.depth}  [${conns}]`);
        });
        console.log(`  Start: ${this.startId}  FinalBoss: ${this.finalBossId}  Bosses: [${this.bossIds}]`);
    }

    // ── Génération ────────────────────────────────────────────

    private generate(): void {
        this.buildCorridor();
        this.addExtraEdges();
        this.computeDepths();
        this.assignTypes();
        this.applyColors();
        this.hideNpcDoors();
    }

    // ── Étape 1 : Couloir connexe garanti ────────────────────

    private buildCorridor(): void {
        const target   = CORRIDOR_MIN + this.rng.nextInt(0, CORRIDOR_MAX - CORRIDOR_MIN);
        const startCol = Math.floor(GRID_COLS / 2);
        const startRow = Math.floor(GRID_ROWS / 2);

        const cells: Array<{col: number; row: number}> = [];
        const visited = new Set<string>();
        const frontier: Array<{col: number; row: number}> = [];

        visited.add(`${startCol},${startRow}`);
        cells.push({ col: startCol, row: startRow });

        for (const dir of ['north', 'south', 'east', 'west'] as Direction[]) {
            const nc = startCol + DIR_DELTA[dir].dc;
            const nr = startRow + DIR_DELTA[dir].dr;
            if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
                frontier.push({ col: nc, row: nr });
            }
        }

        while (cells.length < target && frontier.length > 0) {
            const idx = this.rng.nextInt(0, frontier.length - 1);
            const { col, row } = frontier[idx];
            frontier.splice(idx, 1);
            const key = `${col},${row}`;
            if (visited.has(key)) continue;
            visited.add(key);
            cells.push({ col, row });
            for (const dir of ['north', 'south', 'east', 'west'] as Direction[]) {
                const nc = col + DIR_DELTA[dir].dc;
                const nr = row + DIR_DELTA[dir].dr;
                if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
                    const nk = `${nc},${nr}`;
                    if (!visited.has(nk)) frontier.push({ col: nc, row: nr });
                }
            }
        }

        for (const { col: c, row: r } of cells) {
            const id = this.nextId++;
            this.rooms.set(id, this.makeRoom(id, c, r));
            this.grid.set(`${c},${r}`, id);
        }

        const startKey = `${startCol},${startRow}`;
        if (!this.grid.has(startKey)) {
            const id = this.nextId++;
            this.rooms.set(id, this.makeRoom(id, startCol, startRow));
            this.grid.set(startKey, id);
        }
        this.startId = this.grid.get(startKey)!;

        const inTree  = new Set<number>([this.startId]);
        const allIds  = Array.from(this.rooms.keys());

        while (inTree.size < this.rooms.size) {
            const edges: Array<{from: number; to: number; dir: Direction}> = [];
            inTree.forEach(fromId => {
                const fromRoom = this.rooms.get(fromId)!;
                this.getGridNeighborsRaw(fromRoom.col, fromRoom.row).forEach(n => {
                    if (!inTree.has(n.id)) {
                        edges.push({ from: fromId, to: n.id, dir: n.dirFromNew });
                    }
                });
            });

            if (edges.length === 0) {
                const isolated = allIds.find(id => !inTree.has(id));
                if (isolated === undefined) break;
                const iRoom = this.rooms.get(isolated)!;
                let best: {id: number; dist: number} = {id: -1, dist: Infinity};
                inTree.forEach(tid => {
                    const tr = this.rooms.get(tid)!;
                    const d = Math.abs(tr.col - iRoom.col) + Math.abs(tr.row - iRoom.row);
                    if (d < best.dist) best = {id: tid, dist: d};
                });
                if (best.id >= 0) {
                    const tr = this.rooms.get(best.id)!;
                    const dc = tr.col - iRoom.col;
                    const dr = tr.row - iRoom.row;
                    const dir: Direction = Math.abs(dc) >= Math.abs(dr)
                        ? (dc > 0 ? 'east' : 'west')
                        : (dr > 0 ? 'south' : 'north');
                    this.connectRooms(isolated, best.id, dir);
                }
                inTree.add(isolated);
                continue;
            }

            const edge = edges[this.rng.nextInt(0, edges.length - 1)];
            this.connectRooms(edge.from, edge.to, edge.dir);
            inTree.add(edge.to);
        }
    }

    // ── Étape 2 : Arêtes bonus ────────────────────────────────

    private addExtraEdges(): void {
        const candidates: Array<{a: number; b: number; dir: Direction}> = [];
        this.rooms.forEach((room: RoomNode) => {
            this.getGridNeighborsRaw(room.col, room.row).forEach(n => {
                if (!room.connections.has(n.dirFromNew)) {
                    candidates.push({ a: room.id, b: n.id, dir: n.dirFromNew });
                }
            });
        });
        this.rng.shuffle(candidates);
        let added = 0;
        for (const { a, b, dir } of candidates) {
            if (added >= 2) break;
            if (!this.rooms.get(a)!.connections.has(dir)) {
                this.connectRooms(a, b, dir);
                added++;
            }
        }
    }

    // ── Étape 3 : Profondeurs BFS ─────────────────────────────

    private computeDepths(): void {
        const queue   = [this.startId];
        const visited = new Set<number>([this.startId]);
        this.rooms.get(this.startId)!.depth = 0;
        while (queue.length > 0) {
            const id   = queue.shift()!;
            const room = this.rooms.get(id)!;
            room.connections.forEach((nId: number) => {
                if (!visited.has(nId)) {
                    visited.add(nId);
                    this.rooms.get(nId)!.depth = room.depth + 1;
                    queue.push(nId);
                }
            });
        }
    }

    // ── Étape 4 : Assignation des types ──────────────────────

    private assignTypes(): void {
        // ── Trouver les deux feuilles les plus éloignées ──────

        const bfs = (fromId: number): Map<number, number> => {
            const dist = new Map<number, number>();
            dist.set(fromId, 0);
            const queue = [fromId];
            while (queue.length > 0) {
                const id = queue.shift()!;
                this.rooms.get(id)!.connections.forEach((nId: number) => {
                    if (!dist.has(nId)) {
                        dist.set(nId, dist.get(id)! + 1);
                        queue.push(nId);
                    }
                });
            }
            return dist;
        };

        const isLeaf = (r: RoomNode) => r.connections.size === 1;

        const dist1 = bfs(this.startId);
        let newStartId = this.startId;
        let maxDist1 = -1;
        dist1.forEach((d, id) => {
            const r = this.rooms.get(id)!;
            if (isLeaf(r) && d > maxDist1) { maxDist1 = d; newStartId = id; }
        });

        const dist2 = bfs(newStartId);
        let preBossId = -1;
        let maxDist2 = -1;
        dist2.forEach((d, id) => {
            if (id === newStartId) return;
            const r = this.rooms.get(id)!;
            if (isLeaf(r) && d > maxDist2) { maxDist2 = d; preBossId = id; }
        });

        if (preBossId < 0) {
            let maxD = -1;
            dist2.forEach((d, id) => { if (id !== newStartId && d > maxD) { maxD = d; preBossId = id; } });
        }

        this.startId = newStartId;

        const start = this.rooms.get(this.startId)!;
        start.type  = 'start';
        start.state = 'cleared';
        if (start.connections.size > 1) {
            const dist3 = bfs(preBossId);
            const sorted = Array.from(start.connections.entries())
                .sort(([, aId], [, bId]) => (dist3.get(bId) ?? 0) - (dist3.get(aId) ?? 0));
            for (let i = 1; i < sorted.length; i++) {
                const [dir, nId] = sorted[i];
                start.connections.delete(dir);
                const neighbor = this.rooms.get(nId);
                if (neighbor) {
                    neighbor.connections.forEach((id, d) => {
                        if (id === this.startId) neighbor.connections.delete(d);
                    });
                }
            }
        }

        const preBossRoom = this.rooms.get(preBossId)!;
        preBossRoom.type = 'pre_boss';

        const isFinalZone = this.zone >= 4;
        const bossCol  = GRID_COLS + 1;
        const bossRow  = preBossRoom.row;
        const bossId   = this.nextId++;
        const bossType = isFinalZone ? 'boss_final' : 'boss';
        const bossRoom: RoomNode = {
            id: bossId, type: bossType, state: 'unvisited',
            depth: preBossRoom.depth + 1,
            col: bossCol, row: bossRow,
            connections: new Map(),
            hiddenConnections: new Set(),
            enemies: null, killedIndices: new Set(), breakables: null,
            ambientColor: isFinalZone ? 0x0a0a0a : 0x1a0a0a,
            wallColor:    isFinalZone ? 0xcc0000 : 0x8b0000,
        };
        this.rooms.set(bossId, bossRoom);
        this.finalBossId = bossId;
        this.bossIds     = [bossId];

        const npcId = this.nextId++;
        const npcRoom: RoomNode = {
            id: npcId, type: 'npc', state: 'unvisited',
            depth: preBossRoom.depth + 2,
            col: bossCol + 1, row: bossRow,
            connections: new Map(),
            hiddenConnections: new Set(),
            enemies: null, killedIndices: new Set(), breakables: null,
            ambientColor: 0x12121e, wallColor: 0x2a4a6a,
        };
        this.rooms.set(npcId, npcRoom);

        bossRoom.connections.set('north', npcId);
        npcRoom.connections.set('south', bossId);

        const remaining = Array.from(this.rooms.values())
            .filter(r => r.type === 'normal');
        this.rng.shuffle(remaining);
        let traps = 0, empties = 0;
        for (const room of remaining) {
            if (traps < TRAP_COUNT)   { room.type = 'trap';  traps++;   }
            else if (empties < EMPTY_COUNT) { room.type = 'empty'; empties++; }
            else break;
        }
    }

    // ── Étape 6 : Cache porte boss→npc ───────────────────────

    private hideNpcDoors(): void {
        this.rooms.forEach((room: RoomNode) => {
            if (room.type !== 'boss' && room.type !== 'boss_final') return;
            room.connections.forEach((neighborId: number, dir: Direction) => {
                const neighbor = this.rooms.get(neighborId);
                if (neighbor?.type === 'npc') {
                    room.hiddenConnections.add(dir);
                    neighbor.connections.forEach((nid: number, ndir: Direction) => {
                        if (nid === room.id) neighbor.hiddenConnections.add(ndir);
                    });
                }
            });
        });
    }

    public revealNpcDoor(bossRoomId: number): void {
        const boss = this.rooms.get(bossRoomId);
        if (!boss) return;
        boss.connections.forEach((neighborId: number, dir: Direction) => {
            const neighbor = this.rooms.get(neighborId);
            if (neighbor?.type === 'npc') {
                boss.hiddenConnections.delete(dir);
                neighbor.connections.forEach((nid: number, ndir: Direction) => {
                    if (nid === bossRoomId) neighbor.hiddenConnections.delete(ndir);
                });
            }
        });
    }

    // ── Étape 5 : Couleurs ────────────────────────────────────

    private applyColors(): void {
        this.rooms.forEach((room: RoomNode) => {
            const c = AMBIENT[room.type];
            room.ambientColor = c.bg;
            room.wallColor    = c.wall;
        });
    }

    // ── Helpers ───────────────────────────────────────────────

    private makeRoom(id: number, col: number, row: number): RoomNode {
        return {
            id, type: 'normal', state: 'unvisited',
            depth: 0, col, row,
            connections: new Map(),
            hiddenConnections: new Set(),
            enemies: null, killedIndices: new Set(), breakables: null,
            ambientColor: 0x1a1a2e, wallColor: 0x8e44ad,
        };
    }

    private getGridNeighborsRaw(col: number, row: number): Array<{id: number; dirFromNew: Direction}> {
        const result: Array<{id: number; dirFromNew: Direction}> = [];
        for (const dir of ['north', 'south', 'east', 'west'] as Direction[]) {
            const key = `${col + DIR_DELTA[dir].dc},${row + DIR_DELTA[dir].dr}`;
            const id  = this.grid.get(key);
            if (id !== undefined) result.push({ id, dirFromNew: dir });
        }
        return result;
    }

    private connectRooms(aId: number, bId: number, dirFromA: Direction): void {
        const roomA = this.rooms.get(aId)!;
        const roomB = this.rooms.get(bId)!;
        if (roomA.connections.has(dirFromA)) return;
        roomA.connections.set(dirFromA, bId);
        roomB.connections.set(OPPOSITE[dirFromA], aId);
    }

    // ── Contenu ───────────────────────────────────────────────

    private placeEnemies(count: number, pool: string[]): RoomEnemy[] {
        const enemies: RoomEnemy[] = [];
        const SAFE_MIN = 0.25, SAFE_MAX = 0.75, CENTER_R = 0.14;
        const cols = 3;
        for (let i = 0; i < count; i++) {
            let gx = 0, gy = 0, tries = 0;
            do {
                gx = SAFE_MIN + ((i % cols) / (cols - 1)) * (SAFE_MAX - SAFE_MIN) + (this.rng.next() * 0.08 - 0.04);
                gy = SAFE_MIN + (Math.floor(i / cols) / Math.max(Math.ceil(count / cols) - 1, 1)) * (SAFE_MAX - SAFE_MIN) + (this.rng.next() * 0.08 - 0.04);
                gx = Math.max(SAFE_MIN, Math.min(SAFE_MAX, gx));
                gy = Math.max(SAFE_MIN, Math.min(SAFE_MAX, gy));
                tries++;
            } while (tries < 10 && Math.abs(gx - 0.5) < CENTER_R && Math.abs(gy - 0.5) < CENTER_R);
            enemies.push({ enemyId: pool[this.rng.nextInt(0, pool.length - 1)], x: gx, y: gy, index: i });
        }
        return enemies;
    }

    private generateBreakables(roomType: RoomType): RoomBreakable[] {
        const VARIANTS: BreakableVariant[] = ['crate', 'barrel', 'urn'];
        let minCount = 0, maxCount = 0, spawnChance = 1.0;
        switch (roomType) {
            case 'npc': case 'boss_final': return [];
            case 'start': case 'pre_boss': minCount = 0; maxCount = 2; spawnChance = 0.4; break;
            case 'empty':  minCount = 2; maxCount = 4; spawnChance = 1.0; break;
            case 'boss':   minCount = 0; maxCount = 1; spawnChance = 0.5; break;
            default:       minCount = 0; maxCount = 3; spawnChance = 0.65; break;
        }
        if (this.rng.next() > spawnChance) return [];
        const count = minCount + this.rng.nextInt(0, Math.max(0, maxCount - minCount));
        if (count === 0) return [];
        const BORDER = 0.08;
        const positions: {x: number; y: number}[] = [];
        for (let i = 1; i <= 3; i++) {
            const t = i / 4;
            if (Math.abs(t - 0.5) > 0.12) {
                positions.push({x: t, y: BORDER}, {x: t, y: 1 - BORDER},
                    {x: BORDER, y: t}, {x: 1 - BORDER, y: t});
            }
        }
        this.rng.shuffle(positions);
        return positions.slice(0, count).map(p => ({
            variant: VARIANTS[this.rng.nextInt(0, VARIANTS.length - 1)],
            x: p.x, y: p.y, broken: false,
        }));
    }

    private generateBossEnemies(): RoomEnemy[] {
        const enemyId = this.zone >= 4 ? 'morn_boss' : 'boss_sentinel';
        return [{ enemyId, x: 0.5, y: 0.35, index: 0 }];
    }
}