export type SystemEventMap = {
  "nepse:snapshot": {
    source: string;
    data: Record<string, unknown>;
    fetchedAt: number;
  };
  "nepse:status": { isOpen: boolean };
  "alert:fired": {
    watchId: string;
    watchName: string;
    message: string;
    value: unknown;
    firedAt: string;
  };
  "system:error": { module: string; message: string; err?: unknown };
  "system:info": { module: string; message: string };
};

export type EventKey = keyof SystemEventMap;
export type EventHandler<K extends EventKey> = (
  payload: SystemEventMap[K],
) => void;

export class SystemEvents {
  private listeners: {
    [K in EventKey]?: Set<EventHandler<K>>;
  } = {};

  // publish an event
  emit<K extends EventKey>(event: K, payload: SystemEventMap[K]): void {
    const handlers = this.listeners[event];
    if (!handlers) return;

    for (const handler of handlers) {
      handler(payload);
    }
  }

  // subscribe
  on<K extends EventKey>(event: K, handler: EventHandler<K>): void {
    if (!this.listeners[event]) {
      // Cast needed: TS cannot narrow mapped type index to specific K
      (this.listeners as any)[event] = new Set();
    }

    // Cast needed: TS can't narrow mapped type index to specific K
    (this.listeners[event] as Set<EventHandler<K>>).add(handler);
  }

  // unsubscribe
  off<K extends EventKey>(event: K, handler: EventHandler<K>): void {
    const handlers = this.listeners[event];
    if (!handlers) return;

    // Cast needed: TS can't narrow mapped type index to specific K
    (handlers as Set<EventHandler<K>>).delete(handler);

    if (handlers.size === 0) {
      delete this.listeners[event];
    }
  }

  // optional helper: subscribe once
  once<K extends EventKey>(event: K, handler: EventHandler<K>): void {
    const wrapper: EventHandler<K> = (payload) => {
      handler(payload);
      this.off(event, wrapper);
    };

    this.on(event, wrapper);
  }

  // optional helper: clear all listeners
  clear(): void {
    this.listeners = {};
  }
}

export const systemEvents = new SystemEvents();
