import { forwardRef, useEffect, useRef, useState } from 'react';
import { Input, type InputProps } from './input';

type NumericInputBaseProps = Omit<InputProps, 'onChange' | 'type' | 'value' | 'defaultValue'> & {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (value: string) => void;
};

type DecimalListInputProps = Omit<InputProps, 'onChange' | 'type' | 'value' | 'defaultValue'> & {
  defaultValue?: string | number;
  fallbackValue?: string;
  onChange?: (value: string) => void;
  onValuesChange?: (values: number[]) => void;
  parseValues?: (value: string) => number[];
  formatValues?: (values: number[]) => string;
};

function restoreInputSelection(input: HTMLInputElement, start: number, end = start) {
  window.requestAnimationFrame(() => {
    if (document.activeElement !== input) return;
    const length = input.value.length;
    input.setSelectionRange(Math.min(start, length), Math.min(end, length));
  });
}

function normalizeDecimalText(value: unknown) {
  return String(value ?? '')
    .replace(/[。．｡，]/g, '.')
    .replace(/[﹣－–—]/g, '-')
    .replace(/[＋]/g, '+')
    .replace(/\s+/g, '');
}

function normalizeDecimalInput(value: unknown) {
  const text = normalizeDecimalText(value);
  let seenDot = false;
  return Array.from(text).filter(char => {
    if (char !== '.') return true;
    if (seenDot) return false;
    seenDot = true;
    return true;
  }).join('');
}

function formatDecimalInput(value: unknown) {
  const normalized = normalizeDecimalInput(value);
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? String(parsed) : '';
}

function normalizeIntegerInput(value: unknown) {
  return String(value ?? '').replace(/\D+/g, '').replace(/^0+/, '');
}

function normalizeDecimalListSegment(value: string) {
  const withInferredBreaks = value
    .replace(/\.{2,}/g, '.')
    .replace(/(\d*\.)(?=(?:0|1)\.)/g, '$1,')
    .replace(/(\d*\.\d+)(?=(?:0|1)\.)/g, '$1,');
  return withInferredBreaks
    .split(',')
    .map(normalizeDecimalInput)
    .join(',');
}

function normalizeDecimalListInput(value: unknown) {
  return String(value ?? '')
    .replace(/[。．｡]/g, '.')
    .replace(/，/g, ',')
    .replace(/[﹣－–—]/g, '-')
    .replace(/[＋]/g, '+')
    .split(/([,\s]+)/)
    .map(part => (/^[,\s]+$/.test(part) ? part : normalizeDecimalListSegment(part)))
    .join('');
}

const DecimalInput = forwardRef<HTMLInputElement, NumericInputBaseProps>(function DecimalInput(
  { value = '', onChange, onBlur, onFocus, readOnly, ...props },
  ref
) {
  const displayValue = String(value ?? '');
  const [draftValue, setDraftValue] = useState(displayValue);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraftValue(displayValue);
  }, [displayValue, editing]);

  return (
    <Input
      {...props}
      ref={ref}
      inputMode="decimal"
      autoComplete={props.autoComplete || 'off'}
      readOnly={readOnly}
      value={draftValue}
      onFocus={event => {
        if (!readOnly) setEditing(true);
        onFocus?.(event);
      }}
      onBlur={event => {
        setEditing(false);
        if (!readOnly) {
          const nextValue = formatDecimalInput(draftValue);
          setDraftValue(nextValue);
          onChange?.(nextValue);
        }
        onBlur?.(event);
      }}
      onChange={event => {
        const input = event.currentTarget;
        const rawValue = input.value;
        const selectionStart = input.selectionStart ?? rawValue.length;
        const selectionEnd = input.selectionEnd ?? selectionStart;
        const nextValue = normalizeDecimalInput(rawValue);
        const nextSelectionStart = normalizeDecimalInput(rawValue.slice(0, selectionStart)).length;
        const nextSelectionEnd = normalizeDecimalInput(rawValue.slice(0, selectionEnd)).length;
        setDraftValue(nextValue);
        onChange?.(nextValue);
        restoreInputSelection(input, nextSelectionStart, nextSelectionEnd);
      }}
    />
  );
});

const IntegerInput = forwardRef<HTMLInputElement, NumericInputBaseProps>(function IntegerInput(
  { value = '', onChange, onBlur, onFocus, readOnly, ...props },
  ref
) {
  const displayValue = String(value ?? '');
  const [draftValue, setDraftValue] = useState(displayValue);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraftValue(displayValue);
  }, [displayValue, editing]);

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete={props.autoComplete || 'off'}
      readOnly={readOnly}
      value={draftValue}
      onFocus={event => {
        if (!readOnly) setEditing(true);
        onFocus?.(event);
      }}
      onBlur={event => {
        setEditing(false);
        if (!readOnly) {
          const nextValue = normalizeIntegerInput(draftValue);
          setDraftValue(nextValue);
          onChange?.(nextValue);
        }
        onBlur?.(event);
      }}
      onChange={event => {
        const input = event.currentTarget;
        const rawValue = input.value;
        const selectionStart = input.selectionStart ?? rawValue.length;
        const selectionEnd = input.selectionEnd ?? selectionStart;
        const nextValue = normalizeIntegerInput(rawValue);
        const nextSelectionStart = normalizeIntegerInput(rawValue.slice(0, selectionStart)).length;
        const nextSelectionEnd = normalizeIntegerInput(rawValue.slice(0, selectionEnd)).length;
        setDraftValue(nextValue);
        onChange?.(nextValue);
        restoreInputSelection(input, nextSelectionStart, nextSelectionEnd);
      }}
    />
  );
});

const DecimalListInput = forwardRef<HTMLInputElement, DecimalListInputProps>(function DecimalListInput(
  {
    defaultValue = '',
    fallbackValue = '',
    formatValues,
    onBlur,
    onChange,
    onFocus,
    onValuesChange,
    parseValues,
    readOnly,
    ...props
  },
  forwardedRef
) {
  const localRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState(false);

  function setInputRef(input: HTMLInputElement | null) {
    localRef.current = input;
    if (typeof forwardedRef === 'function') {
      forwardedRef(input);
    } else if (forwardedRef) {
      forwardedRef.current = input;
    }
  }

  useEffect(() => {
    if (editing || !localRef.current) return;
    localRef.current.value = String(defaultValue ?? '');
  }, [defaultValue, editing]);

  function notifyValues(value: string) {
    const values = parseValues?.(value) || [];
    if (values.length) onValuesChange?.(values);
    return values;
  }

  return (
    <Input
      {...props}
      ref={setInputRef}
      type="text"
      inputMode="decimal"
      autoComplete={props.autoComplete || 'off'}
      readOnly={readOnly}
      defaultValue={String(defaultValue ?? '')}
      onFocus={event => {
        if (!readOnly) setEditing(true);
        onFocus?.(event);
      }}
      onBlur={event => {
        const input = event.currentTarget;
        const values = notifyValues(input.value);
        input.value = values.length && formatValues ? formatValues(values) : fallbackValue || String(defaultValue ?? '');
        setEditing(false);
        onBlur?.(event);
      }}
      onChange={event => {
        const input = event.currentTarget;
        const rawValue = input.value;
        const selectionStart = input.selectionStart ?? rawValue.length;
        const selectionEnd = input.selectionEnd ?? selectionStart;
        const normalized = normalizeDecimalListInput(rawValue);
        const nextSelectionStart = normalizeDecimalListInput(rawValue.slice(0, selectionStart)).length;
        const nextSelectionEnd = normalizeDecimalListInput(rawValue.slice(0, selectionEnd)).length;
        if (input.value !== normalized) input.value = normalized;
        input.setSelectionRange(Math.min(nextSelectionStart, input.value.length), Math.min(nextSelectionEnd, input.value.length));
        onChange?.(normalized);
        notifyValues(normalized);
      }}
    />
  );
});

export {
  DecimalInput,
  DecimalListInput,
  IntegerInput,
  formatDecimalInput,
  normalizeDecimalInput,
  normalizeDecimalListInput,
  normalizeDecimalText,
  normalizeIntegerInput,
  restoreInputSelection
};
export type { DecimalListInputProps, NumericInputBaseProps };
