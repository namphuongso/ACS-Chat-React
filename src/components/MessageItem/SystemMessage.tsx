import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import type { ChatMessage } from '../../types/message.types';
import styles from './MessageItem.module.scss';

export interface SystemMessageProps {
  message: ChatMessage;
  currentUserId?: string;
  roomMembers?: Array<{ userId?: string; contactName?: string; avatarUrl?: string; cui?: string }>;
}

export const SystemMessage: React.FC<SystemMessageProps> = React.memo(
  ({ message, currentUserId, roomMembers }) => {
    const { t } = useTranslation();

    let systemNode: React.ReactNode = message.content;
    if (message.systemEvent) {
      const { type, initiator, participants, newTopic } = message.systemEvent;

      const getMemberName = (id?: string, defaultName?: string) => {
        if (!id) return defaultName || 'System';
        if (id === currentUserId) return t('chat.you', 'You');
        const member = roomMembers?.find((m) => m.cui === id || m.userId === id);
        return member?.contactName || defaultName || id;
      };

      const isInitiatorMe = initiator?.id === currentUserId;
      const initiatorName = isInitiatorMe
        ? t('chat.you_lowercase', 'you')
        : getMemberName(initiator?.id, initiator?.displayName);

      if (type === 'topicUpdated') {
        const topicInitiator = isInitiatorMe ? t('chat.you', 'You') : initiatorName;
        systemNode = (
          <Trans
            i18nKey="chat.system.topicUpdated"
            values={{ initiator: topicInitiator, newTopic }}
            components={{ b: <b /> }}
          />
        );
      } else if (type === 'participantAdded') {
        const addedNames = participants
          ?.filter((p) => p.id !== initiator?.id)
          .map((p) => getMemberName(p.id, p.displayName))
          ?.join(', ');
        if (isInitiatorMe) {
          systemNode = (
            <Trans
              i18nKey="chat.system.youAddedParticipants"
              values={{ participants: addedNames }}
              components={{ b: <b /> }}
            />
          );
        } else {
          systemNode = (
            <Trans
              i18nKey="chat.system.participantsAddedBy"
              values={{ participants: addedNames, initiator: initiatorName }}
              components={{ b: <b /> }}
            />
          );
        }
      } else if (type === 'participantRemoved') {
        const removedNames = participants
          ?.filter((p) => p.id !== initiator?.id)
          .map((p) => getMemberName(p.id, p.displayName))
          ?.join(', ');
        if (isInitiatorMe) {
          systemNode = (
            <Trans
              i18nKey="chat.system.youRemovedParticipants"
              values={{ participants: removedNames }}
              components={{ b: <b /> }}
            />
          );
        } else {
          systemNode = (
            <Trans
              i18nKey="chat.system.participantsRemovedBy"
              values={{ participants: removedNames, initiator: initiatorName }}
              components={{ b: <b /> }}
            />
          );
        }
      }
    }

    return (
      <div className={`${styles.messageItem} ${styles.systemMessage}`}>
        <div className={styles.systemContent}>{systemNode}</div>
      </div>
    );
  }
);
