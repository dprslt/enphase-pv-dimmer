import { Broker } from '../../src/ports-adapters/broker/broker.js';
import { TestAdapter } from './TestAdapter.js';

export class TestBrokerAdapter extends TestAdapter implements Broker {
    messages: Array<{ key: string; value: string }> = [];

    makeIteration(): void {
        // Do nothing
    }
    async publish(key: string, value: string): Promise<void> {
        this.messages.push({ key, value });
    }

    cleanMessage() {
        this.messages = [];
    }

    isReady(): boolean {
        return true;
    }
    onConnect(cb: () => void): void {
        // TODO implement this, do nothing for now
    }
    onDisconnect(cb: () => void): void {
        // TODO implement this, do nothing for now
    }
    onError(cb: () => void): void {
        // TODO implement this, do nothing for now
    }
}
