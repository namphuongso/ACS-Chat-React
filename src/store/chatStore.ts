import { create } from 'zustand';
import type { ChatUser, ConnectionState } from '../types/chat.types';
import type { ChatError } from '../types/errors.types';

export interface ChatState {
  /** Current authenticated chat user */
  currentUser: ChatUser | null;
  /** Connection state of the real-time notification channel */
  connectionState: ConnectionState;
  /** Flag indicating if the chat client initialization is in progress */
  initializing: boolean;
  /** Initialization error if chat initialization failed */
  initError: ChatError | null;

  /** Action to set current user */
  setCurrentUser: (currentUser: ChatUser | null) => void;
  /** Action to update connection state */
  setConnectionState: (connectionState: ConnectionState) => void;
  /** Action to set initializing state flag */
  setInitializing: (initializing: boolean) => void;
  /** Action to set initialization error */
  setInitError: (initError: ChatError | null) => void;
  /** Global search state for conversation list */
  isSearching: boolean;
  /** Action to set global search state */
  setIsSearching: (isSearching: boolean) => void;
  /** Global search term for conversation list */
  searchTerm: string;
  /** Action to set global search term */
  setSearchTerm: (searchTerm: string) => void;
  /** Reset chat store state back to initial state */
  reset: () => void;
}

export const initialChatState = {
  currentUser: null,
  connectionState: 'disconnected' as ConnectionState,
  initializing: false,
  initError: null,
  isSearching: false,
  searchTerm: '',
};

export const useChatStore = create<ChatState>((set) => ({
  ...initialChatState,

  setCurrentUser: (currentUser: ChatUser | null) => set({ currentUser }),
  setConnectionState: (connectionState: ConnectionState) => set({ connectionState }),
  setInitializing: (initializing: boolean) => set({ initializing }),
  setInitError: (initError: ChatError | null) => set({ initError }),
  setIsSearching: (isSearching: boolean) => set({ isSearching }),
  setSearchTerm: (searchTerm: string) => set({ searchTerm }),
  reset: () => set(initialChatState),
}));
