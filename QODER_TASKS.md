# Qoder Automated Refactor Instructions

## Rules
- No file > 300 lines.
- Separate UI, logic, and sync code.
- Follow feature-first folder structure.
- Keep local DB schema = server schema.
- Always include expected_amount when saving transactions.

## Tasks
1. Refactor `app-context.tsx`:
   - Move session/auth logic → `/features/auth/useSessionManager.ts`
   - Move sync logic → `/features/sync/useSyncManager.ts`
   - Keep `AppContext.tsx` minimal, only as provider.

2. Refactor `unified-transaction-form.tsx`:
   - Split into `CashForm`, `BankForm`, `StockForm`, `SharedFields`.
   - Move validation to `/features/transactions/validation/transaction.schema.ts`.
   - Unified form becomes a controller.

3. Extract Sync Logic:
   - Create `/features/sync/sync.service.ts` with:
     - `enqueue(op, payload)`
     - `flushQueue()`
     - `resolveConflict(serverRow, localRow)`

4. Apply Folder Restructure:
/src
/features
/auth
/sync
/transactions
/ledger
/shared
/components
/hooks
/utils
/lib


5. Update Documentation:
- Rewrite `PROJECT_DETAILS.md` with new structure.
- Create `REFRACTOR_NOTES.md` summarizing changes.

## Acceptance
- All tests pass.
- Offline mode works (IndexedDB sync).
- No console errors.
- Clear loading/skeleton states instead of “No data” flashes.
