import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useContactSearch } from '../../hooks/useContactSearch';
import { useConversations } from '../../hooks/useConversations';
import { useDebounce } from '../../hooks/useDebounce';
import { useVirtualScroll } from '../../hooks/useVirtualScroll';
import { useChatStore } from '../../store/chatStore';
import { useTranslation } from 'react-i18next';

import type { Contact, Conversation } from '../../types';
import { EmptyState } from '../EmptyState';
import { ConversationListHeader, TabType } from './ConversationListHeader';
import { ConversationSearchResults } from './ConversationSearchResults';
import { ContactItem } from './ContactItem';
import { ConversationItem } from './ConversationItem';
import { SectionHeader } from './SectionHeader';
import styles from './ConversationList.module.scss';

const CONVERSATION_ITEM_HEIGHT = 72;
const CONTAINER_HEIGHT = 1200; // Increased for safe virtual scroll calculation on tall screens

export interface ConversationListProps {
  conversations?: Conversation[];
  activeId?: string;
  onSelect?: (id: string, contact?: Contact) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  renderItem?: (conversation: Conversation, isActive: boolean) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderSearch?: () => ReactNode;
}

export const ConversationList: React.FC<ConversationListProps> = React.memo((props) => {
  const { t } = useTranslation();

  // Use hook to get default values if props are not provided
  const store = useConversations();

  const conversations = props.conversations ?? store.conversations;
  const activeId = props.activeId ?? store.activeConversation?.id;
  const onSelect = props.onSelect ?? store.openConversation;
  const onLoadMore = props.onLoadMore ?? store.loadMore;
  const hasMore = props.hasMore ?? store.hasMore;
  const loading = props.loading ?? (store.loading || store.loadingMore);
  const connectionState = useChatStore((state) => state.connectionState);

  useEffect(() => {
    if (
      connectionState === 'connected' &&
      !props.conversations &&
      store.conversations.length === 0 &&
      !store.loading &&
      store.hasMore
    ) {
      store.loadConversations();
    }
  }, [
    connectionState,
    props.conversations,
    store.conversations.length,
    store.loading,
    store.hasMore,
    store.loadConversations,
    store,
  ]);

  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchTerm) return conversations;

    return conversations.filter((conv) => {
      const isGroup = conv.type === 'group';
      const name = isGroup
        ? conv.name
        : conv.otherParticipant.displayName || conv.otherParticipant.id;

      return name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [conversations, searchTerm]);

  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('All');
  const [recentSearches, setRecentSearches] = useState<Contact[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('recentSearches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to parse recent searches', e);
    }
  }, []);

  const saveRecentSearch = (contact: Contact) => {
    const newRecent = [contact, ...recentSearches.filter((c) => c.id !== contact.id)].slice(0, 10);
    setRecentSearches(newRecent);
    localStorage.setItem('recentSearches', JSON.stringify(newRecent));
  };

  const handleContactSelect = (id: string) => {
    // Prevent activating if we are already in the direct conversation with this contact
    const currentActiveConv = conversations.find(c => c.id === activeId);
    if (currentActiveConv?.type === 'direct' && currentActiveConv.otherParticipant?.id === id) {
      return;
    }

    const contact = allContacts.find((c) => c.id === id) || recentSearches.find((c) => c.id === id);
    if (contact) {
      saveRecentSearch(contact);
    }
    if (onSelect) {
      onSelect(id, contact);
    }
  };

  const { contacts, loading: contactsLoading, search: searchContacts } = useContactSearch();
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (isSearching) {
      searchContacts(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, isSearching, searchContacts]);

  const globalContacts = useMemo(() => {
    return contacts;
  }, [contacts]);

  const allContacts = useMemo<Contact[]>(() => {
    return globalContacts;
  }, [globalContacts]);

  const handleSearchFocus = () => {
    setIsSearching(true);
  };

  const handleSearchClose = () => {
    setIsSearching(false);
    setSearchTerm('');
    setActiveTab('All');
  };

  const defaultRenderEmpty = () => (
    <EmptyState
      type="no-conversations"
      message={t('chat.noConversationsFound')}
      className={styles.emptyState}
    />
  );

  const { virtualItems, totalHeight, scrollElementRef, handleScroll } = useVirtualScroll({
    itemCount: filteredConversations.length,
    itemHeight: CONVERSATION_ITEM_HEIGHT,
    containerHeight: CONTAINER_HEIGHT,
    overscan: 5,
  });

  const handleConversationEndReached = useCallback(() => {
    if (hasMore && !loading && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, loading, onLoadMore]);

  const handleConversationScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      handleScroll(e);

      const target = e.currentTarget;
      if (target.scrollHeight - target.scrollTop - target.clientHeight < 100) {
        handleConversationEndReached();
      }
    },
    [handleScroll, handleConversationEndReached]
  );

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  return (
    <div className={styles.conversationList}>
      {props.renderSearch ? (
        props.renderSearch()
      ) : (
        <ConversationListHeader
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          isSearching={isSearching}
          onSearchFocus={handleSearchFocus}
          onSearchClose={handleSearchClose}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}

      <div className={styles.listViewport}>
        {!isSearching &&
          filteredConversations.length === 0 &&
          !loading &&
          !hasMore &&
          (props.renderEmpty ? props.renderEmpty() : defaultRenderEmpty())}

        {!isSearching && filteredConversations.length > 0 && (
          <div
            ref={scrollElementRef}
            onScroll={handleConversationScroll}
            className={styles.virtualList}
            style={{
              height: '100%',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            <div style={{ height: totalHeight, position: 'relative' }}>
              {virtualItems.map((virtualItem) => {
                const conv = filteredConversations[virtualItem.index];
                return (
                  <div
                    key={conv.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: virtualItem.size,
                      transform: `translateY(${virtualItem.start}px)`,
                      zIndex: openDropdownId === conv.id ? 20 : 1,
                    }}
                  >
                    {props.renderItem ? (
                      props.renderItem(conv, conv.id === activeId)
                    ) : (
                      <ConversationItem
                        conversation={conv}
                        isActive={conv.id === activeId}
                        onClick={() => {
                          if (conv.id === activeId) return;
                          if (onSelect) onSelect(conv.id);
                        }}
                        isDropdownOpen={openDropdownId === conv.id}
                        onDropdownOpenChange={(isOpen) =>
                          setOpenDropdownId(isOpen ? conv.id : null)
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isSearching && !searchTerm.trim() && (
          <div className={styles.recentSearchContainer}>
            <SectionHeader style={{ fontSize: '15px', padding: '16px 12px 8px' }}>
              {t('chat.recentSearch')}
            </SectionHeader>
            {recentSearches.length > 0 ? (
              recentSearches.map((contact) => (
                <ContactItem
                  key={contact.id}
                  contact={contact}
                  onClick={() => handleContactSelect(contact.id)}
                />
              ))
            ) : (
              <div className={styles.emptyState}>{t('chat.noRecentSearches')}</div>
            )}
          </div>
        )}

        {isSearching && !!searchTerm.trim() && (
          <ConversationSearchResults
            isSearching={isSearching}
            activeTab={activeTab}
            contacts={allContacts}
            contactsLoading={contactsLoading}
            onContactSelect={handleContactSelect}
            onSeeAllContacts={() => setActiveTab('Contacts')}
          />
        )}

        {(loading || (!isSearching && filteredConversations.length === 0 && hasMore)) && (
          <div style={{ padding: 16, textAlign: 'center', color: '#667781', fontSize: 13 }}>
            {t('chat.loading')}
          </div>
        )}
      </div>
    </div>
  );
});

export * from './ContactItem';
export * from './ConversationItem';
export * from './ConversationListHeader';
export * from './ConversationSearchResults';
