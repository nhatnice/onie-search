import { serve } from 'inngest/nitro';

import { inngest, pageCrawlFunction } from '@/inngest';

export default serve({ client: inngest, functions: [pageCrawlFunction] });
