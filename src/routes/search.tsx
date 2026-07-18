import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { ResultsView } from '@/features/search/views/ResultsView';

// Schema for parsing route search query parameters
const searchParamsSchema = z.object({
  q: z.string().optional(),
  case: z.string().optional(),
});

export const Route = createFileRoute('/search')({
  validateSearch: searchParamsSchema,
  loaderDeps: ({ search: { q, case: caseNum } }) => ({ q, caseNum }),
  loader: ({ deps: { q, caseNum } }) => {
    return { caseNum: caseNum || null, q: q || null };
  },
  component: ResultsView,
});
