import { test } from 'uvu';
import * as assert from 'uvu/assert';

import { Router } from '../../src/router/router.js';
import { TestBrokerAdapter } from '../adapters/TestBrokerAdapter.js';
import { buildBasicDimmer } from '../adapters/TestDimmerAdapter.js';
import { TestMeterAdapter } from '../adapters/TestMeterAdapter.js';
import { createRouterWithWaterTankFromConfig } from '../utils/RouterFactory.js';

test('should', () => {
    const { router } = createRouterWithWaterTankFromConfig();
});
