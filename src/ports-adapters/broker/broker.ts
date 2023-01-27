export interface Broker {
    publish(key: string, value: string): Promise<void>;
    isReady() : boolean;
    onConnect(cb: () => void): void;
    onDisconnect(cb: () => void): void;
    onError(cb: () => void): void;
}