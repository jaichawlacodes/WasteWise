IMPORTANT: Work strictly one phase at a time. Start with Phase 0 only. Do not implement Phase 1 or any later phase until Phase 0 is complete and validated. After completing Phase 0, report the results and proceed to Phase 1 only if there are no blockers.

You have a performance audit of this project in `Pasted text.txt` / the provided performance audit report.

I want you to use that audit as the starting point and **actually optimize the entire website**, not just fix individual console errors.

The goal is:

> **Make the website dramatically lighter, faster, and more responsive while preserving the existing visual design, functionality, interactions, and user experience.**

Do not blindly remove features or simplify the UI to achieve better numbers. The goal is to make the implementation more efficient.

## First: understand before changing

Read the entire performance audit and then inspect the actual codebase yourself.

Do not blindly trust every recommendation in the audit. Verify each important finding against the current code before changing anything.

Before editing, create a prioritized implementation plan based on the actual code.

The optimization should be performed in phases.

---

# PHASE 0 — Establish a real baseline

Before making substantial changes:

* Inspect the current production build.
* Inspect route First Load JS sizes.
* Add/use bundle analysis if appropriate.
* Identify which dependencies actually contribute to client bundles.
* Identify the largest client chunks/modules.
* Run whatever local performance measurements are realistically available.
* Do not fabricate Lighthouse/Core Web Vitals measurements.
* Record the baseline so we can compare before vs after.

The current audit reports these First Load JS sizes:

* `/` — 349 kB
* `/report` — 345 kB
* `/collect` — 313 kB
* `/rewards` — 306 kB
* `/leaderboard` — 297 kB

Use the actual current build output as the source of truth rather than assuming these numbers are unchanged.

---

# PHASE 1 — Fix the architecture and critical-path weight

Prioritize architectural improvements over micro-optimizations.

## Database/client boundary

Investigate all imports from:

* `utils/db/action.ts`
* `utils/db/dbConfig.jsx`
* Drizzle
* Neon

from client components.

Move database operations behind an appropriate server boundary:

* Server Components
* Server Actions
* Route Handlers

where appropriate.

Ensure database credentials and server-only dependencies never enter browser bundles.

Pay particular attention to `DATABASE_URL` and the current `next.config.mjs` configuration.

Do NOT break authentication or authorization while doing this.

Preserve the existing behavior of every page.

---

# PHASE 2 — Remove Web3Auth from the critical path

The current Header globally loads Web3Auth.

This is a major priority.

The header should remain lightweight.

Do NOT initialize Web3Auth merely because someone visited the website.

Instead:

* Keep the login/connect UI available.
* Dynamically load the heavy Web3Auth/provider code when the user actually initiates authentication.
* Prevent Web3Auth/RPC initialization from blocking or competing with initial page rendering.
* Avoid unnecessary RPC calls for anonymous visitors.
* Preserve existing login/logout/reconnect behavior.
* Handle failed authentication gracefully.
* Do not change the product's authentication UX unnecessarily.

Verify that Web3Auth and its heavy dependencies are actually removed from routes where they are not needed.

---

# PHASE 3 — Fix data fetching

Audit every page's data fetching.

Look specifically for:

* sequential requests that could run concurrently
* duplicate requests
* repeated user lookups
* fetching entire tables when only a few fields are required
* unbounded queries
* client-side pagination
* fetching data only to calculate simple aggregates in JavaScript

For example, if multiple independent queries are required, determine whether they should be:

* executed concurrently,
* consolidated into one server-side query,
* cached/revalidated,
* or replaced with an aggregate query.

Do not blindly use `Promise.all` everywhere. Prefer the architecture that minimizes total work, network requests, database load, and browser JavaScript.

Add appropriate limits/pagination where data can grow without bound.

Preserve the current UI and data behavior.

---

# PHASE 4 — Reduce client-side JavaScript

This is one of the most important parts.

Inspect every route currently using `"use client"`.

Determine which portions genuinely require client-side JavaScript.

Convert unnecessarily client-rendered page shells/content into Server Components.

Use small client islands for things that actually need:

* state
* event handlers
* browser APIs
* forms
* modals
* interactive controls
* authentication
* maps
* uploads
* animations

Do not convert something to a Server Component if it genuinely requires client behavior.

The objective is:

**minimal client JavaScript + maximum useful server-rendered HTML.**

Pay particular attention to:

* `app/page.tsx`
* `app/report/page.tsx`
* `app/collect/page.tsx`
* `app/rewards/page.tsx`
* `app/leaderboard/page.tsx`
* `app/calculator/page.tsx`
* `app/settings/page.tsx`
* `app/verify/page.tsx`
* `app/messages/page.tsx`

---

# PHASE 5 — Optimize the homepage globe

The Cobe globe is a major continuous runtime cost.

Do NOT remove it.

Instead:

* dynamically load it
* avoid making it part of the critical initial JavaScript
* initialize it after the important hero content is usable
* pause it when it leaves the viewport
* pause it when the browser tab is hidden
* respect `prefers-reduced-motion`
* reduce rendering quality/sample count on low-powered/mobile devices
* avoid unnecessary React state updates during pointer interaction
* avoid recreating the globe instance when pointer state changes
* use refs for transient animation/pointer state where appropriate

Preserve the current visual appearance as much as practical on capable devices.

For reduced-motion or low-power devices, provide a visually consistent static/low-cost alternative rather than simply removing the globe.

---

# PHASE 6 — Optimize Gemini and uploads

Inspect:

* `/collect`
* `/report`
* `/messages`

The audit indicates that Gemini and image data are currently handled client-side.

Move AI operations behind a server boundary where appropriate.

Do not expose API keys in browser code.

For image uploads:

* validate file type
* validate file size
* avoid unnecessarily retaining huge base64 strings in React state
* use object URLs for previews where appropriate
* resize/compress images where appropriate
* avoid storing huge base64 payloads in database records if the product architecture allows a better approach

Preserve the existing AI functionality and UI.

Do not reduce image quality so aggressively that AI accuracy or the user experience suffers.

---

# PHASE 7 — Optimize Google Maps

On `/report`:

* avoid loading Google Maps/Places during initial page load if the user does not need autocomplete
* load it when the user actually focuses/uses the location functionality
* investigate the deprecated SearchBox API mentioned in the audit
* migrate to the supported API if necessary
* maintain a normal text-input fallback
* preserve the existing location UX

The Maps library should not contribute to the initial cost of unrelated routes.

---

# PHASE 8 — Optimize animations without destroying the design

Do not remove the website's visual personality.

Audit Framer Motion usage.

Keep animations that materially contribute to the design.

Replace simple effects with CSS where that provides the same result.

Pay particular attention to:

* hover scale
* opacity transitions
* shadows
* simple entrance animations
* repeated card animations
* unnecessary springs
* simultaneous animations

Add proper `prefers-reduced-motion` behavior.

Do not optimize animation merely by making everything static.

---

# PHASE 9 — Fonts and assets

Audit all fonts and public assets.

Determine whether:

* multiple font families are actually necessary
* unused font files can be removed
* unnecessary font weights are loaded
* images are oversized
* images can use more efficient formats
* explicit image dimensions can prevent layout shifts
* upload previews can be more memory efficient

Preserve the current typography and visual identity.

Do not change fonts simply because another font is technically smaller unless the visual result remains acceptably identical.

---

# PHASE 10 — Remove confirmed dead weight

Investigate:

* Leaflet
* inactive map code
* inactive Lit/Web3 code
* unused dependencies
* globally imported CSS that isn't needed
* unused components
* unused assets

**Do not delete anything merely because it appears unused.**

First verify that it is genuinely dead and not a hidden/secondary product feature.

Only remove code/dependencies after confirming they are not required.

---

# PHASE 11 — Validate after every major phase

After each major phase:

1. Run the production build.
2. Run lint/type checking if configured.
3. Run the relevant tests.
4. Check for runtime errors.
5. Check important routes.
6. Check authentication.
7. Check forms/uploads.
8. Check AI functionality.
9. Check maps.
10. Check animations.
11. Check mobile behavior.

Do not proceed blindly if a phase introduces regressions.

---

# PHASE 12 — Performance comparison

After all optimizations:

Compare the final project against the baseline.

Report actual measurements for:

* route First Load JS
* shared JavaScript
* largest client chunks
* build output
* dependency/bundle changes
* relevant request counts if measurable

If Lighthouse is available, measure:

* LCP
* CLS
* INP/TBT
* performance score

If a measurement is unavailable, explicitly say so.

Never invent performance improvements.

---

# IMPORTANT CONSTRAINTS

### Do NOT:

* remove features just to improve performance
* significantly redesign the UI
* replace the visual identity
* disable error reporting
* suppress warnings instead of fixing them
* remove authentication
* remove the globe
* remove AI functionality
* remove Maps functionality
* blindly replace libraries without measuring the benefit
* make unrelated refactors
* optimize tiny things before fixing architectural bottlenecks
* claim success because `npm run build` passes

### DO:

* preserve functionality
* preserve the visual design
* reduce initial JavaScript
* reduce unnecessary hydration
* reduce network requests
* reduce browser CPU/GPU work
* defer expensive features until they're needed
* move server work to the server
* lazy-load genuinely heavy features
* eliminate duplicate work
* measure before and after
* keep iterating when validation reveals problems

---

# Success criteria

The final website should:

1. Feel substantially faster on initial load.
2. Ship substantially less unnecessary JavaScript to the browser.
3. Hydrate less code.
4. Avoid loading expensive third-party functionality until needed.
5. Avoid continuous expensive background work when it isn't visible.
6. Make fewer unnecessary network/database requests.
7. Handle large data sets more efficiently.
8. Maintain the current visual design and functionality.
9. Have no new console/runtime errors.
10. Show measurable improvement over the original baseline.

**Do not stop after creating the plan. Execute it.**

Work through the phases, validate each major change, fix regressions, and continue iterating until the project is genuinely lighter and faster.

At the end, give me:

* baseline vs final measurements
* biggest improvements
* files changed
* dependencies removed/changed
* architectural changes
* remaining bottlenecks
* any compromises made
* any optimizations you intentionally did NOT make and why

## EXECUTION RULE — IMPORTANT

You must work **strictly one phase at a time**.

Do NOT implement all phases in one pass.

For each phase, follow this exact cycle:

**1. Inspect → 2. Plan → 3. Implement → 4. Validate → 5. Review → 6. Only then move to the next phase**

### After each phase:

* Run the relevant build/tests/type-check/lint commands.
* Inspect the git diff.
* Verify that existing functionality still works.
* Check for new console/runtime errors.
* Compare performance measurements against the previous baseline where applicable.
* Fix any regression you introduced before continuing.
* Briefly summarize what changed and what the validation showed.

### Important

**Do not start the next phase until the current phase has been successfully validated.**

If a phase reveals a problem that requires work from a later phase, handle only the minimum necessary dependency work, document it, and then return to the current phase.

If you encounter a decision that could significantly change functionality, architecture, or visual appearance, stop and explain the tradeoff rather than making a destructive assumption.

At the end of each phase, explicitly state:

**PHASE X COMPLETE**

* Changes made:
* Files changed:
* Validation performed:
* Results:
* Performance impact:
* Regressions:
* Ready for next phase: Yes/No

Then proceed to the next phase only if the answer is **Yes**.
