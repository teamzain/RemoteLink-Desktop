import { useDeviceStore } from '../stores/deviceStore';

const WS_URL = 'ws://159.65.84.190/api/signal';

class PresenceService {
  private socket: WebSocket | null = null;
  private retryTimer: any = null;
  private isManuallyClosing = false;
  private isConnecting = false;
  private backoffDelay = 5000;

  connect() {
    const { devices } = useDeviceStore.getState();
    const accessKeys = devices.map((d) => d.accessKey);
    
    if (accessKeys.length === 0) return;
    this.subscribeToDevices(accessKeys);
  }

  subscribeToDevices(accessKeys: string[]) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.connectWithKeys(accessKeys);
      return;
    }
    
    console.log('[Presence] Updating subscriptions:', accessKeys.length);
    this.socket.send(JSON.stringify({
      type: 'subscribe-presence',
      accessKeys: accessKeys,
    }));
  }

  private connectWithKeys(accessKeys: string[]) {
    if (this.isConnecting || (this.socket && this.socket.readyState === WebSocket.OPEN)) return;
    
    this.isConnecting = true;
    this.isManuallyClosing = false;
    this.socket = new WebSocket(WS_URL);

    this.socket.onopen = () => {
      console.log('[Presence] Connected');
      this.isConnecting = false;
      this.backoffDelay = 5000; // Reset backoff on success
      this.socket?.send(JSON.stringify({
        type: 'subscribe-presence',
        accessKeys: accessKeys,
      }));
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'presence-update') {
          const { sessionId, status } = data;
          useDeviceStore.getState().updateDeviceStatus(sessionId, status);
        } else if (data.type === 'ping') {
          this.socket?.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (err) {
        console.error('[Presence] Message error:', err);
      }
    };

    this.socket.onclose = () => {
      console.log('[Presence] Disconnected');
      this.isConnecting = false;
      if (!this.isManuallyClosing) {
        this.retryTimer = setTimeout(() => this.connect(), this.backoffDelay);
        this.backoffDelay = Math.min(this.backoffDelay * 1.5, 30000); // Exponential backoff max 30s
      }
    };

    this.socket.onerror = (err) => {
      console.error('[Presence] Error:', err);
    };
  }

  disconnect() {
    this.isManuallyClosing = true;
    this.socket?.close();
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }
}

export const presenceService = new PresenceService();
