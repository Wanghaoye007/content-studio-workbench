import { ArrowUp, RotateCcw } from 'lucide-react';
import type { RefObject } from 'react';
import { AspectRatioControl, OutputSelector } from './PanelControls';

type GenerationFooterProps = {
  actionLabel: string;
  disabled: boolean;
  estimate: number;
  outputCount: number;
  primaryRef?: RefObject<HTMLButtonElement | null>;
  ratio: string;
  showOutput?: boolean;
  showRatio?: boolean;
  submitting: boolean;
  disabledReason?: string;
  onOutputCountChange: (count: number) => void;
  onRatioChange: (ratio: string) => void;
  onReset?: () => void;
  onRun: () => void;
};

export function GenerationFooter({
  actionLabel,
  disabled,
  disabledReason,
  estimate,
  outputCount,
  primaryRef,
  ratio,
  showOutput = false,
  showRatio = false,
  submitting,
  onOutputCountChange,
  onRatioChange,
  onReset,
  onRun,
}: GenerationFooterProps) {
  const currentActionLabel = submitting ? '正在提交' : actionLabel;

  return (
    <footer className="generation-footer">
      {(onReset || showOutput || showRatio) && (
        <div className="generation-footer__settings">
          {onReset && (
            <button className="generation-footer__reset" onClick={onReset} type="button">
              <RotateCcw aria-hidden="true" size={16} />
              <span>重置</span>
            </button>
          )}
          {showOutput && <OutputSelector onChange={onOutputCountChange} value={outputCount} />}
          {showRatio && <AspectRatioControl onChange={onRatioChange} value={ratio} />}
        </div>
      )}

      <div className="generation-footer__estimate">
        <span>预计消耗</span>
        <strong>{estimate} 点</strong>
      </div>

      {disabledReason && <p className="generation-footer__message" role="alert">{disabledReason}</p>}

      <button
        className="generation-footer__run"
        disabled={disabled}
        onClick={onRun}
        ref={primaryRef}
        type="button"
      >
        <span>{currentActionLabel}</span>
        <ArrowUp aria-hidden="true" size={19} strokeWidth={2.2} />
      </button>
    </footer>
  );
}
