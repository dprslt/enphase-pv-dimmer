import { Broker } from "./broker.js";
import { AsyncMqttClient, connect } from "async-mqtt"  // import connect from mqtt


export class BrokerMQTT implements Broker {
    client: AsyncMqttClient
    
    constructor(private MQTTHost: string) {
        this.client = connect(`mqtt://${this.MQTTHost}`, {
            keepalive: 10,
            connectTimeout: 4000
        }) 
    }
    onConnect(cb: () => void): void {
        this.client.on('connect', cb)
    }
    onDisconnect(cb: () => void): void {
        this.client.on('disconnect', cb)
    }
    onError(cb: () => void): void {
        this.client.on('error', cb)
    }

    async publish(key: string, value: string): Promise<void> {
        if(this.client.connected) {
            await this.client.publish(key, value)
        }
    }

    isReady(): boolean {
        return this.client.connected;
    }

}