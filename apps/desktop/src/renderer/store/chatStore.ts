import { create } from 'zustand';
import api from '../lib/api';

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: ChatUser;
}

export interface ChatConversation {
  id: string;
  isGroup: boolean;
  name: string | null;
  requestedById?: string | null;
  blockedById?: string | null;
  participants: { userId: string; user: ChatUser; nickname?: string | null }[];
  messages: ChatMessage[];
  updatedAt: string;
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
}

interface ChatState {
  conversations: ChatConversation[];
  messages: Record<string, ChatMessage[]>;
  unreadCounts: Record<string, number>;
  activeChatId: string | null;
  ws: WebSocket | null;
  isLoading: boolean;
  loadingMessages: Record<string, boolean>;

  setActiveChat: (id: string | null) => void;
  markRead: (id: string) => void;
  onNewMessage?: (msg: any, convId: string) => void;
  onToastMessage?: (msg: any, convId: string) => void;
  onInvite?: (conv: any) => void;
  onSessionInvite?: (invite: any) => void;
  onConversationEvent?: (event: { type: string; conversation?: ChatConversation; conversationId?: string; actorUserId?: string; reason?: string }) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  createConversation: (email: string) => Promise<boolean>;
  createGroup: (name: string, emails: string[]) => Promise<boolean>;
  addGroupMembers: (id: string, emails: string[]) => Promise<boolean>;
  sendMessage: (conversationId: string, content: string) => void;
  renameConversation: (id: string, name: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  unfriendConversation: (id: string) => Promise<void>;
  blockConversation: (id: string) => Promise<void>;
  unblockConversation: (id: string) => Promise<void>;
  acceptInvite: (id: string) => Promise<void>;
  rejectInvite: (id: string) => Promise<void>;
  connectWebSocket: () => Promise<void>;
  disconnectWebSocket: () => void;
}

const getAuthToken = async (): Promise<string | null> => {
  const isElectron = !!(window as any).electronAPI;
  if (isElectron) {
    const result = await (window as any).electronAPI.getToken();
    return result?.token || null;
  }
  return localStorage.getItem('access_token');
};

const getWsUrl = (): string => {
  const envUrl = import.meta.env.VITE_SIGNAL_URL;
  if (envUrl && envUrl.includes('localhost')) {
    // If we're forcing a connection to the remote server locally
    if (import.meta.env.VITE_API_URL?.includes('159.65.84.190')) {
       return 'ws://159.65.84.190/api/signal';
    }
    return envUrl;
  }
  if (envUrl) return envUrl;

  // Production fallback
  return 'ws://159.65.84.190/api/signal';
};

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  unreadCounts: {},
  activeChatId: null,
  ws: null,
  isLoading: false,
  loadingMessages: {},

  setActiveChat: (id) => {
    console.log('[chatStore] setActiveChat called with:', id);
    set((state) => ({
      activeChatId: id,
      unreadCounts: id ? { ...state.unreadCounts, [id]: 0 } : state.unreadCounts
    }));
    if (id && !get().messages[id]) {
      console.log('[chatStore] Fetching messages for:', id);
      get().fetchMessages(id);
    }
  },

  markRead: (id) => {
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [id]: 0 }
    }));
  },

  fetchConversations: async () => {
    try {
      set({ isLoading: true });
      const { data } = await api.get('/api/chat/conversations');
      console.log('[chatStore] fetchConversations raw data:', data);
      set({ conversations: Array.isArray(data) ? data : [], isLoading: false });
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      set({ isLoading: false });
    }
  },

  fetchMessages: async (conversationId: string) => {
    try {
      set((state) => ({
        loadingMessages: {
          ...state.loadingMessages,
          [conversationId]: true
        }
      }));
      const { data } = await api.get(`/api/chat/conversations/${conversationId}/messages`);
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: data
        },
        loadingMessages: {
          ...state.loadingMessages,
          [conversationId]: false
        }
      }));
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      set((state) => ({
        loadingMessages: {
          ...state.loadingMessages,
          [conversationId]: false
        }
      }));
    }
  },

  createConversation: async (email: string) => {
    try {
      const { data } = await api.post('/api/chat/conversations', { email });
      set((state) => ({
        conversations: [data, ...state.conversations.filter(c => c.id !== data.id)]
      }));
      get().setActiveChat(data.id);
      return true;
    } catch (err) {
      console.error('Failed to create conversation:', err);
      return false;
    }
  },

  createGroup: async (name: string, emails: string[]) => {
    try {
      const { data } = await api.post('/api/chat/groups', { name, emails });
      set((state) => ({
        conversations: [data, ...state.conversations.filter(c => c.id !== data.id)]
      }));
      get().setActiveChat(data.id);
      return true;
    } catch (err) {
      console.error('Failed to create group:', err);
      return false;
    }
  },

  addGroupMembers: async (id: string, emails: string[]) => {
    try {
      const { data } = await api.post(`/api/chat/conversations/${id}/members`, { emails });
      set((state) => ({
        conversations: state.conversations.map(c => c.id === id ? data : c)
      }));
      return true;
    } catch (err) {
      console.error('[ChatStore] Failed to add group members', err);
      return false;
    }
  },

  sendMessage: (conversationId: string, content: string) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'send-chat-message',
        conversationId,
        content
      }));
    } else {
      console.error('WebSocket is not connected');
    }
  },

  renameConversation: async (id: string, name: string) => {
    try {
      const { data } = await api.patch(`/api/chat/conversations/${id}`, { name });
      set((state) => ({
        conversations: state.conversations.map(c => c.id === id ? data : c)
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to rename conversation', err);
    }
  },

  deleteConversation: async (id: string) => {
    try {
      await api.delete(`/api/chat/conversations/${id}`);
      set((state) => ({
        conversations: state.conversations.filter(c => c.id !== id),
        activeChatId: state.activeChatId === id ? null : state.activeChatId
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to delete conversation', err);
    }
  },

  unfriendConversation: async (id: string) => {
    try {
      await api.post(`/api/chat/conversations/${id}/unfriend`);
      set((state) => ({
        conversations: state.conversations.filter(c => c.id !== id),
        activeChatId: state.activeChatId === id ? null : state.activeChatId
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to unfriend conversation', err);
    }
  },

  blockConversation: async (id: string) => {
    try {
      const { data } = await api.post(`/api/chat/conversations/${id}/block`);
      set((state) => ({
        conversations: state.conversations.map(c => c.id === id ? data : c)
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to block conversation', err);
    }
  },

  unblockConversation: async (id: string) => {
    try {
      const { data } = await api.post(`/api/chat/conversations/${id}/unblock`);
      set((state) => ({
        conversations: state.conversations.map(c => c.id === id ? data : c)
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to unblock conversation', err);
    }
  },

  acceptInvite: async (id: string) => {
    try {
      const { data } = await api.post(`/api/chat/conversations/${id}/accept`);
      set((state) => ({
        conversations: state.conversations.map(c => c.id === id ? data : c)
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to accept invite', err);
    }
  },

  rejectInvite: async (id: string) => {
    try {
      await api.post(`/api/chat/conversations/${id}/reject`);
      set((state) => ({
        conversations: state.conversations.filter(c => c.id !== id),
        activeChatId: state.activeChatId === id ? null : state.activeChatId
      }));
    } catch (err) {
      console.error('[ChatStore] Failed to reject invite', err);
    }
  },

  connectWebSocket: async () => {
    const existingWs = get().ws;
    if (existingWs) return;

    const token = await getAuthToken();
    if (!token) return;

    const wsUrl = getWsUrl();
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[ChatStore] WebSocket connected');
      ws.send(JSON.stringify({ type: 'authenticate-chat', token }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat-message-received') {
          const { message, conversationId } = data;
          
          set((state) => {
            // Update messages map
            const currentMessages = state.messages[conversationId] || [];
            // Prevent duplicates
            if (currentMessages.some(m => m.id === message.id)) return state;
            
            const updatedMessages = {
              ...state.messages,
              [conversationId]: [...currentMessages, message]
            };

            // Move conversation to top and update its last message
            let updatedConversations = [...state.conversations];
            const convIndex = updatedConversations.findIndex(c => c.id === conversationId);
            
            if (convIndex > -1) {
              const conv = { ...updatedConversations[convIndex] };
              conv.messages = [message];
              conv.updatedAt = message.createdAt;
              updatedConversations.splice(convIndex, 1);
              updatedConversations.unshift(conv);
            } else {
              // If we received a message for a new conversation, fetch full conversation list
              get().fetchConversations();
            }

            // Trigger callback for notifications
            get().onNewMessage?.(message, conversationId);
            get().onToastMessage?.(message, conversationId);

            const isUnread = state.activeChatId !== conversationId;

            return {
              messages: updatedMessages,
              conversations: updatedConversations,
              unreadCounts: isUnread
                ? { ...state.unreadCounts, [conversationId]: (state.unreadCounts[conversationId] || 0) + 1 }
                : state.unreadCounts
            };
          });
        } else if (data.type === 'chat-invite') {
          const { conversation } = data;
          set((state) => {
            // Check if it already exists to avoid duplicates
            if (state.conversations.some(c => c.id === conversation.id)) return state;
            
            // Show a native browser notification if permitted
            if (Notification.permission === 'granted') {
              new Notification('New Chat Invite', {
                body: `Someone wants to connect with you!`
              });
            }

            // Trigger callback for UI notification
            get().onInvite?.(conversation);

            return {
              conversations: [conversation, ...state.conversations]
            };
          });
        } else if (data.type === 'chat-conversation-updated') {
          const { conversation } = data;
          if (!conversation?.id) return;

          set((state) => {
            const exists = state.conversations.some(c => c.id === conversation.id);
            const conversations = exists
              ? state.conversations.map(c => c.id === conversation.id ? conversation : c)
              : [conversation, ...state.conversations];

            return { conversations };
          });

          get().onConversationEvent?.(data);
        } else if (data.type === 'chat-conversation-removed') {
          const { conversationId } = data;
          if (!conversationId) return;

          set((state) => ({
            conversations: state.conversations.filter(c => c.id !== conversationId),
            activeChatId: state.activeChatId === conversationId ? null : state.activeChatId
          }));

          get().onConversationEvent?.(data);
        } else if (data.type === 'chat-session-invite') {
          get().onSessionInvite?.(data.invite);
        }
      } catch (err) {
        console.error('[ChatStore] Failed to parse message', err);
      }
    };

    ws.onclose = () => {
      console.log('[ChatStore] WebSocket disconnected');
      set({ ws: null });
      // Reconnect after delay
      setTimeout(() => get().connectWebSocket(), 5000);
    };

    set({ ws });
  },

  disconnectWebSocket: () => {
    const ws = get().ws;
    if (ws) {
      ws.onclose = null; // Prevent auto-reconnect
      ws.close();
      set({ ws: null });
    }
  }
}));
