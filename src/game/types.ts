import type { EmotionType } from './systems/core/RunStats';

// ── Ennemis ───────────────────────────────────────────────────

export type EnemyBehavior = 'chase' | 'erratic' | 'ghost' | 'flanker' | 'dasher' | 'boss';

export interface EnemyConfig {
    id:               string;
    label:            string;
    color:            string;
    hp:               number;
    speed:            number;
    damage:           number;
    attackRange:      number;
    attackCooldownMs: number;
    scoreValue:       number;
    size:             number;
    behavior:         EnemyBehavior;
    spawnWeight:      number;
    knockbackResist:  number;
    emotion:          EmotionType;
    aggroDelayMs?:    number;
    projectileSpeed?:      number;
    projectileDamage?:     number;
    projectileCooldownMs?: number;
}

// ── Salles ────────────────────────────────────────────────────

export interface RoomEnemyPlacement {
    enemyId: string;
    x:       number;
    y:       number;
}

export interface RoomDefinition {
    id:          number;
    isBoss:      boolean;
    bgColor:     number;
    wallColor:   number;
    enemies:     RoomEnemyPlacement[];
}

// ── États du joueur ───────────────────────────────────────────

export type PlayerState =
    | 'idle'
    | 'moving'
    | 'attacking'
    | 'dodging'
    | 'defending'
    | 'hit'
    | 'dead';

// ── Événements ────────────────────────────────────────────────

export type GameEventType =
    | 'ENEMY_KILLED'
    | 'PLAYER_HIT'
    | 'PLAYER_HEALED'
    | 'PLAYER_DEAD'
    | 'ROOM_CLEAR'
    | 'PERFECT_PARRY'
    | 'COMBO_UPDATE'
    | 'SCORE_UPDATE'
    | 'ORB_COLLECTED'
    | 'DOOR_ENTER'
    | 'ROOM_NPC'
    | 'PLAYER_JUMP_HOLE'
    | 'PLAYER_LAND_HOLE'
    | 'MORN_DOOR_OPEN'
    | 'MORN_TELEPORT'
    | 'MORN_FINAL_DIALOGUE_DONE'
    | 'MORN_START_FINAL_DIALOGUE'
    | 'CONTROLS_CHANGED'
    | 'HEAL_ORB_COLLECT'
    | 'BOSS_SPAWN_ADDS'
    | 'MORN_TELEPORT_NEXT_BOSS';

export interface GameEvent {
    type:     GameEventType;
    payload?: Record<string, unknown>;
}

// ── Score / Combo ─────────────────────────────────────────────

export interface ScoreState {
    total:      number;
    combo:      number;
    multiplier: number;
    room:       number;
}

// ── High Score ────────────────────────────────────────────────

export interface ScoreEntry {
    score: number;
    room:  number;
    zone:  number;
    seed:  number;
    date:  string;
}

// ── Donjon / Salles ───────────────────────────────────────────

export type RoomType =
    | 'start'
    | 'normal'
    | 'trap'
    | 'boss'
    | 'boss_final'
    | 'pre_boss'
    | 'npc'
    | 'empty';

export type RoomState =
    | 'unvisited'
    | 'active'
    | 'cleared';

export type Direction = 'north' | 'south' | 'east' | 'west';

export const OPPOSITE: Record<Direction, Direction> = {
    north: 'south', south: 'north',
    east:  'west',  west:  'east',
};

export interface RoomEnemy {
    enemyId: string;
    x:       number;
    y:       number;
    index:   number;
}

export type BreakableVariant = 'crate' | 'barrel' | 'urn';

export interface RoomBreakable {
    variant: BreakableVariant;
    x:       number;
    y:       number;
    broken:  boolean;
}

export interface RoomNode {
    id:                 number;
    type:               RoomType;
    state:              RoomState;
    depth:              number;
    col:                number;
    row:                number;
    connections:        Map<Direction, number>;
    hiddenConnections:  Set<Direction>;
    enemies:            RoomEnemy[] | null;
    killedIndices:      Set<number>;
    breakables:         RoomBreakable[] | null;
    ambientColor:       number;
    wallColor:          number;
    maxDoors?:          number;
}