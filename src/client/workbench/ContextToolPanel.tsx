import { RotateCcw, Search, X } from 'lucide-react';
import { useMemo, useRef, useState, type RefObject } from 'react';
import { getProfile, type Asset, type TaskParameters, type TaskProfileId } from '../../shared/domain';
import { AngleEditor, LightEditor } from './AdvancedToolEditors';
import { GenerationFooter } from './GenerationFooter';
import {
  PanelEmptyState,
  PanelSection,
  RangeControl,
  SegmentedControl,
} from './PanelControls';
import { ToolPanelShell } from './ToolPanelShell';

type ContextToolPanelProps = {
  tool: TaskProfileId;
  prompt: string;
  outputCount: number;
  ratio: string;
  availableCredits: number;
  assets: Asset[];
  parameters: TaskParameters;
  referenceAssetId: string;
  previewImageUrl: string;
  hasRemoveMask?: boolean;
  assetPickerOpen?: boolean;
  isSubmitting?: boolean;
  placement?: 'left' | 'right';
  onPromptChange: (prompt: string) => void;
  onOutputCountChange: (count: number) => void;
  onRatioChange: (ratio: string) => void;
  onParameterChange: (key: string, value: string | number | boolean) => void;
  onClearRemoveMask?: () => void;
  onReferenceAssetChange: (assetId: string) => void;
  onAssetPickerOpen?: () => void;
  onAssetPickerClose?: () => void;
  onClose: () => void;
  onRun: () => void;
};

export function ContextToolPanel(props: ContextToolPanelProps) {
  const profile = getProfile(props.tool);
  const estimate = profile.costPerOutput * props.outputCount;
  const disabledReason = getDisabledReason(props, estimate);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const referenceRef = useRef<HTMLButtonElement>(null);
  const firstControlRef = useRef<HTMLInputElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const initialFocusRef = getInitialFocusRef(
    props.tool,
    promptRef,
    referenceRef,
    firstControlRef,
    primaryRef,
  );

  const advancedTool = props.tool === 'light' || props.tool === 'angle' ? props.tool : undefined;
  const resetAdvancedEditor = advancedTool
    ? () => resetAdvancedParameters(advancedTool, props.onParameterChange, props.onPromptChange)
    : undefined;

  const body = (
    <>
      {props.tool === 'blend' && (
        <ReferenceAssetSlot
          asset={props.assets.find((asset) => asset.id === props.referenceAssetId)}
          buttonRef={referenceRef}
          onOpen={() => props.onAssetPickerOpen?.()}
        />
      )}

      {props.tool === 'light' && (
        <>
          <LightEditor
            onParameterChange={props.onParameterChange}
            parameters={props.parameters}
            previewImageUrl={props.previewImageUrl}
          />
          <p className="panel-risk-note" role="note">
            实验能力：生成后请重点复核商品文字、颜色与材质
          </p>
        </>
      )}

      {props.tool === 'angle' && (
        <AngleEditor
          onParameterChange={props.onParameterChange}
          parameters={props.parameters}
          previewImageUrl={props.previewImageUrl}
        />
      )}

      {!['light', 'angle', 'extract'].includes(props.tool) && (
        <ToolSpecificControls
          firstControlRef={firstControlRef}
          onParameterChange={props.onParameterChange}
          parameters={props.parameters}
          tool={props.tool}
        />
      )}

      {props.tool === 'remove' && (
        <div className="remove-mask-status" data-ready={props.hasRemoveMask ? 'true' : 'false'}>
          <span>{props.hasRemoveMask ? '蒙版已就绪' : '在图片上涂抹要移除的区域'}</span>
          {props.hasRemoveMask && (
            <button
              aria-label="清除去除蒙版"
              onClick={props.onClearRemoveMask}
              title="清除蒙版"
              type="button"
            >
              <RotateCcw aria-hidden="true" size={15} />
            </button>
          )}
        </div>
      )}

      {['generate', 'expand'].includes(props.tool) && (
        <PanelSection className="panel-section--prompt">
          <label className="panel-field panel-field--prompt">
            <span>补充描述（可选）</span>
            <textarea
              aria-label="创作描述"
              onChange={(event) => props.onPromptChange(event.target.value)}
              placeholder={promptPlaceholder(props.tool)}
              ref={promptRef}
              value={props.prompt}
            />
          </label>
        </PanelSection>
      )}

      {props.tool === 'extract' && (
        <PanelEmptyState
          description="将自动识别主体并输出透明背景图片"
          title="无需额外参数"
        />
      )}
    </>
  );

  const footer = (
    <GenerationFooter
      actionLabel={actionLabel(props.tool)}
      disabled={Boolean(props.isSubmitting || disabledReason)}
      disabledReason={disabledReason}
      estimate={estimate}
      onOutputCountChange={props.onOutputCountChange}
      onRatioChange={props.onRatioChange}
      onReset={resetAdvancedEditor}
      onRun={props.onRun}
      outputCount={props.outputCount}
      primaryRef={primaryRef}
      ratio={props.ratio}
      showOutput={!['remove', 'extract', 'upscale'].includes(props.tool)}
      showRatio={['generate', 'blend', 'angle', 'expand'].includes(props.tool)}
      submitting={Boolean(props.isSubmitting)}
    />
  );

  const overlay = props.assetPickerOpen ? (
    <AssetPicker
      assets={props.assets}
      onClose={() => props.onAssetPickerClose?.()}
      onSelect={(assetId) => {
        props.onReferenceAssetChange(assetId);
        props.onAssetPickerClose?.();
      }}
      selectedAssetId={props.referenceAssetId}
    />
  ) : undefined;

  return (
    <ToolPanelShell
      ariaLabel={`${profile.label}参数`}
      body={body}
      eyebrow="图片处理"
      footer={footer}
      initialFocusRef={initialFocusRef}
      onClose={props.onClose}
      onEscape={props.assetPickerOpen ? props.onAssetPickerClose : undefined}
      overlay={overlay}
      placement={props.placement}
      title={profile.label}
      toolId={props.tool}
    />
  );
}

function getInitialFocusRef(
  tool: TaskProfileId,
  promptRef: RefObject<HTMLTextAreaElement | null>,
  referenceRef: RefObject<HTMLButtonElement | null>,
  firstControlRef: RefObject<HTMLInputElement | null>,
  primaryRef: RefObject<HTMLButtonElement | null>,
): RefObject<HTMLElement | null> | undefined {
  if (tool === 'generate' || tool === 'expand') return promptRef;
  if (tool === 'blend') return referenceRef;
  if (tool === 'remove') return firstControlRef;
  if (tool === 'extract') return primaryRef;
  return undefined;
}

function getDisabledReason(props: ContextToolPanelProps, estimate: number): string | undefined {
  if (props.tool === 'remove' && !props.hasRemoveMask) {
    return '请先在图片上涂抹要去除的区域';
  }
  if (props.tool === 'blend' && !props.referenceAssetId) {
    return '请选择参考素材';
  }
  if (estimate > props.availableCredits) {
    return '可用额度不足';
  }
  return undefined;
}

function resetAdvancedParameters(
  tool: 'light' | 'angle',
  onParameterChange: ContextToolPanelProps['onParameterChange'],
  onPromptChange: ContextToolPanelProps['onPromptChange'],
) {
  if (tool === 'light') {
    onParameterChange('lightDirection', 'front');
    onParameterChange('lightIntensity', 50);
    onParameterChange('lightTemperature', 5200);
    onParameterChange('lightSmartMode', false);
    onParameterChange('rimLight', false);
  } else {
    onParameterChange('horizontalAngle', -45);
    onParameterChange('moveForward', 0);
    onParameterChange('verticalView', -0.7);
    onParameterChange('wideAngle', false);
  }
  onPromptChange('');
}

function ReferenceAssetSlot({
  asset,
  buttonRef,
  onOpen,
}: {
  asset?: Asset;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
}) {
  return (
    <div className="reference-slot">
      <span>参考素材</span>
      <button aria-label="选择参考素材" onClick={onOpen} ref={buttonRef} type="button">
        {asset ? (
          <>
            <img alt="" src={asset.imageUrl} />
            <span>
              <strong>{asset.product}</strong>
              <small>{asset.skuCode}</small>
            </span>
          </>
        ) : (
          <span>选择商品或场景参考</span>
        )}
      </button>
    </div>
  );
}

function AssetPicker({
  assets,
  selectedAssetId,
  onSelect,
  onClose,
}: {
  assets: Asset[];
  selectedAssetId: string;
  onSelect: (assetId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('zh-CN');
    if (!normalized) return assets;
    return assets.filter((asset) => [asset.product, asset.skuCode, asset.usage]
      .some((value) => value.toLocaleLowerCase('zh-CN').includes(normalized)));
  }, [assets, query]);

  return (
    <section aria-label="选择参考素材" className="asset-picker" role="dialog">
      <header>
        <strong>选择参考素材</strong>
        <button aria-label="关闭素材选择" onClick={onClose} type="button"><X size={16} /></button>
      </header>
      <label className="asset-picker__search">
        <Search aria-hidden="true" size={15} />
        <input
          aria-label="搜索参考素材"
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索商品、SKU 或用途"
          type="search"
          value={query}
        />
      </label>
      <div className="asset-picker__grid">
        {filteredAssets.map((asset) => (
          <button
            aria-label={`${asset.product}，${asset.skuCode}，${asset.usage}`}
            aria-pressed={asset.id === selectedAssetId}
            className={asset.id === selectedAssetId ? 'is-selected' : ''}
            key={asset.id}
            onClick={() => onSelect(asset.id)}
            type="button"
          >
            <img alt="" src={asset.imageUrl} />
            <span>{asset.product}</span>
            <small>{asset.skuCode}</small>
          </button>
        ))}
        {filteredAssets.length === 0 && <p>暂无匹配素材</p>}
      </div>
    </section>
  );
}

function ToolSpecificControls({
  firstControlRef,
  tool,
  parameters,
  onParameterChange,
}: {
  firstControlRef: RefObject<HTMLInputElement | null>;
  tool: TaskProfileId;
  parameters: TaskParameters;
  onParameterChange: (key: string, value: string | number | boolean) => void;
}) {
  if (tool === 'generate') {
    return (
      <PanelSection>
        <SegmentedControl
          label="场景模板"
          onChange={(value) => onParameterChange('sceneTemplate', value)}
          options={[
            { label: '日光展台', value: '日光展台' },
            { label: '水面倒影', value: '水面倒影' },
            { label: '纯净棚拍', value: '纯净棚拍' },
          ]}
          value={String(parameters.sceneTemplate ?? '日光展台')}
        />
        <SegmentedControl
          label="质量"
          onChange={(value) => onParameterChange('quality', value)}
          options={[
            { label: '快速', value: '快速' },
            { label: '精细', value: '精细' },
          ]}
          value={String(parameters.quality ?? '精细')}
        />
      </PanelSection>
    );
  }

  if (tool === 'blend') {
    return (
      <PanelSection>
        <SegmentedControl
          className="panel-segmented--placement"
          label="商品位置"
          onChange={(value) => onParameterChange('productPlacement', value)}
          options={[
            { label: '左侧', value: 'left_center' },
            { label: '居中', value: 'center_vertical' },
            { label: '右侧', value: 'right_center' },
            { label: '左下', value: 'bottom_left' },
            { label: '下方', value: 'bottom_center' },
            { label: '右下', value: 'bottom_right' },
          ]}
          value={String(parameters.productPlacement ?? 'bottom_center')}
        />
      </PanelSection>
    );
  }

  if (tool === 'expand') {
    return (
      <PanelSection>
        <SegmentedControl
          className="panel-segmented--anchors"
          label="原图锚点"
          onChange={(value) => onParameterChange('expandAnchor', value)}
          options={[
            { label: '左上', value: 'top-left' },
            { label: '上', value: 'top' },
            { label: '右上', value: 'top-right' },
            { label: '左', value: 'left' },
            { label: '中', value: 'center' },
            { label: '右', value: 'right' },
            { label: '左下', value: 'bottom-left' },
            { label: '下', value: 'bottom' },
            { label: '右下', value: 'bottom-right' },
          ]}
          value={String(parameters.expandAnchor ?? 'center')}
        />
        <RangeControl
          label="原图缩放"
          max={100}
          min={36}
          onChange={(value) => onParameterChange('expandScale', value)}
          suffix="%"
          value={numberValue(parameters.expandScale, 72)}
        />
      </PanelSection>
    );
  }

  if (tool === 'upscale') {
    return (
      <PanelSection>
        <SegmentedControl
          label="目标尺寸"
          onChange={(value) => onParameterChange('upscaleSize', value)}
          options={[
            { label: '2K', value: '2048' },
            { label: '4K', value: '4096' },
            { label: '8K', value: '8192' },
          ]}
          value={String(parameters.upscaleSize ?? '2048')}
        />
        <RangeControl
          label="细节增强"
          onChange={(value) => onParameterChange('detailLevel', value)}
          value={numberValue(parameters.detailLevel, 60)}
        />
      </PanelSection>
    );
  }

  if (tool === 'remove') {
    return (
      <PanelSection>
        <RangeControl
          inputRef={firstControlRef}
          label="笔刷大小"
          onChange={(value) => onParameterChange('brushSize', value)}
          value={numberValue(parameters.brushSize, 42)}
        />
      </PanelSection>
    );
  }

  return null;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function promptPlaceholder(tool: TaskProfileId): string {
  if (tool === 'expand') return '例如：向画面外延展同一空间与光线';
  return '可补充构图、材质或品牌要求';
}

function actionLabel(tool: TaskProfileId): string {
  if (tool === 'blend') return '开始融图';
  if (tool === 'angle') return '生成视角';
  if (tool === 'light') return '生成光影修改';
  if (tool === 'remove') return '开始去除';
  if (tool === 'extract') return '开始抠图';
  if (tool === 'expand') return '开始扩图';
  if (tool === 'upscale') return '开始超分';
  return '开始生成';
}
