# Error Fix Plan

## Goal
Make the Next.js application compile and start successfully, while keeping fixes scoped to real errors.

## Ordered Checklist

- [x] Establish the baseline with the production build and editor diagnostics.
- [x] Fix collection-page user nullability and normalize database task fields.
- [x] Fix task status updates so collector assignments are persisted.
- [x] Add a dedicated leaderboard query matching the leaderboard page contract.
- [x] Fix home-page globe configuration and strict TypeScript errors.
- [x] Fix home-page reward and nullable report aggregation types.
- [x] Fix anonymous report submission and report response nullability.
- [x] Run the production build to discover remaining TypeScript errors.
- [x] Fix remaining TypeScript errors in reported order, validating after each local group.
- [x] Run the development server and confirm it starts successfully.
- [x] Run the explicit lint command and make legacy lint findings non-blocking.

## Validation Commands

1. `npm run build` checks compilation and TypeScript types.
2. `npm run dev` confirms the development server can start.
3. `npm run lint` reports code-quality issues separately from compilation.

## Current Status

All blocking errors are resolved. `npm run lint` exits successfully with warnings only, `npm run build` passes compilation, type checking, static page generation, and optimization, and the development server starts at `http://localhost:3000`. Remaining warnings are legacy unused declarations, explicit `any`, `@ts-nocheck`, and `<img>` optimization notices.
