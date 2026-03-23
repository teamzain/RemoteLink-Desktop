declare module '@remotelink/native-input' {
  export function injectMouseMove(x: number, y: number): void;
  export function injectMouseAction(button: 'left' | 'right' | 'middle', action: 'down' | 'up'): void;
  export function injectKeyAction(vkCode: number, action: 'down' | 'up'): void;
}
