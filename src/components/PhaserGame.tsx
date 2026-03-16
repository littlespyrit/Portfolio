'use client';

import { useEffect, useRef } from 'react';

export default function PhaserGame() {
    const gameRef      = useRef<unknown>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Bloquer Alt gauche — empêche les raccourcis navigateur sans bloquer Phaser
    useEffect(() => {
        const blockAltDown = (e: KeyboardEvent) => {
            // Sur keydown : bloquer Alt seul ET combos Alt+touche
            if (e.altKey || e.code === 'AltLeft' || e.code === 'AltRight') {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        };
        const blockAltUp = (e: KeyboardEvent) => {
            // Sur keyup : bloquer SEULEMENT Alt lui-même
            // Ne pas bloquer les autres keyup sinon Phaser croit les touches encore enfoncées
            if (e.code === 'AltLeft' || e.code === 'AltRight') {
                e.preventDefault();
                e.stopImmediatePropagation();
                // Refocus le canvas pour que Phaser récupère les events clavier
                const canvas = document.querySelector('canvas');
                if (canvas) canvas.focus();
            }
        };
        document.addEventListener('keydown', blockAltDown, { capture: true });
        document.addEventListener('keyup',   blockAltUp,   { capture: true });
        return () => {
            document.removeEventListener('keydown', blockAltDown, { capture: true });
            document.removeEventListener('keyup',   blockAltUp,   { capture: true });
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !containerRef.current) return;
        if (gameRef.current) return;

        let destroyed = false;

        (async () => {
            const [
                Phaser,
                { TitleScene },
                { OptionsScene },
                { ArenaScene },
                { PauseScene },
                { GerbilShopScene },
                { MornShopScene },
                { DebugConsoleScene },
                { EndingScene },
            ] = await Promise.all([
                import('phaser'),
                import('@/game/scenes/TitleScene'),
                import('@/game/scenes/OptionsScene'),
                import('@/game/scenes/ArenaScene'),
                import('@/game/scenes/PauseScene'),
                import('@/game/scenes/GerbilShopScene'),
                import('@/game/scenes/MornShopScene'),
                import('@/game/scenes/DebugConsoleScene'),
                import('@/game/scenes/EndingScene'),
            ]);

            if (destroyed || !containerRef.current) return;

            const game = new Phaser.Game({
                type:            Phaser.AUTO,
                backgroundColor: '#0d0d1a',
                parent:          containerRef.current,
                scale: {
                    mode:         Phaser.Scale.FIT,
                    autoCenter:   Phaser.Scale.CENTER_BOTH,
                    width:        800,
                    height:       600,
                    expandParent: true,
                },
                physics: {
                    default: 'arcade',
                    arcade: {
                        gravity: { x: 0, y: 0 },
                        debug:   false,
                    },
                },
                input: {
                    keyboard: {
                        target: window,
                        capture: [],
                    },
                    mouse: {
                        target: window,
                        preventDefaultDown: false,
                        preventDefaultUp: false,
                        preventDefaultMove: false,
                        preventDefaultWheel: false,
                    },
                },
                scene: [TitleScene, OptionsScene, ArenaScene, PauseScene, GerbilShopScene, MornShopScene, DebugConsoleScene, EndingScene],
            });
            gameRef.current = game;
            // Forcer le focus sur le canvas après init pour que tous les inputs fonctionnent
            game.events.once('ready', () => {
                const canvas = game.canvas;
                if (canvas) {
                    canvas.setAttribute('tabindex', '0');
                    canvas.style.outline = 'none';
                    canvas.focus();
                }
            });
        })();

        return () => {
            destroyed = true;
            (gameRef.current as { destroy?: (r: boolean) => void })?.destroy?.(true);
            gameRef.current = null;
        };
    }, []);

    return (
        <div
            ref={containerRef}
            id="phaser-game"
            style={{ width: '100vw', height: '100vh' }}
        />
    );
}