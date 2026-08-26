import React, { CSSProperties, ReactNode } from 'react';
import { useMessageStore } from '../store/messageStore';
import { useConversations } from '../hooks/useConversations';
import { usePinnedMessages } from '../hooks/usePinnedMessages';
import { ConversationList } from './ConversationList';
import { ConversationView } from './Conversation';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import type { FilePreviewItem } from './FilePreviewModal';

export interface ConversationListRenderProps {}

export interface ConversationRenderProps {
  conversationId: string;
}

export interface ChatContainerProps {
  className?: string;
  style?: CSSProperties;
  renderConversationList?: (props: ConversationListRenderProps) => ReactNode;
  renderConversation?: (props: ConversationRenderProps) => ReactNode;
  renderEmpty?: () => ReactNode;
  onOpenAttachment?: (url: string, fileName?: string, metadata?: FilePreviewItem) => void;
  onDownloadAttachment?: (url: string, fileName?: string) => void;
  disableOfficeOnlineViewer?: boolean;
  disableInternalPreview?: boolean;
}


export const ChatContainer: React.FC<ChatContainerProps> = React.memo(
  ({
    className,
    style,
    renderConversationList,
    renderConversation,
    renderEmpty,
    onOpenAttachment,
    onDownloadAttachment,
    disableOfficeOnlineViewer,
    disableInternalPreview,
  }) => {
    const { activeConversation, openingConversation } = useConversations();
    const { loading: loadingPinnedMessages } = usePinnedMessages(
      activeConversation?.id || '',
      activeConversation?.conversationId
    );
    const hasFetchedPinned = useMessageStore(
      (state) => state.messagesByConversation[activeConversation?.id || '']?.hasFetchedPinned
    );

    const defaultStyle: CSSProperties = {
      display: 'flex',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
    };

    const defaultSidebarStyle: CSSProperties = {
      width: '320px',
      borderRight: '1px solid #e1e4e8',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    };

    const defaultMainStyle: CSSProperties = {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    };

    return (
      <div
        className={className ? `acs-chat-container ${className}` : 'acs-chat-container'}
        style={{ ...defaultStyle, ...style }}
      >
        <div className="acs-chat-sidebar" style={defaultSidebarStyle}>
          {renderConversationList ? renderConversationList({}) : <ConversationList />}
        </div>
        <div className="acs-chat-main-area" style={defaultMainStyle}>
          {openingConversation || loadingPinnedMessages || (activeConversation && !hasFetchedPinned) ? (
            <LoadingState />
          ) : activeConversation ? (
            renderConversation ? (
              renderConversation({ conversationId: activeConversation.id })
            ) : (
              <ConversationView
                onOpenAttachment={onOpenAttachment}
                onDownloadAttachment={onDownloadAttachment}
                disableOfficeOnlineViewer={disableOfficeOnlineViewer}
                disableInternalPreview={disableInternalPreview}
              />
            )
          ) : renderEmpty ? (
            renderEmpty()
          ) : (
            <EmptyState type="no-conversations" />
          )}
        </div>
      </div>
    );
  }
);
