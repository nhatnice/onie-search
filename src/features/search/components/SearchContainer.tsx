import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '640px',
    padding: '2rem',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
});

interface SearchContainerProps {
  children: ReactNode;
}

export function SearchContainer({ children }: SearchContainerProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '640px',
        padding: '2rem',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
      {...stylex.props(styles.container)}
    >
      {children}
    </div>
  );
}
