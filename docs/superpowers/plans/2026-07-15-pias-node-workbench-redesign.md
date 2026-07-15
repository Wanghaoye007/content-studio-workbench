# PIAS Node Workbench Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 PIAS 图片 MVP 改造成全中文、深色无限画布、节点可自由拖拽的企业级图片生产工作台。

**Architecture:** 保留 React、TypeScript、React Flow 与现有领域状态，将 `App.tsx` 中的工作台拆成独立组件。领域层新增场景、任务、结果的画布坐标和统一移动操作；展示层通过图适配器生成 React Flow 节点与连线，并用悬浮工具栏、上下文参数面板和任务抽屉完成生产交互。

**Tech Stack:** React 19、TypeScript 5.8、Vite 7、`@xyflow/react` 12、Lucide React、Vitest、Testing Library。

## Global Constraints

- 所有用户可见界面使用简体中文，任务状态、错误、空状态、按钮、工具提示和表单标签不得残留英文。
- 画布背景使用 `#08090B`，主面板使用 `#15161A`，浮层使用 `#1C1D22`，品牌操作蓝使用 `#2F80FF`。
- 节点和面板圆角不超过 `8px`，字间距保持 `0`，工具界面字号使用 `12px` 至 `14px`。
- 桌面端提供完整画布编辑；小于 `768px` 时只提供项目预览、任务状态和审核操作。
- 不接入新的后端服务或大型前端框架，不复制竞品商标、名称、文案或专有素材。
- 现有用量预留与结算、审核状态机、下载门禁和版本血缘规则必须保留。

---

## File Map

- `src/domain.ts`：领域类型、演示数据、任务生命周期、画布位置更新、审核和用量规则。
- `src/workbench/graph.ts`：把领域状态转换为 React Flow 节点和连线。
- `src/workbench/CanvasNodes.tsx`：场景、任务、结果三类节点及图片覆盖交互。
- `src/workbench/SceneRail.tsx`：场景树、素材分组和素材定位。
- `src/workbench/ToolPalette.tsx`：八个中文图标工具入口。
- `src/workbench/ContextToolPanel.tsx`：所选工具的悬浮参数面板。
- `src/workbench/TaskTray.tsx`：可收起的任务队列。
- `src/workbench/Workbench.tsx`：画布、节点选择、拖拽写回、任务执行和浮层编排。
- `src/SecondaryViews.tsx`：首页、项目、素材库、审核、用量和企业管理页面。
- `src/App.tsx`：全局中文导航、应用状态和页面切换。
- `src/styles.css`：全局深色视觉、画布布局、节点样式和响应式规则。
- `tests/domain.test.ts`：领域规则与画布坐标测试。
- `tests/workbench.test.tsx`：图适配器、节点和工作台交互测试。
- `tests/app.test.tsx`：中文导航、任务、审核与下载门禁的端到端组件测试。

---

### Task 1: 画布领域模型与中文任务配置

**Files:**
- Modify: `src/domain.ts:1-390`
- Modify: `tests/domain.test.ts:1-122`

**Interfaces:**
- Produces: `CanvasNodeKind`, `CanvasPosition`, `moveCanvasItem(state, input)`, `createSceneFromAsset(state, input)`, `failJob(state, jobId)`, `cancelJob(state, jobId)`, `job.x/y`, `result.x/y`。
- Produces: `TaskProfileId = 'generate' | 'blend' | 'angle' | 'light' | 'remove' | 'extract' | 'expand' | 'upscale'`。
- Consumes: existing `StudioState`, `createJob`, `completeJob`, `createDerivedScene`。

- [ ] **Step 1: Write the failing position and localization tests**

```ts
import { getProfile, moveCanvasItem } from '../src/domain';

it('stores manual positions for scenes, jobs, and results', () => {
  const queued = createJob(initialStudioState(), {
    sceneId: 'scene-source',
    profileId: 'generate',
    outputCount: 1,
  });
  const settled = completeJob(queued, queued.jobs[0].id, {
    successfulOutputs: 1,
    actualCredits: 15,
  });

  const movedScene = moveCanvasItem(settled, {
    kind: 'scene', id: 'scene-source', position: { x: 120, y: 80 },
  });
  const movedJob = moveCanvasItem(movedScene, {
    kind: 'job', id: settled.jobs[0].id, position: { x: 500, y: 140 },
  });
  const movedResult = moveCanvasItem(movedJob, {
    kind: 'result', id: settled.results[0].id, position: { x: 820, y: 180 },
  });

  expect(movedResult.scenes[0]).toMatchObject({ x: 120, y: 80 });
  expect(movedResult.jobs[0]).toMatchObject({ x: 500, y: 140 });
  expect(movedResult.results[0]).toMatchObject({ x: 820, y: 180 });
});

it('defines Chinese labels for every workbench tool', () => {
  expect(getProfile('remove').label).toBe('去除');
  expect(getProfile('extract').label).toBe('抠图');
  expect(getProfile('light').label).toBe('定向光');
});

it.each(['failed', 'canceled'] as const)('releases reserved credits when a job is %s', (status) => {
  const queued = createJob(initialStudioState(), {
    sceneId: 'scene-source', profileId: 'blend', outputCount: 2,
  });
  const settled = status === 'failed'
    ? failJob(queued, queued.jobs[0].id, '服务暂时不可用')
    : cancelJob(queued, queued.jobs[0].id);

  expect(settled.jobs[0].status).toBe(status);
  expect(settled.usage.availableCredits).toBe(2000);
  expect(settled.usage.frozenCredits).toBe(0);
});

it('creates a source scene when an asset is dropped on the canvas', () => {
  const next = createSceneFromAsset(initialStudioState(), {
    assetId: 'asset-pack', position: { x: 420, y: 260 },
  });
  expect(next.scenes.at(-1)).toMatchObject({
    skuCode: 'PIAS-SK-014', x: 420, y: 260, status: 'source',
  });
});
```

- [ ] **Step 2: Run the domain tests and verify the new assertions fail**

Run: `npm test -- --run tests/domain.test.ts`

Expected: FAIL because `moveCanvasItem`, `createSceneFromAsset`, `failJob`, `cancelJob`, `remove`, and `extract` do not exist.

- [ ] **Step 3: Add canvas positions and Chinese profiles**

```ts
export type CanvasNodeKind = 'scene' | 'job' | 'result';
export type CanvasPosition = { x: number; y: number };
export type TaskProfileId =
  | 'generate' | 'blend' | 'angle' | 'light'
  | 'remove' | 'extract' | 'expand' | 'upscale';

export type TaskProfile = {
  id: TaskProfileId;
  label: string;
  description: string;
  costPerOutput: number;
  defaultOutputs: number;
  accent: string;
};

export function moveCanvasItem(
  state: StudioState,
  input: { kind: CanvasNodeKind; id: string; position: CanvasPosition },
): StudioState {
  const patch = <T extends { id: string; x: number; y: number }>(items: T[]) =>
    items.map((item) => item.id === input.id ? { ...item, ...input.position } : item);
  if (input.kind === 'scene') return { ...state, scenes: patch(state.scenes) };
  if (input.kind === 'job') return { ...state, jobs: patch(state.jobs) };
  return { ...state, results: patch(state.results) };
}
```

Add `x` and `y` to `GenerationJob` and `Result`. In `createJob`, place the task at `source.x + 320, source.y + 24`; in `completeJob`, place results at `job.x + 280 + index * 220, job.y`; in `createDerivedScene`, use `sourceResult.x + 300, sourceResult.y` so the next branch begins beside the selected result.

Implement `failJob` and `cancelJob` through one private settlement helper: update the job and source scene status, return the complete reserved amount to `availableCredits`, reduce `frozenCredits`, and append an audit event. Store the Chinese failure reason on `GenerationJob.errorMessage`. `completeJob` must preserve the source scene image instead of replacing it with the first generated result.

Implement `createSceneFromAsset` by validating the asset id and creating a source scene at the exact drop position, with title, SKU and image copied from the asset. The new scene becomes `selectedSceneId` and receives a `scene.created_from_asset` audit event.

Use these exact Chinese labels: `生成`, `融图`, `快速视角`, `定向光`, `去除`, `抠图`, `扩图`, `超分`.

- [ ] **Step 4: Run domain tests**

Run: `npm test -- --run tests/domain.test.ts`

Expected: all domain tests PASS.

- [ ] **Step 5: Commit the domain foundation**

```bash
git add src/domain.ts tests/domain.test.ts
git commit -m "feat: add canvas node positions"
```

---

### Task 2: React Flow 图适配器与三类画布节点

**Files:**
- Create: `src/workbench/graph.ts`
- Create: `src/workbench/CanvasNodes.tsx`
- Create: `tests/workbench.test.tsx`

**Interfaces:**
- Consumes: `StudioState`, `TaskProfileId`, `CanvasNodeKind` from `src/domain.ts`。
- Produces: `buildCanvasGraph(state, selectedNodeId, activeTool): { nodes, edges }`。
- Produces: `canvasNodeTypes = { scene, job, result }`。

- [ ] **Step 1: Write failing graph adapter tests**

```tsx
import { buildCanvasGraph } from '../src/workbench/graph';

it('maps scenes, jobs, and results to separate connected canvas nodes', () => {
  const queued = createJob(initialStudioState(), {
    sceneId: 'scene-source', profileId: 'generate', outputCount: 1,
  });
  const settled = completeJob(queued, queued.jobs[0].id, {
    successfulOutputs: 1, actualCredits: 15,
  });
  const graph = buildCanvasGraph(settled, 'scene:scene-source', 'generate');

  expect(graph.nodes.map((node) => node.id)).toEqual([
    'scene:scene-source', `job:${settled.jobs[0].id}`, `result:${settled.results[0].id}`,
  ]);
  expect(graph.edges).toHaveLength(2);
  expect(graph.edges[0]).toMatchObject({ source: 'scene:scene-source', target: `job:${settled.jobs[0].id}` });
  expect(graph.edges[1]).toMatchObject({ source: `job:${settled.jobs[0].id}`, target: `result:${settled.results[0].id}` });
});
```

- [ ] **Step 2: Run the graph test and verify it fails**

Run: `npm test -- --run tests/workbench.test.tsx`

Expected: FAIL because `src/workbench/graph.ts` does not exist.

- [ ] **Step 3: Implement the graph adapter**

```ts
export function buildCanvasGraph(
  state: StudioState,
  selectedNodeId: string,
  activeTool: TaskProfileId,
): { nodes: Node[]; edges: Edge[] } {
  const sceneNodes = state.scenes.map((scene) => ({
    id: `scene:${scene.id}`,
    type: 'scene',
    position: { x: scene.x, y: scene.y },
    data: { kind: 'scene', scene, selected: selectedNodeId === `scene:${scene.id}`, activeTool },
  }));
  const jobNodes = state.jobs.map((job) => ({
    id: `job:${job.id}`,
    type: 'job',
    position: { x: job.x, y: job.y },
    data: { kind: 'job', job, profile: getProfile(job.profileId) },
  }));
  const resultNodes = state.results.map((result) => ({
    id: `result:${result.id}`,
    type: 'result',
    position: { x: result.x, y: result.y },
    data: { kind: 'result', result, selected: selectedNodeId === `result:${result.id}` },
  }));
  return { nodes: [...sceneNodes, ...jobNodes, ...resultNodes], edges: buildEdges(state) };
}

function buildEdges(state: StudioState): Edge[] {
  const jobEdges = state.jobs.map((job) => ({
    id: `scene-job:${job.id}`,
    source: `scene:${job.sceneId}`,
    target: `job:${job.id}`,
    animated: job.status === 'queued' || job.status === 'running',
    className: `lineage-edge is-${job.status}`,
  }));
  const resultEdges = state.results.map((result) => ({
    id: `job-result:${result.id}`,
    source: `job:${result.jobId}`,
    target: `result:${result.id}`,
    className: 'lineage-edge is-succeeded',
  }));
  const derivedEdges = state.edges.map((edge) => ({
    id: edge.id,
    source: `result:${edge.source}`,
    target: `scene:${edge.target}`,
    label: edge.label,
    className: 'lineage-edge is-succeeded',
  }));
  return [...jobEdges, ...resultEdges, ...derivedEdges];
}
```

`createDerivedScene` stores `sourceResult.id` in `SceneEdge.source`, so `buildEdges` creates `scene -> job`, `job -> result`, and `result -> derived scene` lineage. Running edges are animated blue, completed edges are solid gray, failed or canceled edges are dashed gray.

- [ ] **Step 4: Implement the three node components**

```tsx
export const canvasNodeTypes = {
  scene: SceneCanvasNode,
  job: JobCanvasNode,
  result: ResultCanvasNode,
};

function JobCanvasNode({ data }: NodeProps<Node<JobNodeData>>) {
  return (
    <article className={`canvas-node job-node is-${data.job.status}`}>
      <Handle type="target" position={Position.Left} />
      <span>{data.profile.label}</span>
      <strong>{statusLabels[data.job.status]}</strong>
      <progress value={data.job.progress} max={100} />
      <small>{data.job.progress}%</small>
      <Handle type="source" position={Position.Right} />
    </article>
  );
}
```

Scene nodes show title, SKU, source image and review summary. When `activeTool === 'light'` and selected, render eight light handles plus one blue light point; when `activeTool === 'expand'`, render a 3x3 expansion grid. Result nodes show image, Chinese review state, “继续创作”, “提交审核” and gated download actions.

- [ ] **Step 5: Add node rendering assertions and run tests**

```tsx
it('provides Chinese labels for canvas node states', () => {
  expect(getJobStatusLabel('queued')).toBe('等待中');
  expect(getJobStatusLabel('running')).toBe('生成中');
  expect(getJobStatusLabel('succeeded')).toBe('已完成');
  expect(getReviewStatusLabel('submitted')).toBe('待审核');
});
```

Run: `npm test -- --run tests/workbench.test.tsx`

Expected: all workbench graph and node tests PASS.

- [ ] **Step 6: Commit graph and nodes**

```bash
git add src/workbench/graph.ts src/workbench/CanvasNodes.tsx tests/workbench.test.tsx
git commit -m "feat: render canvas lineage nodes"
```

---

### Task 3: 场景栏、工具栏、参数面板和任务抽屉

**Files:**
- Create: `src/workbench/SceneRail.tsx`
- Create: `src/workbench/ToolPalette.tsx`
- Create: `src/workbench/ContextToolPanel.tsx`
- Create: `src/workbench/TaskTray.tsx`
- Create: `src/workbench/Workbench.tsx`
- Modify: `tests/workbench.test.tsx`

**Interfaces:**
- Consumes: `StudioState`, `TaskProfileId`, `setSelectedScene`, `setSelectedTool`, `moveCanvasItem`, `createJob`, `updateJobProgress`, `completeJob`。
- Produces: `Workbench({ state, setState })`。
- Produces: callbacks `onDerive(result)`, `onSubmitReview(resultId)`, `onMove(kind, id, position)`。

- [ ] **Step 1: Write failing workbench interaction tests**

```tsx
function WorkbenchHarness() {
  const [state, setState] = useState(() => initialStudioState());
  return <Workbench state={state} setState={setState} />;
}

function createDataTransfer(assetId: string): DataTransfer {
  return {
    getData: (type: string) => type === 'application/x-pias-asset' ? assetId : '',
    setData: vi.fn(),
  } as unknown as DataTransfer;
}

it('opens a Chinese context panel from the floating tool palette', () => {
  render(<WorkbenchHarness />);
  fireEvent.click(screen.getByRole('button', { name: '融图' }));
  expect(screen.getByRole('dialog', { name: '融图参数' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '开始生成' })).toBeInTheDocument();
});

it('keeps the task tray and scene library in the workbench', () => {
  render(<WorkbenchHarness />);
  expect(screen.getByRole('complementary', { name: '场景与素材' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /任务队列/ })).toBeInTheDocument();
});

it('creates a source node when a library asset is dropped on the canvas', () => {
  render(<WorkbenchHarness />);
  const asset = screen.getByRole('button', { name: /PIAS-SK-014/ });
  fireEvent.dragStart(asset, { dataTransfer: createDataTransfer('asset-pack') });
  fireEvent.drop(screen.getByLabelText('节点画布'), {
    clientX: 640, clientY: 360, dataTransfer: createDataTransfer('asset-pack'),
  });
  expect(screen.getByText('PIAS-SK-014')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run interaction tests and verify they fail**

Run: `npm test -- --run tests/workbench.test.tsx`

Expected: FAIL because `Workbench` and its controls do not exist.

- [ ] **Step 3: Implement the rail and tool palette**

```tsx
export function ToolPalette({ activeTool, onSelect }: ToolPaletteProps) {
  return (
    <div className="tool-palette" aria-label="图片工具">
      {taskProfiles.map((profile) => {
        const Icon = toolIcons[profile.id];
        return (
          <button
            aria-label={profile.label}
            className={activeTool === profile.id ? 'is-active' : ''}
            key={profile.id}
            onClick={() => onSelect(profile.id)}
            title={profile.description}
            type="button"
          >
            <Icon size={17} />
          </button>
        );
      })}
    </div>
  );
}
```

`SceneRail` uses “场景 / 素材” tabs. Scene rows select and center nodes; product, upload, and brand asset groups show searchable thumbnails. Asset buttons set `dataTransfer.setData('application/x-pias-asset', asset.id)` on drag start. The collapse button uses `PanelLeftClose`/`PanelLeftOpen` icons and a Chinese tooltip.

- [ ] **Step 4: Implement the contextual tool panel**

```tsx
export function ContextToolPanel(props: ContextToolPanelProps) {
  const profile = getProfile(props.tool);
  const estimate = profile.costPerOutput * props.outputCount;
  return (
    <section className="context-panel" role="dialog" aria-label={`${profile.label}参数`}>
      <header><strong>{profile.label}</strong><button aria-label="关闭参数面板" onClick={props.onClose}><X /></button></header>
      <label>创作描述<textarea value={props.prompt} onChange={(event) => props.onPromptChange(event.target.value)} /></label>
      <fieldset className="segmented"><legend>输出数量</legend>{[1, 2, 4].map((count) => <button className={count === props.outputCount ? 'is-active' : ''} key={count} onClick={() => props.onOutputCountChange(count)} type="button">{count}</button>)}</fieldset>
      <label>画面比例<select value={props.ratio} onChange={(event) => props.onRatioChange(event.target.value)}><option value="1:1">1:1</option><option value="4:5">4:5</option><option value="16:9">16:9</option></select></label>
      <div className="credit-estimate"><span>预计消耗</span><strong>{estimate} 点</strong></div>
      <button className="primary-action" disabled={!props.prompt.trim()} onClick={props.onRun}>开始生成</button>
    </section>
  );
}
```

For `light`, `expand`, `angle`, and `blend`, add the corresponding slider or segmented control. Every input has a visible Chinese label; the main action is disabled when required values are missing or credits are insufficient.

- [ ] **Step 5: Compose the React Flow workbench**

```tsx
<ReactFlow
  nodes={graph.nodes}
  edges={graph.edges}
  nodeTypes={canvasNodeTypes}
  onNodeClick={handleNodeClick}
  onNodeDragStop={(_, node) => {
    const [kind, id] = node.id.split(':') as [CanvasNodeKind, string];
    setState((current) => moveCanvasItem(current, { kind, id, position: node.position }));
  }}
  fitView
  minZoom={0.3}
  maxZoom={1.8}
>
  <Background color="#353840" gap={24} size={1} />
  <MiniMap pannable zoomable />
  <Controls showInteractive={false} />
</ReactFlow>
```

Place `SceneRail` on the left, `ToolPalette` at the canvas upper-left, `ContextToolPanel` beside it, zoom controls at bottom-right, and `TaskTray` as a collapsible bottom panel. Preserve the existing asynchronous demo timings and use functional `setState` updates.

Handle canvas `onDragOver` with `preventDefault()` and `onDrop` by reading `application/x-pias-asset`, converting screen coordinates with React Flow's `screenToFlowPosition`, and calling `createSceneFromAsset`. Failed tasks show their Chinese reason and a retry button in both the node and task tray; queued/running tasks expose cancel.

- [ ] **Step 6: Run interaction tests**

Run: `npm test -- --run tests/workbench.test.tsx`

Expected: all workbench tests PASS.

- [ ] **Step 7: Commit the complete workbench interaction**

```bash
git add src/workbench tests/workbench.test.tsx
git commit -m "feat: add floating workbench controls"
```

---

### Task 4: 中文应用框架与辅助页面

**Files:**
- Create: `src/SecondaryViews.tsx`
- Modify: `src/App.tsx:1-641`
- Modify: `tests/app.test.tsx:1-59`

**Interfaces:**
- Consumes: `Workbench`, `StudioState`, approval functions。
- Produces: compact global app shell and fully Chinese navigation/content。

- [ ] **Step 1: Replace app assertions with Chinese behavior tests**

```tsx
it('renders a fully Chinese global navigation and opens the node workbench', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: '首页' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '图片工作台' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '图片工作台' }));
  expect(screen.getByLabelText('节点画布')).toBeInTheDocument();
  expect(screen.queryByText('Image Studio')).not.toBeInTheDocument();
});

it('contains no legacy English navigation labels', () => {
  render(<App />);
  ['Dashboard', 'Projects', 'Assets', 'Reviews', 'Usage', 'Admin'].forEach((label) => {
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run app tests and verify the Chinese assertions fail**

Run: `npm test -- --run tests/app.test.tsx`

Expected: FAIL because the current app uses English and Japanese labels.

- [ ] **Step 3: Extract and translate secondary views**

```tsx
export const navItems: NavItem[] = [
  { key: 'dashboard', label: '首页', icon: Gauge },
  { key: 'projects', label: '项目', icon: FolderKanban },
  { key: 'studio', label: '图片工作台', icon: Image },
  { key: 'assets', label: '素材库', icon: Archive },
  { key: 'reviews', label: '审核', icon: BadgeCheck },
  { key: 'usage', label: '用量', icon: Coins },
  { key: 'admin', label: '企业管理', icon: ShieldCheck },
];
```

Translate status values through lookup maps rather than rendering raw enums. Keep secondary pages quiet and utilitarian: compact KPI rows, unframed tables, image catalog grid, review list, usage ledger, and role table.

- [ ] **Step 4: Replace the studio branch with `Workbench`**

```tsx
return (
  <div className={`app-frame ${activeNav === 'studio' ? 'is-workbench' : ''}`}>
    <GlobalNav activeNav={activeNav} onNavigate={setActiveNav} state={state} />
    <div className="workspace">
      {activeNav === 'studio' ? (
        <Workbench state={state} setState={setState} />
      ) : (
        <SecondaryView activeNav={activeNav} state={state} setState={setState} />
      )}
    </div>
  </div>
);
```

Make “图片工作台” the initial route for this prototype so opening `127.0.0.1:5173` immediately reveals the primary experience. Keep all `<img>` elements accessible and all icon buttons named with `aria-label`.

- [ ] **Step 5: Run app and workbench tests**

Run: `npm test -- --run tests/app.test.tsx tests/workbench.test.tsx`

Expected: all tests PASS, including strict-mode single-job creation and review-gated download.

- [ ] **Step 6: Commit the app integration**

```bash
git add src/App.tsx src/SecondaryViews.tsx tests/app.test.tsx
git commit -m "feat: localize PIAS application shell"
```

---

### Task 5: 深色画布视觉与响应式布局

**Files:**
- Modify: `src/styles.css:1-898`

**Interfaces:**
- Consumes: class names from Tasks 2-4。
- Produces: desktop workbench, tablet collapsed rail, mobile preview/task/review layout。

- [ ] **Step 1: Replace light theme tokens and layout foundations**

```css
:root {
  color-scheme: dark;
  font-family: Inter, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  color: #f3f4f6;
  background: #08090b;
  --canvas: #08090b;
  --panel: #15161a;
  --overlay: #1c1d22;
  --line: #34363d;
  --muted: #9297a1;
  --blue: #2f80ff;
  --green: #25b47e;
  --warning: #e7a23b;
  --danger: #e45757;
}

.app-frame {
  width: 100%;
  height: 100dvh;
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  overflow: hidden;
  background: var(--canvas);
}
```

- [ ] **Step 2: Style the canvas, nodes, floating controls, and panels**

Use stable dimensions: 240px scene nodes, 176px task nodes, 196px result nodes, 36px icon buttons, 224px scene rail, and 320px context panel. Images use fixed aspect ratios. Selected nodes use a 1px blue border and restrained shadow; loading state preserves node size and shows an in-node progress bar.

```css
.workbench-canvas { position: relative; min-width: 0; min-height: 0; background: var(--canvas); }
.tool-palette { position: absolute; z-index: 20; top: 64px; left: 16px; display: grid; gap: 4px; padding: 5px; border: 1px solid var(--line); border-radius: 8px; background: var(--overlay); }
.context-panel { position: absolute; z-index: 22; top: 64px; left: 68px; width: min(320px, calc(100% - 84px)); border: 1px solid var(--line); border-radius: 8px; background: var(--overlay); box-shadow: 0 18px 44px rgb(0 0 0 / 32%); }
.canvas-node { overflow: hidden; border: 1px solid var(--line); border-radius: 8px; background: #111216; }
.canvas-node.is-selected { border-color: var(--blue); box-shadow: 0 0 0 2px rgb(47 128 255 / 20%); }
```

- [ ] **Step 3: Add responsive behavior without overlapping controls**

```css
@media (max-width: 1199px) {
  .scene-rail { width: 44px; }
  .scene-rail__content { display: none; }
}

@media (max-width: 767px) {
  .app-frame { grid-template-columns: 1fr; grid-template-rows: 52px minmax(0, 1fr); }
  .global-nav { flex-direction: row; overflow-x: auto; }
  .desktop-workbench { display: none; }
  .mobile-workbench-summary { display: grid; }
}
```

Ensure every long Chinese label uses wrapping or ellipsis within a constrained container. No element uses viewport-width font scaling, negative letter spacing, gradient decoration, or nested cards.

- [ ] **Step 4: Run the full automated suite and production build**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run build`

Expected: TypeScript and Vite production build PASS with no errors.

- [ ] **Step 5: Commit the visual system**

```bash
git add src/styles.css
git commit -m "style: redesign workbench as dark canvas"
```

---

### Task 6: 浏览器交互与视觉验收

**Files:**
- Modify if defects are found: `src/**/*.tsx`, `src/styles.css`, `tests/**/*.tsx`

**Interfaces:**
- Consumes: complete application from Tasks 1-5。
- Produces: verified development server and screenshot evidence。

- [ ] **Step 1: Start or reuse the Vite development server**

Run: `npm run dev -- --port 5173`

Expected: `Local: http://127.0.0.1:5173/`. If 5173 is occupied by a healthy PIAS server, reuse it; if occupied by another process, use 5174 and report that URL.

- [ ] **Step 2: Verify desktop interaction at 1440x900 and 1280x800**

Open the app and verify:

- The first viewport is the dark node workbench.
- Scene rail, tool palette, context panel, task tray, zoom controls and graph are visible without overlap.
- Dragging a scene, job, or result node keeps its new position after another state update.
- Running a task creates a task node, updates progress, creates result nodes, and connects all nodes.
- “提交审核” moves a result to pending; approval in “审核” enables download.

- [ ] **Step 3: Verify tablet and mobile layouts**

At 1024x768, verify the scene rail is collapsed and the canvas remains editable. At 375x812, verify the editor is replaced by project preview, task status and audit entry points, with no clipped Chinese text or horizontal page overflow.

- [ ] **Step 4: Inspect console and fix defects with regression tests**

For each defect, first add a failing assertion to the closest test file, then make the smallest implementation or CSS correction. Repeat `npm test` after each correction.

- [ ] **Step 5: Run final verification**

Run: `npm test && npm run build`

Expected: all tests PASS and the production build completes successfully.

Check server: `curl -I http://127.0.0.1:5173/`

Expected: HTTP `200 OK`.

- [ ] **Step 6: Commit verified fixes**

```bash
git add src tests
git commit -m "fix: finish workbench browser validation"
```

If browser validation requires no fixes, do not create an empty commit.
