# Studio State Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the complete PIAS `StudioState` on the local server so refreshes and single-process restarts restore confirmed business state.

**Architecture:** A schema module validates runtime state, a revisioned atomic file store owns persistence, and a Vite middleware exposes a stable GET/PUT API. A browser client and React hook load before rendering, debounce writes, and surface real loading/saving/saved/error/conflict states to the workbench.

**Tech Stack:** TypeScript 5.8, React 19, Vite Connect middleware, Node `fs/promises`, Vitest, Testing Library.

## Global Constraints

- Default file path is `/tmp/pias-image-studio/studio-state.json`, overridable with `PIAS_STUDIO_STATE_FILE`.
- Persisted schema version is exactly `1`; file mode is `0600`; writes use temporary file plus atomic rename.
- PUT bodies are limited to `5 MiB` and require a non-negative integer `expectedRevision`.
- The client does not render or auto-save the demo state before the initial GET resolves.
- Only a confirmed successful PUT may produce the text `已自动保存`.
- A `409` conflict stops automatic writes and requires an explicit reload; no automatic merge is permitted.
- This phase does not implement authentication, RBAC, tenant isolation, multi-instance storage, backup, or disaster recovery.

---

### Task 1: Runtime StudioState schema

**Files:**
- Create: `src/studio/studioStateSchema.ts`
- Test: `tests/studioStateSchema.test.ts`

**Interfaces:**
- Consumes: `StudioState`, `JobStatus`, `ReviewStatus`, and `TaskProfileId` from `src/domain.ts`.
- Produces: `parseStudioState(value: unknown): StudioState` and `StudioStateValidationError`.

- [ ] **Step 1: Write failing schema tests**

Cover a valid `initialStudioState()`, missing array fields, invalid job/review enums, negative/non-finite usage values, and malformed nested records.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/studioStateSchema.test.ts`

Expected: FAIL because `src/studio/studioStateSchema.ts` does not exist.

- [ ] **Step 3: Implement the minimal structural parser**

Use explicit object, string, finite-number, array, enum, and optional-field guards. Return the validated object as `StudioState`; throw `StudioStateValidationError` with a safe field path on failure.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/studioStateSchema.test.ts`

Expected: the schema test file passes.

### Task 2: Revisioned atomic file store

**Files:**
- Create: `src/studio/studioStatePersistence.ts`
- Test: `tests/studioStatePersistence.test.ts`

**Interfaces:**
- Consumes: `parseStudioState(value)` from Task 1.
- Produces:

```ts
type PersistedStudioSnapshot = {
  schemaVersion: 1;
  revision: number;
  updatedAt: string;
  state: StudioState;
};

type StudioStatePersistence = {
  load(): Promise<PersistedStudioSnapshot | null>;
  save(expectedRevision: number, state: StudioState): Promise<PersistedStudioSnapshot>;
};

createFileStudioStatePersistence(filePath?: string): StudioStatePersistence;
StudioStateConflictError;
StudioStateStorageError;
```

- [ ] **Step 1: Write failing store tests**

Use a temporary directory. Verify missing file returns `null`, first save creates revision `1`, a fresh store instance reloads identical state, a second save increments revision, stale revision throws `StudioStateConflictError`, and only the final JSON file remains after save.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/studioStatePersistence.test.ts`

Expected: FAIL because the store module does not exist.

- [ ] **Step 3: Implement atomic persistence and serialization queue**

Each save operation must execute inside one Promise chain: load current snapshot, compare revision, validate state, write a process-specific temporary file with mode `0600`, rename it, and return the new snapshot. Wrap corrupt-file and filesystem failures in `StudioStateStorageError` without deleting or overwriting the source file.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/studioStatePersistence.test.ts`

Expected: all store tests pass.

### Task 3: Vite state API middleware

**Files:**
- Create: `src/studio/studioStatePlugin.ts`
- Modify: `vite.config.ts`
- Test: `tests/studioStatePlugin.test.ts`

**Interfaces:**
- Consumes: `StudioStatePersistence` and its typed errors from Task 2.
- Produces: `createStudioStateMiddleware(persistence)` and `studioStatePlugin()`.

- [ ] **Step 1: Write failing middleware tests**

Use `EventEmitter` requests and an in-memory fake persistence. Verify:

```text
GET missing       -> 404 STUDIO_STATE_NOT_FOUND
GET existing      -> 200 snapshot
PUT valid         -> 200 snapshot metadata
PUT invalid JSON  -> 400 STUDIO_STATE_INVALID_JSON
PUT invalid state -> 400 STUDIO_STATE_INVALID
PUT stale version -> 409 STUDIO_STATE_CONFLICT
PUT over 5 MiB    -> 413 STUDIO_STATE_BODY_TOO_LARGE
other routes      -> next()
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/studioStatePlugin.test.ts`

Expected: FAIL because the middleware module does not exist.

- [ ] **Step 3: Implement middleware and register it**

Mount the middleware in both `configureServer` and `configurePreviewServer`. Register it before the Fal plugin or as a separate plugin; it must only consume `/api/studio/state`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/studioStatePlugin.test.ts`

Expected: all API tests pass.

### Task 4: Typed browser client

**Files:**
- Create: `src/studio/studioStateClient.ts`
- Test: `tests/studioStateClient.test.ts`

**Interfaces:**
- Produces:

```ts
loadStudioState(): Promise<PersistedStudioSnapshot | null>;
saveStudioState(expectedRevision: number, state: StudioState): Promise<PersistedStudioSnapshotMeta>;
StudioStateClientError { code: string; status: number; }
```

- [ ] **Step 1: Write failing client tests**

Stub `fetch` and verify GET parsing, 404 to `null`, PUT body shape, 409 typed error, non-JSON failure response, and malformed success payload rejection.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/studioStateClient.test.ts`

Expected: FAIL because the client module does not exist.

- [ ] **Step 3: Implement typed fetch client**

Validate response metadata before returning it. Normalize all failures to safe Chinese messages and never expose response stack or HTML.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/studioStateClient.test.ts`

Expected: all client tests pass.

### Task 5: React load and autosave state machine

**Files:**
- Create: `src/studio/demoState.ts`
- Create: `src/studio/usePersistentStudioState.ts`
- Modify: `src/App.tsx`
- Modify: `src/workbench/Workbench.tsx`
- Modify: `src/styles.css`
- Test: `tests/app.test.tsx`

**Interfaces:**
- Consumes: Task 4 load/save functions and `createDemoStudioState()` from `src/studio/demoState.ts`.
- Produces:

```ts
type StudioSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

type PersistentStudioState = {
  state: StudioState | null;
  setState: Dispatch<SetStateAction<StudioState>>;
  loadStatus: 'loading' | 'ready' | 'error';
  saveStatus: StudioSaveStatus;
  errorMessage: string;
  retryLoad(): void;
  retrySave(): void;
};
```

- [ ] **Step 1: Update App tests before production code**

Mock `studioStateClient`. Add tests proving:

- loading UI appears before GET resolves and workbench is absent;
- a saved snapshot is rendered instead of demo state;
- 404 uses demo state and creates the first revision;
- mutation shows `正在保存`, then `已自动保存` only after PUT resolves;
- failed PUT shows `保存失败` and retry works;
- 409 shows `存在更新冲突` and does not auto-retry;
- failed initial GET shows recovery error and retry button.

Update existing App tests to resolve the load mock before interacting.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/app.test.tsx`

Expected: new persistence tests fail because App still renders seeded state synchronously.

- [ ] **Step 3: Implement the hook and App loading/error shells**

Use a `400 ms` timer, revision ref, last-confirmed-state ref, one in-flight write, and one latest queued snapshot. Do not start a save for the state received from GET. On 404, mark the demo state as needing initial save. On conflict, clear the save timer and stop writes until reload.

- [ ] **Step 4: Replace hard-coded status text**

Pass `saveStatus` and `onRetrySave` into `Workbench`. Render exactly one of `正在保存`, `已自动保存`, `保存失败`, or `存在更新冲突`, with a retry button for ordinary save errors. Preserve stable layout dimensions.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- tests/app.test.tsx`

Expected: App and persistence state-machine tests pass.

### Task 6: Full verification and acceptance evidence

**Files:**
- Modify: `acceptance/manifest.json`
- Modify: `docs/acceptance/PIAS验收自查报告_2026-07-21.md`
- Add: `docs/acceptance/evidence/pias-persistence-2026-07-21.png`

**Interfaces:**
- Consumes: all completed tasks.
- Produces: updated evidence that closes the refresh-loss symptom while retaining the production database risk.

- [ ] **Step 1: Run focused and full automated verification**

Run:

```bash
npm test
npm run build
npm run acceptance:report
git diff --check
```

Expected: tests and build pass. Acceptance remains red only because remaining P0 requirements still exist.

- [ ] **Step 2: Browser refresh verification**

Approve `生成 1`, wait until the UI says `已自动保存`, reload, and verify it remains approved with `0 项待审核`.

- [ ] **Step 3: Single-process restart verification**

Restart the Vite service, reload the page, and verify the same approved result and usage values remain.

- [ ] **Step 4: Update acceptance evidence**

Set `DATA-001` to `partial/P1` with evidence from the API, file store tests, browser refresh, and restart. Keep `AUTH-001` and `ISOLATION-001` unchanged at P0. Update report counts and wording without claiming production readiness.

- [ ] **Step 5: Commit implementation**

```bash
git add src/studio src/App.tsx src/workbench/Workbench.tsx src/styles.css vite.config.ts tests acceptance/manifest.json docs/acceptance
git commit -m "fix: persist studio state across reloads"
```
