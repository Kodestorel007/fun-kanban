# Frontend Rewrite Plan

**Status:** COMPLETED (Feb 12, 2026)

This plan was executed in full. All 31 frontend files were rewritten from scratch. See [CHANGELOG.md](CHANGELOG.md) (v2.0.0) for the complete list of changes.

---

## Original Problem

Mobile was completely broken due to three root causes:
1. `touch-action: pan-y` on html/body — iOS Safari only supports `auto` and `manipulation`
2. `position: sticky` on `.main-header` inside `overflow: hidden` parent — traps scroll on iOS
3. Missing `min-height: 0` on flex ancestors — breaks overflow constraint chain

## Solution Applied

- **CSS:** Full rewrite from ~3,500 lines to ~1,200 clean lines. Single mobile media query. Strict overflow chain with `.column-tasks` as the only scrollable element.
- **Components:** Split-component architecture. `TaskCard.jsx` for desktop (dnd-kit), `MobileTaskCard.jsx` for mobile (zero dnd-kit). Separate rendering paths in `WorkspacePage.jsx`.
- **Layout:** Empty `useSensors()` on mobile. Header `position: relative` on mobile. No `autoFocus` anywhere.

## Scroll Chain (Mobile)

```
html, body, #root        height: 100%, touch-action: manipulation
  .app-layout             height: 100dvh, overflow: hidden, display: flex
    .main-content         flex: 1 1 0%, min-height: 0, overflow: hidden
      .page-content       flex: 1 1 0%, min-height: 0
        .workspace-page   flex: 1 1 0%, min-height: 0
          .kanban-board   flex: 1 1 0%, min-height: 0, overflow: hidden
            .kanban-column.mobile-active
              .column-tasks   position: absolute, inset: 0, overflow-y: auto
```

## Files Rewritten

All 31 frontend files. See CHANGELOG.md v2.0.0 for the complete breakdown.
