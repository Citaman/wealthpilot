# UI Revamp Task — Mobile / PWA / Accessibility

**Version**: v0.17.0

## Why
Finance apps are used on phones. Accessibility is a trust signal.

## Goals
- Mobile navigation and layouts feel intentional.
- Installable PWA.
- Accessibility baseline met.

## Requirements

### Mobile
- Responsive shell: sidebar drawer + header actions
- Touch targets: ≥44px
- Tables: horizontal scroll or responsive stacking

### PWA
- Manifest + icons
- Offline policy documented (cache strategy)

### Accessibility
- Keyboard navigation for all flows
- Visible focus states
- AA color contrast
- Reduced motion support

## Acceptance Criteria
- QA at 390px/768px/1024px/1440px.
- Lighthouse a11y score target: 90+ (informational; verify manually too).
- PWA install works.
