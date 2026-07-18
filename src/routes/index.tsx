import { createFileRoute } from '@tanstack/react-router';

import { SearchView } from '@/features/search';

export const Route = createFileRoute('/')({
  component: SearchView,
});
