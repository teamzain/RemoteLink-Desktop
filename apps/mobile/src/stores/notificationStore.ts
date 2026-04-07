import { create } from 'zustand';

export interface AppNotification {
  id: string;
  type: 'SECURITY' | 'SYSTEM' | 'BILLING';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [
    {
      id: '1',
      type: 'SECURITY',
      title: 'New Device Login',
      message: 'A Windows 11 device logged into your session.',
      timestamp: '2 mins ago',
      isRead: false,
    },
    {
      id: '2',
      type: 'SYSTEM',
      title: 'Performance Optimized',
      message: 'Connect-X latency reduced to 42ms.',
      timestamp: '1 hour ago',
      isRead: true,
    },
    {
      id: '3',
      type: 'BILLING',
      title: 'Pro Trial Ending',
      message: 'Your Premium trial expires in 3 days.',
      timestamp: 'Yesterday',
      isRead: true,
    }
  ],
  
  addNotification: (notif) => {
    const newNotif: AppNotification = {
      ...notif,
      id: Math.random().toString(36).substring(7),
      isRead: false,
    };
    set((state) => ({ notifications: [newNotif, ...state.notifications] }));
  },
  
  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) => 
        n.id === id ? { ...n, isRead: true } : n
      )
    }));
  },
  
  clearAll: () => {
    set({ notifications: [] });
  }
}));
