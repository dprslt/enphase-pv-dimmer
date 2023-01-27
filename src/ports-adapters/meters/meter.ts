import { MeterReading } from '../../types/IvpMetersReadings.js';

export type MetersValues = { production: MeterReading; consumption: MeterReading };

export interface Meter {
    readValues(): Promise<MetersValues>;
}
