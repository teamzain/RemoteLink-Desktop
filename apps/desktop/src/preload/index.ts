import { contextBridge, ipcRenderer } from 'electron';

// Expose secure IPC methods to the React Renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('system:ping'),
  getToken: () => ipcRenderer.invoke('auth:getToken'),
  setToken: (token: string, refresh: string) => ipcRenderer.invoke('auth:setToken', token, refresh),
  deleteToken: () => ipcRenderer.invoke('auth:deleteToken'),
  startHosting: (accessKey?: string) => ipcRenderer.invoke('host:start', accessKey),
  getHostStatus: () => ipcRenderer.invoke('host:getStatus'),
  stopHosting: () => ipcRenderer.invoke('host:stop'),
  connectToHost: (sessionId: string, serverIP?: string, token?: string, viewerClientId?: string) => ipcRenderer.invoke('viewer:connect', sessionId, serverIP, token, viewerClientId),
  getLocalIP: () => ipcRenderer.invoke('system:getLocalIP'),
  getDeterministicKey: () => ipcRenderer.invoke('system:getDeterministicKey'),
  getMachineName: () => ipcRenderer.invoke('system:getMachineName'),
  openViewerWindow: (sessionId: string, serverIP: string, token: string, deviceName?: string, deviceType?: string) => ipcRenderer.invoke('viewer:open-window', sessionId, serverIP, token, deviceName, deviceType),
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
  onFileReceived: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('host:file-received', listener);
    return () => ipcRenderer.removeListener('host:file-received', listener);
  },
  openPath: (savePath: string) => ipcRenderer.invoke('system:openPath', savePath),
  sendSignalingMessage: (msg: any) => ipcRenderer.send('viewer:send-signaling', msg),
  onSignalingMessage: (callback: (msg: any) => void) => {
    const listener = (_: any, msg: any) => callback(msg);
    ipcRenderer.on('viewer:signaling-message', listener);
    return () => ipcRenderer.removeListener('viewer:signaling-message', listener);
  },
  onSignalingDisconnected: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('viewer:signaling-disconnected', listener);
    return () => ipcRenderer.removeListener('viewer:signaling-disconnected', listener);
  },
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
    readText: () => ipcRenderer.invoke('clipboard:readText')
  },
  isPackaged: () => ipcRenderer.invoke('system:isPackaged'),
  log: (msg: string, level: 'info' | 'warn' | 'error' = 'info') => ipcRenderer.invoke('system:log', msg, level),
  onAuthDeepLinkSuccess: (callback: (tokens: { accessToken: string, refreshToken: string }) => void) => {
    const listener = (_: any, tokens: { accessToken: string, refreshToken: string }) => callback(tokens);
    ipcRenderer.on('auth:deep-link-success', listener);
    return () => ipcRenderer.removeListener('auth:deep-link-success', listener);
  },
  onAuthOnboard: (callback: (data: { token: string }) => void) => {
    const listener = (_: any, data: { token: string }) => callback(data);
    ipcRenderer.on('auth:onboard', listener);
    return () => ipcRenderer.removeListener('auth:onboard', listener);
  },
  onHostStats: (callback: (stats: { bandwidth: string, activeUsers: number, cpu: string, memory: string }) => void) => {
    const listener = (_: any, stats: any) => callback(stats);
    ipcRenderer.on('host:stats', listener);
    return () => ipcRenderer.removeListener('host:stats', listener);
  },
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  saveFileLocally: (name: string, data: Uint8Array) => ipcRenderer.invoke('host:save-file-locally', name, data),
  sendFileToViewer: () => ipcRenderer.send('host:send-file'),
  getScreens: () => ipcRenderer.invoke('host:get-screens'),
  setCaptureScreen: (displayId: number) => ipcRenderer.invoke('host:set-capture-screen', displayId),
});
