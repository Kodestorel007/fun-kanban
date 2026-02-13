# Mobile UX Patterns

**App:** Fun Kanban v2
**Target:** iOS Safari, Android Chrome (touch devices < 768px)
**Last Updated:** Feb 13, 2026

Behavioral specifications for the mobile touch interface. These patterns solve concrete problems discovered during development and are documented here for reference.

---

## Architecture

### Split-Component Strategy

Desktop and mobile use **completely separate card components**:

| Component | Platform | DnD Kit | Touch Handling |
|-----------|----------|---------|----------------|
| `TaskCard.jsx` | Desktop | `useSortable`, full drag-and-drop | Mouse events |
| `MobileTaskCard.jsx` | Mobile | None (zero imports) | Native `onClick` + passive `touchstart` |

**Why?** React hooks can't be conditional. `useSortable()` registers internal event listeners that intercept single-finger touch events even when `disabled: true`. The only fix: a component that never imports dnd-kit.

### Split-Rendering in WorkspacePage.jsx

```
isMobile === true:
  <div> containers + <MobileTaskCard> + <MobileNav>
  No DndContext, no SortableContext, no DragOverlay

isMobile === false:
  <DndContext> + <SortableContext> + <DroppableColumn> + <TaskCard> + <DragOverlay>
```

The `isMobile` state is derived from `window.innerWidth < 768` with a resize listener.

---

## Touch Interactions

### Tap &rarr; Edit Modal

`MobileTaskCard` uses a native `onClick` handler. The browser's click event only fires on genuine taps, not during scroll gestures.

```
User taps card → browser fires click → onClick calls props.onClick(task) → TaskModal opens
```

A `didLongPress` ref prevents the click from firing after a long press.

### Long Press (500ms) &rarr; Move Menu

```
touchstart → start 500ms timer
touchmove (> 10px) → cancel timer
timer fires → set didLongPress flag, haptic feedback, open MoveMenu at touch position
touchend → if didLongPress, suppress click
```

**Critical:** `touchstart` and `touchmove` handlers never call `preventDefault()`. This preserves native browser scrolling.

### Priority Dot &rarr; Popup Menu

Tapping the priority dot on mobile opens `PriorityMenu`, a fixed-position popup showing Low / Medium / High options. The dot uses `stopPropagation()` to prevent the card's click handler from also firing.

---

## Passive Touch Listeners

React's synthetic `onTouchStart` registers as a **non-passive** event listener. The browser must wait to see if `preventDefault()` will be called before it can begin scrolling, causing noticeable lag.

**Solution:** Use native `addEventListener` in a `useEffect`:

```javascript
useEffect(() => {
  const el = ref.current;
  if (!el) return;
  el.addEventListener('touchstart', handler, { passive: true });
  el.addEventListener('touchmove', moveHandler, { passive: true });
  return () => {
    el.removeEventListener('touchstart', handler);
    el.removeEventListener('touchmove', moveHandler);
  };
}, []);
```

This pattern is used in `MobileTaskCard`, `MoveMenu`, and `MobileNav`.

---

## Scroll Chain

Exactly **one element** scrolls on mobile: `.column-tasks` inside the active column.

Every ancestor in the chain uses `overflow: hidden` to prevent competing scroll containers:

```
html, body, #root        overflow: hidden, height: 100%
  .app-layout             overflow: hidden, height: 100dvh
    .main-content         overflow: hidden, flex: 1 1 0%, min-height: 0
      .page-content       flex: 1 1 0%, min-height: 0
        .workspace-page   flex: 1 1 0%, min-height: 0
          .kanban-board   overflow: hidden, flex: 1 1 0%, min-height: 0
            .kanban-column.mobile-active
              .column-tasks   position: absolute, inset: 0, overflow-y: auto
                               ^ ONLY SCROLLABLE ELEMENT
```

### Key CSS Rules

- `touch-action: manipulation` on `html, body, #root` (not `pan-y` &mdash; iOS Safari only supports `auto` and `manipulation`)
- `height: 100dvh` (not `100vh`) to account for the iOS Safari address bar
- `-webkit-overflow-scrolling: auto` (not `touch`) for interruptible scrolling
- `overscroll-behavior: contain` on `.column-tasks` to prevent scroll chaining

### Bottom Padding

```css
.kanban-column.mobile-active .column-tasks {
  padding-bottom: calc(120px + env(safe-area-inset-bottom));
}
```

Ensures the last card clears the fixed bottom navigation bar.

---

## Keyboard Prevention

The on-screen keyboard must never appear unless the user explicitly taps an input inside a modal.

How it's prevented:
1. Desktop-only elements (quick-add forms, filter selects) are **not rendered in JSX** on mobile &mdash; not just hidden with CSS
2. `tabIndex={-1}` on `MobileTaskCard` prevents focus
3. `Layout.jsx` sidebar DndContext uses empty `useSensors()` on mobile (no document-level pointer listeners)
4. No `autoFocus` on any mobile-rendered element

---

## Viewport & Zoom

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

Combined with `touch-action: manipulation`, this fully disables pinch-zoom and double-tap-to-zoom.

---

## Column Navigation

Only one column is visible at a time on mobile. `MobileNav` renders a fixed bottom tab bar:

```
To Do | In Progress | Done | Archived
```

Tapping a tab sets the active column. The `.mobile-active` CSS class controls which column is displayed.

---

## Haptic Feedback

```javascript
navigator.vibrate?.(10);    // light — tab switch
navigator.vibrate?.(25);    // medium — menu open
navigator.vibrate?.([30, 20, 30]); // heavy — long press activation
```

Android only. iOS ignores `navigator.vibrate()`.

---

## Context Menu (MoveMenu)

Long-press opens a fixed-position menu with move options (columns) at the touch position. Positioning logic avoids screen edges:

- If touch is on the right half, menu opens to the left of the finger
- If touch is on the left half, menu opens to the right
- Vertical position clamped to stay within viewport

Outside-click detection uses a **delayed** passive `touchstart` listener to avoid immediately closing on the same touch that opened it.

---

## Anti-Patterns

Things that break mobile and must be avoided:

| Don't | Why | Do Instead |
|-------|-----|------------|
| Import dnd-kit in mobile components | Hooks eat touch events even when disabled | Separate component, zero dnd-kit |
| `e.preventDefault()` in touch handlers | Blocks native scroll | Only cancel long-press timer |
| React `onTouchStart` | Non-passive, delays scroll | Native `addEventListener` with `{ passive: true }` |
| `-webkit-overflow-scrolling: touch` | Un-interruptible momentum | `overflow-y: auto` (default behavior) |
| `touch-action: pan-y` | iOS Safari doesn't support it | `touch-action: manipulation` |
| `position: sticky` inside `overflow: hidden` | Traps scroll on iOS | `position: relative` on mobile |
| `autoFocus` on inputs | Triggers keyboard on mount | Focus via `useEffect` + `setTimeout` after render |
| CSS `display: none` on inputs | Some browsers still focus them | Don't render in JSX on mobile |
| `tabIndex={0}` on cards | Can trigger keyboard | `tabIndex={-1}` |
| Multiple `overflow: auto` ancestors | Browser confused about which scrolls | Single scroll container, all others `overflow: hidden` |
