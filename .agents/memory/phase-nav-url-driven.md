---
name: Phase navigation is URL-driven
description: How to change game phase from components that don't own the useGameState instance
---

# Game phase is URL-driven; useGameState is local

`client/src/hooks/useGameState.ts` is a plain `useState` hook, so **every**
`useGameState()` call creates an independent state. Only the top-level `GameApp`
in `client/src/App.tsx` owns the authoritative phase. App mirrors phase→URL with
`history.replaceState` and reads URL→phase via a `popstate` listener
(`getPageBySlug`). Page components rendered propless by App (e.g.
`pages/world-map.tsx` → `WorldMapPage`) cannot reach App's `setPhase`.

**Why:** because the hook is local, calling `useGameState()` in a child gives a
fresh, disconnected state — phase changes there do nothing to the app.

**How to apply:** to navigate from such a component, change the URL to the target
page slug and dispatch popstate so App's listener applies it:
```ts
window.history.pushState({}, "", "/");            // "/" = menu slug (lib/pageRegistry)
window.dispatchEvent(new PopStateEvent("popstate"));
```
Do NOT use `window.history.back()` — phase sync uses `replaceState`, so back() is
unreliable and can exit app history. Slugs live in `client/src/lib/pageRegistry.ts`.
