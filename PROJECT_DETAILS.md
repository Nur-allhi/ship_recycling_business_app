# ShipShape Ledger - Project Map & Technical Breakdown

This document provides a detailed map of the ShipShape Ledger application, outlining its **refactored feature-based architecture**, file structure, features, and data flow. This document reflects the completed modular restructure that organizes code into feature-specific modules for improved maintainability and scalability.

## 1. High-Level Overview

### Project Purpose
The ShipShape Ledger is an offline-first financial and inventory management application designed for "Ha-Mim Iron Mart" ship recycling business. It allows users to track cash, bank transactions, stock levels, accounts receivable (A/R), and accounts payable (A/P) seamlessly, with or without an internet connection.

### Core Technologies
- **Framework**: Next.js 15.3.3 (App Router)
- **Language**: TypeScript 5.x
- **UI**: React 18.3.1, ShadCN UI Components, Tailwind CSS 3.4.1
- **Local Database (Offline Caching)**: Dexie.js 4.0.7 (IndexedDB wrapper)
- **Backend & Database**: Supabase (PostgreSQL, Auth, Storage)
- **State Management**: React Context API (`AppContext`) with modular feature hooks
- **Authentication**: Supabase Auth with JWT in httpOnly cookies
- **Build Tools**: Next.js with Turbopack, PWA support via next-pwa

### Architecture Patterns
- **Feature-Based Architecture**: Code organized by business features rather than technical layers
- **Offline-First Pattern**: Local data persistence with background sync
- **Optimistic UI Updates**: Immediate local updates with server reconciliation
- **Modular Hooks**: Feature-specific logic encapsulated in custom hooks
- **Component Composition**: Reusable UI components with clear separation of concerns

---

## 2. Refactored File & Folder Structure

### Major Architectural Changes
The application has been **completely refactored** from a monolithic structure to a **feature-based modular architecture**:

#### Before Refactoring:
```
src/
├── app/
├── components/           # All components mixed together
├── lib/
└── hooks/
```

#### After Refactoring:
```
src/
├── app/                  # Core application setup
├── features/            # 🆕 Feature-based modules
│   ├── auth/           # Authentication logic
│   ├── admin/          # Admin components
│   ├── contacts/       # Contact management
│   ├── dashboard/      # Dashboard functionality
│   ├── ledger/         # Financial ledger components
│   ├── settings/       # Application settings
│   ├── shared/         # Shared utilities
│   ├── stock/          # Stock management
│   ├── sync/           # Data synchronization
│   └── transactions/   # Transaction forms & validation
├── components/         # Shared UI components & backward compatibility
├── lib/               # Core utilities and database
└── hooks/             # Global custom hooks
```

### Feature Modules Structure
Each feature module follows a consistent structure:
```
features/[feature-name]/
├── components/         # Feature-specific components
│   ├── [Component].tsx
│   └── index.ts       # Clean exports
├── hooks/             # Feature-specific hooks (if needed)
├── validation/        # Feature-specific schemas (if needed)
└── index.ts          # Feature module exports
```

---

## 3. Detailed Feature Module Breakdown

### Core Application (`src/app/`)
| File | Purpose | Refactoring Impact |
|------|---------|-------------------|
| `layout.tsx` | Root application layout | ✅ Unchanged - stable foundation |
| `page.tsx` | Main application dashboard | ✅ Updated imports - now uses feature modules |
| `context/app-context.tsx` | **Refactored** - Core state management | 🔄 **Session logic → `/features/auth/useSessionManager.ts`** |
| `context/app-actions.tsx` | **Refactored** - Action handlers | 🔄 **Sync logic → `/features/sync/useSyncManager.ts`** |
| `login/page.tsx` | Login page | ✅ Unchanged |
| `auth/actions.ts` | Server-side auth actions | ✅ Unchanged |

### Authentication Module (`src/features/auth/`)
- **`useSessionManager.ts`** - 🆕 **Extracted from app-context.tsx**
  - Session state management
  - User authentication flow
  - Login/logout handling
  - Cookie-based session persistence

### Data Synchronization Module (`src/features/sync/`)
- **`sync.service.ts`** - 🆕 **Core sync functionality**
  - `enqueue()` - Add operations to sync queue
  - `flushQueue()` - Process pending sync operations
  - `resolveConflict()` - Handle data conflicts
- **`useSyncManager.ts`** - 🆕 **Extracted from app-context.tsx**
  - Online/offline status management
  - Background synchronization
  - Queue processing logic

### Transaction Management (`src/features/transactions/`)
- **`components/UnifiedTransactionController.tsx`** - 🆕 **Refactored from unified-transaction-form.tsx**
  - Main transaction form controller
  - Orchestrates different transaction types
- **`components/CashForm.tsx`** - 🆕 **Extracted component**
- **`components/BankForm.tsx`** - 🆕 **Extracted component**
- **`components/StockForm.tsx`** - 🆕 **Extracted component**
- **`components/SharedFields.tsx`** - 🆕 **Reusable form fields**
- **`validation/transaction.schema.ts`** - 🆕 **Extracted validation logic**

### Financial Ledger (`src/features/ledger/`)
- **`components/CashTab.tsx`** - 🔄 **Moved from `/components`**
- **`components/BankTab.tsx`** - 🔄 **Moved from `/components`**
- **`components/CreditTab.tsx`** - 🔄 **Moved from `/components`**
- **`components/PayablesList.tsx`** - 🔄 **Moved from `/components`**
- **`components/ReceivablesList.tsx`** - 🔄 **Moved from `/components`**
- **Dialog components** for payment settlement and advance recording

### Other Feature Modules
- **`/features/dashboard/`** - Dashboard components
- **`/features/stock/`** - Stock management
- **`/features/contacts/`** - Client/vendor management
- **`/features/admin/`** - Admin tools and user management
- **`/features/settings/`** - Application settings
- **`/features/shared/`** - Shared utilities and dialogs

---

## 4. Migration & Backward Compatibility

### Import Path Strategy
To ensure smooth migration, a **backward compatibility layer** was implemented:

```typescript
// src/components/index.ts - Backward compatibility exports
export { DashboardTab } from '@/features/dashboard/components';
export { CashTab, BankTab, CreditTab } from '@/features/ledger/components';
export { StockTab } from '@/features/stock/components';
export { UnifiedTransactionForm } from '@/features/transactions/components';
// ... other feature exports
```

This allows existing code to continue working while gradually migrating to direct feature imports:

```typescript
// Old way (still works)
import { CashTab } from '@/components';

// New way (preferred)
import { CashTab } from '@/features/ledger/components';
```

---

## 5. Key Refactoring Benefits

### 🎯 **Improved Maintainability**
- **Feature Isolation**: Each business feature is self-contained
- **Clear Dependencies**: Easier to understand component relationships
- **Reduced Coupling**: Components only import what they need

### 📈 **Enhanced Scalability**
- **Modular Growth**: New features can be added without affecting others
- **Team Collaboration**: Multiple developers can work on different features
- **Code Reuse**: Shared components and utilities are clearly identified

### 🔧 **Developer Experience**
- **Faster Navigation**: Find feature-related code quickly
- **Better IntelliSense**: More precise auto-completion
- **Easier Testing**: Unit test individual features in isolation

### 🚀 **Performance Benefits**
- **Tree Shaking**: Better dead code elimination
- **Lazy Loading**: Features can be loaded on demand (future enhancement)
- **Bundle Optimization**: Smaller JavaScript bundles

---

## 6. Database Interaction (Unchanged)

### Local Database (Dexie.js / IndexedDB)
- **Definition**: `src/lib/db.ts` 
- **Primary Consumers**: Feature hooks and context providers
- **Tables**: `cash_transactions`, `bank_transactions`, `stock_transactions`, `ledger_transactions`, `vendors`, `clients`, `banks`, `categories`, `sync_queue`, `monthly_snapshots`

### Remote Database (Supabase / PostgreSQL)
- **Interface**: `src/lib/actions.ts`
- **Authentication**: Service role key for trusted operations
- **Sync Strategy**: Background synchronization with conflict resolution

---

## 7. Integration Points (Enhanced)

### Supabase Integration
- **Client Setup**: `src/lib/supabase.ts`
- **Server Actions**: `src/lib/actions.ts` 
- **Authentication**: `src/app/auth/actions.ts`
- **Enhanced Security**: Row-level security with JWT validation

### Progressive Web App
- **Configuration**: `next.config.ts`
- **Service Worker**: Auto-generated via next-pwa
- **Offline Support**: Full offline functionality with sync queue

---

## 8. Development & Build Process

### Commands
```bash
# Development with Turbopack
npm run dev
# or: next dev --turbopack -p 9002

# Production Build
npm run build

# Type Checking
npm run typecheck

# Linting
npm run lint
```

### Build Validation
- ✅ **TypeScript Compilation**: All types validate correctly
- ✅ **Module Resolution**: All imports resolve successfully  
- ✅ **PWA Generation**: Service worker and manifest created
- ✅ **Bundle Optimization**: Tree shaking and code splitting working
- ✅ **Static Generation**: Pages pre-rendered for performance

---

## 9. Future Considerations

### Potential Enhancements
1. **Feature-based Lazy Loading**: Load features on-demand
2. **Micro-Frontend Architecture**: Split features into separate deployments
3. **Shared Component Library**: Extract UI components to separate package
4. **Feature Flags**: Enable/disable features dynamically
5. **Advanced Testing**: Feature-specific test suites

### Migration Guidelines
- **Gradual Migration**: Move imports to feature modules over time
- **Documentation**: Update all documentation to reflect new structure
- **Team Training**: Ensure all developers understand the new architecture
- **Monitoring**: Track build performance and bundle sizes

---

*This document reflects the application state after the complete architectural refactoring completed in the QODER_TASKS.md implementation.*

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
