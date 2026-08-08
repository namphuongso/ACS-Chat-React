import React from 'react';
import type { Contact } from '../../types';
import styles from './ContactItem.module.scss';
import { Avatar } from '../Avatar';

export interface ContactItemProps {
  contact: Contact;
  onClick: () => void;
}

export const ContactItem: React.FC<ContactItemProps> = React.memo(({ contact, onClick }) => {
  const name = contact.fullName || contact.email || contact.id;
  const avatarUrl = contact.avatarUrl;

  const nameParts = name ? name.split(' ') : [];
  const firstName = nameParts.length > 0 ? nameParts[0] : '';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

  return (
    <div className={styles.contactItem} onClick={onClick}>
      <Avatar url={avatarUrl} name={name} className={styles.avatarContainer} />
      <div className={styles.content}>
        <div className={styles.name}>
          {firstName && <span className={styles.lastName}>{firstName}</span>}
          {lastName && <span className={styles.lastName}> {lastName}</span>}
        </div>
      </div>
    </div>
  );
});
