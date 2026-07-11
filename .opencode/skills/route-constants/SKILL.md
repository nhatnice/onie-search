---
name: route-constants
description: Use when creating or editing navigation components (Link, OverlayLink, useMatchRoute), router calls (router.navigate, router.invalidate), redirects (redirect, redirectToLogin, redirectToHome), or anywhere a TanStack Router route path string appears in code. Enforces using ROUTES.* constants from @/shared/constants/routes — NEVER hardcode route path strings like to="/login" or navigate({ to: "/projects" }).
---

# Route Constants Enforcement

Centralized route paths are mandatory in this codebase. Every route string MUST go through `ROUTES.*` or `authRoutes.*` from `@/shared/constants/routes`. This is enforced by:

- **ESLint rule** `local/no-hardcoded-routes` — blocks hardcoded `to: "/..."` literals at code level.
- **opencode plugin** `enforce-routes` — runs ESLint after every edit, throws on violation.

If you write hardcoded route strings, the build fails. No exceptions.

## When to load this skill

Load this skill when:

- Creating a new `<Link>`, `<OverlayLink>`, or any navigation component.
- Adding a `router.navigate({ to: ... })` or `router.invalidate()` call.
- Adding `matchRoute({ to: ... })` for active-route detection.
- Adding a server-side redirect (`throw redirect({ to: ... })`).
- Touching any file under `src/features/*/views/`, `src/features/*/components/`, or `src/shared/components/layout/`.

Do NOT load for: pure data fetching, form submission logic, modal rendering.

## The two helpers

`@/shared/constants/routes` exports two helpers:

1. **`ROUTES`** — flat object of typed-route literal strings. Use for `to:` props and `matchRoute`:

   ```ts
   ROUTES.HOME; // "/"
   ROUTES.LOGIN; // "/login"
   ROUTES.TASKS; // "/tasks"
   ROUTES.PROJECTS; // "/projects"
   ROUTES.PROJECT_DETAIL; // "/projects/$projectId" — typed-route literal for dynamic routes
   ```

2. **`authRoutes`** — typed `ToOptions` helpers for auth pages with default search params. Use when you need typed search params for redirect/redirect target:
   ```ts
   authRoutes.login(redirectTo); // { to: "/login", search: { redirect: redirectTo } }
   authRoutes.home(); // { to: "/" }
   ```

## WRONG vs RIGHT examples

### ❌ WRONG — hardcoded route strings (ESLint will block these)

```tsx
<Link to="/login">Sign in</Link>
<Link to="/projects/$projectId" params={{ projectId: id }}>Open</Link>
<Link to="/tasks">Tasks</Link>

matchRoute({ to: '/login' })
matchRoute({ to: '/forgot-password' })

router.navigate({ to: '/projects' })
router.navigate({ to: '/dashboard' })
```

### ❌ WRONG — interpolating params into the `to` string (breaks TanStack Router type safety)

```tsx
<Link to={`/projects/${project.id}`}>Open</Link>
```

### ✅ RIGHT — use ROUTES constants

```tsx
<Link to={ROUTES.LOGIN}>Sign in</Link>
<Link to={ROUTES.PROJECT_DETAIL} params={{ projectId: id }}>Open</Link>
<Link to={ROUTES.TASKS}>Tasks</Link>

matchRoute({ to: ROUTES.LOGIN })
matchRoute({ to: ROUTES.FORGOT_PASSWORD })

router.navigate({ to: ROUTES.PROJECTS })
```

### ✅ RIGHT — use authRoutes helpers for typed search params

```tsx
throw redirect(authRoutes.login(redirectTo));
return <Link {...authRoutes.home()}>Home</Link>;
```

## Dynamic routes with params

**TanStack Router CRITICAL rule:** Never interpolate params into the `to` string. Always pass them via the `params` prop, with the literal `$param` placeholder in `to`:

```tsx
// ACCEPTABLE: ROUTES provides the typed-route literal; params passes the value
<OverlayLink to={ROUTES.PROJECT_DETAIL} params={{ projectId: project.id }} />
```

TanStack Router automatically interpolates `$projectId` from `params.projectId` — caller does NOT build the path string. For server-side redirects and `navigate()` calls where the route ID is constructed at runtime, use the same pattern:

```tsx
router.navigate({ to: ROUTES.PROJECT_DETAIL, params: { projectId } });
```

## When you must add a new route

1. Add the path to `ROUTES` in `src/shared/constants/routes.ts` (use `'/path/$param'` literal for dynamic routes).
2. Add a helper in `authRoutes` if it's an auth-flow route that needs default search params.
3. Then use `ROUTES.NEW_PATH` everywhere — never inline the string.

Do not "fix this one place first" and add the constant later. Add it to `ROUTES` first, then consume.

## Reference

- `src/shared/constants/routes.ts` — the constants object.
- `eslint-rules/no-hardcoded-routes.ts` — the AST rule (ObjectExpression inspector).
- `.opencode/plugin/enforce-routes.js` — the plugin that re-runs ESLint after edits.
- `AGENTS.md` line 500-501 — original documentation that this skill replaces.
