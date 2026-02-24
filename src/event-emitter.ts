// Minimal typed event emitter (zero dependencies).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (...args: any[]) => void;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export class EventEmitter<EventMap extends {}> {
  private listeners = new Map<keyof EventMap, Set<Handler>>();

  on<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void,
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as Handler);
    return () => this.off(event, handler);
  }

  once<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void,
  ): () => void {
    const wrapper = (data: EventMap[K]) => {
      this.off(event, wrapper);
      handler(data);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof EventMap>(
    event: K,
    handler: (data: EventMap[K]) => void,
  ): void {
    this.listeners.get(event)?.delete(handler as Handler);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const handler of set) {
        handler(data);
      }
    }
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
