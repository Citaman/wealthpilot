# UI Revamp Task — Micro-Interactions & Motion

**Version**: v0.17.0

## Why
Subtle motion makes the app feel premium *when it improves clarity*.

## Goals
- Add motion only where it improves comprehension or perceived performance.
- Respect reduced-motion settings.

## Motion Rules
- No decorative looping animations.
- Use motion for:
  - opening/closing drawers
  - table row insertion/removal feedback
  - loading skeleton transitions
  - KPI change emphasis

## Components
- Toasts: consistent entry/exit
- Dialogs/drawers: easing and duration standardized
- Charts: minimal (fade in), not distracting

## Acceptance Criteria
- Motion never blocks interaction.
- Reduced motion disables non-essential animations.
- Animations are consistent across the app.
