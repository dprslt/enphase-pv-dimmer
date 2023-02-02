import { Router } from '../src/router/router';
import { TestBrokerAdapter } from './adapters/TestBrokerAdapter';
import { buildBasicDimmer } from './adapters/TestDimmerAdapter';
import { TestMeterAdapter } from './adapters/TestMeterAdapter';
import { createRouterWithWaterTankFromConfig } from './utils/RouterFactory';

describe('testing router', () => {
    it('should', () => {
        const { router } = createRouterWithWaterTankFromConfig();
    });
});
