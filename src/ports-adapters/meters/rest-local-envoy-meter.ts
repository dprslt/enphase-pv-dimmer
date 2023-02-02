import { LightMeterReadings } from '../../types/IvpMetersReadings.js';
import { timeHttpGetJson } from '../http.js';
import { Meter, MetersValues } from './meter.js';

export class RestLocalEnvoyMeter implements Meter {
    private requestOpt;
    constructor(private envoyHostname: string, private envoyToken: string) {
        this.requestOpt = {
            headers: {
                Authorization: `Bearer ${envoyToken}`,
            },
            https: {
                rejectUnauthorized: false,
            },
        };
    }

    getEnvoy = async <T>(path: string): Promise<T> => {
        return timeHttpGetJson(`https://${this.envoyHostname}/${path}`, this.requestOpt);
    };

    async readValues(): Promise<MetersValues> {
        const meterReadings = await this.getEnvoy<LightMeterReadings>('ivp/meters/readings');

        const [production, consumption] = meterReadings;
        return {
            production,
            consumption,
        };
    }
}
