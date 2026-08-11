import { Users } from 'lucide-react';
import React from 'react';
import { SearchInput } from '../SearchInput';
import { useTranslation } from 'react-i18next';
import styles from './ConversationList.module.scss';

export type TabType = 'All' | 'Contacts' | 'Conversation';

export interface ConversationListHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isSearching: boolean;
  onSearchFocus: () => void;
  onSearchClose: () => void;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const ConversationListHeader: React.FC<ConversationListHeaderProps> = ({
  searchTerm,
  onSearchChange,
  isSearching,
  onSearchFocus,
  onSearchClose,
  activeTab,
  onTabChange,
}) => {
  const { t } = useTranslation();
  const TABS: TabType[] = ['All', 'Contacts', 'Conversation'];

  return (
    <div className={styles.searchHeaderWrapper}>
      <div className={styles.searchContainer}>
        <SearchInput
          value={searchTerm}
          onChange={onSearchChange}
          onClear={() => onSearchChange('')}
          placeholder={t('chat.search')}
          onFocus={onSearchFocus}
        />
        {!isSearching ? (
          <div className={styles.headerActions}>
            <button className={styles.actionBtn}>
              <Users />
            </button>
          </div>
        ) : (
          <button className={styles.closeSearchBtn} onClick={onSearchClose}>
            {t('chat.close')}
          </button>
        )}
      </div>
      {isSearching && searchTerm.trim() !== '' && (
        <div className={styles.searchTabs}>
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.active : ''}`}
              onClick={() => onTabChange(tab)}
            >
              {t(`chat.tabs.${tab.toLowerCase()}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
