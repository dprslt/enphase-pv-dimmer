import { suite } from 'uvu';
import * as assert from 'uvu/assert';
import { LoadConfig } from '../../src/config';
import { buildBasicDimmer, TestDimmerAdapter } from './TestDimmerAdapter';
import { TestMeterAdapter } from './TestMeterAdapter';

const tests = suite('Test Meter Adapter');

tests('meter should set baseValues', async () => {
    const config: LoadConfig = {
        loadPower: 1000,
        maxPower: 100,
    };
    const dimmer = buildBasicDimmer(config);
    const meter = new TestMeterAdapter(100, 200, dimmer, config);

    assert.is(meter.baseConsumption, 100);
    assert.is(meter.baseProduction, 200);

    meter.setValues(300, 500);
    assert.is(meter.baseConsumption, 300);
    assert.is(meter.baseProduction, 500);
});

tests('meter should count energy like a meter ', async () => {
    const config: LoadConfig = {
        loadPower: 1000,
        maxPower: 100,
    };
    const dimmer = buildBasicDimmer(config);
    const meter = new TestMeterAdapter(100, 200, dimmer, config);

    assert.is((await meter.readValues()).consumption.instantaneousDemand, -100);
    assert.is((await meter.readValues()).production.instantaneousDemand, 200);

    meter.setValues(300, 500);
    assert.is((await meter.readValues()).consumption.instantaneousDemand, -200);
    assert.is((await meter.readValues()).production.instantaneousDemand, 500);
});

tests('meter should add dimmer value', async () => {
    const config: LoadConfig = {
        loadPower: 1000,
        maxPower: 100,
    };
    const dimmer = buildBasicDimmer(config);
    const meter = new TestMeterAdapter(100, 0, dimmer, config);

    dimmer.modulePower(50);
    assert.is((await meter.readValues()).consumption.instantaneousDemand, 600);
});

tests.run();
