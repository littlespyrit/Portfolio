import { PLAYER, DODGE } from '../../config/gameConfig';
import { metaProgress } from './MetaProgress';
import { debugOverrides } from './DebugOverrides';
import { buffManager }  from './BuffManager';

export type EmotionType =
    | 'rage'
    | 'peur'
    | 'desespoir'
    | 'tristesse'
    | 'envie'
    | 'anxiete'
    | 'rancoeur'
    | 'haine';

export interface EmotionDef {
    type:        EmotionType;
    color:       number;
    colorHex:    string;
    label:       string;
    absorbed:    boolean;
}

export const EMOTION_DEFS: Record<EmotionType, EmotionDef> = {
    rage:      { type: 'rage',      color: 0xc0392b, colorHex: '#c0392b', label: 'Rage',      absorbed: true  },
    peur:      { type: 'peur',      color: 0x5dade2, colorHex: '#5dade2', label: 'Peur',      absorbed: true  },
    desespoir: { type: 'desespoir', color: 0x8e44ad, colorHex: '#8e44ad', label: 'Désespoir', absorbed: true  },
    tristesse: { type: 'tristesse', color: 0x27ae60, colorHex: '#27ae60', label: 'Tristesse', absorbed: true  },
    envie:     { type: 'envie',     color: 0xb8a000, colorHex: '#b8a000', label: 'Envie',     absorbed: true  },
    anxiete:   { type: 'anxiete',   color: 0xe67e22, colorHex: '#e67e22', label: 'Anxiété',   absorbed: true  },
    rancoeur:  { type: 'rancoeur',  color: 0xd4a0a0, colorHex: '#d4a0a0', label: 'Rancœur',   absorbed: true  },
    haine:     { type: 'haine',     color: 0x1a1a1a, colorHex: '#1a1a1a', label: 'Haine',     absorbed: false },
};

const STACK_RATIO = [1.0, 0.7, 0.5, 0.35];

function stackRatio(stackCount: number): number {
    const idx = Math.min(stackCount - 1, STACK_RATIO.length - 1);
    return STACK_RATIO[idx];
}

export class RunStats {
    private stacks: Partial<Record<EmotionType, number>> = {};

    public haineCollected: number = 0;

    // ── Statistiques de fin de run ────────────────────────────
    public totalKills:      number = 0;
    public totalEnemies:    number = 0;
    public totalOrbs:       number = 0;
    public totalBreakables: number = 0;
    public totalBroken:     number = 0;

    // ── API publique ──────────────────────────────────────────

    absorb(type: EmotionType): void {
        this.totalOrbs += 1;
        if (type === 'haine') {
            this.haineCollected += 1;
            return;
        }
        this.stacks[type] = (this.stacks[type] ?? 0) + 1;
    }

    recordKill(): void             { this.totalKills       += 1; }
    recordSpawn(): void            { this.totalEnemies     += 1; }
    recordBreakableSpawn(): void   { this.totalBreakables  += 1; }
    recordBroken(): void           { this.totalBroken      += 1; }

    /**
     * Consomme N stacks d'une émotion (utilisé par le shop gerbille).
     * Ne descend pas en dessous de 0.
     */
    consumeStack(type: EmotionType, amount: number): void {
        const current = this.stacks[type] ?? 0;
        this.stacks[type] = Math.max(0, current - amount);
    }

    /**
     * Dépense N unités de haine du run courant (shop Morn).
     * Retourne false si pas assez.
     */
    spendHaine(amount: number): boolean {
        if (this.haineCollected < amount) return false;
        this.haineCollected = Math.max(0, this.haineCollected - amount);
        return true;
    }

    /** Vide toute la haine du run courant (après fermeture dialogue Morn). */
    clearHaine(): void {
        this.haineCollected = 0;
    }

    stackCount(type: EmotionType): number {
        return this.stacks[type] ?? 0;
    }

    get absorbedTypes(): EmotionType[] {
        return Object.keys(this.stacks) as EmotionType[];
    }

    reset(): void {
        this.stacks              = {};
        this.haineCollected      = 0;
        this.totalKills          = 0;
        this.totalEnemies        = 0;
        this.totalOrbs           = 0;
        this.totalBreakables     = 0;
        this.totalBroken         = 0;
        buffManager.reset();
    }

    /**
     * Reset uniquement les compteurs de stats de zone (kills, orbs, breakables)
     * sans toucher à la haine ni aux émotions absorbées.
     * Appelé entre deux zones pour le tableau de score intermédiaire.
     */
    resetZoneStats(): void {
        this.totalKills      = 0;
        this.totalEnemies    = 0;
        this.totalOrbs       = 0;
        this.totalBreakables = 0;
        this.totalBroken     = 0;
    }

    // ── Stats dérivées (lues par Player chaque frame) ─────────

    /** Vitesse effective (px/s).
     *  Peur → +8% par stack (émotion run).
     *  Malus haine stockée (meta) soustrait.
     */
    get speed(): number {
        const override = debugOverrides.speedOverride;
        if (override > 0) return PLAYER.SPEED * override;
        return PLAYER.SPEED
            * this.mult('peur', 0.08)
            * metaProgress.haineSpeedMalus;
    }

    /** Multiplicateur de dégâts.
     *  Rage → +12% par stack.
     *  Morn perma bonus.
     *  Gerbille tempo bonus.
     *  Malus haine.
     */
    get attackMultiplier(): number {
        const override = debugOverrides.atkOverride;
        if (override > 0) return override;
        return this.mult('rage', 0.12)
            * metaProgress.mornAttackBonus
            * buffManager.tempAttackMult
            * metaProgress.haineAttackMalus;
    }

    /** Portée d'attaque effective (px). Désespoir → +10% par stack. */
    get attackRange(): number {
        return PLAYER.ATTACK_RANGE * this.mult('desespoir', 0.10);
    }

    /** HP max.
     *  Tristesse → +1 HP par stack (émotion run).
     *  Morn perma +1 par level.
     *  Gerbille tempo +1 si actif.
     *  Plafonné à 12.
     */
    get maxHp(): number {
        return Math.min(
            PLAYER.MAX_HP
            + metaProgress.mornMaxHpBonus
            + buffManager.tempMaxHpBonus,
            12,
        );
    }

    /** Cooldown dash (ms). Anxiété → -8% par stack. */
    get dashCooldown(): number {
        const n = this.stacks['anxiete'] ?? 0;
        if (n === 0) return DODGE.COOLDOWN_MS;
        let cd = DODGE.COOLDOWN_MS;
        for (let i = 1; i <= n; i++) cd *= (1 - 0.08 * stackRatio(i));
        return Math.max(cd, 200);
    }

    /** Durée invincibilité post-hit (ms). Rancœur → +15% par stack. */
    get invincibilityMs(): number {
        return PLAYER.INVINCIBILITY_MS * this.mult('rancoeur', 0.15);
    }

    /** Poison débloqué par Morn (ce run). */
    get poisonUnlocked(): boolean {
        return metaProgress.poisonUnlocked;
    }

    /** Dague débloquée par Morn (ce run). */
    get daggerUnlocked(): boolean {
        return metaProgress.daggerUnlocked;
    }

    /**
     * Envie → régén : interval en ms ou null.
     */
    get regenIntervalMs(): number | null {
        const n = this.stacks['envie'] ?? 0;
        if (n === 0) return null;
        let interval = 20000;
        for (let i = 1; i <= n; i++) interval *= (1 - 0.15 * stackRatio(i));
        return Math.max(interval, 5000);
    }

    /** Prix shop gerbille multiplié par la haine accumulée. */
    get gerbilShopPriceMult(): number {
        return metaProgress.haineShopPriceMult;
    }

    // ── Helpers ───────────────────────────────────────────────

    /**
     * Calcule un multiplicateur cumulé avec rendement dégressif.
     * mult('rage', 0.12) avec 3 stacks = 1 + 0.12*1.0 + 0.12*0.7 + 0.12*0.5
     */
    private mult(type: EmotionType, bonusPerStack: number): number {
        const n = this.stacks[type] ?? 0;
        if (n === 0) return 1;
        let total = 1;
        for (let i = 1; i <= n; i++) {
            total += bonusPerStack * stackRatio(i);
        }
        return total;
    }
}

export const runStats = new RunStats();