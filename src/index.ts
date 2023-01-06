
 import got from 'got'
import { MeterReading, MeterReadings } from './types/IvpMetersReadings.js'

export const TOKEN = "eyJraWQiOiI3ZDEwMDA1ZC03ODk5LTRkMGQtYmNiNC0yNDRmOThlZTE1NmIiLCJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJhdWQiOiIxMjIyMzkwODQxOTAiLCJpc3MiOiJFbnRyZXoiLCJlbnBoYXNlVXNlciI6Im93bmVyIiwiZXhwIjoxNzA0MTQxNDAxLCJpYXQiOjE2NzI2MDU0MDEsImp0aSI6IjY0Y2FiZDNiLWIyYWUtNGU0Zi04MGI5LTgxMDhmMDI1MDQ3MCIsInVzZXJuYW1lIjoidGhlby5kZXByZXNsZUBnbWFpbC5jb20ifQ.Eg5i1js0vudYAL6ISq3Uw8zTDGKZKZBo5bhQZXh2ot-H8Tdk-dZWDEhx9p3MiEbe9lGL0I0YUVp_MR1QTphytQ"
export const ENVOY_HOSTNAME = "192.168.17.90"

export const DIMMER_HOSTNAME = "192.168.17.68"

const LOAD_POWER = 1800;
const MAX_PWR = 75


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



        // console.log('[REAL]', houseConsumption, '[CURRENT LOAD]', loadPercentage, "% =>", currentTheoricalMaxLoad, 'W')

        // console.log("We're exporting", exportFlow, 'W', 'with a dimmer already set at', currentdimmerSetting,'% that represent', currentTheoricalMaxLoad,'W')
        // console.log("That's", loadPercentage, '% of the load', "Setting the load to ", flooredValue)

        await setPower(flooredValue)
    }
   
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