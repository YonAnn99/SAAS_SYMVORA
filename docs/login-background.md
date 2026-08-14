# Login background — `GradientWaves`

> **Estado actual:** el fondo del login/signup es una capa WebGL animada (raymarching) con olas monocromas en blanco/negro/grises. El gradiente CSS original se mantiene **detrás** como fallback (FOUC, navegadores sin WebGL2, `prefers-reduced-motion`).

## Ubicación

| Archivo | Rol |
|---|---|
| `src/components/auth/gradient-waves.tsx` | Componente cliente (`"use client"`) que monta el WebGL. Wrapper de `ogl` con tipos TS, `useReducedMotion`, cleanup robusto. |
| `src/app/(auth)/[locale]/layout.tsx` | Layout que monta `<GradientWaves />` dentro de `.auth-page-wrapper`. |
| `src/styles/auth-toggle.css` | Reglas de z-index (`auth-gradient-waves` z=0, `auth-noise-overlay` z=1, contenido z=2). |

## Por qué existe

El layout del auth tenía un gradiente lineal estático `linear-gradient(135deg, #ffffff → #e5e5e5 → #a3a3a3 → #1a1a1a)`. Se reemplazó por una capa WebGL animada con la misma paleta para añadir profundidad sin romper el lenguaje visual monocromo del auth.

## API del componente

```tsx
import { GradientWaves } from "@/components/auth/gradient-waves";

<GradientWaves
  horizonColor="#FFFFFF"   // color arriba (cielo/horizonte)
  waveColor="#1a1a1a"      // cuerpo de las olas
  crestColor="#A3A3A3"     // crestas
  speed={0.3}              // velocidad de la animación
  amplitude={2.0}          // amplitud de las olas
  detail="low"             // "low" (40 steps) | "medium" (70) | "high" (110)
  mouseInteraction={false} // desactivado por defecto (no distrae al escribir)
  opacity={0.85}           // transparencia para no competir con la card
  grain                    // textura sutil para evitar banding
  grainIntensity={0.03}
/>
```

Todas las props tienen defaults. La paleta por defecto reproduce exactamente el gradiente lineal original, por lo que si WebGL falla, la transición visual es mínima.

## Decisiones de diseño

### Adaptaciones obligatorias sobre el snippet original

1. **TypeScript estricto**: uniforms tipados como `Float32Array`, retornos `tuple [number, number, number]`, props como `interface GradientWavesProps`.
2. **`useReducedMotion`** de `motion/react` (ya en uso en 5 componentes marketing): si `reduceMotion === true`, no monta WebGL — el gradiente CSS queda detrás. Cubre WCAG 2.3.3.
3. **Cleanup robusto** para React 19 StrictMode: `try/catch` al `removeChild` (StrictMode puede invocar cleanup antes de que el nodo esté attachado), `cancelAnimationFrame`, `WEBGL_lose_context?.loseContext()`.
4. **Pause/Resume**: `IntersectionObserver` pausa cuando el contenedor no es visible; `visibilitychange` pausa cuando la pestaña está oculta. Evita gastar GPU.
5. **`pointer-events: none`** por defecto — decorativo puro.
6. **`mouseInteraction: false` por defecto**: en el contexto del login (usuario escribiendo), un fondo que reacciona al cursor distrae y hace que la card "tiemble". Es opt-in si en el futuro se quiere reactivar.

### Defaults calibrados para blanco/negro y para no competir con la card

| Param | Default | Por qué |
|---|---|---|
| `horizonColor` | `#FFFFFF` | Cielo blanco, integra con el top del gradiente original |
| `waveColor` | `#1a1a1a` | Mismo hex que el toggle panel del auth (`auth-toggle.css` línea 214) |
| `crestColor` | `#A3A3A3` | Mismo gris que el stop del 60% del gradiente original |
| `speed` | `0.3` | Más lento que el default (0.4) — fondo, no protagonista |
| `amplitude` | `2.0` | Más calmado (default 2.5) |
| `tilt` | `1.05` | Horizonte más recto (default 1.11) |
| `fogDepth` | `18` | Niebla más densa para integrarlo al fondo |
| `detail` | `"low"` | 40 steps en lugar de 70 — menos GPU en mobile |
| `opacity` | `0.85` | Semi-transparente: la card blanca encima se mantiene nítida |
| `grainIntensity` | `0.03` | Conserva textura sin ruido visible |

### Z-index layering

```
┌────────────────────────────────────────────┐
│ .auth-page-wrapper (background: linear-gradient)  ← fallback CSS siempre detrás
├────────────────────────────────────────────┤
│ <GradientWaves>          z-index: 0        ← olas WebGL (cuando se monta)
├────────────────────────────────────────────┤
│ <div .auth-noise-overlay> z-index: 1        ← textura SVG noise (opacidad 0.035)
├────────────────────────────────────────────┤
│ {children}               z-index: 2        ← card de auth (AuthForms)
└────────────────────────────────────────────┘
```

El selector `.auth-page-wrapper > *:not(.auth-noise-overlay):not(.auth-gradient-waves) { z-index: 2; }` garantiza que el card siempre queda encima.

## Accesibilidad

| Aspecto | Cubierto por |
|---|---|
| `prefers-reduced-motion: reduce` | `useReducedMotion` salta WebGL → gradiente CSS |
| Lectores de pantalla | `role="presentation"` + `aria-hidden="true"` (decorativo puro) |
| Pointer events | `pointer-events: none` (no interfiere con inputs) |
| Foco / teclado | N/A (no captura foco) |
| Navegadores sin WebGL2 | El renderer de ogl falla silenciosamente; el gradiente CSS queda debajo |
| Primer paint (FOUC) | El gradiente CSS está en SSR; las olas se montan en `useEffect` después del primer frame |

## Toggle de visibilidad en inputs de contraseña

El componente `src/components/ui/password-input.tsx` ya tenía un toggle Eye/EyeOff desde antes, pero solo se usaba en el signup. **Ahora también se usa en el login**: en `src/components/auth/auth-forms.tsx` (líneas 666-672) el `<input type="password">` pelado se reemplazó por `<PasswordInput className="auth-password-input" />`.

El botón del toggle:
- Posición: absoluta, `right: 12px`, centrado vertical.
- Icono: `Eye` (lucide-react) cuando oculto → `EyeOff` cuando visible.
- `tabIndex={-1}` — no participa en la navegación por teclado (no roba foco del input).
- `aria-label` derivado de `t("auth.togglePassword")` cuando esté disponible (futuro), por ahora usa el título nativo del botón.

### Estilos nuevos en `auth-toggle.css`

```css
.auth-password-input {
  width: 100%;
  margin: 6px 0;
}

.auth-password-input > .relative {
  width: 100%;
}
```

El selector `.auth-container input` ya estiliza el `<input>` interno (background `#f0f0f0`, padding, border-radius 8px). El wrapper `.auth-password-input` solo alinea con el `margin: 6px 0` del resto de inputs.

## Tests y verificación

- **`npm run build`**: compila limpio. Sin warnings de ESLint nuevos en `gradient-waves.tsx`, `layout.tsx` ni `auth-forms.tsx`.
- **`tsc --noEmit`**: 0 errores.
- **`npm run test`**: 104 tests pasan (no se añadieron tests nuevos porque el componente depende del DOM/WebGL — verificar visualmente).
- **Verificación manual**: dev server, ir a `/es/auth?mode=login`, confirmar:
  - Las olas se ven suaves y monocromas.
  - La card blanca del form se mantiene nítida encima.
  - El input de password tiene el botón Eye/EyeOff a la derecha y funciona.
  - Toggle Eye/EyeOff cambia entre `type="password"` y `type="text"`.
  - En DevTools → Rendering → "Emulate prefers-reduced-motion: reduce", las olas desaparecen y queda solo el gradiente CSS.

## Riesgos y notas

| Riesgo | Mitigación |
|---|---|
| **GPU/CPU en mobile** | `dpr` capado a 2, `detail="low"` (40 steps), `pointer-events: none`. Si se siente lag, abrir ticket y subir `detail` condicionalmente con `navigator.hardwareConcurrency < 4`. |
| **First-paint FOUC** | El gradiente CSS queda detrás — primer frame siempre muestra degradado estático. |
| **StrictMode double-mount** | `try/catch` en `removeChild`, `raf` cancelado, `WEBGL_lose_context`. |
| **Bundle size de `ogl`** | ~30KB minified. Aceptable; alternativa sería un shader custom más adelante. |
| **Futuro dark mode en auth** | El componente lee `mouseInteraction`/`speed`/etc. Si en el futuro se quiere swap de paleta por tema, añadir `useTheme()` y dos presets de colores. Hoy no se hace porque el auth siempre es claro (consistente con el comportamiento previo). |

## Si en el futuro hay que tocar

- **Cambiar velocidad o paleta**: editar `src/components/auth/gradient-waves.tsx` (defaults) o pasar props en `src/app/(auth)/[locale]/layout.tsx`.
- **Reactivar interacción con mouse**: pasar `mouseInteraction` y `parallaxStrength={0.5}` en el layout.
- **Migrar a dark mode**: añadir `useTheme()` dentro del componente y dos presets de colores por `resolvedTheme`.
- **Quitar el WebGL por completo**: borrar el `<GradientWaves />` del layout y la regla `.auth-gradient-waves` del `<style>`. El gradiente CSS queda como fondo.
