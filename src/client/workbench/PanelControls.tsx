import type { ReactNode, Ref } from 'react';

export const aspectRatios = ['1:1', '4:5', '3:4', '4:3', '16:9', '9:16'];

export function PanelSection({
  children,
  className = '',
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <section className={`panel-section ${className}`.trim()}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}

export function PanelEmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="panel-empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function SegmentedControl({
  label,
  options,
  value,
  onChange,
  className = '',
}: {
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <fieldset className={`panel-segmented ${className}`.trim()}>
      <legend>{label}</legend>
      <div className="panel-segmented__options">
        {options.map((option) => (
          <button
            aria-pressed={option.value === value}
            className={option.value === value ? 'is-active' : ''}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function OutputSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset aria-label="输出数量" className="panel-output-selector">
      <legend>输出</legend>
      <div>
        {[1, 2, 4].map((count) => (
          <button
            aria-pressed={count === value}
            className={count === value ? 'is-active' : ''}
            key={count}
            onClick={() => onChange(count)}
            type="button"
          >
            {count}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function AspectRatioControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="panel-ratio-control">
      <span>比例</span>
      <select aria-label="画面比例" onChange={(event) => onChange(event.target.value)} value={value}>
        {aspectRatios.map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
      </select>
    </label>
  );
}

export function RangeControl({
  inputRef,
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = '',
}: {
  inputRef?: Ref<HTMLInputElement>;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="panel-range-control">
      <span>{label}<output>{value}{suffix}</output></span>
      <input
        aria-label={label}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        ref={inputRef}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

export function SwitchControl({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="panel-switch-control">
      <span>{label}</span>
      <input
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}
