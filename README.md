# SDE Intern Assignment: Shared Bill Splitter

Welcome. In this assignment you build a small bill splitter for a shared home. It has two parts:

1. **Homes and members:** create a home and add members to it.
2. **Bill splitting:** split a bill between the members. Each member pays their own share.

The assignment is small on purpose. We want correct, safe, and clear code. We do not want many features.

## What we look at

- **Your code passes the tests.** The tests decide, not opinion. You get the visible tests. We also run extra tests that you do not see.
- **Your code is safe when things go wrong.** Wrong input, repeated requests, and two requests at the same time must not break your data.
- **Your code is typed.** Use TypeScript. Do not use `any`.
- **You understand your code.** You record a short video and explain it.

Take your time. A careful, correct solution is better than a fast one. We expect 2 to 3 days of real work.

## Stack (required)

- **API:** Hono on Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite). The binding is `DB` in `api/wrangler.jsonc`.
- **Web:** React, Vite, TanStack Router
- **Language:** TypeScript on both sides
- **Tests:** Vitest, running inside the Workers runtime
- **Quality:** Biome. `pnpm check` and `pnpm typecheck` must pass.

You choose the rest (styling, form library, validation library). Pick tools you can explain.

## The task

The assignment has two parts. Do Part 1 first. Part 2 builds on it.

**Database.** Write the schema as SQL migration files in `api/migrations/`. For example `0001_init.sql`. The tests apply every file in this folder. Your schema must have **at least 3 named constraints** that protect the data. For example a foreign key, a `CHECK`, or a `UNIQUE` key. Be ready to explain what each constraint stops.

**Errors.** Every error response is JSON: `{ "error": "message" }`.

## Part 1: Homes and members

Create a home and add members to it. The order in which members are added matters in Part 2.

#### `POST /api/homes`

- Request: `{ "name": string }`
- Success: `201` `{ id, name }`

#### `POST /api/homes/:homeId/members`

- Request: `{ "name": string }`
- Success: `201` `{ id, homeId, name }`
- Errors: `404` home not found

Visible tests: `api/test/homes.test.ts`.

## Part 2: Bill splitting

Add a bill to a home, split it between the members, and let each member pay their share.

All amounts are whole **cents** (integers). `100` cents is 1 dollar. Never use decimals for money.

#### `POST /api/homes/:homeId/bills`

- Request: `{ "title": string, "totalCents": number }`
- Success: `201` `{ id, homeId, title, totalCents, shares: [{ id, memberId, amountCents, paidAt: null }] }`
- Errors: `404` home not found. `422` total is not a positive whole number, or the home has no members.

#### `POST /api/bills/:billId/shares/:shareId/pay`

- Request: header `Idempotency-Key`
- Success: `200` `{ id, memberId, amountCents, paidAt }`
- Errors: `400` key missing. `404` bill or share not found. `409` share already paid with a different key.

#### `GET /api/homes/:homeId/balances`

- Success: `200` `{ balances: [{ memberId, name, outstandingCents }] }`
- Errors: `404` home not found

**Rules**

- **Split.** A bill is split between all members of the home. The shares always add up to `totalCents`. If the amount does not divide evenly, the extra cents go to the members one by one, in the order the members were added to the home. Example: 1000 cents between 3 members gives `334`, `333`, `333`.
- **Pay.** Paying marks one share as paid and sets `paidAt`. If the same `Idempotency-Key` is sent again for the same share, answer `200` with the same result. Do not pay twice. If two requests pay the same share at the same time, only one may succeed.
- **Balances.** `outstandingCents` is the sum of the member's unpaid shares, across all bills of the home. List the members in the order they were added.

Visible tests: `api/test/bills.test.ts` and `api/test/payments.test.ts`.

#### Web page

Build one page that:

- shows the bills of a home and the shares of each bill,
- lets a member pay a share,
- shows clear **loading**, **empty**, and **error** states,
- keeps the share unpaid and shows an error if the payment fails.

The page must not crash when the API answers with an error or is slow.

## Cases you must handle

You must handle these cases and talk about them in your video:

1. A home with no members.
2. An amount that is zero, negative, or not a whole number.
3. An amount that does not divide evenly.
4. The same payment request sent twice.
5. Two members paying the same share at the same time.
6. A bill or share that does not exist.
7. The API answers with a 500 error or is slow. The web page must not crash.

## Run it

This is a pnpm workspace. Install once at the root.

```bash
pnpm install
pnpm dev          # api on :8787 and web on :5173
```

Open http://localhost:5173. Create a home with its members, add bills and pay shares from there. `/api/health` returns `{ "status": "ok" }`.

Wait for `Ready on http://localhost:8787` in the api log before using the page. Vite starts first, so for a few seconds `/api` calls get a 502. If Vite says it moved to port 5174, an older `pnpm dev` is still running. Stop it and start again, because the web proxy always talks to the api on 8787.

```bash
pnpm test         # run the visible tests in api/test
pnpm check        # Biome: format and lint. Must pass.
pnpm check:fix    # fix what Biome can fix
pnpm typecheck    # tsc on both packages. Must pass.
pnpm build        # production build of the web app
```

`pnpm dev` applies your migrations to a local database before it starts the API.

If pnpm says some build scripts were ignored, run `pnpm approve-builds` and allow `esbuild` and `workerd`.

When you change `api/wrangler.jsonc`, refresh the `Env` types:

```bash
pnpm --filter bill-splitter-api cf-typegen
```

### Docker (optional)

`pnpm dev` is the main way to run it. If your local Node or pnpm setup gives trouble, the same thing runs in one container:

```bash
docker compose up -d --build        # api on :8787 and web on :5173
docker compose exec app pnpm test   # tests inside the container
docker compose down                 # stop
```

The local database is kept in a Docker volume between restarts. Don't run this and `pnpm dev` at the same time, because they use the same ports.

## Rules for the tests

- The visible tests are in `api/test`. They start with a failing result. Your job is to make them pass.
- Do **not** change the visible tests or `api/test/helpers.ts`. We compare them with the original.
- We run extra tests after you submit. They test the cases in "Cases you must handle" more closely.

## AI policy

You can use AI tools. Tell us which ones and where in your answers on the form.
You must understand every line you submit. We check this with your video and in a live call. "The AI wrote it" is not an answer.

## How to submit

1. Click **Use this template**, then **Create a new repository**. Make the repository **public**.
2. Build your solution in your new repository. Small, clear commits are welcome.
3. Update this README with a short section called **Decisions**. Write 3 decisions you made and why.
4. Record a video of **3 minutes or less** (Loom or unlisted YouTube). Show the architecture, the data flow, and one trade-off you made. Make sure anyone with the link can view it.
5. Paste the repository link and the video link in the application form.

We will run `pnpm install && pnpm check && pnpm typecheck && pnpm test` on your repository.

## Decisions

1. **Paying a share is one conditional `UPDATE`.**
   `UPDATE shares SET paid_at = ?, pay_key = ? WHERE id = ? AND bill_id = ? AND paid_at IS NULL RETURNING ...`.
   D1 runs writes one after another, so when two requests race, only one gets a row back. The loser
   reads the share. If its key matches the stored `pay_key`, it is a retry and gets the same `200`.
   Otherwise it gets `409`. I didn't add a separate idempotency table. The key lives on the share,
   because a share can only be paid once anyway. The `shares_paid_has_key` check makes sure `paid_at`
   and `pay_key` are always set together.

2. **Member order is a `position` column, not `created_at`.**
   The split gives the extra cents to members in the order they were added, so that order must be
   exact. Timestamps can tie inside the same millisecond. `position` is computed inside the insert
   (`SELECT COALESCE(MAX(position), 0) + 1 ...`), and `UNIQUE (home_id, position)` stops two members
   from ever getting the same slot. The split itself is `floor(total / n)` for everyone, plus 1 cent
   for the first `total % n` members, so the shares always add up to the total.

3. **The web page reuses the idempotency key when you retry.**
   Each share gets a key the first time you press Pay. If the request fails or times out (10s), the
   share stays unpaid, an error is shown, and the button becomes Retry. Retry sends the same key, so a
   payment that reached the server but whose response got lost is not paid twice. The key is dropped
   only after a definite answer (`200`, `404`, or `409`). On `409` the page reloads the bills, because
   someone else paid the share. I used plain `fetch` and React state instead of a data library. The
   page is small, and I wanted to be able to explain every state it can be in.

### Constraints in the schema

| name                                                                     | stops                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `members_home_fk`, `bills_home_fk`, `shares_bill_fk`, `shares_member_fk` | rows pointing at a home/bill/member that doesn't exist                    |
| `members_position_per_home`                                              | two members with the same join order in one home                          |
| `shares_one_per_member`                                                  | a member getting two shares of the same bill                              |
| `bills_total_positive_int`                                               | zero, negative, or decimal totals, even if the API check is skipped       |
| `shares_amount_non_negative`                                             | negative or decimal share amounts                                         |
| `shares_paid_has_key`                                                    | a share marked paid without the key that paid it (or the other way round) |
| `*_not_blank`                                                            | empty names and titles                                                    |

### Extra endpoints

The page needs data the spec doesn't list, so I added two read-only routes:
`GET /api/homes/:homeId` (home and members in order) and `GET /api/homes/:homeId/bills` (bills with shares, newest first).
My own tests for the edge cases (racing payments, the same key sent at once, bad JSON, `2` cents split between 3) are in `api/test/edge-cases.test.ts`.
