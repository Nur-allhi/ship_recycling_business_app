# ShipShape Ledger - Project Map & Technical Breakdown

This document provides a detailed map of the ShipShape Ledger application, outlining its architecture, file structure, features, and data flow. It is intended to serve as a comprehensive technical guide for developers.

## 1. High-Level Overview

### Project Purpose
The ShipShape Ledger is an offline-first financial and inventory management application designed for a business named "Ha-Mim Iron Mart". It allows users to track cash, bank transactions, stock levels, accounts receivable (A/R), and accounts payable (A/P) seamlessly, with or without an internet connection.

### Core Technologies
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **UI**: React, ShadCN UI Components, Tailwind CSS
- **Local Database (Offline Caching)**: Dexie.js (a wrapper for IndexedDB)
- **Backend & Database**: Supabase (PostgreSQL, Auth)
- **State Management**: React Context API (`AppContext`) combined with `dexie-react-hooks` for live UI updates.

---

## 2. File & Folder Structure

### Major Folders
- **/src/app/**: The core of the Next.js application, containing routing, page layouts, and global context providers.
- **/src/components/**: Contains all reusable React components, including UI elements and feature-specific tabs.
- **/src/lib/**: Houses shared logic, utility functions, database definitions, and server-side actions.
- **/src/hooks/**: Contains custom React hooks, such as `useIsMobile`.

### Key File Breakdown

| File Path | Description & Purpose | Feature(s) Responsible For | Side |
| :--- | :--- | :--- | :--- |
| `src/app/layout.tsx` | The root layout of the application. It sets up the main HTML structure, fonts, and wraps the entire app in the `AppProvider`. | Core App Structure | Client |
| `src/app/page.tsx` | The main application view after login. It contains the primary `Tabs` component that orchestrates the different ledger views (Dashboard, Cash, Bank, etc.). | Main UI Navigation, Tab Layout | Client |
| `src/app/login/page.tsx` | The UI for the login page. | User Login | Client |
| `src/app/context/app-context.tsx` | **(Very Large File)** The heart of the application's state management. It initializes the app, manages user sessions, handles online/offline status, fetches and syncs data, and provides global state (balances, transactions) to all components. | **Core State Management**, Auth, Data Sync, Offline/Online Status | Client |
| `src/app/context/app-actions.tsx` | Contains the `useAppActions` hook. This file centralizes all functions that modify the application's state (e.g., adding/deleting transactions, recording payments). It handles both local DB updates and queuing server syncs. | **Core Action Logic**, Transaction Management, Payment Recording | Client |
| `src/lib/actions.ts` | **(Critical File)** Contains all server-side functions (Supabase interactions). This is the bridge between the client app and the PostgreSQL database. All database reads and writes are defined here. | **Database Communication**, Data CRUD, Server-side Logic | Server |
| `src/lib/auth.ts` | Manages the session cookie. It handles creating, reading, and removing the `httpOnly` cookie that stores the user's session payload. | Session Management | Server |
| `src/app/auth/actions.ts` | Contains server-side functions specifically for authentication (login, logout, add/delete users) that interact with Supabase Auth. | User Authentication | Server |
| `src/lib/db.ts` | Defines the entire **local** IndexedDB schema using `Dexie.js`. It lists all tables, their indexes, and provides the `db` instance used for all local database operations. | Local Database Schema | Utility |
| `src/components/unified-transaction-form.tsx` | **(Very Large File)** A complex, multi-purpose form used for adding all types of transactions (cash, bank, stock, etc.). It dynamically changes its fields based on user selections. | Adding All Transactions | Client |
| `src/components/cash-tab.tsx` | The UI and logic for displaying the cash ledger, including monthly navigation and running balances. | Cash Ledger View | Client |
| `src/components/bank-tab.tsx` | The UI and logic for the bank ledger. | Bank Ledger View | Client |
| `src/components/stock-tab.tsx` | UI and logic for both the stock history and current inventory views. | Stock Ledger & Inventory | Client |
| `src/components/credit-tab.tsx` | The main container for displaying Accounts Payable and Accounts Receivable lists. | A/R & A/P Management | Client |
| `src/components/settings-tab.tsx` | The main navigation for all settings pages, including Appearance, General, Contacts, and Admin tools. | Settings Navigation | Client |

---

## 3. Feature Mapping

### User Authentication & Session
- **Files**: `src/app/login/page.tsx`, `src/components/login-form.tsx`, `src/app/auth/actions.ts`, `src/lib/auth.ts`, `src/middleware.ts`
- **Flow**:
  1. User enters credentials in `LoginForm`.
  2. `login` action in `src/app/auth/actions.ts` is called, validating against Supabase Auth.
  3. On success, a session payload is created by `createSession` in `src/lib/auth.ts` and stored in a secure cookie.
  4. The `middleware.ts` file protects routes by checking for this session cookie.

### Offline-First Logic & Data Syncing
- **Files**: `src/lib/db.ts`, `src/app/context/app-context.tsx`, `src/app/context/app-actions.tsx`
- **Flow**:
  1. **Initial Load**: `AppContext` first loads all data from the local Dexie.js database (`src/lib/db.ts`), making the UI instant.
  2. **Background Fetch**: It then calls `reloadData` to fetch the latest data from the server.
  3. **User Action (Offline)**: User adds a transaction via `useAppActions`. The action is written **immediately** to the local Dexie DB. The UI updates instantly. An entry is added to the `sync_queue` table in Dexie.
  4. **User Action (Online)**: Same as offline, but the `processSyncQueue` function in `AppContext` is triggered immediately.
  5. **Going Online**: The `online` event listener in `AppContext` triggers `processSyncQueue`, which sends all pending actions from the queue to the server (`src/lib/actions.ts`).

### Recording a Transaction (e.g., Stock Purchase)
- **Files**: `src/components/unified-transaction-form.tsx`, `src/app/context/app-actions.tsx`, `src/lib/actions.ts`
- **Flow**:
  1. User fills out the `UnifiedTransactionForm`.
  2. On submit, `addStockTransaction` from `useAppActions` is called.
  3. This action writes the new stock transaction (and any linked financial transaction) to the local Dexie DB. The UI updates.
  4. The action is added to the `sync_queue`.
  5. `processSyncQueue` picks it up and calls the `addStockTransaction` server action in `src/lib/actions.ts`, which saves the data to the Supabase database.

---

## 4. Database Interaction

### Local Database (Dexie.js / IndexedDB)
- **Definition File**: `src/lib/db.ts`
- **Interacting Files**: Primarily `src/app/context/app-context.tsx` (for reading) and `src/app/context/app-actions.tsx` (for writing/updating).
- **Tables**: `cash_transactions`, `bank_transactions`, `stock_transactions`, `ap_ar_transactions`, `vendors`, `clients`, `banks`, `categories`, `sync_queue`, etc.

### Remote Database (Supabase / PostgreSQL)
- **Primary Interaction File**: `src/lib/actions.ts`
- **Description**: This file contains all RPCs (Remote Procedure Calls) to the Supabase backend. It handles all `select`, `insert`, `update`, and `delete` operations on the PostgreSQL tables. It uses the `service_role` key to bypass Row Level Security for trusted server operations.
- **Tables**: It interacts with the same set of tables as the local DB, keeping them in sync.

---

## 5. Integration Points

- **Supabase**: The primary backend service.
  - **Integration Files**:
    - `src/lib/supabase.ts`: Initializes the public (anon key) client.
    - `src/lib/actions.ts`: Initializes and uses the admin (service role) client for all data operations.
    - `src/app/auth/actions.ts`: Initializes and uses the admin client for user management.
- **next-pwa**: Used for Progressive Web App capabilities.
  - **Integration File**: `next.config.ts` wraps the Next.js config with the PWA plugin.

---

## 6. Dependencies & Utilities

- **`src/lib/utils.ts`**: Contains the `cn` utility function from ShadCN for merging Tailwind CSS classes.
- **`src/hooks/use-mobile.tsx`**: A custom hook to detect if the app is being viewed on a mobile-sized screen, allowing for responsive UI changes.
- **`date-fns`**: Used extensively throughout the app for reliable date formatting and calculations.
- **`zod`**: Used for schema validation in both client-side forms (`unified-transaction-form.tsx`) and server-side actions (`src/lib/actions.ts`).

---

## 7. Known Large Files & Refactoring Candidates

- **`src/app/context/app-context.tsx` (~450 lines)**: This file is the application's core.
  - **Main Sections**:
    - State Definitions (`useState` hooks for balances, loading states, etc.).
    - `useLiveQuery` hooks for reading from Dexie.
    - Core Logic (`processSyncQueue`, `reloadData`, session management).
    - Context Provider (`AppContext.Provider` that exposes all state and functions).
  - **Refactoring Note**: The separation of `useAppActions` was a good step. Further separation could involve moving specific logic (like `reloadData` or `processSyncQueue`) into dedicated custom hooks to further clean up the main provider component.

- **`src/components/unified-transaction-form.tsx` (~500 lines)**: This is a very large and complex form component.
  - **Main Sections**:
    - Zod schema definitions for all transaction types.
    - `useForm` hook setup and state management (`useState`).
    - Multiple `useEffect` hooks for watching form values and creating dynamic behavior.
    - The main `onSubmit` handler with a large `switch` statement.
    - The JSX render logic, which contains conditional rendering for every transaction type.
  - **Refactoring Note**: This component is a prime candidate for being split. Each transaction type (Cash, Bank, Stock) could be extracted into its own sub-component with its own Zod schema and form fields. The main `UnifiedTransactionForm` would then act as a controller, rendering the appropriate sub-form based on the selected transaction type.
