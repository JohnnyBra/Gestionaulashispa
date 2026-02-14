# Plan de Migracion - PrismaEDU Design System → Hispanidad Reservas

**Creado**: 2026-02-14
**Ultima actualizacion**: 2026-02-14
**Estado**: COMPLETADO (primera pasada)
**Objetivo**: Adoptar el design system completo de PrismaEDU (`design-system.css`) en la app de reservas

---

## Estado General

| Fase | Estado | Descripcion |
|------|--------|-------------|
| 1. theme.css - Variables y base | HECHO | Variables CSS sincronizadas, --glass-hover-bg en dark, mesh backgrounds |
| 2. theme.css - Animaciones | HECHO | Todos los keyframes del design system agregados |
| 3. theme.css - Clases utilitarias | HECHO | Todas las clases faltantes agregadas |
| 4. index.html - Tailwind config | HECHO | Animaciones y keyframes sincronizados |
| 5. index.html - Estilos inline | HECHO | Movidos a theme.css, limpiados duplicados |
| 6. Componentes - Navbar | HECHO | Transiciones, hover:scale, pulse-ring en badge |
| 7. Componentes - Modal | OK | Ya usaba modal-overlay y modal-content correctamente |
| 8. Paginas - Login | HECHO | Error dark mode, divider glass, icono theme corregido |
| 9. Paginas - Dashboard | HECHO | gradient-text animado, glow borders, stagger animations |
| 10. Paginas - CalendarView | HECHO | Botones glass, bordes glass-border, transiciones |
| 11. Paginas - IncidentsPage | HECHO | animate-fade-in, dark mode titles, hover transitions |
| 12. Componentes - StudentOrganizer | HECHO | font-display, rounded-xl, hover transitions |
| 13. Build y verificacion | HECHO | npm run build exitoso sin errores |

---

## Cambios Realizados - Resumen

### theme.css (Fases 1-3)
Reescrito completamente. Cambios principales:

**Variables nuevas:**
- `--glass-hover-bg` en dark mode (`rgba(255,255,255,0.12)`)
- `--mesh-tutor`, `--mesh-parent`, `--mesh-student`, `--mesh-admin` (light + dark)
- `--glass-border-light` corregido para light mode

**Keyframes nuevos:**
- `slide-down`, `slide-in-right`, `bounce-subtle`
- `gradient-shift`, `pulse-ring`, `modal-overlay-in`

**Clases nuevas:**
- `.gradient-text` (animado con gradient-shift)
- `.mesh-tutor`, `.mesh-parent`, `.mesh-student`, `.mesh-admin`
- `.bottom-nav-safe`, `.pb-safe`, `.mobile-full`
- `.stagger-7`, `.stagger-8`
- `.bg-mesh` (movido de index.html, con variantes dark)
- `.glass-panel`, `.glass-header`, `.text-gradient-primary` (movidos de index.html)

**Correcciones:**
- `.glass-light` y `.glass-medium` ahora usan `--glass-border-light` (como design-system.css)
- `.modal-overlay` ahora tiene `animation: modal-overlay-in`
- `.gradient-text-warm` ahora tiene `animation: gradient-shift`
- `::selection` agregado globalmente
- Scrollbar con soporte light/dark en media query
- iOS overscroll fix con `@supports (-webkit-touch-callout: none)`

### index.html (Fases 4-5)
- Tailwind config sincronizado: keyframes `slide-down`, `slide-in-right`, `gradient-shift`, `pulse-ring` agregados
- Nombres de keyframes unificados (snake-case: `slide-up` en vez de `slideUp`)
- Estilos inline eliminados: scrollbar, glass-panel, glass-header, text-gradient-primary, bg-mesh
- Solo queda `overflow-x: hidden` en el `<style>` inline
- `selection:` classes removidas del body (ahora en CSS global)

### Navbar.tsx (Fase 6)
- Theme toggle: `hover:scale-105` + `transition-all duration-200`
- Badge de incidencias: `animate-pulse-ring` en notificacion
- Botones: `hover:scale-[1.02]` + `duration-200`
- Dark ring en badge: `dark:ring-slate-800`

### Login.tsx (Fase 8)
- Icono theme corregido (Sun en dark, Moon en light - consistente con Navbar)
- Top bar: `glass-light` en vez de `bg-white` para dark mode
- Error alert: soporte dark mode (`dark:bg-red-500/10`, `dark:border-red-500/20`)
- Error animacion: `animate-slide-up`
- Divider: `glass-light rounded-full` en vez de `bg-white`

### Dashboard.tsx (Fase 9)
- Nombre de usuario: `gradient-text` animado en vez de gradiente estatico
- Reservas: stagger animations + `hover:-translate-y-1`
- Card Primaria: `glow-border-blue` + `animate-slide-up stagger-1`
- Card Secundaria: `glow-border-green` + `animate-slide-up stagger-2`

### CalendarView.tsx (Fase 10)
- Back button: `glass` en vez de `bg-white dark:bg-slate-800`
- Admin buttons: `glass` + `hover:bg-glass-bg` + `hover:scale-105`
- Calendar header: `glass-light` + `border-glass-border` en vez de `bg-slate-200`
- Calendar rows: `border-glass-border` en vez de hardcoded slate
- Time slots: `glass` en vez de `bg-slate-100`
- Resource toggle: `glass` container, `glass-medium` active state
- Print modal: `glass` buttons, dark mode text
- Booking details: `glass rounded-xl` en vez de `bg-slate-50`

### IncidentsPage.tsx (Fase 11)
- Pagina wrapper: `animate-fade-in`
- Titulo: `dark:text-white` + `font-display`
- Subtitulo: `text-muted` class
- Back button: `hover:scale-[1.02]` + `transition-all duration-200`

### StudentOrganizer.tsx (Fase 12)
- Titulo: `font-display`
- Botones: `rounded-xl` + `transition-all duration-200`
- Importar/Guardar: `hover:-translate-y-0.5` lift effect
- Back button: `rounded-lg` + padding mejorado

---

## Archivos de Referencia

| Archivo | Descripcion |
|---------|-------------|
| `C:\cole\prisma\prismaedu\styles\design-system.css` | Design system original (solo dark mode) |
| `C:\cole\aulas\aulas\src\styles\theme.css` | Design system adaptado (light + dark mode) |
| `C:\cole\aulas\aulas\index.html` | Tailwind config + HTML base |

---

## Posibles Mejoras Futuras (Opcional)

- [ ] Usar `.mesh-admin` como fondo para paginas de admin
- [ ] Agregar animacion `slide-in-right` a transiciones de pagina
- [ ] Usar `glow-border-purple` en cards de incidencias
- [ ] Agregar `shimmer` loading en la carga inicial de datos
- [ ] Implementar `bounce-subtle` en iconos de notificacion
- [ ] Considerar `gradient-shift` animado en titulos de seccion
- [ ] Mobile bottom navigation con `.bottom-nav-safe`

---

## Notas de Sesion

### Sesion 1 (2026-02-14)
- Creado plan de migracion completo
- Analisis exhaustivo de design-system.css vs theme.css
- Analisis de todos los componentes y paginas (7 archivos)
- Implementacion completa de las 13 fases
- Build exitoso sin errores
- **ESTADO: Primera pasada completada. Verificacion visual pendiente.**
