import moment from 'moment';
import { Clock } from './clock';

export class MomentClock implements Clock {
    // We should improve this by using this API to detect sunset
    // https://sunrise-sunset.org/api
    isNight(): boolean {
        // TODO improve support timezone to work with real hours
        return moment().hours() < 7;
    }

    isDay(): boolean {
        return !this.isNight();
    }
}
