const STORAGE_KEY = 'windlessland_meta';

export interface MornUpgrades {
    attackLevels:    number;
    poisonUnlocked:  boolean;
    daggerUnlocked:  boolean;
    maxHpLevels:     number;
}

interface MetaData {
    currentZone: number;
}

const DEFAULT_META: MetaData = {
    currentZone: 1,
};

const DEFAULT_MORN_UPGRADES: MornUpgrades = {
    attackLevels:   0,
    poisonUnlocked: false,
    daggerUnlocked: false,
    maxHpLevels:    0,
};

class MetaProgressClass {
    private data: MetaData = { ...DEFAULT_META };
    private runUpgrades: MornUpgrades = { ...DEFAULT_MORN_UPGRADES };
    private _haineStored: number = 0;

    constructor() { this.load(); }

    // ── Persistence ───────────────────────────────────────────

    private load(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) this.data = { ...DEFAULT_META, ...JSON.parse(raw) };
        } catch { this.data = { ...DEFAULT_META }; }
    }

    private save(): void {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); }
        catch { }
    }

    // ── Haine pure (per-run) ──────────────────────────────────

    get haineStored(): number { return this._haineStored; }

    /** Ajoute de la haine à la fin d'un run (appelé par ArenaScene au game over). */
    addHaine(amount: number): void {
        this._haineStored += amount;
    }

    /** Dépense N unités de haine (achat chez Morn). Retourne false si solde insuffisant. */
    spendHaine(amount: number): boolean {
        if (this._haineStored < amount) return false;
        this._haineStored -= amount;
        return true;
    }

    // ── Debuffs haine ─────────────────────────────────────────

    /** Multiplicateur ATK dû à la haine non échangée. Valeur dans ]0, 1]. */
    get haineAttackMalus(): number {
        const units = Math.min(this._haineStored, 10);
        return Math.max(1 - units * 0.04, 0.60);
    }

    /** Multiplicateur vitesse dû à la haine. Valeur dans ]0, 1]. */
    get haineSpeedMalus(): number {
        const units = Math.min(this._haineStored, 10);
        return Math.max(1 - units * 0.03, 0.70);
    }

    /** Multiplicateur prix shop gerbille. Valeur dans [1, 2.5]. */
    get haineShopPriceMult(): number {
        const units = Math.min(this._haineStored, 10);
        return 1 + units * 0.15;
    }

    // ── Upgrades Morn (per-run) ───────────────────────────────

    get mornUpgrades(): MornUpgrades { return { ...this.runUpgrades }; }

    buyAttackUpgrade(): boolean {
        this.runUpgrades.attackLevels += 1;
        return true;
    }

    buyDaggerUnlock(): boolean {
        if (this.runUpgrades.daggerUnlocked) return false;
        this.runUpgrades.daggerUnlocked = true;
        return true;
    }

    buyPoisonUnlock(): boolean {
        if (this.runUpgrades.poisonUnlocked) return false;
        this.runUpgrades.poisonUnlocked = true;
        return true;
    }

    buyMaxHpUpgrade(): boolean {
        this.runUpgrades.maxHpLevels += 1;
        return true;
    }

    // ── Multiplicateurs finaux (lus par RunStats) ─────────────

    get mornAttackBonus(): number {
        return 1 + this.runUpgrades.attackLevels * 0.08;
    }

    get poisonUnlocked(): boolean { return this.runUpgrades.poisonUnlocked; }
    get daggerUnlocked(): boolean { return this.runUpgrades.daggerUnlocked ?? false; }
    get mornMaxHpBonus(): number  { return this.runUpgrades.maxHpLevels * 2; }

    // ── Zones (1-4) ───────────────────────────────────────────

    /** Zone actuelle : 1-3 normales, 4 = boss final Morn. */
    get currentZone(): number { return this.data.currentZone ?? 1; }

    /** Passe à la zone suivante. Retourne false si déjà à la zone 4. */
    advanceZone(): boolean {
        if (this.data.currentZone >= 4) return false;
        this.data.currentZone += 1;
        this.save();
        return true;
    }

    /** Force la zone (debug uniquement). */
    debugSetZone(zone: number): void {
        this.data.currentZone = Math.max(1, Math.min(4, zone));
    }

    /** Remet à la zone 1 (nouveau run complet). */
    resetZone(): void {
        this.data.currentZone = 1;
        this.save();
    }

    /**
     * Reset complet en début de run (appelé depuis TitleScene et ArenaScene).
     * Remet la haine per-run, la zone et les upgrades Morn à leur état initial.
     */
    resetRun(): void {
        this._haineStored    = 0;
        this.data.currentZone = 1;
        this.runUpgrades = { ...DEFAULT_MORN_UPGRADES };
        this.save();
    }

    /**
     * Reset partiel entre les zones (garde la haine et les émotions).
     * Appelé par showZoneScoreScreen dans ArenaScene.
     */
    resetZoneStats(): void {
    }

    /** Force la zone sans passer par advanceZone (debug). */
    get mornBossPower(): number {
        const upgrades = this.runUpgrades.attackLevels
            + this.runUpgrades.maxHpLevels
            + (this.runUpgrades.poisonUnlocked ? 1 : 0);
        return Math.max(1, upgrades);
    }
}

export const metaProgress = new MetaProgressClass();
