import { Button, TextInput } from '@astryxdesign/core';
import * as stylex from '@stylexjs/stylex';
import { useNavigate } from '@tanstack/react-router';
import { SearchIcon } from 'lucide-react';
import type { FormEvent, MouseEvent } from 'react';

import { layoutStyles } from './styles/layout.styles';

interface ResultsHeaderProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export function ResultsHeader({ query, onQueryChange, onSubmit }: ResultsHeaderProps) {
  const navigate = useNavigate();

  const handleBack = (e: MouseEvent) => {
    e.preventDefault();
    void navigate({ to: '/' });
  };

  return (
    <header {...stylex.props(layoutStyles.header)}>
      <a href="/" onClick={handleBack} {...stylex.props(layoutStyles.headerLeft)}>
        <img
          src="/logo.svg"
          alt="OVE Logo"
          width={36}
          height={36}
          style={{ maxHeight: '36px', width: 'auto', objectFit: 'contain' }}
          {...stylex.props(layoutStyles.logoMini)}
        />
        <h1 {...stylex.props(layoutStyles.logoTitle)}>OVE</h1>
      </a>

      <form onSubmit={onSubmit} {...stylex.props(layoutStyles.searchForm)}>
        <div {...stylex.props(layoutStyles.searchBarWrapper)}>
          <TextInput
            type="text"
            label="Tìm kiếm"
            isLabelHidden={true}
            value={query}
            onChange={(val) => onQueryChange(val)}
            placeholder="Nhập từ khóa tìm kiếm..."
            xstyle={layoutStyles.searchBarInput}
          />
        </div>
        <Button
          icon={<SearchIcon size={16} />}
          variant="primary"
          type="submit"
          xstyle={layoutStyles.searchIconButton}
          label={'Tìm'}
        />
      </form>
    </header>
  );
}
