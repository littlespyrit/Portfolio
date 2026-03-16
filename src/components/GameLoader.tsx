'use client';

import dynamic from 'next/dynamic';

const PhaserGame = dynamic(() => import('@/components/PhaserGame'), {
    ssr: false,
    loading: () => (
        <div className="fixed inset-0 flex items-center justify-center bg-[#0d0d1a]">
            <p className="text-purple-400 font-mono text-lg animate-pulse">Chargement...</p>
        </div>
    ),
});

export default function GameLoader() {
    return <PhaserGame />;
}