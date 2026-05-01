# Plan: SQLite Transition with Drizzle ORM

This plan outlines the steps to switch the project's local database from Supabase (Docker) to a local SQLite file using Drizzle ORM. This approach maintains the offline-first Dexie architecture while simplifying local development and providing a clear path to Supabase Cloud.

## 1. Desired Outcomes
*   **Zero-Docker Local Dev:** Developers can run the project locally without Docker using a simple SQLite file.
*   **Unified DB Layer:** Drizzle ORM abstracts database differences between SQLite (local) and Postgres (Supabase Cloud).
*   **Maintained Sync:** The Dexie-based offline sync mechanism remains intact.
*   **Type Safety:** Leverage Drizzle's type-safe query builder for all server-side data operations.

## 2. Execution Phases

### Phase 1: Dependencies & Environment
*   **Install Dependencies:**
    *   `npm install drizzle-orm better-sqlite3 postgres`
    *   `npm install -D drizzle-kit @types/better-sqlite3`
*   **Configure Drizzle:** Create `drizzle.config.ts` to manage migrations for both SQLite and Postgres.
*   **Update `.env.local`:** Add `DB_TYPE=sqlite` and `DATABASE_URL=local.sqlite`.

### Phase 2: Schema Definition
*   **Create Schema:** Implement `src/lib/db/schema.ts` based on current project types and Dexie stores.
*   **Tables to implement:**
    *   `banks`, `categories`, `contacts`, `initial_stock`, `cash_transactions`, `bank_transactions`, `stock_transactions`, `ap_ar_transactions`, `ledger_payments`, `loans`, `loan_payments`, `activity_log`, `monthly_snapshots`.
*   **Compatibility:** Use Drizzle's `pgTable` and `sqliteTable` utilities (or a unified approach) to ensure schema works for both drivers.

### Phase 3: Database Client Implementation
*   **Implement `src/lib/db/client.ts`:**
    *   Factory to create a Drizzle instance based on `DB_TYPE`.
    *   Export a singleton `db` instance for use in Server Actions.

### Phase 4: Refactor Server Actions
*   **Update `src/lib/actions.ts`:**
    *   Replace `createAdminSupabaseClient` with the new Drizzle client.
    *   Rewrite CRUD functions (`readData`, `appendData`, `updateData`, `deleteData`) using Drizzle syntax.
    *   Refactor complex transaction logic (e.g., `addStockTransaction`, `applyPaymentToLedger`) to use Drizzle's `db.transaction()`.

### Phase 5: Migration & Data Setup
*   **Generate Migrations:** Run `npx drizzle-kit generate` to create the initial SQL migration files.
*   **Push Schema:** Run `npx drizzle-kit push` to synchronize the local `local.sqlite` file with the schema.

### Phase 6: Plan Updates
*   **Update `codePlan.md`:** Remove Phase 0 (Local Supabase Infrastructure) and replace with Phase 0: SQLite Local Development. Update subsequent phases to reflect the move to Supabase Cloud instead of "Local Supabase".

## 3. Verification Plan
*   **Automated Verification:**
    *   Run `npx drizzle-kit check` to ensure schema consistency.
*   **Manual Verification:**
    *   Start the app: `npm run dev`.
    *   Perform data entry (Cash/Bank transactions).
    *   Verify the `local.sqlite` file is updated (using a SQLite viewer or Drizzle Studio).
    *   Test the Sync mechanism: Toggle offline mode (if possible) or verify the sync queue is processed and updates local IDs.

## 4. Risks & Mitigations
*   **Postgres-Specific Features:** Some Postgres features (like RLS or specific types) might not translate perfectly to SQLite. *Mitigation:* Focus on core relational logic first; RLS will be added in Phase 2 (Supabase Cloud migration).
*   **Transaction Differences:** SQLite and Postgres handle transactions differently. *Mitigation:* Use Drizzle's unified `db.transaction` API to handle differences.
