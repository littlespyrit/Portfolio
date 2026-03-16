import type { Player } from '../entities/Player';
import type { EnemyManager } from '../systems/combat/EnemyManager';
import type { RoomManager } from '../systems/dungeon/RoomManager';
import type { DungeonGraph } from '../systems/dungeon/DungeonGraph';
import type { MiniMap } from '../systems/ui/MiniMap';

export interface IArenaScene {
    readonly player:        Player;
    readonly enemyManager:  EnemyManager;
    readonly roomManager:   RoomManager;
    readonly dungeonGraph:  DungeonGraph;
    readonly miniMap:       MiniMap;
}
