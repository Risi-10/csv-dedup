# Newsletter List Cleaner — Project Kickoff

| | |
|---|---|
| **Client** | [Client Name] |
| **Contact** | Arben ([email — TBD]) |
| **User** | Elira |
| **Created** | 2026-11-18 |
| **Status** | Prototype built (demo data) |
| **Tech stack** | Offline web page (decided 2026-11-19), see [section 8](#8-tech-stack) |

---

## 1. Client request

> "Hi, every Monday Elira exports the customer list from the old system and it's a mess.
> Names in capitals, phone numbers all different, some people in twice. She spends half the
> morning fixing it by hand in Excel before we can send the newsletter. Can you make something
> so she just drops the file in and gets a clean one? Thanks, Arben"

**Goal:** Elira drops in Monday's export → gets a clean customer list back. No Excel work.

## 2. Who uses it

- **Elira**, not technical, works in Excel.
- **Every Monday** she exports the customer list from **the old system**, cleans it, and then the newsletter goes out.
- Today: about half a morning of cleaning by hand each week.

The tool must need no install, no command line and no settings. Drop the file in and click download.

## 3. Problem summary

Arben named three problems in the export:

| Problem | Example before | Example after |
|---|---|---|
| **Names in capitals** | `ANNA MÜLLER` | `Anna Müller` |
| **Phone numbers all different** | `+1 (555) 010-0000`, `555 010 0000`, `5550100000` | one standard format, e.g. `+15550100000` |
| **Some people in twice** | `JOHN SMITH, 555-010-0001` and `John  Smith, 5550100001` | one row: `John Smith, +15550100001` |

Duplicates are hard to spot in Excel because the copies aren't identical (different capitals, spaces,
phone formats, or small typos like `Jonh`), so Excel's "Remove Duplicates" misses them.

## 4. Success criteria

- [ ] Cleaning takes **under 2 minutes** instead of half a Monday morning.
- [ ] Names have normal capitals, and phone numbers all use one format.
- [ ] **No customer appears twice**, so no one gets the newsletter twice.
- [ ] **No real customer is lost.** Uncertain cases are flagged, not deleted.
- [ ] A short summary shows what changed, e.g.
      *"1,240 rows → 1,102 · 138 duplicates merged · 4 rows to check"*.
- [ ] The clean file works for sending the newsletter without further edits.

## 5. Out of scope (initially)

- Fixing or replacing the old system that produces the messy export.
- Sending the newsletter or connecting to the newsletter platform directly.
- [Add anything else agreed with Arben]

## 6. Discovery questions for Arben / Elira

**The export**
- [ ] Can we get one real (or anonymized) Monday export, plus the version Elira cleans by hand?
- [ ] Is it saved as CSV or Excel (`.xlsx`)? About how many rows?
- [ ] Which columns does it have? Is there a **customer ID** or an **email** column?
- [ ] Is the layout the same every week?

**Cleaning rules**
- [ ] When two rows are the same person, which details does Elira keep (newest, most complete)?
- [ ] Which phone format do they want (with country code, spaces, etc.)?
- [ ] Is there anything else she fixes by hand besides names, phones and duplicates?

**The newsletter**
- [ ] Which platform do they send with, and does it need specific columns on import?

**Data protection**
- [ ] The list contains personal data. Any GDPR or internal rules on where it may be processed?

## 7. Approach

What Elira does: **open the tool → drag Monday's export in → download the clean file.**

What the tool does automatically:
1. **Read** the export (CSV or Excel). Detect encoding and separator (`,` or `;`) so Excel files just work.
2. **Fix names**: normal capitals (`ANNA MÜLLER` → `Anna Müller`), extra spaces removed.
3. **Fix phone numbers**: convert every number to one standard format.
4. **Find duplicates**, using the most reliable column available:
   - customer ID or email, if the export has one (to confirm);
   - otherwise name + phone, with fuzzy matching to catch small typos.
5. **Merge**: one row per customer, keeping the most complete details.
6. **Output**
   - `clean list`: ready for the newsletter.
   - `check these`: a short list of uncertain matches, flagged rather than removed.
   - The one-line summary on screen.

Since the export always comes from the same old system, the tool can be built around its exact column layout.

## 8. Tech stack

**Recommended (to confirm with Arben): a single offline web page.**
- Elira opens one file in her browser, drags the export in and clicks download.
- No install, works on Windows and Mac.
- **The data never leaves her computer**, which keeps customer data safe.
- Reads and writes both CSV and Excel.

Backup option: a small Python script packaged as a program she drags files onto. Only worth it if the
exports are very large (hundreds of thousands of rows).

**Decision (2026-11-19):** single offline web page. Plain JS, no framework, SheetJS vendored in
`vendor/`; `npm run build` inlines everything into `dist/list-cleaner.html`. See README for layout.

**Backend roadmap (planned 2026-11-20):** keep the offline page and add a Node.js
(Fastify + PostgreSQL) backend that reuses the same cleaning code, in phases. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Phases 0–1 built 2026-11-23: `server/` serves the
page at `/` plus `GET /health` and `POST /api/clean`, no database yet. Opened from the server, the
page cleans there; opened as a file, it cleans in the browser.

## 9. Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Discovery call + one Monday export (raw and hand-cleaned) | ☐ |
| 2 | Prototype: compare its output with Elira's hand-cleaned file | ☐ |
| 3 | Elira uses it on a real Monday newsletter run | ☐ |
| 4 | Adjust based on her feedback | ☐ |
| 5 | Handover: tool + one-page how-to for Elira | ☐ |

## 10. Risks

| Risk | Mitigation |
|---|---|
| Two different people merged into one | Only merge very close matches; flag the rest for Elira to check |
| No reliable ID or email column in the export | Fall back to name + phone matching; confirm in discovery |
| Phone numbers that can't be read or are missing | Keep the original value and flag the row |
| Excel breaks the file (encoding, `;` vs `,`, lost leading zeros on phones) | Accept `.xlsx` directly; detect encoding and separator |
| The old system's export layout changes | Detect columns by name; clear message if a required column is missing |
| Personal data exposure | Processing runs offline in her browser; never commit real customer data to the repo |

## 11. Next steps

- [ ] Send the discovery questions (section 6) to Arben
- [ ] Get one Monday export and Elira's hand-cleaned version
- [ ] Confirm the tech stack (section 8)
- [ ] Set up the repo: `README.md`, `.gitignore` (exclude real customer data and `.env`), sample test files
- [ ] Build the prototype and test it against Elira's hand-cleaned file

## Notes

- [Meeting notes, decisions, links]
