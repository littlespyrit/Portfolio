'use client';
import { useEffect, useRef } from 'react';

export default function FakeCursor() {
    const fakeCursorRef = useRef<HTMLDivElement | null>(null);
    const cursorX       = useRef(0);
    const cursorY       = useRef(0);
    const cursorCurX    = useRef(0);
    const cursorCurY    = useRef(0);
    const cursorRaf     = useRef<number>(0);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            cursorX.current = e.clientX;
            cursorY.current = e.clientY;
        };
        window.addEventListener('mousemove', onMouseMove);

        const animate = () => {
            cursorCurX.current += (cursorX.current - cursorCurX.current) * 0.55;
            cursorCurY.current += (cursorY.current - cursorCurY.current) * 0.55;
            if (fakeCursorRef.current) {
                fakeCursorRef.current.style.transform =
                    `translate(${cursorCurX.current}px, ${cursorCurY.current}px)`;
            }
            cursorRaf.current = requestAnimationFrame(animate);
        };
        cursorRaf.current = requestAnimationFrame(animate);

        const addHover = (el: Element) => {
            el.addEventListener('mouseenter', () => fakeCursorRef.current?.classList.add('cursor-hover'));
            el.addEventListener('mouseleave', () => fakeCursorRef.current?.classList.remove('cursor-hover'));
        };
        document.querySelectorAll('a, button').forEach(addHover);

        const onBtnMouseMove = (e: MouseEvent) => {
            const btn = e.currentTarget as HTMLElement;
            const rect = btn.getBoundingClientRect();
            btn.style.setProperty('--mx', `${e.clientX - rect.left}px`);
            btn.style.setProperty('--my', `${e.clientY - rect.top}px`);
        };
        document.querySelectorAll<HTMLElement>(
            '.about-cta, .cv-dl, .c-cta, .contact-form-link, .wip-card-cta, .wip-card-all'
        ).forEach(el => el.addEventListener('mousemove', onBtnMouseMove));

        return () => {
            cancelAnimationFrame(cursorRaf.current);
            window.removeEventListener('mousemove', onMouseMove);
            document.querySelectorAll<HTMLElement>(
                '.about-cta, .cv-dl, .c-cta, .contact-form-link, .wip-card-cta, .wip-card-all'
            ).forEach(el => el.removeEventListener('mousemove', onBtnMouseMove));
        };
    }, []);

    return <div ref={fakeCursorRef} className="fake-cursor" />;
}
