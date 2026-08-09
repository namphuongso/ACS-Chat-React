import React from 'react';
import { useVirtualScroll } from '../../hooks/useVirtualScroll';
import type { Contact } from '../../types';
import { ContactItem } from './ContactItem';
import { SectionHeader } from './SectionHeader';
import { useTranslation } from 'react-i18next';
import styles from './ConversationList.module.scss';

const MAX_CONTACTS_ALL_TAB = 7;
const CONTACT_ITEM_HEIGHT = 64;
const CONTACTS_CONTAINER_HEIGHT = 1200; // Increased for safe virtual scroll calculation on tall screens

export interface ConversationSearchResultsProps {
  isSearching: boolean;
  activeTab: 'All' | 'Contacts' | 'Messages' | 'Files';
  contacts: Contact[];
  contactsLoading: boolean;
  onContactSelect: (id: string) => void;
  onSeeAllContacts: () => void;
}

export const ConversationSearchResults: React.FC<ConversationSearchResultsProps> = ({
  isSearching,
  activeTab,
  contacts,
  contactsLoading,
  onContactSelect,
  onSeeAllContacts,
}) => {
  const { t } = useTranslation();
  const isContactsOnlyTab = activeTab === 'Contacts';

  const { virtualItems, totalHeight, scrollElementRef, handleScroll } = useVirtualScroll({
    itemCount: contacts.length,
    itemHeight: CONTACT_ITEM_HEIGHT,
    containerHeight: CONTACTS_CONTAINER_HEIGHT,
    overscan: 5,
  });

  return (
    <div
      className={`${styles.resultsContainer} ${
        isContactsOnlyTab ? styles.resultsContainerVirtual : styles.resultsContainerScrollable
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
                ref={scrollElementRef}
                onScroll={handleScroll}
                className={styles.virtualList}
                style={{
                  height: '100%',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                }}
              >
                <div style={{ height: totalHeight, position: 'relative' }}>
                  {virtualItems.map((virtualItem) => {
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
            isSearching &&
            !contactsLoading && <div className={styles.emptyState}>{t('chat.noContactsFound')}</div>
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

      {/* Messages Section */}
      {(activeTab === 'All' || activeTab === 'Messages') && isSearching && (
        <>
          <SectionHeader>{t('chat.tabs.messages')} (0)</SectionHeader>
          <div className={styles.emptyState}>{t('chat.noMessagesFound')}</div>
        </>
      )}

      {/* Files Section */}
      {(activeTab === 'All' || activeTab === 'Files') && isSearching && (
        <>
          <SectionHeader>{t('chat.tabs.files')} (0)</SectionHeader>
          <div className={styles.emptyState}>{t('chat.noFilesFound')}</div>
        </>
      )}
    </div>
  );
};
