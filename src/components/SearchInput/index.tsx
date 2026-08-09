import React from 'react';
import styles from './SearchInput.module.scss';
import { Search, CircleX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onClear?: () => void;
  autoFocus?: boolean;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

export const SearchInput: React.FC<SearchInputProps> = React.memo(({
  value,
  onChange,
  placeholder,
  className = '',
  onClear,
  autoFocus,
  onFocus,
  onBlur,
}) => {
  const { t } = useTranslation();
  return (
    <div className={`${styles.searchContainer} ${className}`}>
      <Search className={styles.searchIcon} />
      <input
        type="text"
        className={styles.searchInput}
        placeholder={placeholder || t('chat.search')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {value && onClear && (
        <button className={styles.clearBtn} onClick={onClear} aria-label="Clear">
          <CircleX className={styles.clearIcon} />
        </button>
      )}
    </div>
  );
});
