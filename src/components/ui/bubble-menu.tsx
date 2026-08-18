"use client";

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

const DEFAULT_ITEMS = [
  { label: 'Productos', href: '#features', rotation: -8 },
  { label: 'Precios', href: '#pricing', rotation: 8 },
  { label: 'Recursos', href: '#resources', rotation: -8 },
  { label: 'Iniciar sesión', href: '/login', rotation: 8 },
  { label: 'Prueba gratis', href: '/register', rotation: -8 }
];

export default function BubbleMenu({
  logo,
  onMenuClick,
  className,
  style,
  menuAriaLabel = 'Toggle menu',
  menuBg = '#fff',
  menuContentColor = '#111',
  useFixedPosition = false,
  items,
  animationEase = 'back.out(1.5)',
  animationDuration = 0.5,
  staggerDelay = 0.12
}: any) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const overlayRef = useRef(null);
  const bubblesRef = useRef<any[]>([]);
  const labelRefs = useRef<any[]>([]);

  const menuItems = items?.length ? items : DEFAULT_ITEMS;

  const containerClassName = [
    'bubble-menu',
    useFixedPosition ? 'fixed' : 'absolute',
    'left-0 right-0 top-6',
    'flex items-center justify-between',
    'gap-4 px-6 sm:px-8',
    'pointer-events-none',
    'z-[1001]',
    className
  ].filter(Boolean).join(' ');

  const handleToggle = () => {
    const nextState = !isMenuOpen;
    if (nextState) setShowOverlay(true);
    setIsMenuOpen(nextState);
    onMenuClick?.(nextState);
  };

  useEffect(() => {
    const overlay = overlayRef.current;
    const bubbles = bubblesRef.current.filter(Boolean);
    const labels = labelRefs.current.filter(Boolean);
    if (!overlay || !bubbles.length) return;

    if (isMenuOpen) {
      gsap.set(overlay, { display: 'flex' });
      gsap.killTweensOf([...bubbles, ...labels]);
      gsap.set(bubbles, { scale: 0, transformOrigin: '50% 50%' });
      gsap.set(labels, { y: 24, autoAlpha: 0 });

      bubbles.forEach((bubble, i) => {
        const delay = i * staggerDelay + gsap.utils.random(-0.05, 0.05);
        const tl = gsap.timeline({ delay });
        tl.to(bubble, {
          scale: 1,
          duration: animationDuration,
          ease: animationEase
        });
        if (labels[i]) {
          tl.to(
            labels[i],
            { y: 0, autoAlpha: 1, duration: animationDuration, ease: 'power3.out' },
            '-=' + animationDuration * 0.9
          );
        }
      });
    } else if (showOverlay) {
      gsap.killTweensOf([...bubbles, ...labels]);
      gsap.to(labels, { y: 24, autoAlpha: 0, duration: 0.2, ease: 'power3.in' });
      gsap.to(bubbles, {
        scale: 0,
        duration: 0.2,
        ease: 'power3.in',
        onComplete: () => {
          gsap.set(overlay, { display: 'none' });
          setShowOverlay(false);
        }
      });
    }
  }, [isMenuOpen, showOverlay, animationEase, animationDuration, staggerDelay]);

  return (
    <>
      <style>{`
        .bubble-menu .menu-line { transition: transform 0.3s ease, opacity 0.3s ease; transform-origin: center; }
        @media (max-width: 899px) {
          .bubble-menu-items { padding-top: 120px; align-items: flex-start; }
          .bubble-menu-items .pill-list { row-gap: 16px; }
          .bubble-menu-items .pill-list .pill-col { flex: 0 0 100% !important; margin-left: 0 !important; overflow: visible; }
          .bubble-menu-items .pill-link { font-size: clamp(1.2rem, 3vw, 4rem); padding: clamp(1rem, 2vw, 2rem) 0; min-height: 80px !important; }
          .bubble-menu-items .pill-link:hover { transform: scale(1.06); background: var(--hover-bg); color: var(--hover-color); }
          .bubble-menu-items .pill-link:active { transform: scale(.94); }
        }
      `}</style>

      <nav className={containerClassName} style={style} aria-label="Main navigation">
        <div
          className="bubble logo-bubble inline-flex items-center justify-center rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.12)] pointer-events-auto h-10 md:h-12 px-4 md:px-6 gap-2 will-change-transform transition-colors duration-300 overflow-hidden"
          aria-label="Logo"
          style={{ background: menuBg, borderRadius: '9999px' }}
        >
          <span className="logo-content inline-flex items-center justify-center w-auto h-full overflow-hidden">
            {logo}
          </span>
        </div>

        <button
          type="button"
          className={`bubble toggle-bubble menu-btn ${isMenuOpen ? 'open' : ''} inline-flex flex-col items-center justify-center rounded-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] pointer-events-auto w-12 h-12 md:w-14 md:h-14 border-0 cursor-pointer p-0 will-change-transform transition-colors duration-300`}
          onClick={handleToggle}
          aria-label={menuAriaLabel}
          aria-pressed={isMenuOpen}
          style={{ background: menuBg }}
        >
          <span className="menu-line block mx-auto rounded-[2px]" style={{ width: 22, height: 2, background: menuContentColor, transform: isMenuOpen ? 'translateY(4px) rotate(45deg)' : 'none' }} />
          <span className="menu-line short block mx-auto rounded-[2px]" style={{ marginTop: '6px', width: 22, height: 2, background: menuContentColor, transform: isMenuOpen ? 'translateY(-4px) rotate(-45deg)' : 'none' }} />
        </button>
      </nav>

      {showOverlay && (
        <div ref={overlayRef} className={`bubble-menu-items ${useFixedPosition ? 'fixed' : 'absolute'} inset-0 flex items-center justify-center pointer-events-none z-[1000]`} aria-hidden={!isMenuOpen}>
          <ul className="pill-list list-none m-0 px-6 w-full max-w-[1600px] mx-auto flex flex-wrap gap-x-0 gap-y-1 pointer-events-auto" role="menu" aria-label="Menu links">
            {menuItems.map((item: any, idx: number) => (
              <li key={idx} role="none" className="pill-col flex justify-center items-stretch box-border">
                <a
                  role="menuitem"
                  href={item.href}
                  aria-label={item.ariaLabel || item.label}
                  onClick={() => handleToggle()}
                  className="pill-link w-full rounded-[999px] no-underline bg-white text-inherit shadow-[0_4px_14px_rgba(0,0,0,0.10)] flex items-center justify-center relative transition-[background,color] duration-300 ease-in-out box-border whitespace-nowrap overflow-hidden"
                  style={{
                    '--item-rot': `${item.rotation ?? 0}deg`,
                    '--pill-bg': menuBg,
                    '--pill-color': menuContentColor,
                    '--hover-bg': item.hoverStyles?.bgColor || '#f3f4f6',
                    '--hover-color': item.hoverStyles?.textColor || menuContentColor,
                    background: 'var(--pill-bg)',
                    color: 'var(--pill-color)',
                    minHeight: 'var(--pill-min-h, 100px)',
                    padding: 'clamp(1rem, 3vw, 4rem) 0',
                    fontSize: 'clamp(1.2rem, 4vw, 2.5rem)',
                    willChange: 'transform'
                  } as React.CSSProperties}
                  ref={el => { if (el) bubblesRef.current[idx] = el; }}
                >
                  <span className="pill-label inline-block" ref={el => { if (el) labelRefs.current[idx] = el; }}>
                    {item.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}