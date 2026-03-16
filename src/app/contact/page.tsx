'use client';

import Link from 'next/link';
import { useState } from 'react';
import FakeCursor from '@/components/FakeCursor';

export default function Contact() {
    const [sent, setSent]       = useState(false);
    const [sending, setSending] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSending(true);
        await new Promise(r => setTimeout(r, 1100));
        setSending(false);
        setSent(true);
    };

    return (
        <div className="root" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <FakeCursor />

            <div className="br- br-tl" /><div className="br- br-tr" />
            <div className="br- br-bl" /><div className="br- br-br" />

            <nav className="nav">
                <Link href="/" className="nav-link">← Retour</Link>
                <Link href="/projets" className="nav-link">Projets</Link>
            </nav>

            <div className="contact-page">
                <div>
                    <p className="cl-eyebrow">Contact</p>
                    <h1 className="cl-title">Envie de me contacter ?</h1>
                    <p className="cl-sub">Disponible pour un <em>master</em>, une <em>collaboration</em>, ou simplement échanger sur un projet.</p>
                    <div className="info-links">
                        <a href="mailto:cloe.charotte@outlook.com" className="info-link">
                            <span className="info-icon">✉</span>cloe.charotte@outlook.com
                        </a>
                        <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="info-link">
                            <span className="info-icon">in</span>LinkedIn — Cloe Charotte
                        </a>
                        <a href="https://github.com/littlespyrit" target="_blank" rel="noreferrer" className="info-link">
                            <span className="info-icon">⌥</span>GitHub — littlespyrit
                        </a>
                    </div>
                </div>

                <div className="form-wrap">
                    {sent ? (
                        <div className="form-success">
                            <div className="form-success-icon">✦</div>
                            <h2 className="form-success-title">Message envoyé</h2>
                            <p className="form-success-txt">Merci — je vous répondrai dans les plus brefs délais.</p>
                        </div>
                    ) : (
                        <form className="form-inner" onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="f-group">
                                    <label className="f-label">Nom</label>
                                    <input type="text" className="f-input" placeholder="Votre nom" required />
                                </div>
                                <div className="f-group">
                                    <label className="f-label">Email</label>
                                    <input type="email" className="f-input" placeholder="votre@email.com" required />
                                </div>
                            </div>
                            <div className="f-group">
                                <label className="f-label">Sujet</label>
                                <input type="text" className="f-input" placeholder="Master, collaboration, projet..." required />
                            </div>
                            <div className="f-group">
                                <label className="f-label">Message</label>
                                <textarea className="f-input" placeholder="Votre message..." rows={6} required />
                            </div>
                            <div className="form-footer">
                                <button type="submit" className="f-submit" disabled={sending}>
                                    {sending ? 'Envoi…' : 'Envoyer →'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            <footer className="footer">
                <span>Cloe Charotte · {new Date().getFullYear()}</span>
            </footer>
        </div>
    );
}