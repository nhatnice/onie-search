import { TextInput, Button } from '@astryxdesign/core';
import * as stylex from '@stylexjs/stylex';
import { useNavigate } from '@tanstack/react-router';
import { SearchIcon } from 'lucide-react';
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
    objectFit: 'contain',
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
  searchIconButton: {
    padding: '0.5rem',
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

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fbfbfd',
      }}
      {...stylex.props(styles.page)}
    >
      <SearchContainer>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '2.5rem',
          }}
          {...stylex.props(styles.logoSection)}
        >
          <img
            src="/logo.svg"
            alt="OVE Logo"
            width={64}
            height={64}
            style={{ maxHeight: '64px', width: 'auto', objectFit: 'contain' }}
            {...stylex.props(styles.logoImage)}
          />
          <span {...stylex.props(styles.logoSubtext)}>Search everything. Own your universe.</span>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
          {...stylex.props(styles.searchForm)}
        >
          <div
            style={{
              width: '100%',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
            }}
            {...stylex.props(styles.inputRow)}
          >
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
            <Button
              icon={<SearchIcon size={20} />}
              variant="primary"
              type="submit"
              size="lg"
              xstyle={styles.searchIconButton}
              label={''}
            />
          </div>
        </form>
      </SearchContainer>
    </main>
  );
}
