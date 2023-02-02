import { Clock } from '../../src/ports-adapters/clock/clock';
import { TestAdapter } from './TestAdapter';

export class TestFixedClockAdapter extends TestAdapter implements Clock {
    makeIteration(): void {
        // DO NOTHNG
    }
    night: boolean = false;

    isNight(): boolean {
        return this.night;
    }
    isDay(): boolean {
        return !this.isNight();
    }

    setTime(time: 'day' | 'night'): void {
        this.night = time === 'night';
    }
}
