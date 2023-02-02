import { LightMeterReading } from '../../types/IvpMetersReadings.js';

export type MetersValues = { production: LightMeterReading; consumption: LightMeterReading };

export interface Meter {
    readValues(): Promise<MetersValues>;
}
