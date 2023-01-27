import { Broker } from "./broker.js";


export class BrokerTest implements Broker {
    
    constructor() {
    }

    onConnect(cb: () => void): void {
        throw new Error("Method not implemented.");
    }

    onDisconnect(cb: () => void): void {
        throw new Error("Method not implemented.");
    }
    
    onError(cb: () => void): void {
        throw new Error("Method not implemented.");
    }

    async publish(key: string, value: string): Promise<void> {
        console.log("{MQTT} - ", key, '-', value)
    }

    isReady(): boolean {
        return true
    }

}