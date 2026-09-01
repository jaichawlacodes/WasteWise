You are working on an existing Next.js application.

Your first task is INSPECTION ONLY.

Do NOT modify any files.
Do NOT install dependencies.
Do NOT create files.
Do NOT run commands that change the project.

Analyze the existing codebase and report back on:

1. Next.js architecture

   * App Router structure
   * API routes
   * Server Actions, if any
   * client vs server components

2. External services

   * Gemini integration
   * geocoding integration
   * Neon/Postgres/Drizzle setup
   * any other external APIs

3. Existing performance work

   * client-side caching
   * large client bundles
   * dynamic imports/lazy loading
   * any other performance optimizations

4. Existing environment/deployment setup

   * Vercel compatibility
   * environment variables
   * Node.js version
   * build/start configuration

5. Redis opportunities
   Identify ONLY places where Redis provides a real engineering benefit.
   In particular, investigate:

   * API rate limiting
   * expensive server-side requests
   * geocoding
   * Gemini requests
   * notification polling, if present

6. Docker
   Determine what would be required to run the existing Next.js application reproducibly in a production-style Docker container without replacing Vercel as the production deployment platform.

7. CI
   Determine what GitHub Actions checks are appropriate based on the project's CURRENT scripts and configuration.

8. Health check and logging
   Identify the appropriate location for:

   * a lightweight health endpoint
   * useful server-side logging
     Do not recommend unnecessary observability infrastructure.

IMPORTANT CONSTRAINTS:

* The application must remain a standard Next.js App Router application deployed to Vercel.
* Docker must NOT replace Vercel.
* Do NOT recommend unnecessary AWS services or infrastructure just to make the project look more complex.
* Existing UI must remain unchanged.
* Existing performance optimizations must be preserved.
* Do not replace existing libraries or architecture unless there is a demonstrated technical reason.
* Redis must be server-side only.
* The application runs in Vercel/serverless environments, so do not rely on in-memory state for distributed concerns such as rate limiting.
* Prefer the smallest change that provides a real engineering benefit.

At the end, provide:

A. Current architecture summary
B. Redis recommendation
C. Docker recommendation
D. CI recommendation
E. Health-check/logging recommendation
F. Files you expect would need to change
G. Risks or compatibility concerns

Again: INSPECTION ONLY. Make no changes.

----
Now implement the Redis portion of the project based on your inspection.

Before making changes, briefly restate the Redis-related files and integration points you identified. Then implement only the Redis functionality described below.

GOAL:

Use Redis primarily for server-side rate limiting of expensive/public API endpoints, with caching added ONLY where your inspection showed a clear benefit.

IMPLEMENTATION:

1. Add the minimum required Redis dependency.

2. Create a reusable server-side Redis client in an appropriate location such as:
   lib/redis.ts

   Requirements:

   * Redis credentials come only from environment variables.
   * Never expose Redis credentials to client components.
   * Do not create a new connection unnecessarily for every request.
   * Keep the implementation compatible with Vercel serverless execution.

3. Create a reusable rate-limiting utility, for example:
   lib/rate-limit.ts

   Requirements:

   * Use Redis-backed state.
   * Do NOT rely on in-memory state.
   * Limits must be configurable through environment variables.
   * Return enough information for an API route to respond appropriately when a request is rejected.
   * Use appropriate HTTP rate-limit behavior, including a 429 response when the limit is exceeded.

4. Apply rate limiting to the API routes where it provides a real benefit.

   At minimum, evaluate:

   * /api/gemini
   * /api/geocode

   Do not blindly apply rate limiting to every route.

5. Gemini:
   Protect expensive Gemini/API usage from abuse.
   Preserve all existing Gemini functionality and request/response behavior.

6. Geocoding:
   Add rate limiting if appropriate based on the existing implementation.
   If the same geocoding requests are repeatedly made and caching is clearly safe, you may add a small Redis cache with a sensible TTL.
   Do NOT add caching merely because Redis is available.

7. Failure behavior:

   Redis must not become a reason for the entire application to fail unnecessarily.

   Design the implementation so that a Redis outage is handled deliberately and safely. Document the chosen behavior.

   Do not silently bypass security controls without explaining the tradeoff.

8. Environment variables:

   Add/update an example environment file if the project has one.

   Never commit actual credentials.

   Use clear names for:

   * Redis connection information
   * rate-limit configuration

9. Logging:

   Add lightweight server-side logging for:

   * rate-limit rejections
   * Redis failures
   * cache hits/misses if caching is implemented

   Do not add a logging framework unless the existing project actually requires one.

STRICT CONSTRAINTS:

* Do NOT change the UI.
* Do NOT change the database schema.
* Do NOT replace Neon, Drizzle, Gemini, or existing libraries.
* Do NOT upgrade Next.js or unrelated dependencies.
* Do NOT refactor unrelated code.
* Do NOT move files unnecessarily.
* Do NOT introduce AWS infrastructure.
* Do NOT use in-memory rate limiting.
* Do NOT expose Redis credentials to the browser.
* Do NOT make Docker or Redis a requirement for the Vercel frontend to function beyond the intended server-side integration.
* Preserve all existing performance optimizations.

After implementation:

1. Run the project's existing lint command.
2. Run TypeScript type checking using the project's existing configuration.
3. Run a production build if practical.
4. Review the git diff.
5. Report:

   * files changed
   * dependencies added
   * environment variables required
   * endpoints protected
   * caching added (if any)
   * Redis failure behavior
   * validation results
   * any remaining concerns

If you discover that a proposed Redis change would risk breaking the existing application or Vercel deployment, STOP that portion and explain the issue instead of forcing an implementation.


---------

Now implement Docker and GitHub Actions CI.

Keep the scope limited to Docker and CI. Do not refactor unrelated application code.

## 1. Docker

Create a production-oriented Docker setup for the existing Next.js application.

Requirements:

* Create a `Dockerfile`.
* Create a `.dockerignore`.
* Use the existing Node.js/Next.js versions and package manager configuration.
* Install dependencies reproducibly using the lockfile.
* Build the existing Next.js application.
* Run the application using its existing production start command.
* Prefer a multi-stage build if it provides a meaningful reduction in the final image size.
* Do not change the application's deployment architecture.

IMPORTANT:

Docker is for reproducible local development/CI and production-style testing.

Vercel remains the production deployment platform.

Do NOT:

* replace Vercel with Docker
* add Kubernetes
* add Docker Compose unless there is a demonstrated need
* add AWS infrastructure
* change Next.js configuration unnecessarily
* modify application UI or behavior

The Docker build must not require secrets to be committed into the image.

If the application requires environment variables at build/runtime, document which variables are required without exposing their values.

## 2. GitHub Actions

Create:

`.github/workflows/ci.yml`

The workflow should run on:

* pull requests
* pushes to `main`

Use the Node.js version appropriate for the existing project.

The CI pipeline should:

1. Check out the repository.
2. Set up Node.js.
3. Restore/cache npm dependencies appropriately.
4. Install dependencies using the lockfile.
5. Run ESLint using the project's existing lint configuration.
6. Run TypeScript type checking.
7. Run the production build.

Do not invent additional checks unless the repository already supports them.

If the existing `lint` script is incompatible with the installed Next.js version, diagnose the issue rather than silently changing unrelated dependencies.

## 3. Docker validation in CI

If practical, add a Docker build validation step to CI.

The goal is to verify that the Dockerfile remains buildable.

Do NOT run unnecessary containers or external services in CI.

## 4. Compatibility

The following must remain true:

* `npm run build` works.
* The application remains deployable to Vercel.
* Redis integration from the previous step remains serverless-compatible.
* Existing performance optimizations remain intact.
* Existing database configuration remains intact.
* Existing UI remains unchanged.

## 5. Validation

After implementation, run locally where possible:

* npm install/CI-equivalent dependency installation
* lint
* TypeScript type checking
* production build
* Docker image build

Then inspect the git diff.

Report:

* files created/changed
* Docker strategy
* Node.js version used
* CI workflow steps
* whether Docker build succeeded
* whether lint/typecheck/build succeeded
* any warnings or compatibility concerns

Do not make unrelated improvements.



------------


Now complete the final reliability and observability pass.

Keep this strictly scoped to:

1. Health check
2. Useful server-side logging
3. Validation
4. Final architecture audit

Do NOT introduce new infrastructure unless there is a demonstrated need.

## 1. Health endpoint

Create a lightweight health endpoint at an appropriate location such as:

`app/api/health/route.ts`

Requirements:

* Return a simple successful response when the Next.js server environment is functioning.
* Do not expose secrets.
* Do not expose database credentials, Redis credentials, API keys, or internal implementation details.
* Keep the endpoint fast.
* Do not make expensive external API calls from the health endpoint.

If you believe dependency checks such as Redis or database connectivity belong in a separate readiness check rather than the basic health endpoint, explain that distinction and implement only what is appropriate.

## 2. Server-side logging

Review the existing server-side code and add lightweight, useful logging where appropriate.

Prioritize:

* API failures
* Gemini failures
* database errors
* Redis failures
* rate-limit rejections
* cache hits/misses, ONLY where Redis caching was actually implemented

Requirements:

* Use the existing logging approach if one already exists.
* Do not add a logging framework just for the sake of adding one.
* Never log secrets, API keys, tokens, passwords, Redis URLs, database credentials, or sensitive user data.
* Avoid excessive logs inside frequently executed code.
* Logs should contain enough context to diagnose failures without exposing sensitive information.

## 3. Reliability

Review the Redis integration and make sure:

* Redis credentials remain server-side.
* Rate limiting does not rely on process-local memory.
* The implementation works with Vercel serverless execution.
* Redis failures are handled according to the behavior established during the Redis implementation.
* Redis does not unnecessarily become a single point of failure for unrelated application functionality.

Do not change the architecture unless a concrete reliability problem is found.

## 4. Final validation

Run the appropriate checks:

* lint
* TypeScript type checking
* production build
* Docker build
* any existing database/schema validation that does not modify production data

If tests already exist, run them.

Do NOT create a large new testing framework as part of this task.

## 5. Final architecture audit

Inspect the complete git diff and verify:

* Existing UI is unchanged.
* Existing performance optimizations are preserved.
* Next.js App Router remains intact.
* Server Actions remain intact.
* Neon/Drizzle remain intact.
* Gemini behavior remains intact.
* Vercel remains the production deployment platform.
* Docker is only an additional reproducibility/development/validation mechanism.
* Redis is only used where it provides a real benefit.
* No unnecessary dependencies or infrastructure were introduced.
* No secrets were committed.
* No unrelated refactoring was performed.

If you find unnecessary changes introduced during the previous steps, do NOT automatically rewrite them. Report them clearly and recommend whether they should be reverted.

## Final report

Give me a concise final report containing:

1. Architecture after changes
2. Files added/modified
3. Dependencies added
4. Environment variables required
5. Redis use cases
6. Docker setup
7. CI checks
8. Health endpoint
9. Logging added
10. Validation results
11. Any remaining risks or recommended follow-up work

The priority is:

STABILITY > COMPATIBILITY > SECURITY > PERFORMANCE > NEW TECHNOLOGY.

Do not make additional changes after completing this audit.




---------




