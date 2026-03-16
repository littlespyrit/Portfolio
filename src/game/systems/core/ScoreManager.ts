import { eventBus } from './EventBus';
import { SCORE } from '../../config/gameConfig';
import type { ScoreState, GameEvent } from '../../types';

export class ScoreManager {
    private state: ScoreState = { total: 0, combo: 0, multiplier: 1, room: 0 };
    private comboResetMs: number = 0;

    private onEnemyKilled  = (e: GameEvent) => this.addKill((e.payload?.scoreValue as number) ?? SCORE.KILL_BASE);
    private onRoomClear    = (e: GameEvent) => this.addRoomBonus((e.payload?.roomNumber as number) ?? 1);
    private onPerfectParry = () => this.addPerfectParry();
    private onRoomEnter    = (e: GameEvent) => { this.state.room = (e.payload?.roomNumber as number) ?? this.state.room; };

    constructor() {
        eventBus.on('ENEMY_KILLED',  this.onEnemyKilled);
        eventBus.on('ROOM_CLEAR',    this.onRoomClear);
        eventBus.on('PERFECT_PARRY', this.onPerfectParry);
        eventBus.on('DOOR_ENTER',    this.onRoomEnter);
    }

    update(delta: number): void {
        if (this.comboResetMs > 0) {
            this.comboResetMs -= delta;
            if (this.comboResetMs <= 0) {
                this.comboResetMs = 0;
                this.state.combo = 0;
                this.state.multiplier = 1;
                eventBus.emit('COMBO_UPDATE', { combo: 0, multiplier: 1 });
            }
        }
    }

    private addKill(baseScore: number): void {
        this.state.combo += 1;
        this.updateMultiplier();
        this.state.total += Math.floor(baseScore * this.state.multiplier);
        this.comboResetMs = SCORE.COMBO_RESET_MS;
        this.emit();
    }

    private addRoomBonus(roomNumber: number): void {
        this.state.total += SCORE.WAVE_CLEAR_BONUS * roomNumber;
        this.emit();
    }

    private addPerfectParry(): void {
        this.state.total += SCORE.PERFECT_PARRY_BONUS * SCORE.PARRY_BONUS_MULTIPLIER;
        this.state.combo += 1;
        this.updateMultiplier();
        this.comboResetMs = SCORE.COMBO_RESET_MS;
        this.emit();
    }

    private updateMultiplier(): void {
        let m = 1;
        for (let i = 0; i < SCORE.COMBO_THRESHOLDS.length; i++) {
            if (this.state.combo >= SCORE.COMBO_THRESHOLDS[i]) m = SCORE.COMBO_MULTIPLIERS[i];
        }
        this.state.multiplier = m;
        eventBus.emit('COMBO_UPDATE', { combo: this.state.combo, multiplier: m });
    }

    private emit(): void { eventBus.emit('SCORE_UPDATE', { ...this.state }); }

    get score():    number     { return this.state.total; }
    get combo():    number     { return this.state.combo; }
    get multiplier(): number   { return this.state.multiplier; }
    get snapshot(): ScoreState { return { ...this.state }; }

    destroy(): void {
        eventBus.off('ENEMY_KILLED',  this.onEnemyKilled);
        eventBus.off('ROOM_CLEAR',    this.onRoomClear);
        eventBus.off('PERFECT_PARRY', this.onPerfectParry);
        eventBus.off('DOOR_ENTER',    this.onRoomEnter);
    }
}