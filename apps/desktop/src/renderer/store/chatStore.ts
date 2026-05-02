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
  participants: { userId: string; user: ChatUser }[];
  messages: ChatMessage[];
  updatedAt: string;
}

interface ChatState {
  conversations: ChatConversation[];
  messages: Record<string, ChatMessage[]>;
  activeChatId: string | null;
  ws: WebSocket | null;
  isLoading: boolean;

  setActiveChat: (id: string | null) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  createConversation: (email: string) => Promise<boolean>;
  sendMessage: (conversationId: string, content: string) => void;
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
  activeChatId: null,
  ws: null,
  isLoading: false,

  setActiveChat: (id) => {
    console.log('[chatStore] setActiveChat called with:', id);
    set({ activeChatId: id });
    if (id && !get().messages[id]) {
      console.log('[chatStore] Fetching messages for:', id);
      get().fetchMessages(id);
    }
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
      const { data } = await api.get(`/api/chat/conversations/${conversationId}/messages`);
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: data
        }
      }));
    } catch (err) {
      console.error('Failed to fetch messages:', err);
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
              const conv = updatedConversations[convIndex];
              conv.messages = [message];
              conv.updatedAt = message.createdAt;
              updatedConversations.splice(convIndex, 1);
              updatedConversations.unshift(conv);
            } else {
              // If we received a message for a new conversation, fetch full conversation list
              get().fetchConversations();
            }

            return {
              messages: updatedMessages,
              conversations: updatedConversations
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

            return {
              conversations: [conversation, ...state.conversations]
            };
          });
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
