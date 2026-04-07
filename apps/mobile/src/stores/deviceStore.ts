import { create } from 'zustand';
import api from '../api';
import { useAuthStore } from './authStore';

export interface Device {
  id: string;
  name: string;
  accessKey: string;
  osType?: string;
  isOnline: boolean;
  lastSeen?: string;
}

interface DeviceState {
  devices: Device[];
  isLoading: boolean;
  fetchDevices: () => Promise<void>;
  updateDeviceStatus: (accessKey: string, status: 'online' | 'offline' | 'busy') => void;
  clearDevices: () => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  isLoading: false,

  fetchDevices: async () => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) return;

    set({ isLoading: true });
    try {
      const response = await api.get('/api/devices/mine');
      if (response.status === 200) {
        const devices = response.data.map((d: any) => ({
          id: d.id?.toString() ?? '',
          name: d.device_name ?? d.name ?? 'Unknown',
          accessKey: d.access_key ?? '',
          osType: d.os_type,
          isOnline: d.is_online ?? false,
          lastSeen: d.last_seen,
        }));
        set({ devices, isLoading: false });
        
        // Instant Presence Sync
        import('../services/presenceService').then(({ presenceService }) => {
          presenceService.subscribeToDevices(devices.map((d: any) => d.accessKey));
        });
      }
    } catch (error) {
      console.error('Fetch devices error:', error);
      set({ isLoading: false });
    }
  },

  updateDeviceStatus: (accessKey, status) => {
    set((state) => ({
      devices: state.devices.map((d) => 
        d.accessKey === accessKey ? { ...d, isOnline: status === 'online' } : d
      ),
    }));
  },

  clearDevices: () => set({ devices: [] }),
}));
