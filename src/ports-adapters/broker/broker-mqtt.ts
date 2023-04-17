import { Broker, BrokerOptions } from './broker.js';
import { AsyncMqttClient, connect } from 'async-mqtt'; // import connect from mqtt


export class BrokerMQTT implements Broker {
    client: AsyncMqttClient;

    constructor(private MQTTHost: string) {
        this.client = connect(`mqtt://${this.MQTTHost}`, {
            keepalive: 10,
            connectTimeout: 4000,
        });

        this.client.on('offline', () => this.client.reconnect());
    }
    onConnect(cb: () => void): void {
        this.client.on('connect', cb);
    }
    onDisconnect(cb: () => void): void {
        this.client.on('disconnect', cb);
    }
    onError(cb: () => void): void {
        this.client.on('error', cb);
    }

    async publish(key: string, value: string, options?: BrokerOptions): Promise<void> {
        await this.client.publish(key, value, {retain: options?.retain});
    }

    isReady(): boolean {
        return this.client.connected;
    }
}
