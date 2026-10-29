import * as stylex from '@stylexjs/stylex';

import { layoutStyles } from './styles/layout.styles';

export function LoadingSkeleton() {
  return (
    <div {...stylex.props(layoutStyles.loadingContainer)}>
      <div {...stylex.props(layoutStyles.spinnerWrapper)}>
        <img src="/logo.svg" alt="Đang tải..." {...stylex.props(layoutStyles.spinner)} />
        <div {...stylex.props(layoutStyles.spinnerText)}>Đang tìm kiếm...</div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} {...stylex.props(layoutStyles.skeletonCard)}>
          <div {...stylex.props(layoutStyles.skeletonTitle)} />
          <div {...stylex.props(layoutStyles.skeletonTabs)}>
            <div {...stylex.props(layoutStyles.skeletonTab)} />
            <div {...stylex.props(layoutStyles.skeletonTab)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div {...stylex.props(layoutStyles.skeletonTextLine)} />
            <div {...stylex.props(layoutStyles.skeletonTextLine)} />
            <div {...stylex.props(layoutStyles.skeletonTextLineShort)} />
          </div>
        </div>
      ))}
    </div>
  );
}
