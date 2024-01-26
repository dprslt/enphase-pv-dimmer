export type BrokerOptions = {
    retain?: boolean
}

export interface Broker {
    publish(key: string, value: string, options?: BrokerOptions): Promise<void>;
    isReady() : boolean;
    onConnect(cb: () => void): void;
    onDisconnect(cb: () => void): void;
    onError(cb: () => void): void;
}