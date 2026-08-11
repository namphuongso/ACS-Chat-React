import React, { useState } from 'react';
import { useVirtualScroll } from '../../hooks/useVirtualScroll';
import type { Contact, Conversation } from '../../types';
import { ContactItem } from './ContactItem';
import { ConversationItem } from './ConversationItem';
import { SectionHeader } from './SectionHeader';
import { useTranslation } from 'react-i18next';
import styles from './ConversationList.module.scss';

const MAX_CONTACTS_ALL_TAB = 7;
const MAX_CONVERSATIONS_ALL_TAB = 7;
const CONTACT_ITEM_HEIGHT = 64;
const CONVERSATION_ITEM_HEIGHT = 72;
const CONTAINER_HEIGHT = 1200;

export interface ConversationSearchResultsProps {
  isSearching: boolean;
  activeTab: 'All' | 'Contacts' | 'Conversation';
  contacts: Contact[];
  contactsLoading: boolean;
  conversations: Conversation[];
  conversationsLoading: boolean;
  onContactSelect: (id: string) => void;
  onSeeAllContacts: () => void;
  onConversationSelect: (id: string) => void;
  onSeeAllConversations: () => void;
}

export const ConversationSearchResults: React.FC<ConversationSearchResultsProps> = ({
  isSearching,
  activeTab,
  contacts,
  contactsLoading,
  conversations,
  conversationsLoading,
  onContactSelect,
  onSeeAllContacts,
  onConversationSelect,
  onSeeAllConversations,
}) => {
  const { t } = useTranslation();
  const isContactsOnlyTab = activeTab === 'Contacts';
  const isConversationsOnlyTab = activeTab === 'Conversation';
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const { virtualItems: virtualContacts, totalHeight: contactsTotalHeight, scrollElementRef: contactsScrollRef, handleScroll: handleContactsScroll } = useVirtualScroll({
    itemCount: contacts.length,
    itemHeight: CONTACT_ITEM_HEIGHT,
    containerHeight: CONTAINER_HEIGHT,
    overscan: 5,
  });

  const { virtualItems: virtualConversations, totalHeight: conversationsTotalHeight, scrollElementRef: conversationsScrollRef, handleScroll: handleConversationsScroll } = useVirtualScroll({
    itemCount: conversations.length,
    itemHeight: CONVERSATION_ITEM_HEIGHT,
    containerHeight: CONTAINER_HEIGHT,
    overscan: 5,
  });

  return (
    <div
      className={`${styles.resultsContainer} ${
        isContactsOnlyTab || isConversationsOnlyTab ? styles.resultsContainerVirtual : styles.resultsContainerScrollable
      }`}
    >
      {/* Contacts Section */}
      {(activeTab === 'All' || activeTab === 'Contacts') && (
        <>
          {isSearching && (
            <SectionHeader>
              {t('chat.tabs.contacts')} ({contacts.length}){' '}
              {contactsLoading && <span className={styles.loadingText}>{t('chat.loading')}</span>}
            </SectionHeader>
          )}
          {contacts.length > 0 ? (
            activeTab === 'All' ? (
              contacts
                .slice(0, MAX_CONTACTS_ALL_TAB)
                .map((contact) => (
                  <ContactItem
                    key={contact.id}
                    contact={contact}
                    onClick={() => onContactSelect(contact.id)}
                  />
                ))
            ) : (
              <div
                ref={contactsScrollRef}
                onScroll={handleContactsScroll}
                className={styles.virtualList}
                style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}
              >
                <div style={{ height: contactsTotalHeight, position: 'relative' }}>
                  {virtualContacts.map((virtualItem) => {
                    const contact = contacts[virtualItem.index];
                    return (
                      <div
                        key={contact.id}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: virtualItem.size,
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        <ContactItem
                          contact={contact}
                          onClick={() => onContactSelect(contact.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ) : (
            isSearching && !contactsLoading && <div className={styles.emptyState}>{t('chat.noContactsFound')}</div>
          )}
          {isSearching && activeTab === 'All' && contacts.length > MAX_CONTACTS_ALL_TAB && (
            <div className={styles.seeAllContainer}>
              <button className={styles.seeAllBtn} onClick={onSeeAllContacts}>
                {t('chat.seeAllContacts')}
              </button>
            </div>
          )}
        </>
      )}

      {/* Conversation Section */}
      {(activeTab === 'All' || activeTab === 'Conversation') && (
        <>
          {isSearching && (
            <SectionHeader>
              {t('chat.tabs.conversation')} ({conversations.length}){' '}
              {conversationsLoading && <span className={styles.loadingText}>{t('chat.loading')}</span>}
            </SectionHeader>
          )}
          {conversations.length > 0 ? (
            activeTab === 'All' ? (
              conversations
                .slice(0, MAX_CONVERSATIONS_ALL_TAB)
                .map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={false}
                    onClick={() => onConversationSelect(conv.id)}
                    isDropdownOpen={openDropdownId === conv.id}
                    onDropdownOpenChange={(isOpen) => setOpenDropdownId(isOpen ? conv.id : null)}
                  />
                ))
            ) : (
              <div
                ref={conversationsScrollRef}
                onScroll={handleConversationsScroll}
                className={styles.virtualList}
                style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}
              >
                <div style={{ height: conversationsTotalHeight, position: 'relative' }}>
                  {virtualConversations.map((virtualItem) => {
                    const conv = conversations[virtualItem.index];
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
                        <ConversationItem
                          conversation={conv}
                          isActive={false}
                          onClick={() => onConversationSelect(conv.id)}
                          isDropdownOpen={openDropdownId === conv.id}
                          onDropdownOpenChange={(isOpen) => setOpenDropdownId(isOpen ? conv.id : null)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ) : (
            isSearching && !conversationsLoading && <div className={styles.emptyState}>{t('chat.noConversationsFound')}</div>
          )}
          {isSearching && activeTab === 'All' && conversations.length > MAX_CONVERSATIONS_ALL_TAB && (
            <div className={styles.seeAllContainer}>
              <button className={styles.seeAllBtn} onClick={onSeeAllConversations}>
                {t('chat.seeAll')}
              </button>
            </div>
          )}
        </>
      )}
    </div>

  );
};
