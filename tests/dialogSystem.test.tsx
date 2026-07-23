import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssetUploadDialog } from '../src/client/assets/AssetUploadDialog';
import { createDemoStudioState } from '../src/client/studio/demoState';
import { ExportDialog } from '../src/client/workbench/ExportDialog';

describe('ordinary dialog design-system contract', () => {
  it('keeps upload dialog regions, controls, and close behavior available', () => {
    const onClose = vi.fn();
    render(<AssetUploadDialog onClose={onClose} onSubmit={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: '上传素材' });
    expect(dialog.querySelector('header')).toBeVisible();
    expect(dialog.querySelector('.asset-upload-dialog__body')).toBeTruthy();
    expect(dialog.querySelector('footer')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: '确认上传' })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole('button', { name: '关闭上传素材' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps export settings and submission behavior available', () => {
    const onSubmit = vi.fn();
    const result = createDemoStudioState().results[0]!;
    render(
      <ExportDialog
        buildFilename={({ format }) => `delivery.${format}`}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        result={result}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '生产导出' });
    expect(dialog.querySelector('header')).toBeVisible();
    expect(dialog.querySelector('.export-dialog__body')).toBeTruthy();
    expect(dialog.querySelector('footer')).toBeVisible();

    fireEvent.change(within(dialog).getByRole('combobox', { name: '文件格式' }), {
      target: { value: 'webp' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '生成生产导出' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ format: 'webp' }));
  });

  it('owns adaptive height, safe padding, and the only body scroll boundary', () => {
    const dialogs = readFile('src/client/styles/dialog-system.css');

    expect(dialogs).toMatch(
      /\.asset-upload-dialog,\s*\.export-dialog\s*\{[^}]*height:\s*auto;[^}]*max-height:\s*calc\(100dvh - 48px\);/s,
    );
    expect(dialogs).toMatch(
      /\.asset-upload-dialog__body,\s*\.export-dialog__body\s*\{[^}]*padding:\s*24px;[^}]*overflow-y:\s*auto;/s,
    );
    expect(dialogs).toMatch(
      /\.asset-upload-dialog > footer,\s*\.export-dialog > footer\s*\{[^}]*padding:\s*16px 24px 24px;/s,
    );
    expect(dialogs).toMatch(/\.node-command-dialog\s*\{[^}]*height:\s*auto;/s);
    expect(dialogs).not.toMatch(/\.result-compare-dialog/);
  });
});

function readFile(relativePath: string): string {
  return readFileSync(`${process.cwd()}/${relativePath}`, 'utf8');
}
