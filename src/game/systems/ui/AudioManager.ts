const STORAGE_KEY    = 'windlessland_audio';
const MUSIC_KEY      = 'bgm_blur';
const SHOP_MUSIC_KEY = 'bgm_shop';

interface AudioSettings {
    musicVol: number;
    sfxVol:   number;
    muted:    boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
    musicVol: 0.5,
    sfxVol:   0.8,
    muted:    false,
};

class AudioManagerClass {
    private soundManager: Phaser.Sound.BaseSoundManager | null = null;
    private cache:        Phaser.Cache.CacheManager | null = null;

    private music:     Phaser.Sound.BaseSound | null = null;
    private shopMusic: Phaser.Sound.BaseSound | null = null;
    private settings:  AudioSettings = { ...DEFAULT_SETTINGS };

    // ── Init ──────────────────────────────────────────────────

    init(scene: Phaser.Scene): void {
        this.soundManager = scene.game.sound;
        this.cache        = scene.cache;
        this.loadSettings();
    }

    /** Appelé dans preload() de TitleScene — charge tous les assets audio */
    preloadAssets(scene: Phaser.Scene): void {
        scene.load.audio(MUSIC_KEY,      'audio/Blur.mp3');
        scene.load.audio(SHOP_MUSIC_KEY, 'audio/sfx/ambiance_shop.mp3');

        scene.load.audio('sfx_boss_spawn', 'audio/sfx/boss_spawn.mp3');
        scene.load.audio('sfx_hurt',       'audio/sfx/hurt.mp3');
        scene.load.audio('sfx_sword',      'audio/sfx/sword.mp3');
        scene.load.audio('sfx_parade',     'audio/sfx/parade.mp3');
        scene.load.audio('sfx_haine_gain', 'audio/sfx/haine_gain.mp3');
        scene.load.audio('sfx_powerup',    'audio/sfx/powerup.mp3');
        scene.load.audio('sfx_run',        'audio/sfx/run.mp3');
        scene.load.audio('sfx_break',      'audio/sfx/break.mp3');
        scene.load.audio('sfx_dash',       'audio/sfx/dash.wav');
        scene.load.audio('sfx_trixx',      'audio/sfx/trixx.wav');
        scene.load.audio('sfx_morn',       'audio/sfx/morn.mp3');
        scene.load.audio('sfx_door',       'audio/sfx/door.mp3');
    }

    // ── Musique principale ────────────────────────────────────

    playMusic(): void {
        if (!this.soundManager || !this.cache) return;
        if (!this.cache.audio.has(MUSIC_KEY)) return;

        if (this.music) {
            try {
                if (this.music.isPlaying) return;
            } catch {
                this.music = null;
            }
        }

        this.music = this.soundManager.add(MUSIC_KEY, {
            loop:   true,
            volume: this.settings.muted ? 0 : this.curvedMusicVol(),
        });
        this.music.play();
    }

    stopMusic(): void {
        if (this.music?.isPlaying) this.music.stop();
    }

    // ── Musique shop ──────────────────────────────────────────

    playShopMusic(): void {
        if (!this.soundManager || !this.cache) return;
        if (this.shopMusic?.isPlaying) return;
        if (!this.cache.audio.has(SHOP_MUSIC_KEY)) return;

        this.shopMusic = this.soundManager.add(SHOP_MUSIC_KEY, {
            loop:   true,
            volume: this.settings.muted ? 0 : this.curvedMusicVol() * 0.7,
        });
        this.shopMusic.play();
    }

    stopShopMusic(): void {
        if (this.shopMusic?.isPlaying) this.shopMusic.stop();
        this.shopMusic = null;
    }

    // ── Volume & mute ─────────────────────────────────────────

    setMusicVol(vol: number): void {
        this.settings.musicVol = Math.max(0, Math.min(1, vol));
        if (this.music && !this.settings.muted) {
            (this.music as Phaser.Sound.WebAudioSound).setVolume(this.curvedMusicVol());
        }
        this.saveSettings();
    }

    setSfxVol(vol: number): void {
        this.settings.sfxVol = Math.max(0, Math.min(1, vol));
        this.saveSettings();
    }

    toggleMute(): void {
        this.settings.muted = !this.settings.muted;
        const vol = this.settings.muted ? 0 : this.curvedMusicVol();
        if (this.music)     (this.music     as Phaser.Sound.WebAudioSound).setVolume(vol);
        if (this.shopMusic) (this.shopMusic as Phaser.Sound.WebAudioSound).setVolume(
            this.settings.muted ? 0 : this.curvedMusicVol() * 0.7
        );
        this.saveSettings();
    }

    private curvedMusicVol(): number {
        return Math.pow(this.settings.musicVol, 4.32);
    }

    get musicVol(): number  { return this.settings.musicVol; }
    get sfxVol():   number  { return this.settings.sfxVol; }
    get muted():    boolean { return this.settings.muted; }
    get isPlaying():boolean { return this.music?.isPlaying ?? false; }

    // ── SFX ───────────────────────────────────────────────────

    playSfx(key: string, volumeMult: number = 1): void {
        if (!this.soundManager || !this.cache) return;
        if (this.settings.muted) return;
        if (!this.cache.audio.has(key)) {
            console.warn(`[AudioManager] SFX non chargé : "${key}"`);
            return;
        }
        this.soundManager.play(key, { volume: this.settings.sfxVol * volumeMult });
    }

    // ── Persistence ───────────────────────────────────────────

    private loadSettings(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        } catch {
            this.settings = { ...DEFAULT_SETTINGS };
        }
    }

    private saveSettings(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch { }
    }
}

export const audioManager = new AudioManagerClass();