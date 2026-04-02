export function injectMouseMove(x: number, y: number): void;
export function injectMouseAction(button: 'left' | 'right' | 'middle', action: 'down' | 'up'): void;
export function injectMouseScroll(deltaX: number, deltaY: number): void;
export function injectKeyAction(vk: number, action: 'down' | 'up'): void;
export function injectText(text: string): void;
