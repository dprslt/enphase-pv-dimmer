import { LoadConfig } from '../../src/config';
import { Router, RouterPorts } from '../../src/router/router';
import { TestAdapter } from '../adapters/TestAdapter';
import { TestBrokerAdapter } from '../adapters/TestBrokerAdapter';
import { buildBasicDimmer, TestDimmerAdapter } from '../adapters/TestDimmerAdapter';
import { TestFixedClockAdapter } from '../adapters/TestFixedClock';
import { TestMeterAdapter } from '../adapters/TestMeterAdapter';

export type RouterAndPorts = {
    router: Router;
    testAdapters: {
        dimmer: TestDimmerAdapter;
        meter: TestMeterAdapter;
        broker: TestBrokerAdapter;
        clock: TestFixedClockAdapter;
    };
    config: LoadConfig;
};
export const createRouterWithWaterTankFromConfig = (): RouterAndPorts => {
    const config = {
        loadPower: 1000,
        maxPower: 100,
    };

    const dimmer = buildBasicDimmer();
    const meter = new TestMeterAdapter();
    const broker = new TestBrokerAdapter();
    const clock = new TestFixedClockAdapter();

    const testAdapters = {
        dimmer,
        meter,
        broker,
        clock,
    };

    const router = new Router(testAdapters, config);

    return { router, testAdapters, config };
};
