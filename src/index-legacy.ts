import * as dotenv from 'dotenv'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();

import got from 'got';
import { MeterReading, MeterReadings } from './types/IvpMetersReadings.js';
import { connect } from 'async-mqtt'; // import connect from mqtt
import { sleep } from './utils/sleep.js';

export const TOKEN = process.env['TOKEN'];
export const ENVOY_HOSTNAME = process.env['ENVOY_HOSTNAME'];
export const DIMMER_HOSTNAME = process.env['DIMMER_HOSTNAME'];
const LOAD_POWER = process.env['LOAD_POWER'] ? Number.parseInt(process.env['LOAD_POWER']) : 100;
const MAX_PWR = process.env['MAX_PWR'] ? Number.parseInt(process.env['MAX_PWR']) : 50;

const MQTT_HOST = process.env['MQTT_HOST'];

export const envoyUrl = (path?: string) => {
    return `https://${ENVOY_HOSTNAME}/${path}`;
};

const webGetTimeouts = {
    request: 4000,
    socket: 1000,
    send: 1000,
    response: 1000,
};

export const setPower = async (power: number): Promise<void> => {
    const cleanedPower = Math.floor(power);
    await got.get(`http://${DIMMER_HOSTNAME}/?POWER=${cleanedPower}`, {
        timeout: webGetTimeouts,
    });
};

export const getEnvoy = async <T>(path: string): Promise<T> => {
    return await got
        .get(envoyUrl(path), {
            headers: {
                Authorization: `Bearer ${TOKEN}`,
            },
            https: {
                rejectUnauthorized: false,
            },
            timeout: webGetTimeouts,
        })
        .json<T>();
};

type DimmerValue = {
    perc?: number;
    temp?: number;
};
export const getDimmerValue = async (): Promise<DimmerValue> => {
    const result = await got
        .get(`http://${DIMMER_HOSTNAME}/state`, {
            timeout: webGetTimeouts,
        })
        .text();
    const [textPerc, textTemp] = result.split(';');
    return {
        perc: textPerc ? Number.parseInt(textPerc) : undefined,
        temp: textTemp ? Number.parseInt(textTemp) : undefined,
    };
};

export type EnvoyMetersValue = { production: MeterReading; consumption: MeterReading };
export const getMetersValuesFromEnvoy = async (): Promise<EnvoyMetersValue> => {
    const meterReadings = await getEnvoy<MeterReadings>('ivp/meters/readings');

    const [production, consumption] = meterReadings;
    return {
        production,
        consumption,
    };
};

export const moduleLoadFromEnvoy = async (envoyMetersValues: EnvoyMetersValue): Promise<void> => {
    const netComsuption = envoyMetersValues.consumption.instantaneousDemand + envoyMetersValues.production.instantaneousDemand;

    let gridFlow = envoyMetersValues.consumption.instantaneousDemand;
    const currentDimmerValues = await getDimmerValue();
    const currentDimmerSetting = currentDimmerValues.perc || 0;
    const currentWaterTemp = currentDimmerValues.temp;

    // Define a threshold around 1% of the load since this is the smaller step we can do with the dimmer
    if (gridFlow > LOAD_POWER * 0.01 && currentDimmerSetting === 0) {
        console.log(
            '-',
            new Date().toISOString(),
            '[SUN]',
            envoyMetersValues.production.instantaneousDemand,
            '[GRID]',
            envoyMetersValues.consumption.instantaneousDemand,
            '[USED]',
            netComsuption,
            '[OVERFLOW]',
            -gridFlow,
            '[TEMP°]',
            currentWaterTemp,
            '[PERC]',
            currentDimmerSetting,
            '[NEWPERC]',
            0,
            '[PWR]',
            0,
            'W',
            "We're not exporting anything, and the load is OFF"
        );
    } else {
        // const currentTheoricalMaxLoad = LOAD_POWER * currentdimmerSetting/100

        // If the dimmer is already set with a value higher than 0, we must compute this current
        // const houseConsumption = gridFlow - currentTheoricalMaxLoad

        // const exportFlow = Math.abs(houseConsumption)
        // const loadPercentage = exportFlow / LOAD_POWER * 100;
        // Fow now Lock max value at 50 perc, even if this is already hardcoded in the dimmer
        // const flooredValue = Math.min(Math.floor(loadPercentage), 50)

        //  algo v2

        const overflow = -gridFlow;
        const neededChange = (overflow / LOAD_POWER) * 100;
        const newPercValue = currentDimmerSetting + neededChange;
        // If the value is < 0 we just need to cut the load
        const flooredValue = Math.max(Math.min(Math.floor(newPercValue), MAX_PWR), 0);

        console.log(
            '-',
            new Date().toISOString(),
            '[SUN]',
            envoyMetersValues.production.instantaneousDemand,
            '[GRID]',
            envoyMetersValues.consumption.instantaneousDemand,
            '[USED]',
            netComsuption,
            '[OVERFLOW]',
            overflow,
            '[TEMP°]',
            currentWaterTemp,
            '[PERC]',
            currentDimmerValues.perc,
            '[PERC_CHANGE]',
            neededChange < 0 ? '-' : '+',
            neededChange,
            '%',
            '[NEWPERC]',
            flooredValue,
            flooredValue > MAX_PWR ? 'CAPPED' : '',
            '[PWR]',
            Math.round((flooredValue / 100) * LOAD_POWER),
            'W'
        );

        await setPower(flooredValue);
    }
};

async function installHaAutoDiscovery() {
    console.log('Installing HA autodiscovery entries');

    // MQTT Discovery
    const consumptionConfig = {
        dev_cla: 'power',
        unit_of_meas: 'W',
        stat_cla: 'measurement',
        name: 'power_grid',
        state_topic: 'homeassistant/sensor/envoy-90/state',
        stat_t: 'homeassistant/sensor/envoy-90/state',
        avty_t: 'homeassistant/sensor/envoy-90/status',
        uniq_id: '90_power_grid',
        value_template: '{{ value_json.power_grid }}',
        dev: {
            ids: 'envoy-90',
            name: 'envoy-90',
            sw: 'PV Router',
            mdl: 'Enphase Envoy 192.168.17.90',
            mf: 'Dprslt',
        },
    };
    await client.publish('homeassistant/sensor/envoy-90/power_grid/config', JSON.stringify(consumptionConfig));

    const productionConfig = {
        dev_cla: 'power',
        unit_of_meas: 'W',
        stat_cla: 'measurement',
        name: 'power_solar',
        state_topic: 'homeassistant/sensor/envoy-90/state',
        stat_t: 'homeassistant/sensor/envoy-90/state',
        avty_t: 'homeassistant/sensor/envoy-90/status',
        uniq_id: '90_power_solar',
        value_template: '{{ value_json.power_solar }}',
        dev: {
            ids: 'envoy-90',
            name: 'envoy-90',
            sw: 'PV Router',
            mdl: 'Enphase Envoy 192.168.17.90',
            mf: 'Dprslt',
        },
    };
    await client.publish('homeassistant/sensor/envoy-90/power_solar/config', JSON.stringify(productionConfig));

    await client.publish('homeassistant/sensor/envoy-90/status', 'online');

    console.log('HA Autodiscovery configured');
}

async function publishValuesToMQTT(envoyMetersValues: EnvoyMetersValue) {
    if (!client.connected) {
        console.log('Not connected to MQTT broker, skipping');
        return;
    }
    await client.publish(
        'homeassistant/sensor/envoy-90/state',
        JSON.stringify({
            power_grid: envoyMetersValues.consumption.instantaneousDemand,
            power_solar: envoyMetersValues.production.instantaneousDemand,
        })
    );
}

async function fetchMetersAndModule() {
    const envoyMetersValues = await getMetersValuesFromEnvoy();

    const sendToHaPromise = publishValuesToMQTT(envoyMetersValues);

    const { production, consumption } = envoyMetersValues;
    const netComsuption = consumption.instantaneousDemand + production.instantaneousDemand;

    try {
        await moduleLoadFromEnvoy(envoyMetersValues);
    } catch (e) {
        console.error('Something gone wrong, stoping load');
        await setPower(0);
    }

    try {
        await sendToHaPromise;
    } catch (e) {
        console.error(e);
    }
}

let shouldStop = false;

async function run() {
    while (!shouldStop) {
        try {
            await fetchMetersAndModule();
        } catch (e) {
            console.error('An error occured');
            console.error(e);
        }

        await sleep(5000);
    }
}

let client = connect(`mqtt://${MQTT_HOST}`, {
    keepalive: 10,
    connectTimeout: 4000,
});

client.on('connect', () => {
    console.log('connected to MQTT');
    installHaAutoDiscovery();
});

client.on('disconnect', () => {
    console.log('connection to MQTT Lost');
});
client.on('error', () => {
    console.log('An error occured with MQTT');
});

process.on('SIGINT', async () => {
    console.log('Turning off and setting load to 0');
    shouldStop = true;
    await setPower(0);
    if (client.connected) {
        await client.publish('homeassistant/sensor/envoy-90/status', 'offline');
    }
    process.exit(0);
});

run();
