# Changelog

### [2026-05-01]

### Fixes
- **Fix**: Resolved `SqliteError: no such table: users` by pushing the Drizzle schema to the local database.
- **Fix**: Resolved `Transaction function cannot return a promise` error in `src/lib/actions.ts` by refactoring `db.transaction` calls to be synchronous for `better-sqlite3` compatibility.

### Transition to SQLite & Drizzle ORM
- **Add**: SQLite database (`local.sqlite`) for local development.
- **Change**: Refactored all server actions in `src/lib/actions.ts` to use Drizzle instead of Supabase SDK.
- **Change**: Refactored `src/app/auth/actions.ts` to use local SQLite and `bcryptjs` for authentication.
- **Add**: Signed session cookies using `jose` in `src/lib/auth.ts`.
- **Add**: Sync locking mechanism in `src/app/context/useDataSyncer.ts` to prevent race conditions.
- **Add**: Security safeguards for destructive actions in `src/lib/actions.ts` and `src/components/export-import-tab.tsx`.

---

## Summary of Changes (2026-05-01)

### 1. Database & ORM Transition (Phase 0)
*   **Drizzle ORM Integration**: Fully transitioned server-side data operations from the Supabase SDK to Drizzle ORM.
*   **SQLite for Local Dev**: Established a local `local.sqlite` database, enabling "Zero-Docker" development.
*   **Unified Schema**: Updated `src/lib/db/schema.ts` with a `users` table and refined existing tables for Drizzle compatibility.
*   **Synchronous Atomic Transactions**: Refactored all 15 transaction-heavy actions in `src/lib/actions.ts` to use synchronous `db.transaction()` callbacks, ensuring data integrity and `better-sqlite3` compatibility.
*   **Generic CRUD Refactor**: Rewrote `readData`, `appendData`, `updateData`, and `deleteData` to use type-safe Drizzle queries.

### 2. Authentication & Security (Phase 1)
*   **Local Auth System**: Transitioned authentication from Supabase Auth to a local SQLite-based system.
*   **Password Hashing**: Implemented `bcryptjs` for secure password storage in the local `users` table.
*   **Signed Session Cookies**: Integrated the `jose` library to cryptographically sign session cookies using a server-side secret (`APP_SESSION_SECRET`), fulfilling **Task 1.1**.
*   **Destructive Action Safeguards**: Added environment checks to prevent `deleteAllData` from running in production and updated the UI to require a manual text confirmation ("Confirm DELETE ALL").

### 3. Synchronization & Reliability
*   **Sync Locking**: Implemented a `useRef` based locking mechanism in `useDataSyncer.ts` to prevent race conditions during data synchronization.
*   **ID Reconciliation**: Ensured local Dexie IDs are correctly mapped to server-side SQLite IDs upon successful sync.
