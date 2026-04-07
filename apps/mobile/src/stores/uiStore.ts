import { create } from 'zustand';

interface UIState {
  errorModalVisible: boolean;
  errorTitle: string;
  errorMessage: string;
  showError: (title: string, message: string) => void;
  hideError: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  errorModalVisible: false,
  errorTitle: '',
  errorMessage: '',
  showError: (title, message) => set({ errorModalVisible: true, errorTitle: title, errorMessage: message }),
  hideError: () => set({ errorModalVisible: false }),
}));
