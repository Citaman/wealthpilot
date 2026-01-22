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

## 2. Encrypted Backups (AES-GCM)
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

## 3. Privacy Audit & Cleanup
**Why:** Ensure professional standards.
- **Console Logs:** Remove all `console.log` of sensitive data (transactions, account details).
- **Error Reporting:** Ensure no PII is leaking in error boundaries (if we had remote logging, which we don't yet, but good practice).
- **Metadata:** Ensure exported files don't contain unnecessary system paths or identifiers.

## UX References
- **Privacy Toggle:** Subtle but accessible in the header.

## Technical Architecture

### Contexts
- `PrivacyContext`: Manages `isPrivacyEnabled`.

### Components
- `SensitiveValue`: Component `<SensitiveValue value={100} />` that handles formatting and blurring.

### Libraries
- `Web Crypto API` (Native, no heavy deps).
