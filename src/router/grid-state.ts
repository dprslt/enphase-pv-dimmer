import moment, { Moment } from 'moment';
import { LoadConfig } from '../config.js';
import { DimmerValue } from '../ports-adapters/dimmer/dimmer.js';
import { MetersValues } from '../ports-adapters/meters/meter.js';

export class GridState {
    gridFlow: number;
    netComsuption: number;
    dimmerSetting: number;
    waterTemp?: number;
    time: Moment;

    constructor(private meters: MetersValues, private dimmer: DimmerValue, private loadConfig: LoadConfig) {
        this.gridFlow = meters.consumption.instantaneousDemand;
        this.netComsuption = meters.consumption.instantaneousDemand + meters.production.instantaneousDemand;
        this.dimmerSetting = dimmer.perc || 0;
        this.waterTemp = dimmer.temp;
        this.time = moment();
    }

    isNight(): boolean {
        return this.time.hours() > 23 || this.time.hours() < 6;
    }

    isDay(): boolean {
        return !this.isNight();
    }

    isDimmerInactive(): boolean {
        return this.dimmerSetting === 0;
    }

    // Define a threshold around 1% of the load since this is the smaller step we can do with the dimmer
    isGridFlowUnderThreesold(): boolean {
        return this.gridFlow > this.loadConfig.loadPower * 0.01;
    }

    isWaterUnderLowRange(): boolean {
        if (this.waterTemp == undefined) {
            return false;
        }
        return this.waterTemp < 55;
    }

    log(percChange: number = 0, newPerc: number = 0, newPower = 0) {
        console.log(
            this.time.format('ddd DD MMM YYYY HH:mm:ss.SSS'),
            '[SUN]',
            this.meters.production.instantaneousDemand.toFixed(1),
            '[GRID]',
            this.meters.consumption.instantaneousDemand.toFixed(1),
            '[USED]',
            this.netComsuption.toFixed(1),
            '[OVERFLOW]',
            -this.gridFlow.toFixed(0),
            '[TEMP°]',
            this.waterTemp,
            '[PERC]',
            this.dimmerSetting,
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
}
