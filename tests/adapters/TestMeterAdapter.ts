import { LoadConfig } from '../../src/config.js';
import { Meter, MetersValues } from '../../src/ports-adapters/meters/meter.js';
import { TestAdapter } from './TestAdapter.js';
import { TestDimmerAdapter } from './TestDimmerAdapter.js';

export class TestMeterAdapter extends TestAdapter implements Meter {
    makeIteration(): void {
        throw new Error('Method not implemented.');
    }
    constructor(
        public baseConsumption: number = 0,
        public baseProduction: number = 0,
        private dimmerLoad: TestDimmerAdapter,
        private loadConfig: LoadConfig
    ) {
        super();
    }

    public getTotalCons(): number {
        return this.baseConsumption + this.dimmerLoad.readRealDrawedPower();
    }

    async readValues(): Promise<MetersValues> {
        const prod = this.baseProduction;
        const cons = this.getTotalCons() - prod;
        return {
            production: { instantaneousDemand: prod },
            consumption: { instantaneousDemand: cons },
        };
    }

    async setValues(baseConsumption: number, baseProduction: number) {
        this.baseConsumption = baseConsumption;
        this.baseProduction = baseProduction;
    }
}
