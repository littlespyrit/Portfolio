/**
 * Générateur de nombres pseudo-aléatoires déterministe (Mulberry32).
 *
 * Avec la même seed, la séquence produite est identique à chaque run,
 * ce qui rend les vagues, les positions de spawn et les pickups entièrement
 * reproductibles. La seed est affichée en jeu et au game over pour permettre
 * de rejouer une run spécifique.
 *
 * @example
 *   const rng = new SeededRNG(42);
 *   rng.next();
 *   rng.nextInt(0, 9);
 *   rng.shuffle(array);
 */
export class SeededRNG {
    private state: number;
    public  readonly seed: number;

    constructor(seed?: number) {
        this.seed  = seed ?? Math.floor(Math.random() * 0xFFFFFFFF);
        this.state = this.seed;
    }

    /**
     * Retourne un float dans [0, 1).
     * Implémentation Mulberry32.
     */
    next(): number {
        this.state += 0x6D2B79F5;
        let z = this.state;
        z = Math.imul(z ^ (z >>> 15), z | 1);
        z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
        return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
    }

    /**
     * Retourne un entier dans [min, max] inclus.
     */
    nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /**
     * Retourne un float dans [min, max).
     */
    nextFloat(min: number, max: number): number {
        return this.next() * (max - min) + min;
    }

    /**
     * Mélange un tableau en place (Fisher-Yates avec ce RNG).
     */
    shuffle<T>(arr: T[]): T[] {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}