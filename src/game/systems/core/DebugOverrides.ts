export const debugOverrides = {
    godMode:       false,
    freeShop:      false,
    speedOverride: 1,
    atkOverride:   1,

    reset(): void {
        this.godMode       = false;
        this.freeShop      = false;
        this.speedOverride = 1;
        this.atkOverride   = 1;
    },
};