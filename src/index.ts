
 import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
 dotenv.config()
 
 import got from 'got'
import { MeterReading, MeterReadings } from './types/IvpMetersReadings.js'
import { connect } from "mqtt"  // import connect from mqtt

export const TOKEN = process.env['TOKEN']
export const ENVOY_HOSTNAME = process.env['ENVOY_HOSTNAME']
export const DIMMER_HOSTNAME = process.env['DIMMER_HOSTNAME']
const LOAD_POWER = process.env['LOAD_POWER'] ?  Number.parseInt(process.env['LOAD_POWER']): 100;
const MAX_PWR = process.env['MAX_PWR'] ? Number.parseInt(process.env['MAX_PWR']): 50;

const MQTT_HOST = process.env['MQTT_HOST']

let client = connect(`mqtt://${MQTT_HOST}`) // create a client


export const envoyUrl = (path?: string) => {
    return `https://${ENVOY_HOSTNAME}/${path}`
} 

export const setPower = async (power:number): Promise<void> => {
    const cleanedPower = Math.floor(power);
    console.log("Set Power To ", cleanedPower);
    await got.get(`http://${DIMMER_HOSTNAME}/?POWER=${cleanedPower}`);
}

export const getEnvoy = async <T>(path: string) : Promise<T> => {
    return await got.get(envoyUrl(path), {
        headers: {
            "Authorization": `Bearer ${TOKEN}`
        },
        https: {
            rejectUnauthorized: false
        }
        
    }).json<T>()
}

export const getMaxPower = async (): Promise<number | undefined> => {
    const result = await got.get(`http://${DIMMER_HOSTNAME}/state`).text();
    const textNumber = result.split(';')[0]
    if(textNumber){
        return Number.parseInt(textNumber)
    } else {
        return undefined
    }
}

export type EnvoyMetersValue = {production: MeterReading, consumption: MeterReading}
export const getMetersValuesFromEnvoy = async (): Promise<EnvoyMetersValue> => {
    const meterReadings = await getEnvoy<MeterReadings>('ivp/meters/readings')

    const [production, consumption] = meterReadings
    return {
        production, consumption
    }
}

export const moduleLoadFromEnvoy = async (envoyMetersValues: EnvoyMetersValue): Promise<void> => {

    let gridFlow = envoyMetersValues.consumption.instantaneousDemand
    const currentDimmerSetting = await getMaxPower() || 0

    
    // Define a threshold around 1% of the load since this is the smaller step we can do with the dimmer
    if(gridFlow > LOAD_POWER * 0.01 && currentDimmerSetting === 0) {
        console.log("We're not exporting anything, we should cut the load for now")
        // TODO improve this algorithm, we should slowly decrease the load
        await setPower(0)
    } else {
        // const currentTheoricalMaxLoad = LOAD_POWER * currentdimmerSetting/100

        // If the dimmer is already set with a value higher than 0, we must compute this current
        // const houseConsumption = gridFlow - currentTheoricalMaxLoad

        // const exportFlow = Math.abs(houseConsumption)
        // const loadPercentage = exportFlow / LOAD_POWER * 100;
        // Fow now Lock max value at 50 perc, even if this is already hardcoded in the dimmer
        // const flooredValue = Math.min(Math.floor(loadPercentage), 50)

        //  algo v2

        const overflow = -gridFlow
        const neededChange  = overflow / LOAD_POWER * 100;
        const newPercValue = currentDimmerSetting + neededChange;
        // If the value is < 0 we just need to cut the load
        const flooredValue = Math.max(Math.min(Math.floor(newPercValue), MAX_PWR), 0)

        console.log(
            '[OVERFLOW]', overflow, 
            '[PERC]', currentDimmerSetting,
            '[PERC_CHANGE]', neededChange < 0 ? '-':'+', neededChange,'%',
            '[NEWPERC]', flooredValue, flooredValue > MAX_PWR ? 'CAPPED': '', 
            '[PWR]', Math.round(flooredValue /100 * LOAD_POWER), 'W'
        )

        await setPower(flooredValue)
    }
   
}

async function sendMetricsToHA(envoyMetersValues: EnvoyMetersValue) {
    // MQTT Discovery
    const consumptionConfig = {
        "dev_cla": "power",
        "unit_of_meas": "W",
        "stat_cla": "measurement",
        "name": "power_grid",
        "state_topic": "homeassistant/sensor/envoy-90/state",
        "stat_t": "homeassistant/sensor/envoy-90/state",
        "avty_t": "homeassistant/sensor/envoy-90/status",
        "uniq_id": "90_power_grid",
        "value_template": "{{ value_json.power }}",
        "dev": {
            "ids": "envoy-90",
            "name": "envoy-90",
            "sw": "PV Router",
            "mdl": "ESP8266 192.168.17.68",
            "mf": "Dprslt"
        }
    }
    await client.publish('homeassistant/sensor/envoy/power_grid/config', JSON.stringify(consumptionConfig))


    await client.publish('homeassistant/sensor/envoy/state')

    
}

async function fetchMetersAndModule() {
    const envoyMetersValues = await getMetersValuesFromEnvoy();
    
    const {production, consumption} = envoyMetersValues
    const netComsuption = consumption.instantaneousDemand + production.instantaneousDemand
    console.log("[SUN]", production.instantaneousDemand, "[GRID]", consumption.instantaneousDemand, "[USED]", netComsuption)

   
    try {
        await moduleLoadFromEnvoy(envoyMetersValues)
    } catch(e) {
        console.error("Something gone wrong, stoping load")
        await setPower(0)
    }

    console.log("")
}


fetchMetersAndModule()
function installTimeout() {
    setTimeout(() => {
        fetchMetersAndModule().then(() => installTimeout())
    }, 5000)
}

installTimeout()

process.on('SIGINT', async () => {
    console.log("Turning off and setting load to 0")
    await setPower(0)
    process.exit(0)
});