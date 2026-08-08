import { UserPlus, Users } from 'lucide-react';
import React from 'react';
import { SearchInput } from '../SearchInput';
import styles from './ConversationList.module.scss';

export type TabType = 'All' | 'Contacts' | 'Messages' | 'Files';

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
  const TABS: TabType[] = ['All', 'Contacts', 'Messages', 'Files'];

  return (
    <div className={styles.searchHeaderWrapper}>
      <div className={styles.searchContainer}>
        <SearchInput
          value={searchTerm}
          onChange={onSearchChange}
          onClear={() => onSearchChange('')}
          placeholder="Search"
          onFocus={onSearchFocus}
        />
        {!isSearching ? (
          <div className={styles.headerActions}>
            <button className={styles.actionBtn}>
              <UserPlus />
            </button>
            <button className={styles.actionBtn}>
              <Users />
            </button>
          </div>
        ) : (
          <button className={styles.closeSearchBtn} onClick={onSearchClose}>
            Close
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
              {tab}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
