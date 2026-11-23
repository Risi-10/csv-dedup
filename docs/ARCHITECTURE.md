# Architecture and backend roadmap

How the list cleaner works today, and the plan for growing it into an app with a backend and a
database without throwing away what already works.

Status: **phases 0 and 1 done** (2026-11-23), except phase 1's "clean on server" mode in the page,
which waits until the server is actually used. Later phases are plans (agreed 2026-11-20). Each
phase below becomes its own branch and pull request.

---

## 1. Where we are today

- The app is **one HTML file**, `dist/list-cleaner.html`, that Elira opens in her browser.
  `npm run build` (`scripts/build.mjs`) inlines the CSS, the scripts and SheetJS into it.
- **There is no server.** Node.js is only used to run the tests (`npm test`) and the build. Nothing is
  uploaded anywhere: the data never leaves Elira's computer.
- The code is split in two:

| Part | Files | Runs in |
|---|---|---|
| **Cleaning logic** | `src/core/`: `names.js`, `phones.js`, `columns.js`, `combine.js`, `dedupe.js`, `parse.js` | Browser **and** Node |
| **Page** | `src/web/`: `app.js`, `index.html`, `styles.css` | Browser only |

The cleaning files have no browser code. Each one exports through `module.exports` in Node and
`window.Cleaner` in the browser, which is how the tests already run them in Node. `parse.js`'s
`readFile(arrayBuffer, fileName, XLSX)` takes plain bytes, so a server can hand it an uploaded file
and the vendored `vendor/xlsx.full.min.js` (which also loads in Node).

## 2. Decision: grow the current code, don't start over

A backend can reuse every cleaning rule, test and bug fix as they are: the Albanian phone formats,
name matching, duplicate rules and multi-file combining. Starting over would mean rewriting and
re-testing all of that for no gain. Only the page needs a new "clean on the server" path.

**The offline page stays.** The same cleaning code powers both:

```
                ┌──────────────────── src/core/ (cleaning logic) ───────────────────┐
                │ parse → combine → columns → names/phones → dedupe → clean result │
                └───────────────▲─────────────────────────────────▲─────────────────┘
                                │                                 │
      offline: dist/list-cleaner.html                  online: server/ (Node + Fastify)
      (everything in the browser, as today)            (upload → clean → save in PostgreSQL)
```

## 3. Target layout

One repository and one `package.json`. No npm workspaces until they're actually needed.

```
src/core/                cleaning logic (moved from src/*.js, code unchanged)
src/web/                 the page: index.html, app.js, styles.css
server/                  Node API: app.js (Fastify setup), routes/, db/
server/db/migrations/    plain SQL migrations, numbered 001_*.sql, 002_*.sql, …
scripts/build.mjs        offline build (only its paths change)
test/                    core tests (unchanged) + test/server/
docker-compose.yml       local PostgreSQL for development
.env.example             PORT, DATABASE_URL (real .env is git-ignored)
```

## 4. Stack

| Piece | Choice | Why |
|---|---|---|
| Runtime | **Node.js 20+** (24 installed) | Same language as the cleaning logic: one codebase, one test suite |
| Web framework | **Fastify** | Built-in request validation and logging; `inject()` tests routes without starting a server |
| Database | **PostgreSQL** via `pg` | Reliable and widely hosted; parameterized SQL, no ORM, in line with the project's "no framework" style |
| Local DB | **Docker Compose** | One command to start, the same version for everyone |
| Config | `.env` + `.env.example` | No secrets in code. `.gitignore` already excludes `.env` and keeps `.env.example` |

Every dependency is pinned to an exact version, and `package-lock.json` is committed.

## 5. Phases

Each phase ends with something that works and can be shown to Arben and Elira.

### Phase 0: prepare (no behaviour change)
- Merge the open PRs in order: #3 → #4 → #2.
- Move the cleaning files to `src/core/` and the page to `src/web/`. Update the `require` paths in
  the tests and the paths in `scripts/build.mjs`.
- **Done when** `npm test` and `npm run build` give exactly the same results as before.

### Phase 1: first server (no database yet)
- Fastify serves the page and two endpoints:
  - `GET /health`: is the server up?
  - `POST /api/clean`: upload one or more files and get back the same result the offline page
    produces (`summary`, `clean`, `check`). It calls the existing `readFile` → `combineFiles` →
    `cleanList`.
- The page gets an optional "clean on server" mode. The offline file works exactly as before.
- Upload limits: `.csv` / `.xlsx` only, and a size limit. Files are handled in memory, never written
  to disk.
- **How to run** (once this phase exists):
  ```sh
  npm install
  cp .env.example .env     # first time only
  npm run dev              # starts the server and restarts it on code changes
  ```
  Then open `http://localhost:3000`.

### Phase 2: database and run history
- Start PostgreSQL with `docker compose up -d db`, then create the tables with `npm run db:migrate`.
- Every cleaning run is saved: when, which files, the summary, the clean list and the rows to check.
- Elira can reopen a past run and download it again.

### Phase 3: master customer list (recommended first real feature)
- The database keeps **one cleaned customer list**. Each Monday's export is compared with it:
  - customers already known and unchanged need no attention;
  - only **new or changed** customers, and real conflicts, go to "rows to check".
- Elira's decisions on rows to check are **remembered**: "these two are the same person" or "these
  are different people". The same question isn't asked again next week.
- This hits the client's main problem hardest: half a Monday morning of hand work.

### Phase 4: logins
- Accounts for Elira, Arben and anyone else who needs access. Passwords are hashed and sessions are
  stored server-side.
- Several businesses using the same app only if it ever becomes a product. Not planned now.

### Phase 5: integrations
- Send the clean list straight to the newsletter platform, or pull the export from the old system
  automatically, once the client tells us which systems (see CLAUDE.md section 6).

## 6. Draft API and data model (phases 1–3)

These are drafts, to be refined when each phase starts.

**Endpoints**

| Method | Path | Phase | Does |
|---|---|---|---|
| GET | `/health` | 1 | Server status |
| POST | `/api/clean` | 1 | Clean uploaded files, nothing stored |
| POST | `/api/runs` | 2 | Clean uploaded files and save the run |
| GET | `/api/runs` | 2 | List past runs (date, files, summary) |
| GET | `/api/runs/:id` | 2 | One run's result |
| GET | `/api/runs/:id/download?format=xlsx\|csv` | 2 | Download a past clean list or rows to check |
| GET | `/api/customers` | 3 | The master list (paged, searchable) |
| POST | `/api/review-decisions` | 3 | Save Elira's "same person" / "different people" decision |

**Tables**

| Table | Phase | Main columns |
|---|---|---|
| `runs` | 2 | `id`, `created_at`, `summary` (JSON), `clean` (JSON), `check` (JSON) |
| `run_files` | 2 | `id`, `run_id`, `file_name`, `row_count` |
| `customers` | 3 | `id`, `name`, `name_key`, `phone`, `email`, `external_id`, `extra` (JSON for other columns), `first_seen_run_id`, `updated_at` |
| `customer_sources` | 3 | `customer_id`, `run_id`, `file_name`, `row_number`: where each customer was seen |
| `review_decisions` | 3 | `id`, `row_a_key`, `row_b_key`, `decision` (`same` / `different`), `decided_at` |
| `users` | 4 | `id`, `email`, `password_hash`, `created_at` |

## 7. Data protection

A server changes the brief's promise that "the data never leaves her computer". So:
- **The offline page stays the default** until Arben confirms the GDPR and internal rules (CLAUDE.md
  section 6, "Data protection").
- If a server is used:
  - hosted in the EU;
  - HTTPS only;
  - an encrypted database;
  - a set retention period for runs and uploads;
  - a data processing agreement with the client;
  - only the access each user needs.
- **Never real customer data in the repository or the development database.** Use fake data based on
  `samples/` for seeding.

## 8. Testing

- Cleaning logic: `node --test`, unchanged. These tests are the safety net for every phase.
- Server routes: `fastify.inject()` tests in `test/server/`.
- Database: tests run against the Docker PostgreSQL. Each test starts from a clean schema.
- Every phase's pull request runs the full suite and the offline build.

## 9. Open questions for Arben

- Which features matter most: master list (phase 3), history, logins or integrations?
- May customer data be processed on a server? If so, where may it be hosted?
- How many people will use it?
- Which newsletter platform do they use, and can it import automatically?
