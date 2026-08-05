import React, { ReactNode, useState, useMemo } from 'react';
import type { Conversation } from '../../types';
import { ConversationItem } from './ConversationItem';
import { useConversations } from '../../hooks/useConversations';
import styles from './ConversationList.module.scss';
import { SearchInput } from '../SearchInput';
import { EmptyState } from '../EmptyState';

export interface ConversationListProps {
  conversations?: Conversation[];
  activeId?: string;
  onSelect?: (id: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  renderItem?: (conversation: Conversation, isActive: boolean) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderSearch?: () => ReactNode;
}

export const ConversationList: React.FC<ConversationListProps> = React.memo((props) => {
  // Use hook to get default values if props are not provided
  const store = useConversations();

  const conversations = props.conversations ?? store.conversations;
  const activeId = props.activeId ?? store.activeConversation?.id;
  const onSelect = props.onSelect ?? store.openConversation;
  const onLoadMore = props.onLoadMore ?? store.loadMore;
  const hasMore = props.hasMore ?? store.hasMore;
  const loading = props.loading ?? store.loading;

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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      if (hasMore && !loading && onLoadMore) {
        onLoadMore();
      }
    }
  };

  const defaultRenderSearch = () => (
    <SearchInput 
      value={searchTerm}
      onChange={setSearchTerm}
      placeholder="Search conversations..."
    />
  );

  const defaultRenderEmpty = () => <EmptyState type="no-conversations" message="No conversations found" className={styles.emptyState} />;

  return (
    <div className={styles.conversationList} onScroll={handleScroll}>
      {props.renderSearch ? props.renderSearch() : defaultRenderSearch()}

      {filteredConversations.length === 0 && !loading
        ? props.renderEmpty
          ? props.renderEmpty()
          : defaultRenderEmpty()
        : filteredConversations.map((conversation) => {
            const isActive = conversation.id === activeId;

            if (props.renderItem) {
              return (
                <React.Fragment key={conversation.id}>
                  {props.renderItem(conversation, isActive)}
                </React.Fragment>
              );
            }

            return (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={isActive}
                onClick={() => onSelect(conversation.id)}
              />
            );
          })}

      {loading && (
        <div style={{ padding: 16, textAlign: 'center', color: '#667781', fontSize: 13 }}>
          Loading...
        </div>
      )}
    </div>
  );
});

export * from './ConversationItem';
