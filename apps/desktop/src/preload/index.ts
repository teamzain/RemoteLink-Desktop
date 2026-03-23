import { contextBridge, ipcRenderer } from 'electron';

// Expose secure IPC methods to the React Renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('system:ping'),
  getToken: () => ipcRenderer.invoke('auth:getToken'),
  setToken: (token: string, refresh: string) => ipcRenderer.invoke('auth:setToken', token, refresh),
  deleteToken: () => ipcRenderer.invoke('auth:deleteToken'),
  startHosting: () => ipcRenderer.invoke('host:start'),
  stopHosting: () => ipcRenderer.invoke('host:stop'),
  connectToHost: (sessionId: string, serverIP?: string) => ipcRenderer.invoke('viewer:connect', sessionId, serverIP),
  getLocalIP: () => ipcRenderer.invoke('system:getLocalIP'),
  onHostStatus: (callback: (status: string) => void) => {
    const listener = (_: any, status: string) => callback(status);
    ipcRenderer.on('host:status', listener);
    return () => ipcRenderer.removeListener('host:status', listener);
  },
  onViewerVideoChunk: (callback: (buffer: Uint8Array) => void) => {
    const listener = (_: any, buffer: Uint8Array) => callback(buffer);
    ipcRenderer.on('viewer:video-chunk', listener);
    return () => ipcRenderer.removeListener('viewer:video-chunk', listener);
  },
  sendSignalingMessage: (msg: any) => ipcRenderer.send('viewer:send-signaling', msg),
  onSignalingMessage: (callback: (msg: any) => void) => {
    const listener = (_: any, msg: any) => callback(msg);
    ipcRenderer.on('viewer:signaling-message', listener);
    return () => ipcRenderer.removeListener('viewer:signaling-message', listener);
  },
  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard:readText'),
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text)
  }
});
