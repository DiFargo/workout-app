# AGENTS.md

## Project Overview

Mobile-first fitness application built with React + Firebase.

The application contains:

- Workouts
- Nutrition
- Measurements
- Trainer Dashboard
- Admin Panel
- Telegram Integration
- Workout History
- Nutrition History

The project is actively developed and must be treated as a production application.

## Critical Development Rules

### Work only from the latest stable base

Always use the latest provided files as the source of truth.

Never restore old code versions.

Never revert features without explicit approval.

### Make minimal changes

Do not rewrite large parts of App.jsx.

Do not refactor unrelated code.

Apply the smallest possible diff.

Preserve existing architecture.

### Preserve existing functionality

Never break:

- Firebase
- Authentication
- Trainer Dashboard
- Admin Panel
- Telegram Integration
- Workout History
- Nutrition History
- Measurements
- Navigation
- Bottom Navigation Bars
- User Roles

### GPT-6 Astra execution mode

This working agreement follows the [official GPT-6 Astra guidance](https://developers.openai.com/api/docs/guides/latest-model) and should be reviewed when that guidance changes.

- Infer ordinary implementation details from the task, prior conversation and repository context; act on a clear request instead of stopping at a plan or a capability answer.
- Before asking a clarification question, finish all safe, authorized investigation and prepare a concrete option. Ask only when the answer can materially change the result or requires new authority.
- Within project guidance, an explicit user request controls the requested outcome and scope. System, security and permission constraints still apply.
- Treat `AGENTS.md`, `.codex-instructions`, selected skills and product documents as active instructions. When they conflict or would pause work, name the exact source and rule that caused it.
- Use `index.md` and `project_map.md` to narrow context before opening large files. Inspect the target component, its colocated styles, imports and relevant tests rather than loading broad unrelated modules.
- Keep one acceptance checklist for the requested outcome and verify it against the actual changed surface before declaring completion.
- Delegate only independent, bounded work that does not edit the same files. The primary agent owns integration, final verification and any change to a shared surface.

### Required verification before completion

Choose the smallest meaningful verification that covers the risk. Do not add tests that only restate a reversible implementation detail.

- Documentation-only changes: validate Markdown structure and links, review the diff, and do not change the runtime version.
- UI-only runtime changes: check JSX and CSS syntax, build, and verify the affected mobile surface at the relevant viewport or with the focused UI test.
- Isolated domain logic: run its focused test in addition to the build.
- Firebase, role/access, API, navigation or release changes: run the relevant focused tests and production smoke checks; never infer that a critical flow still works.
- Before every runtime completion: verify the requested behavior is present and that no protected functionality above was removed.

Once the appropriate checks pass, do not repeat broader checks unless a failure, a later change, or a remaining risk justifies them.

## UI Design System

### General Style

The calm, neutral iOS interface is the primary and current product design.

- Mobile first, fullscreen iOS-like UX.
- Main palette (approved «Свой ритм» mockup, based on calm-blue): canvas `#F2F2F7`, cards `#FFFFFF`, secondary surface `#EFEFF4`, borders `rgba(60,60,67,.12)`, text `#1C1C1E`, secondary text `#636366`, primary action `#3F73B8`, text/chart accent `#3C6FAA`, success `#237A42`.
- Current reference: `docs/client-five-main-screens-signature.html`. Keep its compact grouping; never replace real actions or data with mockup examples. Main page headers have no decorative rhythm mark, per the user's latest refinement; preserve functional header actions.
- Keep accents restrained. Use the primary accent only for the screen's main action or current state; use semantic colours only for a meaningful status.
- Do not restore the former bright-purple, heavy dark-card or saturated legacy colour systems.
- Every new page must visually match the current light iOS interface.

### Design Principles

- Compact layouts
- Minimal visual noise
- Consistent spacing
- Consistent border radius
- Consistent component heights
- One unified product appearance
- Use fixed, opaque iOS-style headers that account for the safe area.
- Keep bottom bars consistent in height, spacing, and element placement.
- Treat modals as separate, polished sheets with padding, rounded corners, a shadow, and a close button.

### Style Architecture

- Preserve the existing CSS Modules structure.
- Keep component styles colocated; do not move them into one global CSS file.
- Reuse established interface patterns instead of introducing legacy components or a parallel visual system.
- Do not change business logic, Firebase, authentication, roles, or navigation while making visual changes unless explicitly requested.

## Workout Module Rules

Must preserve:

- Fixed card sizes
- No card flickering
- Fullscreen workout flow
- Workout timer
- Firebase sync
- Exercise history
- Previous workout data

Requirements:

- Open next unfinished workout
- Bottom navigation buttons
- Exercise video as primary element

## Nutrition Module Rules

Style:

FatSecret + MyFitnessPal

Must preserve:

- Food search
- AI food search
- AI photo search
- Shared "My Database"
- Multi-ingredient dishes
- Automatic nutrition calculation
- Compact cards
- Small "+" buttons
- Fast search UX

## Measurements Module

Current implementation:

12 measurements:

- Weight
- Neck
- Shoulder Girth
- Chest
- Biceps
- Forearm
- Wrist
- Belly
- Pelvis
- Thigh
- Calf
- Ankle

Images stored in:

public/measurements/

Requirements:

- Do not change image paths unless requested.
- Measurements must always load from latest saved measurement.
- Preserve fullscreen measurement wizard.

## Trainer Dashboard Rules

Roles:

- Client
- Trainer
- Admin

Trainer can access:

- Trainer Dashboard
- Clients
- Workouts
- Nutrition
- History

Trainer must only see:

- Assigned clients
- Assigned client data
- Assigned client statistics

Never expose unrelated users.

## Admin Panel Rules

Admin functionality must never be broken.

## Images

Never generate images automatically.

Only generate images if explicitly requested with:

- "сгенерируй"
- "создай картинку"

## Versioning

Increment the application version for completed runtime releases. Documentation-only changes must not change the runtime version.
