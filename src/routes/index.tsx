import * as stylex from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';

const styles = stylex.create({
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'system-ui, sans-serif',
  },
});

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return <main {...stylex.props(styles.page)}>Portal</main>;
}
