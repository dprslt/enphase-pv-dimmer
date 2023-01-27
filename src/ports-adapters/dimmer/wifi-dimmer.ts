import { timeHttpGetText } from '../http.js';
import { Dimmer } from './dimmer.js';

export class WifiDimmer implements Dimmer {
    constructor(private dimmerHostname: string) {}

    async readValues(): Promise<{ perc?: number | undefined; temp?: number | undefined }> {
        const result = await timeHttpGetText(`http://${this.dimmerHostname}/state`);
        const [textPerc, textTemp] = result.split(';');
        return {
            perc: textPerc ? Number.parseInt(textPerc) : undefined,
            temp: textTemp ? Number.parseInt(textTemp) : undefined,
        };
    }
    async modulePower(power: number): Promise<void> {
        const cleanedPower = Math.floor(power);
        await timeHttpGetText(`http://${this.dimmerHostname}/?POWER=${cleanedPower}`);
    }
}
