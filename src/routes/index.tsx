import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/Layout';
import * as stylex from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';

import { counterStore, useCount } from '@/lib/counter-store';

const styles = stylex.create({
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const count = useCount();

  return (
    <main {...stylex.props(styles.page)}>
      <VStack gap={2}>
        <Button
          label={`Count: ${count}`}
          onClick={() => counterStore.setState({ count: count + 1 })}
        />
      </VStack>
    </main>
  );
}
