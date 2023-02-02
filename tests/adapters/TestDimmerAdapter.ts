import { Dimmer, DimmerValue } from '../../src/ports-adapters/dimmer/dimmer';
import { TestAdapter } from './TestAdapter';

export class TestDimmerAdapter extends TestAdapter implements Dimmer {
    power: number;
    temp: number;

    constructor(private readonly iterate: (currentDimmer: TestDimmerAdapter) => void, initialPower: number = 0, initialTemp: number = 45) {
        super();
        this.power = initialPower;
        this.temp = initialTemp;
    }

    makeIteration(): void {
        this.iterate(this);
    }

    readValues(): Promise<DimmerValue> {
        return Promise.resolve({
            perc: this.power,
            temp: this.temp,
        });
    }
    async modulePower(power: number): Promise<void> {
        // TODO improve this to clear the input just as the dimmer do
        this.power = power;
    }
}

/**
 * This create a dimmer which simulate water tank
 * If powered over 50perc the temperature will increase
 * If powered under 10perc the temperature will decrease
 */
export function buildBasicDimmer(initialPower: number = 0, initialTemp: number = 45): TestDimmerAdapter {
    return new TestDimmerAdapter((dimmer) => {
        if (dimmer.power >= 50) {
            dimmer.temp++;
        } else if (dimmer.power < 10) {
            dimmer.temp--;
        }
    });
}
