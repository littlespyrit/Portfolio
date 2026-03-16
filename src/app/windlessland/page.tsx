import GameLoader from '@/components/GameLoader';

export default function WindlessLandPage() {
    return (
        <main className="fixed inset-0 bg-black overflow-hidden" style={{ cursor: 'default' }}>
            <GameLoader />
        </main>
    );
}