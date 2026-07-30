# SDD ledger — plan: docs/superpowers/plans/2026-07-30-non-medical-life-steward-local-ai.md

Baseline: commit 669f596; 25 test files / 66 tests pass.
Baseline audit: 25 high, 10 moderate, 1 low vulnerabilities; Task 9 owns remediation or documented reachability review.
Task 1: fix round 1/5 (4 addressed, 0 open; commits 0b2da4f..118d7e3)
Task 1: minor (deferred): individual English regressions for allergy, condition, rehabilitation, and health terms can be expanded in final policy review.
Task 1: complete (commits 398b290..118d7e3, review clean)
Task 2: fix round 1/5 (4 addressed, 4 open/new — empty-workspace lifecycle, notification rollback, existing-data preservation, DB handle close; commits cf4a82f..cf3cf7c)
Task 2: fix round 2/5 (4 addressed, 0 open; commits cf3cf7c..baa82bd)
Task 2: minor (deferred): if post-schedule getAllScheduledNotificationsAsync throws, scheduled IDs may need an explicit rollback path; final review must triage.
Task 2: minor (deferred): setup-close regression covers first exec failure but not each table/marker setup stage.
Task 2: complete (commits 118d7e3..baa82bd, review clean)
Task 3: fix round 1/5 (0 addressed, 6 open; PWA shell/policy accuracy, storage availability, invalid-data preservation, multi-tab conflict, delete confirmation, failure-path tests; commit e8a9a86)
Task 3: minor (fix requested): button contrast and unsaved-change warning.
Task 3: fix round 1 result (6 addressed, 3 open/new; localStorage getter SecurityError, non-atomic cross-tab mutation, prior v1 raw workspace compatibility; commit ddc34d0)
Task 3: fix round 2 result (2 addressed, 1 open/new; IndexedDB transaction and raw-v1 migration clean, React async load/sync/save may overwrite newer edits; commit 24ddf07)
Task 3: fix round 3/5 (1 addressed, 0 open; async edit epochs, operation exclusion, deletion tombstone; commit e8d0137)
Task 3: complete (commits baa82bd..e8d0137, review clean)
Task 4: fix round 1/5 (0 addressed, 1 open; unrelated lockfile resolved/integrity metadata stripped; commit 0ba3fc86)
Task 4: fix round 1 result (1 addressed, 0 open; unrelated lock metadata fully restored; commit e98f031b)
Task 4: complete (commits e8d0137..e98f031b, review clean)
Task 5: fix round 1/5 (0 addressed, 2 open; Expo offline license asset bundling and strict repo/revision/file supply-chain binding; commit 378178e)
Task 5: minor (fix requested): exact license whitespace, sibling wording, pinned reproduction commands.
Task 5: fix round 1 result (3 addressed, 2 Important plus 1 Minor open/new; URL control-character bypass, offline URI fail-open, report sibling wording; commit b8fb32a)
Task 5: fix round 2/5 (3 addressed, 0 open; URL normalization and offline asset fail-closed; commit d0399fe)
Task 5: complete (commits e98f031b..d0399fe, review clean)
Task 6: fix round 1/5 (0 addressed, 6 Important open; install lifecycle cleanup/callback isolation, resume identity and writer synchronization, operation serialization, models-root confinement, crash-safe replacement, accurate full-data deletion; commit 51be6b7)
Task 6: minor (fix requested): normalize unknown progress totals and expose typed primary/cleanup failure causes.
Task 6: fix round 1 result (5 Important plus 1 Minor addressed, 2 Important open; cleanup queue can block later cancellation, backup unlink followed by directory fsync failure can lose old and new completed artifacts; commits 4405063..b3ace5a)
Task 6: fix round 1 result (6 Important and 1 Minor addressed, 0 known open; typed lifecycle and callback isolation, identity-bound terminal resume, serialized control queue, native models-root confinement, backup/fsync/post-verify replacement, production full-delete integration; commit 4405063)
Task 6: fix round 2 result (2 remaining Important addressed, 0 known open; active cleanup rejects immediately without blocking cancel/remove-all, native backup unlink is an explicit commit point that preserves verified new on final fsync failure; commit 6bf7bed)
