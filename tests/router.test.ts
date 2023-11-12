import { suite } from 'uvu';
import * as assert from 'uvu/assert';

import { Router } from '../src/router/router.js';
import { TestBrokerAdapter } from './adapters/TestBrokerAdapter.js';
import { buildBasicDimmer } from './adapters/TestDimmerAdapter.js';
import { TestMeterAdapter } from './adapters/TestMeterAdapter.js';
import { createRouterWithWaterTankFromConfig } from './utils/RouterFactory.js';

const dayTestsSuite = suite('Router Day Mode');

dayTestsSuite('It should trigger dimmer if production is greater than consumption', async () => {
    const { router, testAdapters } = createRouterWithWaterTankFromConfig({
        loadPower: 1000,
        maxPower: 100,
    });
    testAdapters.clock.setTime('day');
    testAdapters.meter.setValues(0, 1000);
    await router.loopIteration();
    assert.is(testAdapters.dimmer.power, 100);
    // It should send status message to the broker
    assert.is(testAdapters.broker.messages.length, 1);

    testAdapters.meter.setValues(0, 500);
    await router.loopIteration();
    assert.is(testAdapters.dimmer.power, 50);
    // It should send status message to the broker
    assert.is(testAdapters.broker.messages.length, 2);
});

dayTestsSuite('It should stop dimmer if production is lower than consumption', async () => {
    const { router, testAdapters } = createRouterWithWaterTankFromConfig({
        loadPower: 1000,
        maxPower: 100,
    });
    testAdapters.clock.setTime('day');

    testAdapters.meter.setValues(500, 500);
    await router.loopIteration();
    assert.is(testAdapters.dimmer.power, 0);
    // It should send status message to the broker
    assert.is(testAdapters.broker.messages.length, 1);

    testAdapters.meter.setValues(500, 250);
    await router.loopIteration();
    assert.is(testAdapters.dimmer.power, 0);
    // It should send status message to the broker
    assert.is(testAdapters.broker.messages.length, 2);
});

// TODO simulate a full tank


dayTestsSuite.run();
