import * as Phaser from 'phaser';
import { Enemy, EnemyFactory, SEPARATION_RADIUS, SEPARATION_FORCE } from '../../entities/Enemy';
import { ARENA } from '../../config/gameConfig';
import { SeededRNG } from '../core/SeededRNG';

/**
 * Gestion centralisée du cycle de vie des ennemis en arène.
 *
 * Responsabilités :
 *   - Posséder le groupe Phaser (exposé en readonly pour les colliders)
 *   - Spawner les ennemis via EnemyFactory à une position donnée
 *   - Nettoyer les ennemis morts chaque frame (évite l'accumulation mémoire)
 *   - Orchestrer la séparation physique douce entre ennemis
 *   - Exposer getAlive() pour ArenaScene
 */
export class EnemyManager {
    public readonly group: Phaser.Physics.Arcade.Group;

    private scene: Phaser.Scene;
    private rng:   SeededRNG;

    constructor(scene: Phaser.Scene, rng: SeededRNG) {
        this.scene = scene;
        this.rng   = rng;
        this.group = scene.physics.add.group();
    }

    // ── API publique ──────────────────────────────────────────

    /** Spawne un ennemi à une position précise. */
    spawnAt(enemyId: string, x: number, y: number, roomIndex: number = -1): void {
        const enemy = EnemyFactory.create(this.scene, x, y, enemyId);
        enemy.roomIndex = roomIndex;
        this.group.add(enemy);
    }

    /** Comme spawnAt mais retourne l'ennemi créé. */
    spawnAtReturn(enemyId: string, x: number, y: number, roomIndex: number = -1): Enemy {
        const enemy = EnemyFactory.create(this.scene, x, y, enemyId);
        enemy.roomIndex = roomIndex;
        this.group.add(enemy);
        return enemy;
    }

    /** Détruit tous les ennemis actifs — utilisé lors des transitions de salle. */
    clearAll(): void {
        const all = this.group.getChildren() as Enemy[];
        for (const enemy of all) {
            this.group.remove(enemy, true, false);
            enemy.destroyEnemy();
        }
    }

    /** Retourne uniquement les ennemis vivants et actifs. */
    getAlive(): Enemy[] {
        return this.group.getChildren().filter(
            (e) => e.active && !(e as Enemy).dead,
        ) as Enemy[];
    }

    /** À appeler dans ArenaScene.update() chaque frame. */
    update(delta: number, playerX: number, playerY: number): void {
        const alive = this.getAlive();
        for (const enemy of alive) {
            enemy.update(delta, playerX, playerY);
        }
        this.cleanupDead();
        this.separateEnemies(alive);
    }

    // ── Cleanup ───────────────────────────────────────────────

    private cleanupDead(): void {
        const all = this.group.getChildren() as Enemy[];
        for (const enemy of all) {
            if (enemy.dead && !enemy.dying) {
                this.group.remove(enemy, false, false);
                enemy.destroyEnemy();
            }
        }
    }

    // ── Séparation ────────────────────────────────────────────

    private separateEnemies(alive: Enemy[]): void {
        for (let i = 0; i < alive.length; i++) {
            for (let j = i + 1; j < alive.length; j++) {
                const a  = alive[i];
                const b  = alive[j];

                if (a.isGhostPhasing || b.isGhostPhasing) continue;

                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const d  = Math.sqrt(dx * dx + dy * dy);

                if (d < SEPARATION_RADIUS && d > 0) {
                    const nx     = dx / d;
                    const ny     = dy / d;
                    const factor = (SEPARATION_RADIUS - d) / SEPARATION_RADIUS;
                    const push   = SEPARATION_FORCE * factor;

                    const bodyA = a.body as Phaser.Physics.Arcade.Body;
                    const bodyB = b.body as Phaser.Physics.Arcade.Body;

                    if (!a.dead && bodyA.enable) {
                        bodyA.velocity.x += nx * push;
                        bodyA.velocity.y += ny * push;
                    }
                    if (!b.dead && bodyB.enable) {
                        bodyB.velocity.x -= nx * push;
                        bodyB.velocity.y -= ny * push;
                    }
                }
            }
        }
    }
}