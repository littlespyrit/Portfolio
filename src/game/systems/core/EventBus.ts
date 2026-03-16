import type { GameEventType, GameEvent } from '../../types';

type EventHandler = (event: GameEvent) => void;

class EventBus {
    private listeners: Map<GameEventType, Set<EventHandler>> = new Map();

    /** S'abonner à un type d'événement */
    on(type: GameEventType, handler: EventHandler): void {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type)!.add(handler);
    }

    /** S'abonner une seule fois */
    once(type: GameEventType, handler: EventHandler): void {
        const wrapper: EventHandler = (event) => {
            handler(event);
            this.off(type, wrapper);
        };
        this.on(type, wrapper);
    }

    /** Se désabonner */
    off(type: GameEventType, handler: EventHandler): void {
        this.listeners.get(type)?.delete(handler);
    }

    /** Émettre un événement */
    emit(type: GameEventType, payload?: Record<string, unknown>): void {
        const event: GameEvent = { type, payload };
        this.listeners.get(type)?.forEach((handler) => handler(event));
    }

    /** Nettoyer tous les listeners (utile au destroy de scène) */
    clear(): void {
        this.listeners.clear();
    }
}

export const eventBus = new EventBus();