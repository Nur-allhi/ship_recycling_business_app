# Plan for Application Refactoring & New Feature Implementation

## 1. High-Level Goals

This document outlines the step-by-step plan to perform a significant architectural refactoring of the ShipShape Ledger application. The goals are:
1.  **Improve Database Architecture**: Evolve the database schema to a more robust, "real-world" structure for better scalability and maintainability.
2.  **Introduce a Loans Module**: Add a dedicated feature to manage both money borrowed (Liabilities) and money lent (Assets).
3.  **Enhance Code Quality**: Refactor large, complex components into smaller, single-responsibility custom hooks to improve readability and make future development easier.
4.  **Implement Backup & Restore**: Provide a crucial data safety feature allowing users to export and import their entire ledger.

---

## 2. Phase 1: Foundational Database & Backend Changes

**Objective**: Update the server-side schema and logic first. This ensures our "source of truth" is correct before we modify the client application.

*   **Step 1.1: Document the Schemas**
    *   **Action**: I will create two markdown files to document the database changes clearly.
    *   **Details**:
        *   `oldDatabaseStratureSql.md`: This file will contain the complete SQL export of the *current* database schema, serving as our "before" snapshot.
        *   `newDatabaseStructureSql.md`: This file will contain the SQL for the new, improved schema. This includes the unified `contacts` table, the new `loans` and `loan_payments` tables, and the migration scripts.

*   **Step 1.2: Update Server-Side Actions (`src/lib/actions.ts`)**
    *   **Action**: I will rewrite the functions that interact with the database to align with the new schema.
    *   **Details**:
        *   I will replace `addVendor` and `addClient` with a unified `addContact` function.
        *   I will modify functions like `addStockTransaction` and `recordPayment` to reference the new `contacts` table.
        *   I will create a new set of server actions specifically for the Loans module, such as `addLoan`, `recordLoanPayment`, and `getLoanDetails`.
        *   I will implement the `exportAllData` and `batchImportData` server actions for the backup/restore functionality.

---

## 3. Phase 2: Client-Side Refactoring (Data & State Logic)

**Objective**: Update the client application's data layer to match the new backend structure and refactor the core state management logic for better maintainability.

*   **Step 2.1: Update Local Database Schema (`src/lib/db.ts`)**
    *   **Action**: I will update the Dexie.js schema definition to mirror the new Supabase schema.
    *   **Details**:
        *   The `vendors` and `clients` tables will be removed.
        *   A new `contacts` table will be added.
        *   New `loans` and `loan_payments` tables will be added.

*   **Step 2.2: Refactor State Management Logic (`src/app/context/`)**
    *   **Action**: I will decompose the monolithic `app-context.tsx` and `app-actions.tsx` files into smaller, specialized custom hooks.
    *   **Details**:
        *   **Create `useSessionManager.ts`**: This new hook will isolate all logic related to user authentication (login, logout, session checking).
        *   **Create `useDataSyncer.ts`**: This hook will be dedicated to managing the offline `sync_queue` and all communication with the server for data synchronization.
        *   **Create `useBalanceCalculator.ts`**: This hook will handle all financial calculations based on the data in the local database.
        *   **Refactor `app-context.tsx`**: This provider will become a lightweight coordinator that calls the new hooks and passes the state down.
        *   **Update `app-actions.tsx`**: This file will be simplified to focus only on writing new user actions into the local database and queuing them for synchronization. This will also include the new client-side actions for backup and restore.

---

## 4. Phase 3: UI Implementation and Refactoring

**Objective**: Build the user interface for the new features (Loans, Backup/Restore) and update all existing components that were affected by the database refactoring.

*   **Step 3.1: Rebuild Contact Management UI**
    *   **Action**: I will refactor all components related to vendors and clients.
    *   **Details**:
        *   I will remove `vendor-list.tsx` and `client-list.tsx`.
        *   I will create a new, unified `contact-list.tsx` component.
        *   The `contacts-tab.tsx` will be updated to use this new unified component, with filters to view vendors, clients, or all contacts.

*   **Step 3.2: Build the Loans Module UI**
    *   **Action**: I will build the complete user interface for the new Loans feature.
    *   **Details**:
        *   A new "Loans" item will be added to the main navigation in `src/app/page.tsx`.
        *   I will create a `loans-tab.tsx` component to act as the main container.
        *   This tab will contain two sub-components: `loans-payable-list.tsx` (for money borrowed) and `loans-receivable-list.tsx` (for money lent).
        *   I will create a new `add-loan-form.tsx` that will be accessible from the main floating action button, allowing users to easily record new loans.

*   **Step 3.3: Build the Backup & Restore UI**
    *   **Action**: I will create the user interface for the data management feature.
    *   **Details**:
        *   I will create a new `export-import-tab.tsx` component within the Settings page.
        *   This component will feature a button to trigger `handleExport` for downloading the full JSON backup.
        *   It will also include a file upload section to trigger `handleImport`, complete with clear warnings and a confirmation dialog about overwriting data.

*   **Step 3.4: Update and Refactor All Forms**
    *   **Action**: I will update all transaction forms and refactor their logic for better maintainability.
    *   **Details**:
        *   All forms that have a "contact" dropdown will be updated to fetch from the new unified `contacts` list.
        *   I will create dedicated logic hooks (e.g., `useStockFormLogic.ts`) to separate the complex state management and validation from the form's UI (the JSX), making the component files much cleaner.