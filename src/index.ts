import { BrokerMQTT } from './ports-adapters/broker/broker-mqtt.js';
import { buildConfigFromEnv } from './config.js';
import { WifiDimmer } from './ports-adapters/dimmer/wifi-dimmer.js';
import { Router } from './router/router.js';
import { sleep } from './utils/sleep.js';
import { RestLocalEnvoyMeter } from './ports-adapters/meters/rest-local-envoy-meter.js';

import * as dotenv from 'dotenv'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import moment from 'moment';
import { MomentClock } from './ports-adapters/clock/momentClock.js';
dotenv.config();

let shouldStop = false;

const config = buildConfigFromEnv();

const mqttAdapter = new BrokerMQTT(config.mqttHost);
const wifiDimmer = new WifiDimmer(config.dimmerHostname);
const envoyMeter = new RestLocalEnvoyMeter(config.envoyHostname, config.envoyToken);
const momentClock = new MomentClock();

moment.locale('fr');

const router = new Router(
    {
        broker: mqttAdapter,
        dimmer: wifiDimmer,
        meter: envoyMeter,
        clock: momentClock,
    },
    {
        loadPower: config.loadPower,
        maxPower: config.maxPower,
    }
);

async function startLoop() {
    await router.initialize();
    while (!shouldStop) {
        try {
            await router.loopIteration();
        } catch (e) {
            console.error('An error occured');
            console.error(e);
        }

        await sleep(5000);
    }
}

process.on('SIGINT', async () => {
    try {
        await router.stop();
    } catch (e) {
        console.error(e);
        console.error('Unable to stop cleanly');
    }
    process.exit(0);
});

startLoop();
