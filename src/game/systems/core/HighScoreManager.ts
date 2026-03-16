import { HIGH_SCORE } from '../../config/gameConfig';
import type { ScoreEntry } from '../../types';

export class HighScoreManager {
    static submit(score: number, room: number, zone: number, seed: number): boolean {
        const entries   = this.load();
        const isNewBest = entries.length === 0 || score > entries[0].score;
        const newEntry: ScoreEntry = {
            score,
            room,
            zone,
            seed,
            date: new Date().toLocaleDateString('fr-FR'),
        };
        entries.push(newEntry);
        entries.sort((a, b) => b.score - a.score);
        this.save(entries.slice(0, HIGH_SCORE.MAX_ENTRIES));
        return isNewBest;
    }

    static load(): ScoreEntry[] {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem(HIGH_SCORE.STORAGE_KEY);
            return raw ? (JSON.parse(raw) as ScoreEntry[]) : [];
        } catch { return []; }
    }

    static clear(): void {
        if (typeof window !== 'undefined') localStorage.removeItem(HIGH_SCORE.STORAGE_KEY);
    }

    private static save(entries: ScoreEntry[]): void {
        if (typeof window === 'undefined') return;
        try { localStorage.setItem(HIGH_SCORE.STORAGE_KEY, JSON.stringify(entries)); } catch { }
    }
}