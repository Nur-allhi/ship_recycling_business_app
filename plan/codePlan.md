# ShipShape Ledger: Local Transition & Implementation Plan

This plan addresses critical security vulnerabilities, data integrity risks, and synchronization reliability issues identified during the codebase review.

## 1. Desired Outcomes & Acceptance Criteria
*   **Atomic Mutations:** All actions involving multiple tables must be atomic (all-or-nothing) to prevent database corruption.
*   **Race Condition Prevention:** The synchronization process must be sequential and thread-safe.
*   **Cookie Security:** Session cookies must be cryptographically signed to prevent unauthorized role escalation.
*   **Role-Based Access Control (RBAC):** Database security (RLS) must be enforced at the schema level, not just the application level.

## 2. Execution Phases

### Phase 0: SQLite Local Development (Completed)
*   **Task 0.1: Transition to SQLite with Drizzle ORM.**
    *   Install dependencies: `drizzle-orm`, `better-sqlite3`, `drizzle-kit`. (Done)
    *   Define unified schema in `src/lib/db/schema.ts`. (Done)
    *   Implement Drizzle client to support both SQLite (local) and Postgres (cloud). (Done)
    *   Refactor Server Actions to use Drizzle instead of direct Supabase SDK. (Done)
    *   Transitioned Auth to local SQLite with `bcryptjs`. (Done)

### Phase 1: Authentication & Security (In Progress)
*   **Task 1.1: Sign Session Cookies. (Completed)**
    *   Install `jose`. (Done)
    *   Update `src/lib/auth.ts` to sign session cookies with a server-side secret (`APP_SESSION_SECRET`). (Done)
    *   Verify signatures on every request. (Done)
*   **Task 1.2: Refine RLS Policies.** (Next Priority)
    *   Update Supabase migrations to implement role-based policies using JWT metadata.
    *   Test policies against the local Supabase instance.
    *   Restrict sensitive tables (e.g., `activity_log`) to the `admin` role.
*   **Task 1.3: Table Whitelisting.**
    *   Update `readData` in `src/lib/actions.ts` to only permit queries against an explicit list of allowed tables.

### Phase 2: Atomic Database Mutations (RPCs / Drizzle Transactions)
*   **Task 2.1: Implement Transactions.**
    *   Use Drizzle's `db.transaction()` for `add_stock_transaction`, `record_loan_payment`, and `transfer_funds`.
    *   Ensure these operations handle internal balances and ledger entries atomically.
*   **Task 2.2: Refactor Actions.**
    *   Replace multi-step logic in `src/lib/actions.ts` with Drizzle transactions.

### Phase 3: Synchronization Reliability
*   **Task 3.1: Sync Locking.**
    *   Implement a locking mechanism in `useDataSyncer.ts` to prevent concurrent sync executions.
*   **Task 3.2: Local ID Mapping.**
    *   Ensure local Dexie IDs are immediately reconciled with server-generated IDs upon successful sync to prevent duplicates.

### Phase 4: Destructive Action Safeguards
*   **Task 4.1: Secure `deleteAllData`.**
    *   Add a text-input confirmation requirement (e.g., "Confirm DELETE ALL") to the UI.
    *   Add environment checks to prevent execution in production.

## 3. Dependencies & Risks
*   **SQLite for Local Dev:** Replaces the need for Docker locally.
*   **Supabase Cloud:** Future migration target for production data and authentication.
*   **Environment Variables:** Requires `DB_TYPE`, `DATABASE_URL`, and `APP_SESSION_SECRET`.
*   **Schema Consistency:** Maintaining parity between SQLite and Postgres schemas.

## 4. Unresolved Questions
*   Is a manual conflict resolution UI required, or is "server-wins" acceptable for all data types?
*   Should the `service_role` key be completely removed from client-facing server actions?

## 5. Suggested First Step
**Implement Task 0.1 (Transition to SQLite with Drizzle ORM).** Refer to `sqlite-transition.md` for the step-by-step implementation guide.

