# Newsletter List Cleaner

A tool that cleans the weekly customer export before the newsletter goes out. Drop in Monday's
export and get back a clean list:

- Names in normal capitals (`ANNA MÜLLER` → `Anna Müller`)
- Phone numbers in one standard format (`555 010 0000` → `+15550100000`)
- Duplicate customers merged, with uncertain matches flagged for review instead of deleted

Status: **not started.** See [CLAUDE.md](CLAUDE.md) for the project brief, approach and milestones.

## Setup

TBD. The planned approach is a single offline web page: no install, and the data never leaves
the user's computer.

## Usage

TBD.

## Tests

TBD.

## Data protection

Never commit real customer exports. `.gitignore` blocks `.csv` and `.xlsx` files everywhere except
`samples/`, which is for anonymized or made-up test data only.
