import * as stylex from '@stylexjs/stylex';
import type React from 'react';

import type { SectionContentItem } from '../../api/services/search-service';
import { resolveFavicon } from './markdown-helpers';
import { analysisStyles } from './styles/analysis.styles';

interface HiddenSourcesDropdownProps {
  hidden: number[];
  contents: SectionContentItem[];
  sectionKey: string;
  onTabChange: (sectionKey: string, index: number) => void;
}

function toggleDisplay(e: React.MouseEvent<HTMLElement>, display: 'flex' | 'none') {
  const el = e.currentTarget.classList.contains('popover')
    ? e.currentTarget
    : e.currentTarget.nextElementSibling instanceof HTMLElement
      ? e.currentTarget.nextElementSibling
      : null;
  if (el) el.style.display = display;
}

export function HiddenSourcesDropdown({
  hidden,
  contents,
  sectionKey,
  onTabChange,
}: HiddenSourcesDropdownProps) {
  if (hidden.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        {...stylex.props(analysisStyles.sourceMoreButton)}
        onMouseEnter={(e) => toggleDisplay(e, 'flex')}
        onMouseLeave={(e) => toggleDisplay(e, 'none')}
      >
        +{hidden.length}
      </button>
      <div
        className="popover"
        {...stylex.props(analysisStyles.sourcePopover)}
        onMouseEnter={(e) => toggleDisplay(e, 'flex')}
        onMouseLeave={(e) => toggleDisplay(e, 'none')}
      >
        {hidden.map((idx) => {
          const item = contents[idx];
          const faviconUrl = item.source.favicon || resolveFavicon(item.source.url);
          return (
            <button
              key={item.source.url + '-' + idx}
              type="button"
              onClick={() => onTabChange(sectionKey, idx)}
              {...stylex.props(analysisStyles.sourcePopoverButton)}
            >
              <img
                src={faviconUrl}
                alt=""
                style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }}
                onError={(e) => {
                  e.currentTarget.src =
                    'https://www.google.com/s2/favicons?domain=example.com&sz=64';
                }}
              />
              <span>{item.source.author || new URL(item.source.url).hostname}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
