import React, { CSSProperties, ReactNode } from 'react';
import { useConversations } from '../hooks/useConversations';
import { ConversationList } from './ConversationList';
import { ConversationView } from './Conversation';
import { EmptyState } from './EmptyState';

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
}

export const ChatContainer: React.FC<ChatContainerProps> = React.memo(({
  className,
  style,
  renderConversationList,
  renderConversation,
  renderEmpty,
}) => {
  const { activeConversation } = useConversations();



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
        {activeConversation ? (
          renderConversation ? (
            renderConversation({ conversationId: activeConversation.id })
          ) : (
            <ConversationView /> // Assuming it reads from store internally
          )
        ) : (
          renderEmpty ? renderEmpty() : <EmptyState type="no-conversations" />
        )}
      </div>
    </div>
  );
});
