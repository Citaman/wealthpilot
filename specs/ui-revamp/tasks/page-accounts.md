# UI Revamp Page — Accounts

**Version**: v0.16.0

## Why
Accounts builds trust. Users must understand balances and how they’re calculated.

## Goals
- Clear list of accounts with health indicators.
- Balance checkpoints are understandable.
- Transfers between accounts feel correct and visible.

## UX Improvements
- Accounts overview:
  - balance, last import date, transaction count
  - warnings (no transactions in X days)
- Account detail:
  - balance timeline
  - checkpoints management
  - recalc actions with clear messaging
- Transfer visibility:
  - “Transfers in/out” quick filters

## Acceptance Criteria
- Users can explain why a balance is what it is.
- Checkpoints can be added/edited safely.
- Recalculate is safe and doesn’t feel scary.
