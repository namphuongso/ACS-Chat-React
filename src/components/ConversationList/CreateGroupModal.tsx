import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Camera, Search, X, Check, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { searchEmployees } from '../../services/contactService';
import { uploadFile } from '../../services/fileService';
import { useConversations } from '../../hooks/useConversations';
import type { Contact } from '../../types';
import styles from './CreateGroupModal.module.scss';
import { useChatStore } from '../../store/chatStore';
import { Avatar } from '../Avatar';

export interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { createGroupRoom, openConversation } = useConversations();
  const currentUser = useChatStore((state) => state.currentUser);

  const [groupName, setGroupName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state when opening
      setGroupName('');
      setSearchTerm('');
      setSelectedContacts([]);
      setAvatarFile(null);
      setAvatarPreview('');
      fetchContacts('');
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(avatarPreview);
        } catch {
          // Ignore
        }
      }
    };
  }, [avatarPreview]);

  // Debounced search could be added here, simplified for now
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        fetchContacts(searchTerm);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchTerm, isOpen]);

  const fetchContacts = async (keyword: string) => {
    try {
      const result = await searchEmployees(keyword, 1, 100); // get more contacts for filtering
      setContacts(result);
    } catch (error) {
      console.error('Failed to fetch contacts', error);
    }
  };

  const groupedContacts = useMemo(() => {
    // Filter out current user
    const filtered = contacts.filter((c) => c.id !== currentUser?.id);

    // Group alphabetically
    const groups: Record<string, Contact[]> = {
      Recent: [], // Mocking recent for now by taking first 5
    };

    filtered.slice(0, 5).forEach((c) => groups['Recent'].push(c));

    filtered.forEach((c) => {
      const name = c.fullName || c.email || c.id;
      const firstLetter = name.charAt(0).toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(c);
    });

    return groups;
  }, [contacts, currentUser]);

  const toggleContactSelection = (contact: Contact) => {
    setSelectedContacts((prev) => {
      const isSelected = prev.some((c) => c.id === contact.id);
      if (isSelected) {
        return prev.filter((c) => c.id !== contact.id);
      } else {
        return [...prev, contact];
      }
    });
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl);
    }
  };

  const handleCreateGroup = async () => {
    if (selectedContacts.length === 0) return;

    setIsLoading(true);
    try {
      let uploadedAvatarUrl = '';
      if (avatarFile) {
        uploadedAvatarUrl = await uploadFile(avatarFile);
      }

      const participantIds = selectedContacts.map((c) => c.id);
      const res = await createGroupRoom(groupName, participantIds, uploadedAvatarUrl);
      if (res?.conversation) {
        openConversation(res.conversation.id);
      }
      onClose();
    } catch (error) {
      console.error('Failed to create group', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const canCreate = groupName.trim().length > 0 && selectedContacts.length > 1;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.header}>
          <h2>{t('chat.createGroup')}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.groupInfoSection}>
            <div className={styles.avatarUpload} onClick={handleAvatarClick}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar Preview" className={styles.avatarImg} />
              ) : (
                <Camera className={styles.cameraIcon} size={20} />
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handleFileChange}
            />
            <input
              type="text"
              placeholder={t('chat.enterGroupName')}
              className={styles.nameInput}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          <div className={styles.searchSection}>
            <Search className={styles.searchIcon} size={16} />
            <input
              type="text"
              placeholder={t('chat.searchGroupContact')}
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.contactsContainer}>
            <div className={styles.contactsList}>
              {Object.entries(groupedContacts).map(([group, groupContacts]) => {
                if (groupContacts.length === 0) return null;

                return (
                  <div key={group}>
                    <div className={styles.groupHeader}>{group}</div>
                    {groupContacts.map((contact) => {
                      const isSelected = selectedContacts.some((c) => c.id === contact.id);
                      return (
                        <div
                          key={`${group}-${contact.id}`}
                          className={styles.contactItem}
                          onClick={() => toggleContactSelection(contact)}
                        >
                          <div className={`${styles.checkbox} ${isSelected ? styles.checked : ''}`}>
                            {isSelected && <Check size={14} />}
                          </div>
                          <div className={styles.contactAvatar}>
                            {contact.avatarUrl ? (
                              <img src={contact.avatarUrl} alt="" />
                            ) : (
                              <Avatar name={contact.fullName || contact.id} />
                            )}
                          </div>
                          <div className={styles.contactName}>
                            {contact.fullName || contact.email || contact.id}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {selectedContacts.length > 0 && (
              <div className={styles.selectedPanel}>
                <div className={styles.selectedHeader}>
                  {t('chat.selectedContacts')}{' '}
                  <span className={styles.count}>{selectedContacts.length}/100</span>
                </div>
                <div className={styles.selectedList}>
                  {selectedContacts.map((contact) => (
                    <div key={contact.id} className={styles.selectedItem}>
                      <div className={styles.selectedAvatar}>
                        {contact.avatarUrl ? (
                          <img src={contact.avatarUrl} alt="" />
                        ) : (
                          <Avatar name={contact.fullName || contact.id} />
                        )}
                      </div>
                      <div className={styles.selectedName}>
                        {contact.fullName || contact.email || contact.id}
                      </div>
                      <button
                        className={styles.removeBtn}
                        onClick={() => toggleContactSelection(contact)}
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>
            {t('chat.cancel')}
          </button>
          <button
            className={styles.createBtn}
            onClick={handleCreateGroup}
            disabled={!canCreate || isLoading}
          >
            {isLoading ? t('chat.creating') : t('chat.createGroup')}
          </button>
        </div>
      </div>
    </div>
  );
};
