'use client';

/**
 * Swipe Row de React Bits (https://reactbits.dev/micro/swipe-row, registro
 * `SwipeRow-TS-TW`). Cambios respecto al original:
 *
 *   - Sin `@hugeicons`: el icono por defecto es `Trash2` de lucide (el set del
 *     proyecto).
 *   - Textos para lectores de pantalla en español.
 *   - `live.current` se asigna en `useLayoutEffect` y no durante el render
 *     (lo exige el lint de React; mismo arreglo que `hold-button.tsx`).
 *   - `onTap`: un toque que no deslizo (p. ej. para abrir el detalle de la
 *     fila). Hace falta porque la fila captura el puntero y el clic no llega a
 *     su contenido. Si la fila estaba abierta, ese toque solo la cierra.
 *   - `startAction`: una accion al deslizar hacia el lado CONTRARIO (p. ej.
 *     "Recibir" en ordenes de compra). Solo si la fila empezo cerrada; debajo
 *     aparece una capa de su color y, al soltar pasado el umbral, la fila
 *     regresa y se ejecuta. Sin ella, ese lado resiste como en el original.
 *   - `nudgeStart`: al cambiar, la fila se asoma dos veces hacia el lado de
 *     `startAction` y regresa: avisa que esa accion se acaba de habilitar.
 *
 * La primera accion es la "primaria": se ejecuta al deslizar completo o al
 * tocar su boton, y la fila se colapsa antes de llamarla.
 */

import React, { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { Trash2 } from 'lucide-react';

const HYST = 10;
const FLICK = 110;
const DECEL = 0.998;
const VMAX = 1500;
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const SPRING_UI = { type: 'spring' as const, duration: 0.3, bounce: 0 };
const DEFAULT_ACTIONS: SwipeAction[] = [{ id: 'delete', label: 'Eliminar' }];

export interface SwipeAction {
  id: string;
  label: string;
  icon?: ReactNode;
  color?: string;
  dismiss?: boolean;
  onSelect?: () => void;
}

export interface SwipeRowProps {
  children?: ReactNode;
  actions?: SwipeAction[];
  actionColor?: string;
  drawerColor?: string;
  rowColor?: string;
  textColor?: string;
  height?: number;
  radius?: number;
  actionWidth?: number;
  direction?: 'left' | 'right';
  snapBounce?: number;
  resistance?: number;
  collapseMs?: number;
  commitAt?: number;
  fullSwipe?: boolean;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onAction?: (action: SwipeAction) => void;
  onCommit?: (action: SwipeAction) => void;
  /** Toque sin deslizar sobre la fila cerrada (anadido en SYMVORA). */
  onTap?: () => void;
  /** Accion al deslizar hacia el lado contrario (anadido en SYMVORA). */
  startAction?: SwipeAction;
  /**
   * Cada vez que cambia (y no es 0), la fila se asoma hacia `startAction`
   * para avisar que se habilito (anadido en SYMVORA).
   */
  nudgeStart?: number;
  closeOnAction?: boolean;
  haptic?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

type Sample = [number, number];
type Phase = 'idle' | 'committing' | 'collapsing';

interface Grip {
  id: number;
  x0: number;
  y0: number;
  grab: number | null;
  moved: boolean;
  hist: Sample[];
  touch: boolean;
  /** La fila estaba cerrada al empezar: solo asi cuenta `startAction`. */
  cerrada: boolean;
}

interface Live {
  move: (e: PointerEvent) => void;
  up: (e: PointerEvent) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rubber = (o: number, dim: number, c: number) => (o * dim * c) / (dim + c * Math.abs(o));
const unrubber = (y: number, dim: number, c: number) => (y * dim) / (c * Math.max(1, dim - Math.abs(y)));
const project = (v: number) => ((v / 1000) * DECEL) / (1 - DECEL);
const velocityOf = (hist: Sample[]) => {
  if (hist.length < 2) return 0;
  const a = hist[0];
  const b = hist[hist.length - 1];
  return ((b[1] - a[1]) / Math.max(1, b[0] - a[0])) * 1000;
};
const onColor = (hex: string) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const h = m[1].length === 3 ? [...m[1]].map(ch => ch + ch).join('') : m[1];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? '#111111' : '#ffffff';
};
const watchWindow = (live: { current: Live }) => {
  const onMove = (e: PointerEvent) => {
    if (e.isTrusted) live.current.move(e);
  };
  const onUp = (e: PointerEvent) => {
    if (e.isTrusted) live.current.up(e);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
};

const SwipeRow: React.FC<SwipeRowProps> = ({
  children,
  actions = DEFAULT_ACTIONS,
  actionColor = '#e5484d',
  drawerColor = '#3f3f46',
  rowColor = '#27272a',
  textColor = '#f5f5f5',
  height = 64,
  radius = 16,
  actionWidth = 80,
  direction = 'left',
  snapBounce = 0.2,
  resistance = 0.55,
  collapseMs = 200,
  commitAt = 0.6,
  fullSwipe = true,
  disabled = false,
  open: openProp,
  onOpenChange,
  onAction,
  onCommit,
  onTap,
  startAction,
  nudgeStart = 0,
  closeOnAction = true,
  haptic = true,
  label = 'Elemento de la lista',
  className = '',
  style
}) => {
  const uid = useId();
  const reduce = useReducedMotion();
  const s = direction === 'left' ? -1 : 1;
  const A = actionWidth;
  const n = actions.length;
  const D = n * A;
  const c = clamp(resistance, 0.05, 1);
  const primary = actions[0];
  const [openState, setOpenState] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [say, setSay] = useState('');
  const open = openProp ?? openState;

  const root = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const w = useRef(360);
  const grip = useRef<Grip | null>(null);
  const unwatch = useRef<(() => void) | null>(null);
  const live = useRef<Live>({} as Live);
  const foldTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heading = useRef<number | null>(null);
  // Si el gesto actual puede contar como toque: empezo con la fila cerrada y
  // no se deslizo. Lo consume el `onClick` de la superficie.
  const tapOk = useRef(false);

  const x = useMotionValue(0);
  const spread = useMotionValue(0);
  const landed = useMotionValue(0);
  const commitPoint = () => Math.max(commitAt * w.current, D + A / 2);
  // Hacia el lado contrario: cuanto hay que deslizar para `startAction`.
  const startPoint = () => Math.min(120, w.current * 0.35);
  const haciaInicio = () => Boolean(startAction) && Boolean(grip.current?.cerrada);
  const canCommit = () => fullSwipe && n > 0 && commitPoint() <= w.current;
  const exposed = useTransform(x, v => s * v);
  const surfaceXf = useTransform(x, v => `translateX(${v}px)`);
  const railXf = useTransform(exposed, (e: number) => `translateX(${-s * Math.max(0, D - e)}px)`);
  const shift = useTransform([exposed, spread], ([e, p]: number[]) => p * Math.max(0, e - A));
  const blockXf = useTransform(shift, v => `translateX(${s * v}px)`);
  // La capa de `startAction` solo se ve mientras se desliza hacia ese lado.
  const startOpacity = useTransform(exposed, (e: number) => (e < 0 ? 1 : 0));
  const glyphXf = useTransform(
    [shift, landed],
    ([v, l]: number[]) => `translateX(${-s * l * (v - (w.current - A) / 2)}px)`
  );

  const map = (raw: number) => {
    const W = w.current;
    if (raw < 0) return haciaInicio() ? Math.max(raw, -W) : rubber(raw, W, c);
    if (raw <= D) return raw;
    if (!canCommit()) return D + rubber(raw - D, W, c);
    const C = commitPoint();
    const knee = D + (C - D) / c;
    return raw <= knee ? D + c * (raw - D) : C + rubber(raw - knee, W, c);
  };
  const inv = (ex: number) => {
    const W = w.current;
    if (ex < 0) return haciaInicio() ? ex : unrubber(ex, W, c);
    if (ex <= D) return ex;
    if (!canCommit()) return D + unrubber(ex - D, W, c);
    const C = commitPoint();
    const knee = D + (C - D) / c;
    return ex <= C ? D + (ex - D) / c : knee + unrubber(ex - C, W, c);
  };

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    w.current = el.offsetWidth || w.current;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width) w.current = width;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(
    () => () => {
      clearTimeout(foldTimer.current);
      unwatch.current?.();
    },
    []
  );

  const setOpen = (next: boolean) => {
    if (next === open) return;
    setOpenState(next);
    onOpenChange?.(next);
  };
  const settle = (target: number, v = 0) => {
    heading.current = target;
    if (reduce) {
      animate(x, s * target, { duration: 0.2, ease: EASE_OUT });
      return;
    }
    const flick = Math.abs(v) >= FLICK;
    animate(
      x,
      s * target,
      flick
        ? { type: 'spring', duration: 0.4, bounce: snapBounce, velocity: s * clamp(v, -VMAX, VMAX) }
        : { ...SPRING_UI, velocity: s * v }
    );
  };
  const setSpread = (on: boolean) => {
    if ((spread.get() === 1) === on) return;
    if (reduce) spread.set(on ? 1 : 0);
    else animate(spread, on ? 1 : 0, SPRING_UI);
    if (on && primary) {
      setSay(`Suelta para ${primary.label.toLowerCase()}`);
      if (haptic && grip.current?.touch) navigator.vibrate?.(8);
    }
  };
  const commit = (a: SwipeAction, viaKey: boolean, v = 0) => {
    const leap = a === primary;
    setPhase('committing');
    setSay(a.label);
    setOpen(false);
    const fold = () => {
      setPhase('collapsing');
      foldTimer.current = setTimeout(() => {
        onCommit?.(a);
        a.onSelect?.();
      }, collapseMs);
    };
    if (viaKey || reduce) {
      if (leap) {
        spread.set(1);
        landed.set(1);
      }
      if (viaKey) {
        x.set(s * w.current);
        fold();
      } else animate(x, s * w.current, { duration: 0.2, ease: EASE_OUT }).then(fold);
      return;
    }
    if (leap) {
      if (spread.get() < 1) animate(spread, 1, SPRING_UI);
      animate(landed, 1, SPRING_UI);
    }
    animate(x, s * w.current, { ...SPRING_UI, velocity: s * v }).then(fold);
  };
  useEffect(() => {
    if (openProp === undefined || grip.current || phase !== 'idle') return;
    const target = open ? D : 0;
    if (heading.current === target) return;
    if (Math.abs(exposed.get() - target) > 0.5) settle(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, D]);

  // Aviso de que `startAction` se habilito: dos asomos discretos hacia ese
  // lado, dejando ver su capa, y de regreso. No interrumpe un gesto en curso
  // ni una fila abierta, y se omite con "reducir movimiento".
  useEffect(() => {
    if (!nudgeStart || !startAction || reduce) return undefined;
    const timer = setTimeout(() => {
      if (grip.current || open || phase !== 'idle') return;
      heading.current = 0;
      animate(x, [0, -s * 44, 0, -s * 26, 0], {
        duration: 1.3,
        times: [0, 0.28, 0.55, 0.75, 1],
        ease: 'easeInOut'
      });
    }, 350);
    return () => clearTimeout(timer);
    // Solo al cambiar el contador: no debe repetirse por otros renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudgeStart]);

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    tapOk.current = !disabled && !open && phase === 'idle' && e.button === 0;
    if (disabled || (n === 0 && !startAction) || phase !== 'idle' || grip.current || e.button !== 0) return;
    x.stop();
    heading.current = null;
    grip.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      grab: null,
      moved: false,
      hist: [],
      touch: e.pointerType === 'touch',
      cerrada: !open
    };
    try {
      surface.current?.setPointerCapture(e.pointerId);
    } catch {}
    unwatch.current?.();
    unwatch.current = watchWindow(live);
  };
  const move = (e: PointerEvent) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    if (g.grab === null) {
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      if (Math.abs(dx) < HYST || Math.abs(dx) < Math.abs(dy)) return;
      g.grab = s * (g.x0 + Math.sign(dx) * HYST) - inv(exposed.get());
      g.moved = true;
      tapOk.current = false;
      root.current?.setAttribute('data-dragging', '');
    }
    const ex = map(s * e.clientX - g.grab);
    x.set(s * ex);
    g.hist.push([performance.now(), ex]);
    if (g.hist.length > 4) g.hist.shift();
    setSpread(canCommit() && ex >= commitPoint());
  };
  const up = (e: PointerEvent) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    grip.current = null;
    unwatch.current?.();
    unwatch.current = null;
    root.current?.removeAttribute('data-dragging');
    try {
      surface.current?.releasePointerCapture(e.pointerId);
    } catch {}
    const ex = exposed.get();
    const v = velocityOf(g.hist);
    if (!g.moved) {
      if (open) {
        setOpen(false);
        settle(0);
      }
      return;
    }
    if (startAction && g.cerrada && ex < 0) {
      // Hacia el lado contrario: la fila regresa y, pasado el umbral, se
      // ejecuta la accion (no hay cajon que quede abierto de este lado).
      const disparar = -ex >= startPoint();
      settle(0, v);
      if (disparar) {
        if (haptic && g.touch) navigator.vibrate?.(8);
        onAction?.(startAction);
        startAction.onSelect?.();
      }
      return;
    }
    if (primary && canCommit() && ex >= commitPoint()) {
      commit(primary, false, v);
      return;
    }
    const target = Math.abs(v) >= FLICK ? (v > 0 ? D : 0) : ex + project(v) > D / 2 ? D : 0;
    setSpread(false);
    setOpen(target === D);
    settle(target, v);
  };
  useLayoutEffect(() => {
    live.current = { move, up };
  });

  const act = (a: SwipeAction, e: React.MouseEvent<HTMLButtonElement>) => {
    if (phase !== 'idle') return;
    onAction?.(a);
    if (a === primary || a.dismiss) {
      commit(a, e.detail === 0);
      return;
    }
    a.onSelect?.();
    if (!closeOnAction) return;
    setOpen(false);
    if (e.detail === 0) {
      heading.current = 0;
      x.set(0);
    } else settle(0);
  };
  const openNow = () => {
    heading.current = D;
    x.set(s * D);
    setOpen(true);
    setSay(`${n} ${n === 1 ? 'acción visible' : 'acciones visibles'}`);
  };
  const closeNow = () => {
    heading.current = 0;
    x.set(0);
    setOpen(false);
  };
  const onToggleKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || phase !== 'idle' || n === 0) return;
    const openKey = s < 0 ? 'ArrowLeft' : 'ArrowRight';
    const closeKey = s < 0 ? 'ArrowRight' : 'ArrowLeft';
    const toggle = e.key === 'Enter' || e.key === ' ';
    if (e.key === openKey || (toggle && !open)) {
      e.preventDefault();
      openNow();
    } else if (e.key === closeKey || e.key === 'Escape' || (toggle && open)) {
      e.preventDefault();
      closeNow();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && open && primary && canCommit()) {
      e.preventDefault();
      commit(primary, true);
    }
  };
  const onToggleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail !== 0 || disabled || phase !== 'idle' || n === 0) return;
    if (open) closeNow();
    else openNow();
  };

  const railId = `${uid}-rail`;
  return (
    <div
      ref={root}
      role="group"
      aria-label={label}
      className={`group relative overflow-hidden [height:var(--sr-h)] [transition:height_var(--sr-collapse)_cubic-bezier(0.23,1,0.32,1),margin-bottom_var(--sr-collapse)_cubic-bezier(0.23,1,0.32,1),opacity_var(--sr-collapse)_cubic-bezier(0.23,1,0.32,1)] data-[phase=collapsing]:h-0! data-[phase=collapsing]:mb-0! data-[phase=collapsing]:opacity-0 data-[disabled]:pointer-events-none data-[disabled]:opacity-55${className ? ` ${className}` : ''}`}
      data-direction={direction}
      data-open={open ? '' : undefined}
      data-phase={phase}
      data-disabled={disabled ? '' : undefined}
      style={
        {
          '--sr-h': `${height}px`,
          '--sr-r': `${radius}px`,
          '--sr-a': `${A}px`,
          '--sr-row': rowColor,
          '--sr-text': textColor,
          '--sr-drawer': drawerColor,
          '--sr-on-drawer': onColor(drawerColor),
          '--sr-action': actionColor,
          '--sr-on-action': onColor(actionColor),
          '--sr-collapse': `${collapseMs}ms`,
          ...style
        } as CSSProperties
      }
    >
      <div className="relative overflow-hidden [height:var(--sr-h)] [border-radius:var(--sr-r)] [background:var(--sr-row)]">
        <motion.div
          id={railId}
          className="absolute inset-0 [background:var(--sr-drawer)]"
          style={{ transform: railXf }}
          inert={!open || undefined}
          aria-hidden={!open}
        >
          {actions.slice(1).map((a, i) => (
            <button
              key={a.id}
              type="button"
              className="group/action absolute top-0 grid h-full cursor-pointer touch-manipulation place-items-center border-0 p-0 [font:inherit] outline-none select-none [width:var(--sr-a)] [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] after:pointer-events-none after:absolute after:inset-0 after:bg-white after:opacity-0 after:content-[''] [@media(hover:hover)_and_(pointer:fine)]:after:[transition:opacity_150ms_ease] [@media(hover:hover)_and_(pointer:fine)]:hover:after:opacity-[0.08]"
              onClick={e => act(a, e)}
              style={
                s < 0
                  ? { right: (i + 1) * A, background: a.color ?? drawerColor, color: onColor(a.color ?? drawerColor) }
                  : { left: (i + 1) * A, background: a.color ?? drawerColor, color: onColor(a.color ?? drawerColor) }
              }
            >
              <span className="grid justify-items-center gap-1 text-[11px] leading-none font-medium tracking-[0.01em] [transition:transform_160ms_cubic-bezier(0.23,1,0.32,1)] group-active/action:scale-[0.97] motion-reduce:group-active/action:scale-100">
                {a.icon ? <span className="inline-flex">{a.icon}</span> : null}
                <span>{a.label}</span>
              </span>
            </button>
          ))}
          {primary ? (
            <motion.div
              className="absolute top-0 h-full w-full [background:var(--sr-action)] group-data-[direction=left]:[left:calc(100%-var(--sr-a))] group-data-[direction=right]:[right:calc(100%-var(--sr-a))]"
              style={{ transform: blockXf }}
            >
              <motion.button
                type="button"
                className="group/action absolute top-0 grid h-full cursor-pointer touch-manipulation place-items-center border-0 bg-transparent p-0 [font:inherit] outline-none select-none [width:var(--sr-a)] [color:var(--sr-on-action)] [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] group-data-[direction=left]:left-0 group-data-[direction=right]:right-0 after:pointer-events-none after:absolute after:inset-0 after:bg-white after:opacity-0 after:content-[''] [@media(hover:hover)_and_(pointer:fine)]:after:[transition:opacity_150ms_ease] [@media(hover:hover)_and_(pointer:fine)]:hover:after:opacity-[0.08]"
                style={{ transform: glyphXf }}
                onClick={e => act(primary, e)}
              >
                <span className="grid justify-items-center gap-1 text-[11px] leading-none font-medium tracking-[0.01em] [transition:transform_160ms_cubic-bezier(0.23,1,0.32,1)] group-active/action:scale-[0.97] motion-reduce:group-active/action:scale-100">
                  <span className="inline-flex">
                    {primary.icon ?? <Trash2 size={20} strokeWidth={2} />}
                  </span>
                  <span>{primary.label}</span>
                </span>
              </motion.button>
            </motion.div>
          ) : null}
        </motion.div>
        {startAction ? (
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 flex items-center gap-2 px-5 text-[13px] font-medium group-data-[direction=left]:justify-start group-data-[direction=right]:justify-end"
            style={{
              opacity: startOpacity,
              background: startAction.color ?? '#16a34a',
              color: onColor(startAction.color ?? '#16a34a')
            }}
          >
            {startAction.icon ? <span className="inline-flex">{startAction.icon}</span> : null}
            <span>{startAction.label}</span>
          </motion.div>
        ) : null}
        <motion.div
          ref={surface}
          className="relative z-[1] flex h-full touch-pan-y items-center gap-3 px-4 [background:var(--sr-row)] [color:var(--sr-text)] [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] [@media(hover:hover)_and_(pointer:fine)]:cursor-grab [@media(hover:hover)_and_(pointer:fine)]:group-data-[dragging]:cursor-grabbing [@media(pointer:coarse)]:select-none group-data-[dragging]:select-none group-data-[dragging]:[&_*]:select-none"
          style={{ transform: surfaceXf }}
          onPointerDown={down}
          onClick={() => {
            if (tapOk.current) onTap?.();
            tapOk.current = false;
          }}
        >
          {children}
          <button
            type="button"
            className="absolute top-1/2 m-0 h-px w-px overflow-hidden border-0 bg-transparent p-0 [font:inherit] outline-none [clip-path:inset(50%)] [color:var(--sr-text)] group-data-[direction=left]:right-3 group-data-[direction=right]:left-3 focus-visible:h-6 focus-visible:w-auto focus-visible:-translate-y-1/2 focus-visible:overflow-visible focus-visible:rounded-xl focus-visible:px-2.5 focus-visible:text-xs focus-visible:whitespace-nowrap focus-visible:[clip-path:none] focus-visible:[background:color-mix(in_srgb,var(--sr-text)_12%,transparent)]"
            tabIndex={disabled ? -1 : 0}
            aria-expanded={open}
            aria-controls={railId}
            aria-keyshortcuts={s < 0 ? 'ArrowLeft' : 'ArrowRight'}
            onKeyDown={onToggleKey}
            onClick={onToggleClick}
          >
            {n} {n === 1 ? 'acción' : 'acciones'}
          </button>
        </motion.div>
      </div>
      <span className="sr-only" aria-live="polite">
        {say}
      </span>
    </div>
  );
};

export default SwipeRow;
