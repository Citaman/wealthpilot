# 💰 WealthPilot

> A modern, privacy-first personal finance dashboard built with Next.js

![Version](https://img.shields.io/badge/version-0.14.6-blue)
![Status](https://img.shields.io/badge/status-alpha-orange)
![License](https://img.shields.io/badge/license-MIT-green)

## 📖 Overview

WealthPilot is a comprehensive personal finance management application that helps you track expenses, manage budgets, set savings goals, and gain insights into your spending habits. All data is stored locally in your browser - no account required, no data sent to servers.

### ✨ Key Features

- **📊 Dashboard** - At-a-glance overview of your financial health
- **💳 Transaction Tracking** - Import and categorize bank transactions
- **📈 Analytics** - Visualize spending patterns and trends
- **🎯 Savings Goals** - Track progress toward financial goals
- **💰 Budget Management** - 50/30/20 rule and custom budgets
- **🔄 Subscription Tracking** - Monitor recurring expenses
- **📅 Bill Calendar** - Never miss a payment
- **🏦 Multi-Account Support** - Manage multiple bank accounts
- **⚙️ Professional Settings** - Manage preferences, data, and backups with ease
- **🔒 Privacy First** - All data stored locally in IndexedDB

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20.9+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/wealthpilot.git

# Navigate to project directory
cd wealthpilot

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
wealthpilot/
├── ROADMAP.md                 # Current roadmap (single source of truth)
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Dashboard
│   │   ├── transactions/       # Transaction management
│   │   ├── analytics/          # Analytics & insights
│   │   ├── budgets/            # Budget planning
│   │   ├── goals/              # Savings goals
│   │   ├── subscriptions/      # Recurring expenses
│   │   ├── calendar/           # Bill calendar
│   │   ├── accounts/           # Account management
│   │   ├── import/             # CSV import
│   │   └── settings/           # App settings (Revamped v0.12.1)
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── settings/           # Modular settings components
│   │   └── layout/             # Layout components
│   ├── hooks/                  # Custom React hooks (use-toast, use-data)
│   ├── lib/                    # Utilities & database
│   └── types/                  # TypeScript types
├── specs/                      # Feature specifications & architecture
│   ├── architecture/           # System architecture specs
│   ├── features/               # Feature specifications
│   ├── import/                 # Import/export specs
│   ├── ui-ux/                  # UI/UX specifications (legacy)
│   └── ui-revamp/              # Bank-grade UI/UX revamp (v0.15–v0.17)
└── public/                     # Static assets
```

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Components | [shadcn/ui](https://ui.shadcn.com/) |
| Icons | [Lucide React](https://lucide.dev/) |
| Charts | [Recharts](https://recharts.org/) |
| Database | [Dexie.js](https://dexie.org/) (IndexedDB) |
| CSV Parsing | [Papa Parse](https://www.papaparse.com/) |
| Dates | [date-fns](https://date-fns.org/) |

---

## 📋 Current Status

## 💾 Backups & Data Safety (Updated v0.12.1)

WealthPilot stores data locally in your browser (IndexedDB). To avoid losing your finances when switching devices or browser profiles:

- Use **Settings → Data** to access backup options.
- **Export Backup**: Download your full database as a JSON file.
- **Restore Backup**: Import a previous backup. You can choose to:
  - **Replace All**: Wipes current data and restores the backup (default).
  - **Merge**: Adds backup data to your current data (advanced).
- **Reset App**: Clear all local data to start fresh.

Backup format details: `specs/features/data-backups.md`.

### ✅ Implemented Features

- [x] Basic dashboard with balance overview
- [x] Transaction list with filtering and overrides
- [x] CSV import (dual format support)
- [x] Smart categorization (50+ merchant patterns)
- [x] Budget planning page with smart income detection
- [x] Savings goals tracking with history
- [x] Subscription detection & bill calendar
- [x] Advanced Analytics (Bento grid, forecasting)
- [x] Multi-account support
- [x] System Toast Notifications (v0.12.1)

### 📅 Roadmap Highlights

See [ROADMAP](./ROADMAP.md) for full version planning.

| Version | Theme | Status |
|---------|-------|--------|
| v0.10.0 | Goals Overhaul | ✅ Released |
| v0.11.0 | Data Safety & Portability | ✅ Released |
| v0.12.0 | Mobile, PWA, Accessibility | ✅ Released |
| v0.12.1 | Professional Polish | ✅ Released |
| v0.13.0 | Performance & Consistency | ✅ Released |
| v0.14.6 | Security & Intelligence Integration | ✅ Released |
| v0.15.0 | UI Foundation & System | 📋 Planned |
| v1.0.0 | Production Ready | 🎯 Target |

---

## 🏦 v0.5.0 - Multi-Account Support

### Managing Multiple Accounts

WealthPilot v0.5.0 introduces full multi-account support to help you track all your finances in one place:

#### Global Account Selector

- **Sidebar Account Picker**: Click the account selector below the logo to switch between accounts
- **View All Accounts**: Select "All Accounts" to see combined data across all accounts
- **Per-Account Balance**: Each account shows its current balance in the dropdown
- **Color-Coded**: Each account has a unique color for easy identification

#### Account Overview on Dashboard

When viewing "All Accounts", the dashboard shows:

- **Total Balance**: Combined balance across all accounts
- **Account Grid**: Quick view of all accounts with balances
- **Click to Filter**: Click any account to switch to viewing just that account

#### Import Flow

When importing transactions, you must select which account they belong to:

1. Go to **Import Data** page
2. **Select Account**: Choose an existing account from the dropdown
3. **Or Create New**: Type a name and click "Create" to add a new account
4. **Upload CSV**: Once an account is selected, upload your bank export
5. Transactions are automatically assigned to the selected account

#### Account-Filtered Views

All views respect the selected account:

- **Transactions**: Only shows transactions for the selected account
- **Analytics**: Charts and stats filtered by account
- **Subscriptions**: Filter by account (coming soon)
- **Calendar**: Shows bills for selected account (coming soon)

#### Transfer Detection

WealthPilot can detect transfers between your accounts:

- **Auto-Detection**: Matches opposite amounts on same/nearby dates
- **Link Transfers**: Mark two transactions as a transfer pair
- **Category Update**: Linked transfers are categorized as "Transfer > Internal Transfer"
- **Exclude from Budgets**: Transfers don't count toward spending

#### Account Types

- 🏦 **Checking** - Current/checking accounts
- 💰 **Savings** - Savings accounts
- 💳 **Credit** - Credit cards
- 📈 **Investment** - Brokerage accounts
- 💵 **Cash** - Cash tracking

---

## 🔧 v0.4.0 - Subscriptions & Recurring Features

### Recurring Transaction Management

WealthPilot v0.4.0 introduces comprehensive subscription and recurring transaction management:

#### Features

- **Auto-Detection**: Automatically detects recurring transactions from your imported bank data
- **Type Categories**:
  - 📺 **Subscriptions** - Netflix, Spotify, gym memberships
  - 🧾 **Bills** - Rent, utilities, insurance
  - 🏦 **Loans** - Mortgages, car loans with progress tracking
  - 💵 **Income** - Salary, dividends, rental income
- **Payment History**: View all linked transactions for each recurring item
- **Merge & Link**: Combine duplicate subscriptions or link transactions to existing items

---

## 📚 Specs & Docs

- Roadmap: [ROADMAP.md](./ROADMAP.md)
- Architecture overview: [specs/architecture/overview.md](./specs/architecture/overview.md)
- UI Revamp (bank-grade): [specs/ui-revamp/README.md](./specs/ui-revamp/README.md)
- Feature specs index: [specs/features](./specs/features)
- Import specs: [specs/import](./specs/import)

#### Sync & Repair Tool

If your subscriptions show "0 payments" or transactions aren't linked properly:

1. Go to **Subscriptions** page
2. Click **"Sync & Repair"** button in the header
3. This will:
   - Scan all your transactions
   - Match them to existing recurring items by merchant name and amount
   - Build the payment history for each subscription
   - Update averages and next expected dates

#### Creating from Transactions

1. Go to **Transactions** page
2. Click the `...` menu on any transaction
3. Select **"Create Recurring"**
4. Choose to:
   - **Create New**: Set the type (subscription, bill, loan, income)
   - **Link to Existing**: Add this transaction to an existing recurring item

#### Merging Subscriptions

If you have duplicate subscriptions:

1. Click the `...` menu on a subscription card
2. Select **"Merge with Another"**
3. Choose the target subscription
4. All payment history will be combined

#### Changing Subscription Type

To change a subscription's type (e.g., subscription → income):

1. Click the `...` menu on a subscription card
2. Hover over **"Change Type"**
3. Select the new type (Subscription, Bill, Loan, or Income)
4. The item will automatically:
   - Move to the appropriate tab
   - Update its amount sign (positive for income, negative for expenses)
   - Update its category

#### Bill Calendar (Dynamic Updates)

The Bill Calendar now uses **live queries** and automatically updates when you:

- Add, edit, or delete subscriptions
- Exclude items from recurring
- Change subscription types
- Import new transactions

No manual refresh needed - changes appear instantly on the calendar.

---

## 📊 Data Import

### Supported Formats

**Format A: Bank Export (Société Générale)**

```csv
Date de l'opération;Libellé;Détail de l'écriture;Montant de l'opération;Devise
```

**Format B: Historical (LLM-generated)**

```csv
date,value_date,direction,amount,balance_after,category,...
```

### Smart Categorization

WealthPilot automatically categorizes transactions using 50+ merchant patterns:

- **Groceries**: Carrefour, Auchan, Lidl, Leclerc...
- **Transport**: SNCF, RATP, Uber, Bolt...
- **Utilities**: EDF, Engie, Free, Orange...
- **Entertainment**: Netflix, Spotify, Steam...
- And many more...

---

## 🔒 Privacy

WealthPilot is designed with privacy as a core principle:

- **Local Storage**: All data stored in browser's IndexedDB
- **No Backend**: No server communication for user data
- **No Accounts**: No registration or login required
- **Your Data**: Export anytime, delete anytime

---

## 📖 Documentation

Detailed specifications are available in the [specs](./specs/) folder:

- [ROADMAP.md](./ROADMAP.md) - Version planning and milestones
- [architecture/](./specs/architecture/) - System architecture decisions
- [features/](./specs/features/) - Feature specifications
- [import/](./specs/import/) - Data import specifications
- [ui-revamp/](./specs/ui-revamp/) - Bank-grade UI/UX revamp specs (v0.15–v0.17)

---

## 🤝 Contributing

Contributions are welcome! Please read the specs for the feature you want to work on before starting.

1. Check [ROADMAP.md](./ROADMAP.md) for version assignment
2. Read the relevant spec file
3. Create a branch: `feature/v0.X.0-feature-name`
4. Make your changes
5. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful components
- [Recharts](https://recharts.org/) for the charting library
- [Dexie.js](https://dexie.org/) for the IndexedDB wrapper

---

<p align="center">
  Made with ❤️ for better personal finance management
</p>
