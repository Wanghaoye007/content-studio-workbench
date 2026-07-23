import { X } from 'lucide-react';
import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';

type ToolPanelShellProps = {
  ariaLabel: string;
  body: ReactNode;
  eyebrow: string;
  footer: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  overlay?: ReactNode;
  placement?: 'left' | 'right';
  title: string;
  toolId: string;
  onClose: () => void;
  onEscape?: () => void;
};

export function ToolPanelShell({
  ariaLabel,
  body,
  eyebrow,
  footer,
  initialFocusRef,
  overlay,
  placement = 'right',
  title,
  toolId,
  onClose,
  onEscape,
}: ToolPanelShellProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const explicitTarget = initialFocusRef?.current;
    const bodyTarget = panelRef.current?.querySelector<HTMLElement>(
      '.tool-panel__body button:not([disabled]), .tool-panel__body input:not([disabled]), .tool-panel__body select:not([disabled]), .tool-panel__body textarea:not([disabled])',
    );
    (explicitTarget ?? bodyTarget)?.focus();
  }, [initialFocusRef]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    (onEscape ?? onClose)();
  };

  return (
    <section
      aria-label={ariaLabel}
      className="tool-panel"
      data-placement={placement}
      data-tool={toolId}
      onKeyDown={handleKeyDown}
      ref={panelRef}
      role="dialog"
    >
      <header className="tool-panel__header" data-panel-region="header">
        <div className="tool-panel__heading">
          <small>{eyebrow}</small>
          <strong>{title}</strong>
        </div>
        <button
          aria-label="关闭参数面板"
          className="tool-panel__close"
          onClick={onClose}
          title="关闭参数面板"
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      <div className="tool-panel__body" data-panel-region="body">
        {body}
      </div>

      <div className="tool-panel__footer" data-panel-region="footer">
        {footer}
      </div>

      {overlay}
    </section>
  );
}
