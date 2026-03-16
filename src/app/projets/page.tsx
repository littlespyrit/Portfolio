'use client';

import Link from 'next/link';
import FakeCursor from '@/components/FakeCursor';

export default function Projets() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg)',
            color: 'var(--gold2)',
            fontFamily: 'var(--fb)',
            textAlign: 'center',
            padding: '2rem',
        }}>
            <FakeCursor />

            <nav style={{
                position: 'fixed',
                top: '1.5rem',
                left: '2rem',
                right: '2rem',
                display: 'flex',
                justifyContent: 'space-between',
            }}>
                <Link href="/" style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '0.05em' }}>← Retour</Link>
                <Link href="/contact" style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: '0.85rem', letterSpacing: '0.05em' }}>Contact</Link>
            </nav>

            <p style={{
                fontSize: '0.75rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--gold)',
                opacity: 0.6,
                marginBottom: '1rem',
            }}>
                Portfolio
            </p>

            <h1 style={{
                fontFamily: 'var(--font-title)',
                fontSize: 'clamp(2rem, 6vw, 4rem)',
                color: 'var(--gold)',
                marginBottom: '1.5rem',
                letterSpacing: '0.05em',
            }}>
                En construction
            </h1>

            <p style={{
                fontSize: '1rem',
                opacity: 0.55,
                maxWidth: '400px',
                lineHeight: 1.7,
            }}>
                La page des projets arrive bientôt.
            </p>
        </div>
    );
}