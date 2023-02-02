import { LoadConfig } from '../../src/config.js';
import { Router, RouterPorts } from '../../src/router/router.js';
import { TestAdapter } from '../adapters/TestAdapter.js';
import { TestBrokerAdapter } from '../adapters/TestBrokerAdapter.js';
import { buildBasicDimmer, TestDimmerAdapter } from '../adapters/TestDimmerAdapter.js';
import { TestFixedClockAdapter } from '../adapters/TestFixedClock.js';
import { TestMeterAdapter } from '../adapters/TestMeterAdapter.js';

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
export const createRouterWithWaterTankFromConfig = (config: LoadConfig): RouterAndPorts => {
    const dimmer = buildBasicDimmer(config);
    const meter = new TestMeterAdapter(0, 0, dimmer, config);

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
