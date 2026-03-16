export const GAME_WIDTH  = 800;
export const GAME_HEIGHT = 600;

export const ARENA = {
    MARGIN:         40,
    WALL_THICKNESS: 16,
};

export const PLAYER = {
    SPEED:              300,
    MAX_HP:               5,
    ATTACK_DAMAGE:       25,
    ATTACK_RANGE:        90,
    ATTACK_SWING_MS:    300,
    ATTACK_COOLDOWN_MS: 600,
    INVINCIBILITY_MS:  1000,
};

export const DODGE = {
    DASH_SPEED:       620,
    DASH_MS:          220,
    INVINCIBILITY_MS: 260,
    COOLDOWN_MS:      700,
};

export const COMBAT = {
    PARRY_WINDOW_MS:        200,
    PARRY_BONUS_MULTIPLIER:   2,
};

export const SCORE = {
    KILL_BASE:              100,
    WAVE_CLEAR_BONUS:       500,
    PERFECT_PARRY_BONUS:    150,
    PARRY_BONUS_MULTIPLIER:   2,
    COMBO_THRESHOLDS:  [3, 5, 10],
    COMBO_MULTIPLIERS: [1.5, 2, 3],
    COMBO_RESET_MS:    2000,
};

export const HIGH_SCORE = {
    STORAGE_KEY: 'windlessland_scores',
    MAX_ENTRIES: 5,
};

export const ROOM = {
    BOSS_EVERY: 3,
};