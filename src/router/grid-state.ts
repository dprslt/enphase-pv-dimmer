import moment, { Moment } from 'moment';
import { LoadConfig } from '../config.js';
import { DimmerValue } from '../ports-adapters/dimmer/dimmer.js';
import { MetersValues } from '../ports-adapters/meters/meter.js';

export class GridState {
    overflow: number;
    netComsuption: number;
    dimmerSetting: number;
    waterTemp?: number;
    timestamp: Moment;

    constructor(private meters: MetersValues, private dimmer: DimmerValue, private loadConfig: LoadConfig) {
        this.overflow = -meters.consumption.instantaneousDemand;
        this.netComsuption = meters.consumption.instantaneousDemand + meters.production.instantaneousDemand;
        this.dimmerSetting = dimmer.perc || 0;
        this.waterTemp = dimmer.temp;
        this.timestamp = moment();
    }

    isDimmerInactive(): boolean {
        return this.dimmerSetting === 0;
    }

    isDimmerActive(): boolean {
        return !this.isDimmerInactive();
    }

    // Define a threshold around 1% of the load since this is the smaller step we can do with the dimmer
    isOverflowOverThreesold(): boolean {
        // TODO move this to config
        return this.overflow > this.loadConfig.loadPower * 0.01;
    }

    // TODO get theses values outside in a config and a separate class
    isWaterUnderLowRange(): boolean {
        if (this.waterTemp == undefined || this.waterTemp === 0) {
            return false;
        }
        return this.waterTemp < 50;
    }

    isWaterOverTarget(): boolean {
        if (this.waterTemp == undefined) {
            return false;
        }
        return this.waterTemp > 55;
    }

    private genericLogItems(): Array<string | number | undefined> {
        return [
            '[STATE] - ',
            this.timestamp.format('ddd DD MMM YYYY HH:mm:ss.SSS'),
            '[SUN]',
            this.meters.production.instantaneousDemand.toFixed(1),
            '[GRID]',
            this.meters.consumption.instantaneousDemand.toFixed(1),
            '[USED]',
            this.netComsuption.toFixed(1),
            '[OVERFLOW]',
            this.overflow.toFixed(0),
            '[TEMP°]',
            this.waterTemp,
            '[PERC]',
            this.dimmerSetting,
        ];
    }

    logNoProd() {
        console.log(...this.genericLogItems());
    }

    logDimmer(percChange: number = 0, newPerc: number = 0, newPower = 0) {
        console.log(
            ...this.genericLogItems(),
            '[PERC_CHANGE]',
            percChange < 0 ? '-' : '+',
            percChange,
            '%',
            '[NEWPERC]',
            newPerc,
            '[PWR]',
            newPower,
            'W'
        );
    }

    logNight(heating: boolean) {
        console.log(...this.genericLogItems(), '[NIGHT-HEATING]', heating ? 'yes' : 'no');
    }
}
