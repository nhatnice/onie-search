import * as stylex from '@stylexjs/stylex';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

const styles = stylex.create({
  button: {
    padding: '0.875rem 1.75rem',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '9999px',
    cursor: 'pointer',
    transitionProperty: 'background-color, transform, box-shadow',
    transitionDuration: '150ms',
    boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1), 0 2px 4px -1px rgba(59, 130, 246, 0.06)',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    ':hover': {
      backgroundColor: '#2563eb',
      transform: 'translateY(-1px)',
      boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2), 0 4px 6px -2px rgba(59, 130, 246, 0.1)',
    },
    ':active': {
      backgroundColor: '#1d4ed8',
      transform: 'translateY(0)',
    },
    ':disabled': {
      backgroundColor: '#9ca3af',
      cursor: 'not-allowed',
      transform: 'none',
      boxShadow: 'none',
    },
  },
});

interface SearchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function SearchButton({ children, ...props }: SearchButtonProps) {
  return (
    <button {...props} {...stylex.props(styles.button)}>
      {children}
    </button>
  );
}
