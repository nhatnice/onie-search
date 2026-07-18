import { TextInput, Button } from '@astryxdesign/core';
import * as stylex from '@stylexjs/stylex';
import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';

import { SearchContainer } from '../components/SearchContainer';

const styles = stylex.create({
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fbfbfd',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  logoSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '2.5rem',
  },
  logoImage: {
    maxHeight: '64px',
    width: 'auto',
    borderRadius: '12px',
    marginBottom: '1.25rem',
    objectFit: 'contain',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
  },
  logoText: {
    fontSize: '2.25rem',
    fontWeight: '700',
    letterSpacing: '-0.02em',
    color: '#1d1d1f',
    margin: 0,
  },
  logoSubtext: {
    fontSize: '1rem',
    color: '#86868b',
    marginTop: '0.5rem',
    fontWeight: '400',
  },
  searchBarInput: {
    width: '100%',
  },
  searchForm: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  inputRow: {
    width: '100%',
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
  },
  quickSearchSection: {
    marginTop: '3rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    width: '100%',
  },
  quickSearchTitle: {
    fontSize: '0.8125rem',
    fontWeight: '500',
    color: '#86868b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  quickButtonsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '0.625rem',
  },
  quickButton: {
    borderRadius: '9999px',
  },
});

export function SearchView() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      void navigate({
        to: '/search',
        search: { q: query.trim() },
      });
    }
  };

  const handleQuickSearch = (caseNum: number) => {
    void navigate({
      to: '/search',
      search: { case: String(caseNum) },
    });
  };

  return (
    <main {...stylex.props(styles.page)}>
      <SearchContainer>
        <div {...stylex.props(styles.logoSection)}>
          <img
            src="/logo.png"
            alt="Portal Logo"
            width={64}
            height={64}
            style={{ maxHeight: '64px', width: 'auto', objectFit: 'contain' }}
            {...stylex.props(styles.logoImage)}
          />
          <h1 {...stylex.props(styles.logoText)}>PORTAL</h1>
          <span {...stylex.props(styles.logoSubtext)}>
            Tìm kiếm thông tin thị trường thông minh
          </span>
        </div>

        <form onSubmit={handleSubmit} {...stylex.props(styles.searchForm)}>
          <div {...stylex.props(styles.inputRow)}>
            <div style={{ flex: 1 }}>
              <TextInput
                label="Tìm kiếm"
                isLabelHidden={true}
                placeholder="Nhập từ khóa tìm kiếm..."
                value={query}
                onChange={(val) => setQuery(val)}
                size="lg"
                xstyle={styles.searchBarInput}
              />
            </div>
            <Button label="Tìm kiếm" variant="primary" type="submit" size="lg" />
          </div>
        </form>

        <div {...stylex.props(styles.quickSearchSection)}>
          <span {...stylex.props(styles.quickSearchTitle)}>Tìm nhanh case demo</span>
          <div {...stylex.props(styles.quickButtonsContainer)}>
            <Button
              label="Case 1: Thị trường kim cương"
              variant="secondary"
              onClick={() => handleQuickSearch(1)}
              xstyle={styles.quickButton}
            />
            <Button
              label="Case 2: Giá vàng biến động"
              variant="secondary"
              onClick={() => handleQuickSearch(2)}
              xstyle={styles.quickButton}
            />
            <Button
              label="Case 3: Dự báo công nghệ AI"
              variant="secondary"
              onClick={() => handleQuickSearch(3)}
              xstyle={styles.quickButton}
            />
          </div>
        </div>
      </SearchContainer>
    </main>
  );
}
