import { create } from 'zustand';

import api from '../lib/api';

interface Device {
  id: string;
  name: string;
  device_name: string;
  type: string;
  access_key: string;
  is_online: boolean;
  last_seen_at: string;
  last_seen: string;  // alias for display
  os_type?: string;
}

interface DeviceState {
  devices: Device[];
  isLoading: boolean;
  fetchDevices: (silent?: boolean) => Promise<void>;
  addDevice: (accessKey: string, password?: string) => Promise<void>;
  updateDeviceName: (id: string, name: string) => Promise<void>;
  regenerateKey: (id: string) => Promise<void>;
  removeDevice: (id: string) => Promise<void>;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  isLoading: false,

  fetchDevices: async (silent = false) => {
    if (!silent) set({ isLoading: true });
    try {
      const { data } = await api.get('/api/devices/mine');
      // Backend returns snake_case; normalize here for UI consistency
      const normalized = data.map((d: any) => ({
        ...d,
        name: d.device_name || d.name || 'Unnamed Device',
        last_seen: d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : 'Never',
      }));
      set({ devices: normalized });
    } finally {
      if (!silent) set({ isLoading: false });
    }
  },

  addDevice: async (accessKey, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/devices/add-existing', { accessKey, password });
      set((state) => {
        const normalized = {
          ...data,
          name: data.device_name || data.name || 'Unnamed Device',
          last_seen: data.last_seen_at ? new Date(data.last_seen_at).toLocaleString() : 'Never',
        };
        return { devices: [...state.devices, normalized] };
      });
    } catch (err) {
      console.error('Add existing device failed', err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateDeviceName: async (id, name) => {
    try {
      await api.patch(`/api/devices/${id}/name`, { device_name: name });
      set((state) => ({
        devices: state.devices.map((d) => (d.id === id ? { ...d, name } : d)),
      }));
    } catch (err) {
      console.error('Update device name failed', err);
    }
  },

  regenerateKey: async (id) => {
    try {
      const { data } = await api.post('/api/devices/regenerate-key', { deviceId: id });
      set((state) => ({
        devices: state.devices.map((d) => (d.id === id ? { ...d, access_key: data.access_key } : d)),
      }));
    } catch (err) {
      console.error('Regenerate key failed', err);
    }
  },

  removeDevice: async (id) => {
    try {
      await api.delete(`/api/devices/${id}`);
      set((state) => ({
        devices: state.devices.filter((d) => d.id !== id),
      }));
    } catch (err) {
      console.error('Remove device failed', err);
    }
  },
}));
