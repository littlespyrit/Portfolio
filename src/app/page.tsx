'use client';
import React from 'react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/* ─── Lune ─────────────────────────────────────────────── */
function Moon({ phase, size }: { phase: number; size: number }) {
    const cx = size / 2, cy = size / 2, r = size * 0.44;
    const cosVal = Math.cos(phase * Math.PI * 2);
    const rx = Math.abs(cosVal) * r;
    const scaleX = cosVal >= 0 ? 1 : -1;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible', display: 'block' }}>
            <defs>
                <radialGradient id="ml" cx="35%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#c87248" />
                    <stop offset="45%" stopColor="#9e5030" />
                    <stop offset="100%" stopColor="#4a2010" />
                </radialGradient>
                <radialGradient id="md">
                    <stop offset="0%" stopColor="#1a0e0a" />
                    <stop offset="100%" stopColor="#0d0806" />
                </radialGradient>
                <clipPath id="mc"><circle cx={cx} cy={cy} r={r} /></clipPath>
                <filter id="mg" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="6" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>
            <circle cx={cx} cy={cy} r={r} fill="url(#md)" />
            {rx > 2 && (
                <g clipPath="url(#mc)" filter="url(#mg)">
                    <g transform={`translate(${cx},0) scale(${scaleX},1) translate(${-cx},0)`}>
                        <path d={`M${cx},${cy - r} A${rx},${r} 0 0,1 ${cx},${cy + r} A${r},${r} 0 0,1 ${cx},${cy - r}`} fill="url(#ml)" />
                    </g>
                </g>
            )}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#9e5030" strokeWidth="0.8" opacity="0.3" />
        </svg>
    );
}

/* ─── Données ───────────────────────────────────────────── */
const XP = [
    { y: '2025 — 26', t: 'Développeuse Web',                           o: 'Alternance · Chartreuse Diffusion', d: 'Développement complet de vegetal-grande-chartreuse.com (WordPress/Elementor), système de recettes via snippets PHP. Refonte e-commerce PrestaShop — intégration front JS/CSS.' },
    { y: '2025',      t: 'Développeuse Front-end & Graphiste',          o: 'Stage · GC Formation et Conseil',   d: 'Conception d\'une plateforme de ressources pédagogiques (WordPress/Elementor/CSS). Réalisation de supports graphiques.' },
    { y: '2023 — 26', t: 'BUT Métiers du Multimédia et de l\'Internet', o: 'IUT1 de Grenoble',                  d: 'Développement web, Graphisme, UX/UI, Production vidéo, Communication.' },
    { y: '2020 — 23', t: 'BAC STI2D — Mention Bien',                   o: 'Lycée Ferdinand Buisson · Voiron',  d: '' },
];

const SKILLS = [
    { cat: 'Langages',   items: ['JavaScript', 'TypeScript', 'PHP', 'SQL', 'Java', 'Node.js'] },
    { cat: 'Frameworks', items: ['Next.js', 'Vue.js', 'Laravel', 'Phaser', 'WordPress', 'React'] },
    { cat: 'Design',     items: ['Figma', 'Illustrator', 'Photoshop', 'Adobe XD', 'Clip Studio', 'Blender'] },
    { cat: 'Langues',    items: ['Français natif', 'Anglais courant', 'Russe débutant'] },
];

const FEATURED = [
    { href: '/projets#escape-game',     wip: false, badge: 'Dev web · Équipe',          title: 'Escape Game',          sub: 'Laravel · Next.js · Pusher', desc: 'Plateforme d\'escape game temps réel. Énigme en information asymétrique : deux groupes séparés se coordonnent vocalement pour naviguer un labyrinthe.', cta: '→ Voir' },
    { href: '/projets#ojoloco',         wip: false, badge: 'Dev web · Cheffe de projet', title: 'Ojoloco',              sub: 'PHP · Vue.js · API REST',    desc: 'Plateforme festival de films. API REST + panel d\'administration avec système de rôles dont un rôle graphiste pour modifier l\'apparence sans toucher au code.', cta: '→ Voir' },
    { href: '/projets#blender-blender', wip: false, badge: 'Dev web · Binôme',           title: 'Blender-Into-Blender', sub: 'JavaScript · BabylonJS',     desc: 'Smoothie maker 3D dans le navigateur. Première découverte de BabylonJS — drag & drop d\'objets 3D, calcul calorique dynamique.', cta: '→ Voir' },
];

const WIP = [
    { href: '/windlessland',      title: 'WindlessLand',      sub: 'TypeScript · Phaser · Next.js', desc: 'Roguelite procédural — donjon généré via graphe seedé (spanning tree + cycles). Boss comportementaux, minimap, système de score.', cta: '▶ Jouer' },
    { href: '/projets#kario-lab', title: 'Refonte Kario Lab', sub: 'PrestaShop · CSS · JS',         desc: 'Refonte e-commerce d\'une marque de compléments naturels. CSS/JS natif pour les performances.', cta: '' },
];

/* ─── Carousel hook ─────────────────────────────────────── */
function useCarousel(len: number) {
    const [idx, setIdx] = useState(0);
    const prev = () => setIdx(i => (i - 1 + len) % len);
    const next = () => setIdx(i => (i + 1) % len);
    return { idx, prev, next, setIdx };
}

/* ─── Composant principal ───────────────────────────────── */
export default function Home() {
    const [phase, setPhase]     = useState(0.35);
    const moonRaf               = useRef<number>(0);
    const lerpRaf               = useRef<number>(0);
    const t0                    = useRef<number>(0);
    const heroRef               = useRef<HTMLElement | null>(null);
    const gTop                  = useRef<SVGGElement | null>(null);
    const gBot                  = useRef<SVGGElement | null>(null);
    const cur                   = useRef(-180);
    const tgt                   = useRef(-180);
    const carousel              = useCarousel(FEATURED.length);
    const fakeCursorRef         = useRef<HTMLDivElement | null>(null);
    const cursorX               = useRef(0);
    const cursorY               = useRef(0);
    const cursorCurX            = useRef(0);
    const cursorCurY            = useRef(0);
    const cursorRaf             = useRef<number>(0);

    useEffect(() => {
        gTop.current?.setAttribute('transform', 'rotate(-180,300,300)');
        gBot.current?.setAttribute('transform', 'rotate(0,300,300)');

        // Lune
        const moon = (ts: number) => {
            if (!t0.current) t0.current = ts;
            setPhase(((ts - t0.current) / 38000) % 1);
            moonRaf.current = requestAnimationFrame(moon);
        };
        moonRaf.current = requestAnimationFrame(moon);
        requestAnimationFrame(() => requestAnimationFrame(() => { tgt.current = 0; }));

        // Rotation orbitale
        const lerp = () => {
            cur.current += (tgt.current - cur.current) * 0.022;
            const r = cur.current;
            gTop.current?.setAttribute('transform', `rotate(${r},300,300)`);
            gBot.current?.setAttribute('transform', `rotate(${r - 180},300,300)`);
            if (heroRef.current) heroRef.current.style.opacity = String(Math.max(0, 1 - Math.max(0, tgt.current) / 45));
            lerpRaf.current = requestAnimationFrame(lerp);
        };
        lerpRaf.current = requestAnimationFrame(lerp);

        const onScroll = () => { tgt.current = window.scrollY * 0.12; };
        window.addEventListener('scroll', onScroll, { passive: true });

        // Faux curseur
        const onMouseMove = (e: MouseEvent) => {
            cursorX.current = e.clientX;
            cursorY.current = e.clientY;
        };
        window.addEventListener('mousemove', onMouseMove);

        const animateCursor = () => {
            cursorCurX.current += (cursorX.current - cursorCurX.current) * 0.55;
            cursorCurY.current += (cursorY.current - cursorCurY.current) * 0.55;
            if (fakeCursorRef.current) {
                fakeCursorRef.current.style.transform = `translate(${cursorCurX.current}px, ${cursorCurY.current}px)`;
            }
            cursorRaf.current = requestAnimationFrame(animateCursor);
        };
        cursorRaf.current = requestAnimationFrame(animateCursor);

        // Hover curseur
        document.querySelectorAll('a, button').forEach(el => {
            el.addEventListener('mouseenter', () => fakeCursorRef.current?.classList.add('cursor-hover'));
            el.addEventListener('mouseleave', () => fakeCursorRef.current?.classList.remove('cursor-hover'));
        });

        // Effet encre — suit la souris dans le bouton
        const onBtnMouseMove = (e: MouseEvent) => {
            const btn = e.currentTarget as HTMLElement;
            const rect = btn.getBoundingClientRect();
            btn.style.setProperty('--mx', `${e.clientX - rect.left}px`);
            btn.style.setProperty('--my', `${e.clientY - rect.top}px`);
        };

        document.querySelectorAll<HTMLElement>(
            '.about-cta, .cv-dl, .c-cta, .contact-form-link, .wip-card-cta, .wip-card-all'
        ).forEach(el => {
            el.addEventListener('mousemove', onBtnMouseMove);
        });

        return () => {
            cancelAnimationFrame(moonRaf.current);
            cancelAnimationFrame(lerpRaf.current);
            cancelAnimationFrame(cursorRaf.current);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('mousemove', onMouseMove);
            document.querySelectorAll<HTMLElement>(
                '.about-cta, .cv-dl, .c-cta, .contact-form-link, .wip-card-cta, .wip-card-all'
            ).forEach(el => {
                el.removeEventListener('mousemove', onBtnMouseMove);
            });
        };
    }, []);

    const S = 'min(600px,90vw)';

    return (
        <div className="root">

            {/* ── FAUX CURSEUR ── */}
            <div ref={fakeCursorRef} className="fake-cursor" />

            {/* ── COINS ── */}
            <div className="br- br-tl" /><div className="br- br-tr" />
            <div className="br- br-bl" /><div className="br- br-br" />

            {/* ── NAV ── */}
            <nav className="nav">
                <div className="nav-links">
                    <a href="#cv" className="nav-link">CV</a>
                    <span className="nav-sep">✦</span>
                    <a href="#projets" className="nav-link">Projets</a>
                </div>
                <a href="#contact" className="nav-link">Contact</a>
            </nav>

            {/* ── HERO ── */}
            <section className="hero" ref={heroRef as React.RefObject<HTMLElement>}>
                <div className="hero-border" />
                <div className="hero-center">

                    {/* Lune */}
                    <svg viewBox="0 0 600 600" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: S, height: S, pointerEvents: 'none', zIndex: 6, overflow: 'visible' }}>
                        <defs>
                            <radialGradient id="ml3" cx="35%" cy="30%" r="70%">
                                <stop offset="0%" stopColor="#c87248" /><stop offset="45%" stopColor="#9e5030" /><stop offset="100%" stopColor="#4a2010" />
                            </radialGradient>
                            <radialGradient id="md3">
                                <stop offset="0%" stopColor="#1a0e0a" /><stop offset="100%" stopColor="#0d0806" />
                            </radialGradient>
                            <clipPath id="mc3"><circle cx="300" cy="300" r="132" /></clipPath>
                            <filter id="mg3" x="-30%" y="-30%" width="160%" height="160%">
                                <feGaussianBlur stdDeviation="5" result="b" />
                                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                        </defs>
                        <g style={{ animation: 'float 7s ease-in-out infinite', transformOrigin: '300px 300px' }}>
                            <circle cx="300" cy="300" r="132" fill="url(#md3)" />
                            {(() => {
                                const r = 132, c = Math.cos(phase * Math.PI * 2), rx = Math.abs(c) * r, sx = c >= 0 ? 1 : -1;
                                if (rx < 2) return null;
                                return (
                                    <g clipPath="url(#mc3)" filter="url(#mg3)">
                                        <g transform={`translate(300,0) scale(${sx},1) translate(-300,0)`}>
                                            <path d={`M300,${300 - r} A${rx},${r} 0 0,1 300,${300 + r} A${r},${r} 0 0,1 300,${300 - r}`} fill="url(#ml3)" />
                                        </g>
                                    </g>
                                );
                            })()}
                            <circle cx="300" cy="300" r="132" fill="none" stroke="#9e5030" strokeWidth="0.8" opacity="0.3" />
                        </g>
                    </svg>

                    {/* Texte orbital */}
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: S, height: S, zIndex: 2, pointerEvents: 'none' }}>
                        <svg viewBox="0 0 600 600" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                            <defs>
                                <path id="arc-h" d="M 300,300 m -168,0 a 168,168 0 1,1 336,0" />
                                <path id="arc-b" d="M 300,300 m 168,0 a 168,168 0 1,0 -336,0" />
                                <clipPath id="clip-h" clipPathUnits="userSpaceOnUse"><rect x="0" y="0" width="600" height="228" /></clipPath>
                                <clipPath id="clip-b" clipPathUnits="userSpaceOnUse"><rect x="0" y="340" width="600" height="260" /></clipPath>
                            </defs>
                            <circle cx="300" cy="300" r="172" fill="none" stroke="#c9a96e" strokeWidth="0.4" strokeDasharray="2 12" opacity="0.15" />
                            <g clipPath="url(#clip-h)">
                                <g ref={gTop} transform="rotate(-180,300,300)">
                                    <text style={{ fontFamily: '"Montserrat Alternates",sans-serif', fontSize: 20, fontWeight: 400, fill: '#d4b89672', letterSpacing: 6 }}>
                                        <textPath href="#arc-h" startOffset="50%" textAnchor="middle">Développement web</textPath>
                                    </text>
                                </g>
                            </g>
                            <g clipPath="url(#clip-b)">
                                <g ref={gBot} transform="rotate(0,300,300)">
                                    <text style={{ fontFamily: '"Montserrat Alternates",sans-serif', fontSize: 20, fontWeight: 400, fill: '#d4b89672', letterSpacing: 6 }}>
                                        <textPath href="#arc-b" startOffset="50%" textAnchor="middle">Création numérique</textPath>
                                    </text>
                                </g>
                            </g>
                        </svg>
                    </div>

                    {/* Nom */}
                    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', zIndex: 10, pointerEvents: 'none', width: 'max-content' }}>
                        <h1 className="hero-name ai d1">CLOE CHAROTTE</h1>
                        <p className="hero-sub ai d2">Développeuse web</p>
                    </div>

                    <div style={{ width: S, height: S, visibility: 'hidden' }} />
                </div>
                <div className="scroll-hint ai d3"><span>Scroll</span><div className="scroll-line" /></div>
            </section>

            {/* ── ABOUT ── */}
            <section className="about" id="about">
                <div className="about-img">
                    <div className="about-img-inner">
                        <div className="about-img-moon">
                            <Moon phase={phase} size={120} />
                        </div>
                    </div>
                </div>
                <div className="about-right">
                    <div>
                        <p className="about-eyebrow">À propos</p>
                        <p className="about-body">
                            Développeuse web avec une <em>tête pleine d'idées</em>, je conçois des projets où la logique du code rencontre l'envie de créer. Du roguelite procédural aux plateformes e-commerce, j'aime autant construire des systèmes complexes que soigner ce qu'on voit à l'écran.
                            <br /><br />
                            <em>Je cherche un master</em> pour approfondir cette direction, entre développement et expériences numériques.
                        </p>
                    </div>
                    <div className="about-ctas">
                        <Link href="/projets" className="about-cta primary">Mes projets</Link>
                        <a href="/cv.pdf" className="about-cta" download>Mon CV</a>
                    </div>
                </div>
            </section>

            <div className="divider"><span>✦ · · ✦ · · ✦</span></div>

            {/* ── CV ── */}
            <section className="sec" id="cv">
                <div className="sec-head">
                    <div className="sec-title-row">
                        <img src="/img/lys.svg" className="sec-lys" alt="" aria-hidden="true" />
                        <h2 className="sec-title">Curriculum Vitæ</h2>
                    </div>
                    <div className="sec-rule" />
                </div>
                <div className="cv-wrap">
                    <div>
                        <p className="cv-col-title">Parcours</p>
                        <div className="timeline">
                            {XP.map((e, i) => (
                                <div key={i} className="t-item">
                                    <img src="/img/diam.svg" className="t-dot" alt="" aria-hidden="true" />
                                    <p className="t-year">{e.y}</p>
                                    <p className="t-title">{e.t}</p>
                                    <p className="t-org">{e.o}</p>
                                    {e.d && <p className="t-desc">{e.d}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="cv-col-title">Compétences</p>
                        <div className="skills-wrap">
                            {SKILLS.map((s, i) => (
                                <div key={i}>
                                    <p className="skill-cat">{s.cat}</p>
                                    <div className="pills">
                                        {s.items.map((t, j) => (
                                            <React.Fragment key={j}>
                                                {j > 0 && <span className="pill-sep">·</span>}
                                                <span className="pill">{t}</span>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <a href="/cv.pdf" className="cv-dl" download>↓ Télécharger le CV</a>
                    </div>
                </div>
            </section>

            <div className="divider"><span>✦ · · ✦ · · ✦</span></div>

            {/* ── PROJETS CAROUSEL ── */}
            <section className="proj-sec" id="projets">
                <div className="sec-head">
                    <div className="sec-title-row">
                        <img src="/img/lys.svg" className="sec-lys" alt="" aria-hidden="true" />
                        <h2 className="sec-title">Projets</h2>
                    </div>
                    <div className="sec-rule" />
                </div>

                <div className="carousel-wrap">
                    <div className="carousel-inner" style={{ transform: `translateX(-${carousel.idx * 100}%)` }}>
                        {FEATURED.map((p, i) => (
                            <div key={i} className="carousel-slide">
                                <p className="c-badge">
                                    {p.wip && <span className="c-wip-dot" />}
                                    {p.badge}
                                </p>
                                <h3 className="c-title">{p.title}</h3>
                                <p className="c-sub">{p.sub}</p>
                                <p className="c-desc">{p.desc}</p>
                                <Link href={p.href} className="c-cta">{p.cta}</Link>
                            </div>
                        ))}
                    </div>
                    <div className="carousel-dots">
                        {FEATURED.map((_, i) => (
                            <button key={i} className={`c-dot${carousel.idx === i ? ' on' : ''}`} onClick={() => carousel.setIdx(i)} aria-label={`Slide ${i + 1}`} />
                        ))}
                    </div>
                </div>

                {/* En cours */}
                <div className="wip-section">
                    <p className="wip-label"><span className="wip-dot-anim" />En cours</p>
                    <div className="wip-grid">
                        {WIP.map((p, i) => (
                            <Link key={i} href={p.href} className="wip-card">
                                <div>
                                    <p className="wip-card-title">{p.title}</p>
                                    <p className="wip-card-sub">{p.sub}</p>
                                    <p className="wip-card-desc">{p.desc}</p>
                                </div>
                                {p.cta && <span className="wip-card-cta">{p.cta}</span>}
                            </Link>
                        ))}
                        <Link href="/projets" className="wip-card-all">
                            <div className="wip-all-row">
                                <span className="wip-all-title">Voir tous mes projets</span>
                                <span className="wip-all-arrow">→</span>
                            </div>
                        </Link>
                    </div>
                </div>
            </section>

            <div className="divider"><span>✦ · · ✦ · · ✦</span></div>

            {/* ── CONTACT ── */}
            <section className="contact-sec" id="contact">
                <div className="sec-head">
                    <div className="sec-title-row">
                        <img src="/img/lys.svg" className="sec-lys" alt="" aria-hidden="true" />
                        <h2 className="sec-title">Contact</h2>
                    </div>
                    <div className="sec-rule" />
                </div>
                <div className="contact-grid">
                    <div className="social-links">
                        <a href="mailto:cloe.charotte@outlook.com" className="s-link">
                            <div className="s-icon">✉</div>
                            <span className="s-name">cloe.charotte@outlook.com</span>
                        </a>
                        <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="s-link">
                            <div className="s-icon">in</div>
                            <span className="s-name">LinkedIn</span>
                        </a>
                        <a href="https://github.com/littlespyrit" target="_blank" rel="noreferrer" className="s-link">
                            <div className="s-icon">⌥</div>
                            <span className="s-name">GitHub — littlespyrit</span>
                        </a>
                    </div>
                    <div className="contact-right">
                        <p className="contact-tagline">Envie de me contacter ?</p>
                        <p className="contact-sub">Disponible pour un master, une collaboration ou simplement échanger sur un projet. Écrivez-moi directement ou passez par le formulaire.</p>
                        <Link href="/contact" className="contact-form-link">Formulaire de contact →</Link>
                    </div>
                </div>
            </section>

            <footer className="footer">
                <span>Cloe Charotte · {new Date().getFullYear()}</span>
            </footer>

        </div>
    );
}