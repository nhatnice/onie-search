import * as stylex from '@stylexjs/stylex';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

const styles = stylex.create({
  button: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    color: '#4b5563',
    backgroundColor: '#f3f4f6',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    borderRadius: '9999px',
    cursor: 'pointer',
    transitionProperty: 'background-color, border-color, color, transform',
    transitionDuration: '150ms',
    boxSizing: 'border-box',
    ':hover': {
      backgroundColor: '#eff6ff',
      borderColor: '#bfdbfe',
      color: '#2563eb',
      transform: 'translateY(-1px)',
    },
    ':active': {
      transform: 'translateY(0)',
    },
  },
});

interface QuickSearchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function QuickSearchButton({ children, ...props }: QuickSearchButtonProps) {
  return (
    <button {...props} {...stylex.props(styles.button)}>
      {children}
    </button>
  );
}
