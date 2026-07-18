import * as stylex from '@stylexjs/stylex';
import type { InputHTMLAttributes } from 'react';

const styles = stylex.create({
  inputWrapper: {
    width: '100%',
    position: 'relative',
  },
  input: {
    width: '100%',
    padding: '0.875rem 1.25rem',
    fontSize: '1rem',
    lineHeight: '1.5',
    color: '#1f2937',
    backgroundColor: '#ffffff',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d1d5db',
    borderRadius: '9999px',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    transitionProperty: 'border-color, box-shadow',
    transitionDuration: '150ms',
    outline: 'none',
    boxSizing: 'border-box',
    ':focus': {
      borderColor: '#3b82f6',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15)',
    },
  },
});

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function SearchInput({ ...props }: SearchInputProps) {
  return (
    <div {...stylex.props(styles.inputWrapper)}>
      <input {...props} {...stylex.props(styles.input)} />
    </div>
  );
}
