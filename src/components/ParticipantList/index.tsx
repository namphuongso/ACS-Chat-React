import React, { ReactNode } from 'react';
import styles from './ParticipantList.module.scss';
import { MoreHorizontalIcon, UserPlusIcon } from '../Icons';
import { ParticipantItem } from './ParticipantItem';
import type { ConversationParticipant } from '../../types/participant.types';

export interface ParticipantListProps {
  participants: ConversationParticipant[];
  currentUserId: string;
  onAddParticipant?: () => void;
  onRemoveParticipant?: (userId: string) => void;
  renderItem?: (participant: ConversationParticipant) => ReactNode;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  currentUserId,
  onAddParticipant,
  onRemoveParticipant,
  renderItem,
}) => {
  return (
    <div className={styles.container}>
      {onAddParticipant && (
        <button className={styles.addMembersBtn} onClick={onAddParticipant}>
          <UserPlusIcon />
          <span>Add members</span>
        </button>
      )}

      <div className={styles.listHeader}>
        <h3>Listing members ({participants.length})</h3>
        <button className={styles.moreListBtn}>
          <MoreHorizontalIcon width={20} height={20} />
        </button>
      </div>

      <div className={styles.participantList}>
        {participants.map((participant) => (
          <React.Fragment key={participant.id}>
            {renderItem ? (
              renderItem(participant)
            ) : (
              <ParticipantItem
                participant={participant}
                isCurrentUser={participant.id === currentUserId}
                onRemove={onRemoveParticipant}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
