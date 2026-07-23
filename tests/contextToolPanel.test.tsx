import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { Asset, TaskProfileId } from '../src/shared/domain';
import { ContextToolPanel } from '../src/client/workbench/ContextToolPanel';

const referenceAsset: Asset = {
  id: 'asset-reference',
  brand: 'Content Studio',
  product: '参考商品',
  skuCode: 'REF-001',
  usage: '场景参考',
  version: 'v1',
  imageUrl: '/reference.png',
};

type PanelProps = ComponentProps<typeof ContextToolPanel>;

function renderPanel(tool: TaskProfileId, overrides: Partial<PanelProps> = {}) {
  const callbacks = {
    onPromptChange: vi.fn(),
    onOutputCountChange: vi.fn(),
    onRatioChange: vi.fn(),
    onParameterChange: vi.fn(),
    onReferenceAssetChange: vi.fn(),
    onAssetPickerOpen: vi.fn(),
    onAssetPickerClose: vi.fn(),
    onClearRemoveMask: vi.fn(),
    onClose: vi.fn(),
    onRun: vi.fn(),
  };
  render(
    <ContextToolPanel
      assets={[referenceAsset]}
      availableCredits={2_000}
      hasRemoveMask={tool !== 'remove'}
      outputCount={1}
      parameters={{}}
      previewImageUrl="/demo.png"
      prompt=""
      ratio="1:1"
      referenceAssetId={tool === 'blend' ? referenceAsset.id : ''}
      tool={tool}
      {...callbacks}
      {...overrides}
    />,
  );
  return callbacks;
}

describe('image tool panel design-system contract', () => {
  const cases = [
    ['generate', '生成参数', '开始生成'],
    ['blend', '融图参数', '开始融图'],
    ['angle', '多角度参数', '生成视角'],
    ['light', '修改光影参数', '生成光影修改'],
    ['remove', '去除参数', '开始去除'],
    ['extract', '抠图参数', '开始抠图'],
    ['expand', '扩图参数', '开始扩图'],
    ['upscale', '超分参数', '开始超分'],
  ] as const;

  it.each(cases)('%s uses the shared three-region panel', (tool, dialogName, actionName) => {
    renderPanel(tool, tool === 'remove' ? { hasRemoveMask: true } : {});
    const panel = screen.getByRole('dialog', { name: dialogName });

    expect(panel.querySelector('[data-panel-region="header"]')).toBeTruthy();
    expect(panel.querySelector('[data-panel-region="body"]')).toBeTruthy();
    expect(panel.querySelector('[data-panel-region="footer"]')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: actionName })).toBeVisible();
  });

  it('keeps output, ratio, parameter, close, and run callbacks functional', () => {
    const callbacks = renderPanel('expand');

    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.change(screen.getByRole('combobox', { name: '画面比例' }), {
      target: { value: '4:5' },
    });
    fireEvent.change(screen.getByRole('slider', { name: '原图缩放' }), {
      target: { value: '64' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始扩图' }));

    expect(callbacks.onOutputCountChange).toHaveBeenCalledWith(4);
    expect(callbacks.onRatioChange).toHaveBeenCalledWith('4:5');
    expect(callbacks.onParameterChange).toHaveBeenCalledWith('expandScale', 64);
    expect(callbacks.onRun).toHaveBeenCalledTimes(1);
  });

  it('explains why remove cannot run without a mask', () => {
    renderPanel('remove', { hasRemoveMask: false });

    expect(screen.getByRole('button', { name: '开始去除' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('请先在图片上涂抹要去除的区域');
  });

  it('focuses the primary action when extract has no parameters', () => {
    renderPanel('extract');

    expect(screen.getByRole('button', { name: '开始抠图' })).toHaveFocus();
    expect(screen.getByText('无需额外参数')).toBeVisible();
  });

  it('closes the asset picker before the blend panel on Escape', () => {
    const callbacks = renderPanel('blend', { assetPickerOpen: true });
    const panel = screen.getByRole('dialog', { name: '融图参数' });

    fireEvent.keyDown(panel, { key: 'Escape' });

    expect(callbacks.onAssetPickerClose).toHaveBeenCalledTimes(1);
    expect(callbacks.onClose).not.toHaveBeenCalled();
  });

  it('shows submitting state without allowing a duplicate run', () => {
    const callbacks = renderPanel('generate', { isSubmitting: true });

    const action = screen.getByRole('button', { name: '正在提交' });
    expect(action).toBeDisabled();
    fireEvent.click(action);
    expect(callbacks.onRun).not.toHaveBeenCalled();
  });

  it('resets light parameters without changing the existing defaults', () => {
    const callbacks = renderPanel('light');

    fireEvent.click(screen.getByRole('button', { name: '重置' }));

    expect(callbacks.onParameterChange.mock.calls).toEqual([
      ['lightDirection', 'front'],
      ['lightIntensity', 50],
      ['lightTemperature', 5200],
      ['lightSmartMode', false],
      ['rimLight', false],
    ]);
    expect(callbacks.onPromptChange).toHaveBeenCalledWith('');
  });

  it('resets angle parameters without changing Fal angle defaults', () => {
    const callbacks = renderPanel('angle');

    fireEvent.click(screen.getByRole('button', { name: '重置' }));

    expect(callbacks.onParameterChange.mock.calls).toEqual([
      ['horizontalAngle', -45],
      ['moveForward', 0],
      ['verticalView', -0.7],
      ['wideAngle', false],
    ]);
    expect(callbacks.onPromptChange).toHaveBeenCalledWith('');
  });
});
