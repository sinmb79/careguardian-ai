# Task 10 smoke addendum: mobile workspace entry

## Context

The signed Android release APK proved that the local Naver 0.5B model can be
downloaded, SHA-256 verified, and loaded. The smoke test then found a
load-bearing product gap: `LocalAiScreen` accepts only canonical tasks, lists,
or records, but the mobile workspace UI only renders tasks/lists and cannot
create any. A fresh install therefore cannot run its first local-AI request
through the UI.

## Scope

Implement the smallest complete mobile workflow that lets a new user create
and persist at least:

1. an open life task from the `오늘` section; and
2. a personal list from the `목록` section.

The existing parent save button remains the explicit persistence action. Do
not add cloud sync, accounts, analytics, medical/health concepts, model
changes, or new dependencies.

## Required behavior

- Each form has a clearly labelled React Native `TextInput`, an accessible
  add button, and a short inline validation/error message.
- Leading/trailing whitespace is removed before storing.
- Empty or whitespace-only input cannot create an item.
- Titles longer than the `life-core` maximum of 500 Unicode code units cannot
  create an item, and the user receives a clear error.
- A successful task has `{ status: "open" }`.
- A successful list has `{ recordIds: [] }`.
- Generated IDs:
  - satisfy `life-core`'s identifier contract;
  - have the corresponding `task-` or `list-` prefix;
  - do not collide with any existing workspace ID of the same collection;
  - are injectable/deterministic in tests rather than depending on real time
    or randomness there.
- Every successful mutation updates `workspace.updatedAt` to an injected ISO
  timestamp.
- The produced workspace passes `validateWorkspace`.
- A successful add clears its input and error state.
- The rendered new item is immediately visible before save.
- Existing extension-builder, delete, save, warning, and navigation behavior
  must remain intact.
- `listAssistantSources(updatedWorkspace)` must expose both a newly added task
  and a newly added list as canonical sources.
- Keep the mobile release non-medical and local-only.

## TDD and verification

Write the failing tests first and record the red result in the report. Prefer
a small pure helper for workspace mutations so edge cases can be tested
without brittle React Native snapshots. Tests must cover:

- task success;
- list success;
- trim;
- empty rejection;
- over-500 rejection;
- collision-free injected ID fallback;
- deterministic updated timestamp;
- `validateWorkspace` success;
- assistant-source visibility;
- source immutability/no mutation of the input workspace.

Then implement the UI wiring. Run at minimum:

```powershell
npx vitest run apps/mobile/src/ui apps/mobile/src/local-ai/assistantSources.test.ts
npm run mobile:typecheck
```

Run `git diff --check` and inspect the final diff. Commit the implementation,
tests, this brief, and the report in one or more focused commits.

## Report

Write the full report to:

`.superpowers/sdd/2026-07-30-non-medical-life-steward-local-ai/task-10-workspace-entry-report.md`

Include:

- status: `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`;
- red test command and observed failure;
- green test commands and exact results;
- files changed;
- self-review;
- concerns, if any;
- commit SHA(s).
