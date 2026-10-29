import * as stylex from '@stylexjs/stylex';

import type { SearchResultItem } from '../../api/services/search-service';
import { resolveFavicon } from './markdown-helpers';
import { googleStyles } from './styles/google.styles';
import { layoutStyles } from './styles/layout.styles';

interface GoogleResultsListProps {
  results: SearchResultItem[] | undefined;
}

export function GoogleResultsList({ results }: GoogleResultsListProps) {
  if (!results || results.length === 0) {
    return (
      <div {...stylex.props(layoutStyles.noResults)}>
        Không có kết quả tìm kiếm tiêu chuẩn liên quan.
      </div>
    );
  }

  return (
    <section {...stylex.props(googleStyles.googleResultsContainer)}>
      <h3 {...stylex.props(googleStyles.googleTitle)}>Kết quả tìm kiếm liên quan</h3>
      <div {...stylex.props(googleStyles.googleList)}>
        {results.map((item) => {
          const displayAuthor = item.author || new URL(item.url).hostname;
          const faviconUrl = resolveFavicon(item.url);

          return (
            <article key={item.id} {...stylex.props(googleStyles.googleItem)}>
              <div {...stylex.props(googleStyles.googleItemHeader)}>
                <img
                  src={faviconUrl}
                  alt=""
                  {...stylex.props(googleStyles.googleItemFavicon)}
                  onError={(e) => {
                    e.currentTarget.src =
                      'https://www.google.com/s2/favicons?domain=example.com&sz=64';
                  }}
                />
                <span>{displayAuthor}</span>
                {item.publishedDate && (
                  <span>&bull; {new Date(item.publishedDate).toLocaleDateString()}</span>
                )}
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                {...stylex.props(googleStyles.googleItemTitle)}
              >
                {item.title || item.url}
              </a>
              {item.text && (
                <p {...stylex.props(googleStyles.googleItemSnippet)}>
                  {item.text.length > 250 ? item.text.substring(0, 250) + '...' : item.text}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
