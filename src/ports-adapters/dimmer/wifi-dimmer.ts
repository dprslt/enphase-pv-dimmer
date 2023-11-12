import { timeHttpGetJson, timeHttpGetText } from '../http.js';
import { Dimmer } from './dimmer.js';


type WifiDimmerStatePayload = {
        "dimmer": number,
        "temperature": string,
        "power": number,
        "Ptotal": number,
        "alerte": number,
        "relay1": number,
        "relay2": number,
        "minuteur": boolean
}

export class WifiDimmer implements Dimmer {
    constructor(private dimmerHostname: string) {}

    async readValues(): Promise<{ perc?: number | undefined; temp?: number | undefined }> {
        const dimmerState = await timeHttpGetJson<WifiDimmerStatePayload>(`http://${this.dimmerHostname}/state`);
        
        return {
            perc: dimmerState.dimmer || undefined,
            temp: dimmerState.temperature ? Number.parseInt(dimmerState.temperature) : undefined,
        };
    }
    async modulePower(power: number): Promise<void> {
        const cleanedPower = Math.floor(power);
        await timeHttpGetText(`http://${this.dimmerHostname}/?POWER=${cleanedPower}`);
    }
}
