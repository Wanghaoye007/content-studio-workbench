# PIAS Result Decision And Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有节点画布中补齐收藏、采用、主结果、四图对比、结果详情和合规导出，并将关键动作接入审核、用量与审计反馈。

**Architecture:** 业务约束集中在 `domain.ts`，画布通过现有 `CanvasNodeActions` 投射命令；新增独立的结果检查器、对比台和导出对话框，避免继续扩大 `Workbench.tsx` 的展示职责。对比选择和面板开关属于临时 UI 状态，收藏、采用、主结果、质量反馈与导出审计属于 `StudioState`。

**Tech Stack:** React 19、TypeScript、React Flow、Lucide、Vitest、Testing Library、Vite。

## Global Constraints

- 全部用户可见文本使用简体中文，不暴露内部 ID、供应商密钥、内部 Prompt 或路由规则。
- 单个 Scene 可有多个采用结果，但最多一个主结果。
- 对比台最多四张；生产导出只允许已批准结果。
- 不引入新依赖，不实现虚假的服务端 ZIP、签名 URL 或图片转码。
- 使用现有 8px 以内圆角、图标按钮和工作台密度；移动端不提供完整画布对比编辑。

---

### Task 1: Result decision domain

**Files:**
- Modify: `src/domain.ts`
- Test: `tests/domain.test.ts`

**Interfaces:**
- Produces: `QualityIssue`, `ExportSpec`, `toggleResultFavorite`, `toggleResultAdoption`, `setPrimaryResult`, `setResultQualityIssue`, `recordResultExport`, `buildExportFilename`, `buildResultManifest`.
- Consumes: existing `StudioState`, `Result`, `AuditEvent`, `completeJob` result creation.

- [ ] **Step 1: Write failing tests for result decision invariants**

Test first adoption becoming primary, multiple adoption with unique primary, main-result reassignment after unadopt, favorite toggle, quality issue recording, approved-only production export, deterministic filename sanitation and manifest fields.

- [ ] **Step 2: Run the focused domain tests and confirm failure**

Run: `npm test -- --run tests/domain.test.ts`

Expected: FAIL because the new exports and fields do not exist.

- [ ] **Step 3: Implement the domain state and pure helpers**

Add default result metadata in `completeJob`; keep all mutation immutable; write audit types `result.favorited`, `result.unfavorited`, `result.adopted`, `result.unadopted`, `result.primary_set`, `result.quality_flagged`, and `result.exported`.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/domain.test.ts`

Expected: all domain tests PASS.

### Task 2: Result node actions and graph projection

**Files:**
- Modify: `src/workbench/graph.ts`
- Modify: `src/workbench/CanvasNodes.tsx`
- Modify: `src/styles.css`
- Test: `tests/workbench.test.tsx`

**Interfaces:**
- Consumes: decision fields from Task 1.
- Produces: node callbacks `onToggleFavorite`, `onToggleAdoption`, `onSetPrimary`, `onToggleCompare`, `onOpenDetails`; selected compare state visual.

- [ ] **Step 1: Write failing node and graph tests**

Assert accessible icon actions, adopted/favorite/primary state markers, compare selection, and callback payloads.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -- --run tests/workbench.test.tsx`

Expected: FAIL because result action interfaces are absent.

- [ ] **Step 3: Extend graph data and result node UI**

Keep node dimensions stable; use Lucide icons and tooltips; move download out of the compact node while preserving review and derive commands.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/workbench.test.tsx`

Expected: result-node tests PASS.

### Task 3: Result inspector, compare tray, and export dialog

**Files:**
- Create: `src/workbench/ResultInspector.tsx`
- Create: `src/workbench/ResultCompare.tsx`
- Create: `src/workbench/ExportDialog.tsx`
- Modify: `src/workbench/Workbench.tsx`
- Modify: `src/workbench/CanvasNodes.tsx`
- Modify: `src/workbench/graph.ts`
- Modify: `src/styles.css`
- Test: `tests/workbench.test.tsx`

**Interfaces:**
- `ResultInspector` consumes selected `Result`, source `Scene`, source `GenerationJob`, and callbacks for decisions, feedback, review, preview download, and production export.
- `ResultCompare` consumes 1-4 results and callbacks for remove/close/open details.
- `ExportDialog` consumes result/export metadata and emits one validated `ExportSpec`.

- [ ] **Step 1: Write failing interaction tests**

Cover selecting two results, opening comparison, changing shared zoom, removing a result, opening details, setting quality issue, blocking production export before approval, and submitting an approved export.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -- --run tests/workbench.test.tsx`

Expected: FAIL because the panels do not exist.

- [ ] **Step 3: Build focused components and wire Workbench state**

Use local `compareResultIds`, `inspectedResultId`, `compareOpen`, and `exportResultId`. Domain callbacks update `StudioState`; transient compare state never enters the domain.

- [ ] **Step 4: Implement accessible close and responsive behavior**

Escape closes the topmost panel; trigger focus is restored; tablet panels overlay rather than resize the canvas; mobile compare controls are hidden.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- --run tests/workbench.test.tsx`

Expected: all workbench tests PASS.

### Task 4: Audit, usage, and review continuity

**Files:**
- Modify: `src/SecondaryViews.tsx`
- Modify: `src/workbench/Workbench.tsx`
- Modify: `src/styles.css`
- Test: `tests/app.test.tsx`

**Interfaces:**
- Consumes: `result.exported` and result decision audit events.
- Produces: localized dashboard labels and a dynamic export count on Usage.

- [ ] **Step 1: Write failing app-flow tests**

Approve a pending result, return to the workbench, configure production export, then verify dashboard audit copy and usage export count. Verify an unapproved result exposes only preview download.

- [ ] **Step 2: Run app tests and confirm failure**

Run: `npm test -- --run tests/app.test.tsx`

Expected: FAIL because export events are not projected.

- [ ] **Step 3: Implement localized projections and dynamic metrics**

Add audit labels for every result action and compute export count from `result.exported` events.

- [ ] **Step 4: Run app tests**

Run: `npm test -- --run tests/app.test.tsx`

Expected: all app tests PASS.

### Task 5: Verification and visual QA

**Files:**
- Modify only files required by discovered defects.

**Interfaces:**
- Produces: passing full suite, production build, and screenshots for result decision, comparison, export, tablet, and mobile.

- [ ] **Step 1: Run complete automated verification**

Run: `npm test && npm run build`

Expected: all tests PASS and Vite build exits 0.

- [ ] **Step 2: Exercise the real browser flow**

Open `http://127.0.0.1:5173/`; adopt and favorite a result, select two results, open comparison, inspect details, approve a result from Reviews, return to Studio, and submit production export.

- [ ] **Step 3: Capture and compare responsive screenshots**

Capture desktop 1440x900, tablet 1024x768, and mobile 390x844. Check panel clipping, node size stability, text fit, focus order, image visibility, and overlap.

- [ ] **Step 4: Review the complete diff and fix defects**

Run: `git diff --check && git diff --stat && git status --short`

Expected: no whitespace errors; only scoped tracked files plus pre-existing user-owned untracked directories.

- [ ] **Step 5: Commit the completed batch**

Stage only the new spec, plan, source, and tests. Do not stage `analysis/`, `figma_thesea_slides_15_21/`, or `thesea_videos/`.

