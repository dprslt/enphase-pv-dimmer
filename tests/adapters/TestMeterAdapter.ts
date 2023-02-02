import { Meter, MetersValues } from '../../src/ports-adapters/meters/meter.js';
import { TestAdapter } from './TestAdapter.js';

export class TestMeterAdapter extends TestAdapter implements Meter {
    consumption: number = 0;
    production: number = 0;

    makeIteration(): void {
        throw new Error('Method not implemented.');
    }
    constructor() {
        super();
    }

    async readValues(): Promise<MetersValues> {
        return {
            production: { instantaneousDemand: this.production },
            consumption: { instantaneousDemand: this.consumption },
        };
    }
}
