export enum ControlPreset {
    QWERTY = 'QWERTY',
    AZERTY = 'AZERTY',
    CUSTOM = 'CUSTOM'
}

export interface ControlScheme {
    up: string;
    down: string;
    left: string;
    right: string;
    attack: string;
    defend: string;
    parade: string;
    charMenu: string;
}

export const CONTROL_PRESETS: Record<ControlPreset, ControlScheme> = {
    QWERTY: {
        up: 'W',
        down: 'S',
        left: 'A',
        right: 'D',
        attack: 'SPACE',
        defend: 'SHIFT',
        parade: 'ALT',
        charMenu: 'C'
    },
    AZERTY: {
        up: 'Z',
        down: 'S',
        left: 'Q',
        right: 'D',
        attack: 'SPACE',
        defend: 'SHIFT',
        parade: 'ALT',
        charMenu: 'C'
    },
    CUSTOM: {
        up: 'W',
        down: 'S',
        left: 'A',
        right: 'D',
        attack: 'SPACE',
        defend: 'SHIFT',
        parade: 'ALT',
        charMenu: 'C'
    }
};

export class ControlsConfig {
    private static currentPreset: ControlPreset = ControlPreset.AZERTY;
    private static customScheme: ControlScheme = { ...CONTROL_PRESETS.AZERTY };

    static getCurrentScheme(): ControlScheme {
        if (this.currentPreset === ControlPreset.CUSTOM) {
            return this.customScheme;
        }
        return CONTROL_PRESETS[this.currentPreset];
    }

    static setPreset(preset: ControlPreset): void {
        this.currentPreset = preset;
    }

    static getPreset(): ControlPreset {
        return this.currentPreset;
    }

    static setCustomControl(action: keyof ControlScheme, key: string): void {
        this.customScheme[action] = key;
        this.currentPreset = ControlPreset.CUSTOM;
    }

    static resetToPreset(preset: ControlPreset): void {
        this.currentPreset = preset;
        this.customScheme = { ...CONTROL_PRESETS[preset] };
    }
}