import { Dialog, Layout, LayoutContent, Markdown } from '@astryxdesign/core';
import * as stylex from '@stylexjs/stylex';
import { ExternalLinkIcon, XIcon } from 'lucide-react';

import { getHighlightedMarkdown, highlightPlugin } from './markdown-helpers';
import { layoutStyles } from './styles/layout.styles';

export interface DrawerData {
  author?: string;
  favicon: string;
  title: string;
  url: string;
  content: string;
  fullText: string;
}

interface SourceDetailDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: DrawerData | null;
}

function DrawerHeader({ data, onClose }: { data: DrawerData | null; onClose: () => void }) {
  return (
    <div
      style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
      }}
    >
      <div style={{ maxWidth: '85%' }}>
        <h2
          style={{
            fontSize: '1.125rem',
            fontWeight: '700',
            color: '#1d1d1f',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data?.title || 'Nội dung gốc'}
        </h2>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '6px',
            fontSize: '0.8125rem',
            color: '#86868b',
          }}
        >
          <img
            src={data?.favicon}
            alt=""
            style={{ width: '16px', height: '16px', borderRadius: '2px' }}
            onError={(e) => {
              e.currentTarget.src = 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
            }}
          />
          <a
            href={data?.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#0066cc',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {data?.author || (data?.url ? new URL(data.url).hostname : '')}
            <ExternalLinkIcon size={12} />
          </a>
        </div>
      </div>
      <button onClick={onClose} {...stylex.props(layoutStyles.drawerCloseButton)}>
        <XIcon size={16} />
      </button>
    </div>
  );
}

function DrawerBody({ data }: { data: DrawerData | null }) {
  return (
    <LayoutContent xstyle={layoutStyles.drawerLayoutContent}>
      <div
        style={{
          padding: '1.75rem',
          color: '#333333',
          fontSize: '0.9375rem',
          lineHeight: '1.7',
          whiteSpace: 'pre-wrap',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {data && (
          <Markdown inlinePlugins={[highlightPlugin]}>
            {getHighlightedMarkdown(data.fullText, data.content)}
          </Markdown>
        )}
      </div>
    </LayoutContent>
  );
}

export function SourceDetailDialog({ isOpen, onOpenChange, data }: SourceDetailDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      position={{ right: 0, top: 0, bottom: 0 }}
      width={540}
      maxHeight="100vh"
      padding={0}
    >
      <Layout
        header={<DrawerHeader data={data} onClose={() => onOpenChange(false)} />}
        content={<DrawerBody data={data} />}
      />
    </Dialog>
  );
}
