# Security & Privacy Experience (v0.14.0)

**Goal:** Transform WealthPilot into a secure, private-by-default application that users trust with their sensitive financial data. This update adds "Bank-Grade" privacy features suitable for use in public spaces and shared devices.

## 1. Privacy Mode (Blur Sensitive Data)
**Why:** Users often check finances in public (cafes, trains) or show the app to others without wanting to reveal their total net worth.

**Feature:**
- **Global Toggle:** An "Eye" icon in the top navigation bar (and keyboard shortcut `Shift + P`).
- **Effect:** When enabled, all currency values (balances, transaction amounts, budget totals) are blurred or replaced with `••••••`.
- **Persistence:** State persists across page navigations but defaults to "Hidden" or "Visible" based on user preference setting.
- **Implementation:**
  - Create a `PrivacyContext` providing `isPrivacyMode` and `togglePrivacyMode`.
  - Create a `<PrivacyBlur>` component or a utility class `privacy-blur` that conditionally applies a CSS filter.
  - Wrap all sensitive numbers in the app with this component/class.

## 2. App Lock (PIN Protection)
**Why:** As a PWA/Local-first app, anyone with access to the unlocked device can open the browser and see everything. An app-level PIN adds a crucial layer of defense against casual snooping.

**Feature:**
- **Setup:** User sets a 4-6 digit PIN.
- **Lock Screen:** A dedicated, clean overlay that blocks the entire UI until the correct PIN is entered.
- **Triggers:**
  - **App Launch:** If PIN is enabled.
  - **Inactivity:** Auto-lock after X minutes (configurable: 1m, 5m, 15m, 30m, Never).
  - **Background:** Option to lock immediately when the app goes to the background (blur event).
- **Security:**
  - PIN stored as a salted hash (SHA-256) in `localStorage` (sufficient for client-side privacy).
  - *Not* a replacement for device encryption, but a deterrent for "borrowed phone" scenarios.
- **Recovery:** Since data is local, "Forgot PIN" means "Clear Data & Reset". This is a security feature, not a bug. It prevents unauthorized access.

## 3. Encrypted Backups (AES-GCM)
**Why:** Current backups are plain JSON. If a user stores them in Google Drive/Dropbox, they are readable by the cloud provider or anyone with access.

**Feature:**
- **Encryption:** Use Web Crypto API (AES-GCM).
- **Key Derivation:** PBKDF2 to derive a strong key from a user-provided passphrase.
- **Format:** Wrap the existing JSON dump in an encrypted envelope.
  ```json
  {
    "v": 1,
    "algo": "AES-GCM",
    "iv": "base64...",
    "salt": "base64...",
    "data": "encrypted-base64-blob..."
  }
  ```
- **UX:**
  - Export: Toggle "Encrypt Backup" -> Prompt for Passphrase -> Generate `.enc` file.
  - Import: Detect `.enc` file -> Prompt for Passphrase -> Decrypt -> Validate -> Restore.

## 4. Privacy Audit & Cleanup
**Why:** Ensure professional standards.
- **Console Logs:** Remove all `console.log` of sensitive data (transactions, account details).
- **Error Reporting:** Ensure no PII is leaking in error boundaries (if we had remote logging, which we don't yet, but good practice).
- **Metadata:** Ensure exported files don't contain unnecessary system paths or identifiers.

## UX References
- **Lock Screen:** Clean, numeric keypad, biometric icon (future proofing), minimalist logo. Matches "Dashboard" aesthetic (clean, modern).
- **Privacy Toggle:** Subtle but accessible in the header.

## Technical Architecture

### Contexts
- `SecurityContext`: Manages `isLocked`, `unlock(pin)`, `setPin(pin)`, `lock()`.
- `PrivacyContext`: Manages `isPrivacyEnabled`.

### Components
- `AppLockOverlay`: Rendered at the root `layout.tsx`, conditionally shown if `isLocked`.
- `SensitiveValue`: Component `<SensitiveValue value={100} />` that handles formatting and blurring.

### Libraries
- `Web Crypto API` (Native, no heavy deps).
