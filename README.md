# Newsletter List Cleaner

A single offline web page that cleans the weekly customer export before the newsletter goes out.
Drop in Monday's export and get back a clean list:

- Names in normal capitals (`ANNA MÜLLER` → `Anna Müller`)
- Phone numbers in one standard format (`069 123 4567` → `+355691234567`)
- Duplicate customers merged, with uncertain cases flagged for review instead of deleted

The data never leaves the computer: everything runs in the browser, with no internet needed.

Status: **prototype.** See [CLAUDE.md](CLAUDE.md) for the project brief and milestones, and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the plan to add a backend and database.

## Using it

1. Open `list-cleaner.html` in any browser (double-click it).
2. Drag the export (`.csv` or `.xlsx`) onto the page, or click to choose it. To combine several exports,
   drop or choose them together: they are cleaned as one list, so a customer in two files appears once.
3. Read the summary line, e.g. `14 rows → 9 · 4 duplicates merged · 1 empty row removed · 6 rows to check`.
4. Download the clean list (Excel, or CSV for the newsletter tool) and, if there are any, the rows to check.

Rows to check are still in the clean list. Nothing is ever dropped, except fully empty rows and header
rows repeated partway down a file. Row numbers in "rows to check" are the rows as Excel shows them, with
the file name in front when several files were combined (`monday.csv row 7`).

The page follows the computer's light/dark setting. The button in the top-right corner switches it,
and the browser remembers the choice.

## Setup

Requires [Node.js](https://nodejs.org/) 20 or newer, for building and tests only. There are no npm dependencies.

```sh
npm run build   # writes dist/list-cleaner.html, the single file to hand over
npm test        # unit tests + end-to-end test on samples/ (the sample uses US numbers, so it runs with country code 1)
```

During development you can also open `src/index.html` directly; it loads the same scripts unbundled.

## How it works

| File | Job |
|---|---|
| `src/parse.js` | Reads CSV (detects UTF-8 vs Windows-1252 and `,` / `;` / tab) and Excel files |
| `src/columns.js` | Finds columns by header name in Albanian, English and German (name, phone, email, ID, plus city, address, country, postal code, birthday, notes) and names them for the download |
| `src/combine.js` | Joins several files into one table, lining up columns by role or header, and remembers each row's file and row number |
| `src/names.js` | Fixes capitals word by word; leaves already mixed-case words like `McDonald` alone |
| `src/phones.js` | Converts phones to `+<country><number>`; default country code is `355`, Albania (`DEFAULT_COUNTRY_CODE`). Albanian and Kosovo numbers with a digit missing or extra are flagged |
| `src/dedupe.js` | Groups duplicates, merges them and builds the "rows to check" list and summary |
| `src/app.js` | Page wiring: drop zone, previews, downloads |
| `vendor/xlsx.full.min.js` | [SheetJS](https://sheetjs.com/) Community Edition **0.20.3**, from `cdn.sheetjs.com` (the npm registry copy is outdated) |

**Duplicate rules**

- **Merged** when two rows have the same customer ID, or the same email or phone with names that
  match allowing one typo per word (`Jonh Smith` = `John Smith`). Word order, leading titles (`Dr.`, `Z.`, `Znj.`) and accents are
  ignored, so `Dr. Agim Leka` = `Leka Agim` and `Elira Çela` = `Elira Cela`.
- **Flagged, not merged**: different names sharing a phone or email, the same name with different
  contact details, and missing or unreadable phone numbers.
- When merging, the most complete row wins, gaps are filled from the other copies, and the name
  spelling most copies agree on is kept. If merged copies had different phones or emails, the row is flagged.

**Columns** are found by header name, so their order doesn't matter. If a row's email or phone was typed
into another column (e.g. the email under `TELEFONI`), it is moved back to its own column and the row is
flagged. If most rows are like that, the header row itself is out of place, and the app stops with a
message instead of guessing.

**Files in different languages** line up: known columns are matched by meaning, so `QYTETI` and `City`
become one column. Columns the app doesn't know only line up when their header text is the same; any
column that only some files have is listed under the summary. **Column names in the clean file** can
be kept as in the first file (default), or set to Albanian (`Emri`, `Telefoni`, `Qyteti`…) or English
(`Name`, `Phone`, `City`…); the page remembers the choice. Unknown columns keep their own name.

**Downloads**: the Excel file stores every cell as text, so phone numbers keep their `+`. The CSV
uses the same separator as the input and starts with a UTF-8 BOM so Excel shows accents correctly.

## Data protection

Never commit real customer exports. `.gitignore` blocks `.csv` and `.xlsx` files everywhere except
`samples/`, which is for made-up test data only.
