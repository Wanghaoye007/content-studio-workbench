import { Columns3, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Result } from '../domain';
import { getReviewStatusLabel } from './CanvasNodes';

type ResultCompareProps = {
  results: Result[];
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  onInspect: (resultId: string) => void;
  onRemove: (resultId: string) => void;
};

export function ResultCompare({
  results,
  open,
  onClose,
  onOpen,
  onInspect,
  onRemove,
}: ResultCompareProps) {
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (results.length === 0) return null;

  return (
    <>
      <section aria-label="结果对比栏" className="result-compare-tray">
        <div className="result-compare-tray__summary">
          <Columns3 aria-hidden="true" size={16} />
          <strong>结果对比</strong>
          <span>已选 {results.length} / 4</span>
        </div>
        <div className="result-compare-tray__items">
          {results.map((result) => (
            <div key={result.id}>
              <img alt="" src={result.imageUrl} />
              <span>{result.title}</span>
              <button
                aria-label={`从对比移除${result.title}`}
                onClick={() => onRemove(result.id)}
                title="移出对比"
                type="button"
              >
                <X aria-hidden="true" size={13} />
              </button>
            </div>
          ))}
        </div>
        <button className="result-compare-tray__open" disabled={results.length < 2} onClick={onOpen} type="button">
          开始对比
        </button>
      </section>

      {open && (
        <div className="result-dialog-backdrop">
          <section aria-label="结果对比" className="result-compare-dialog" role="dialog">
            <header>
              <div>
                <span>统一视图</span>
                <strong>结果对比</strong>
              </div>
              <label>
                <span>缩放</span>
                <input
                  aria-label="对比缩放"
                  max={200}
                  min={25}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  step={25}
                  type="range"
                  value={zoom}
                />
                <output>{zoom}%</output>
              </label>
              <button aria-label="关闭结果对比" onClick={onClose} title="关闭" type="button">
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <div className="result-compare-grid" data-count={results.length}>
              {results.map((result) => (
                <article key={result.id}>
                  <div className="result-compare-grid__viewport">
                    <img
                      alt={result.title}
                      src={result.imageUrl}
                      style={{ width: `${zoom}%` }}
                    />
                  </div>
                  <footer>
                    <div>
                      <strong>{result.title}</strong>
                      <span>{getReviewStatusLabel(result.reviewStatus)}</span>
                    </div>
                    <div className="result-compare-grid__states">
                      {result.isAdopted && <span>已采用</span>}
                      {result.isPrimary && <span>主结果</span>}
                    </div>
                    <button
                      aria-label={`查看${result.title}详情`}
                      onClick={() => onInspect(result.id)}
                      title="查看详情"
                      type="button"
                    >
                      <Info aria-hidden="true" size={16} />
                    </button>
                    <button
                      aria-label={`从对比移除${result.title}`}
                      onClick={() => onRemove(result.id)}
                      title="移出对比"
                      type="button"
                    >
                      <X aria-hidden="true" size={16} />
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

