import { suite } from 'uvu';
import * as assert from 'uvu/assert';
import { LoadConfig } from '../../src/config';
import { buildBasicDimmer, TestDimmerAdapter } from './TestDimmerAdapter';

const tests = suite('Test Dimmer Adapter');

const config: LoadConfig = {
    loadPower: 1000,
    maxPower: 100,
};

tests('module power should change power value', () => {
    const dimmer = buildBasicDimmer(config, 30);
    assert.is(dimmer.power, 30);
    dimmer.modulePower(50);
    assert.is(dimmer.power, 50);
});

tests('Basic Dimmer should decrease temp when not powered', () => {
    const dimmer = buildBasicDimmer(config, 0, 45);
    assert.is(dimmer.temp, 45);
    dimmer.makeIteration();
    assert.is(dimmer.temp, 44);
    dimmer.makeIteration();
    assert.is(dimmer.temp, 43);
});

tests('Basic Dimmer should increase temp when powered', () => {
    const dimmer = buildBasicDimmer(config, 100, 45);
    assert.is(dimmer.temp, 45);
    dimmer.makeIteration();
    assert.is(dimmer.temp, 46);
    dimmer.modulePower(75);
    dimmer.makeIteration();
    assert.is(dimmer.temp, 47);
});

tests('Basic Dimmer should stabilize temp when lightly powered', () => {
    const dimmer = buildBasicDimmer(config, 40, 45);
    assert.is(dimmer.temp, 45);
    dimmer.makeIteration();
    assert.is(dimmer.temp, 45);
});

tests.run();
