export interface TempBuff {
    id:         string;
    label:      string;
    remainingMs: number;
    totalMs:    number;
}

class BuffManagerClass {
    private buffs: Map<string, TempBuff> = new Map();

    // ── API publique ──────────────────────────────────────────

    /** Applique ou renouvelle un buff temporaire. */
    apply(id: string, label: string, durationMs: number): void {
        this.buffs.set(id, { id, label, remainingMs: durationMs, totalMs: durationMs });
    }

    /** Vérifie si un buff est actif. */
    isActive(id: string): boolean {
        return this.buffs.has(id);
    }

    /** Retourne tous les buffs actifs (pour l'UI). */
    getActive(): TempBuff[] {
        return Array.from(this.buffs.values());
    }

    /** À appeler chaque frame avec le delta. */
    update(delta: number): void {
        for (const [id, buff] of this.buffs) {
            buff.remainingMs -= delta;
            if (buff.remainingMs <= 0) this.buffs.delete(id);
        }
    }

    /** Vide tous les buffs (entre les runs). */
    reset(): void {
        this.buffs.clear();
    }

    // ── Multiplicateurs lus par RunStats ──────────────────────

    /** Multiplicateur d'attaque temporaire gerbille. */
    get tempAttackMult(): number {
        return this.isActive('gerbil_attack') ? 1.5 : 1.0;
    }

    /** HP max bonus temporaire gerbille (+1 par stack tempHp). */
    get tempMaxHpBonus(): number {
        return this.isActive('gerbil_hp') ? 1 : 0;
    }
}

export const buffManager = new BuffManagerClass();
