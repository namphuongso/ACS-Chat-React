import React, { useMemo, ReactNode, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { ChatMessage } from '../../types/message.types';
import { LoadingState } from '../LoadingState';
import styles from './MessageList.module.scss';

export interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  renderMessage?: (message: ChatMessage) => ReactNode;
  renderSystemMessage?: (message: ChatMessage) => ReactNode;
  renderDateSeparator?: (date: Date) => ReactNode;
  renderLoadingMore?: () => ReactNode;
}

type ListItem =
  { type: 'message'; data: ChatMessage } | { type: 'date-separator'; id: string; date: Date };

export const MessageList: React.FC<MessageListProps> = React.memo(({
  messages,
  currentUserId,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  renderMessage,
  renderSystemMessage,
  renderDateSeparator,
  renderLoadingMore,
}) => {
  const items: ListItem[] = useMemo(() => {
    const result: ListItem[] = [];
    let currentDate = '';

    // Sort messages by createdAt to ensure chronological order
    const sortedMessages = [...messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sortedMessages.forEach((msg) => {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== currentDate) {
        result.push({
          type: 'date-separator',
          id: `date-${msgDate}`,
          date: new Date(msg.createdAt),
        });
        currentDate = msgDate;
      }
      result.push({ type: 'message', data: msg });
    });

    return result;
  }, [messages]);

  // Using firstItemIndex technique for prepending items smoothly in react-virtuoso
  // This ensures scroll position is maintained when items are added to the top
  const firstItemIndex = Math.max(0, 1000000 - items.length);

  const handleStartReached = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      onLoadMore();
    }
  }, [hasMore, loadingMore, loading, onLoadMore]);

  const defaultRenderDateSeparator = (date: Date) => (
    <div className={styles.dateSeparator}>
      <span>
        {new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(date)}
      </span>
    </div>
  );

  const defaultRenderLoadingMore = () => (
    <div className={styles.loadingMore}>Loading previous messages...</div>
  );

  const defaultRenderMessage = (message: ChatMessage) => {
    const isOwn = message.sender.id === currentUserId;
    return (
      <div className={`${styles.defaultMessageWrapper} ${isOwn ? styles.own : ''}`}>
        <div className={`${styles.fallbackMessage} ${isOwn ? styles.ownMessage : ''}`}>
          {message.type === 'html' ? (
            <div dangerouslySetInnerHTML={{ __html: message.content }} />
          ) : (
            <div>{message.content}</div>
          )}
        </div>
      </div>
    );
  };

  if (loading && messages.length === 0) {
    return (
      <div className={styles.messageListContainer}>
        <LoadingState />
      </div>
    );
  }

  return (
    <div className={styles.messageListContainer}>
      <Virtuoso
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={items.length - 1}
        data={items}
        startReached={handleStartReached}
        computeItemKey={(_, item) => (item.type === 'message' ? item.data.id : item.id)}
        itemContent={(_, item) => {
          if (item.type === 'date-separator') {
            return renderDateSeparator
              ? renderDateSeparator(item.date)
              : defaultRenderDateSeparator(item.date);
          }

          if (item.data.type === 'system') {
            return renderSystemMessage
              ? renderSystemMessage(item.data)
              : defaultRenderMessage(item.data);
          }

          return renderMessage ? renderMessage(item.data) : defaultRenderMessage(item.data);
        }}
        components={{
          Header: () =>
            loadingMore
              ? renderLoadingMore
                ? renderLoadingMore()
                : defaultRenderLoadingMore()
              : null,
        }}
        followOutput={(isAtBottom) => (isAtBottom ? 'smooth' : false)}
        alignToBottom
      />
    </div>
  );
});
