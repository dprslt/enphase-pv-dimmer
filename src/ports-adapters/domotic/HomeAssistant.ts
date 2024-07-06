import { LightMeterReading } from '../../types/IvpMetersReadings.js';
import { Broker } from '../broker/broker.js';

export class HomeAssistant {
    devInfos: Record<string, string>;

    constructor(private brokerPort: Broker, private sensorName: string) {
        this.devInfos = {
            ids: `${this.sensorName}`,
            name: `${this.sensorName}`,
            sw: 'PV Router',
            mdl: 'Enphase Envoy 192.168.17.90',
            mf: 'Dprslt',
        };
    }

    async installAutoDiscovery() {
        console.log('[HomeAssistant] - Installing autodiscovery entries');

        // MQTT Discovery
        const consumptionConfig = {
            dev_cla: 'power',
            unit_of_meas: 'W',
            stat_cla: 'measurement',
            name: 'power_grid',
            state_topic: `homeassistant/sensor/${this.sensorName}/state`,
            stat_t: `homeassistant/sensor/${this.sensorName}/state`,
            avty_t: `homeassistant/sensor/${this.sensorName}/status`,
            uniq_id: `${this.sensorName}-grid`,
            value_template: '{{ value_json.power_grid }}',
            dev: this.devInfos,
        };
        await this.brokerPort.publish(`homeassistant/sensor/${this.sensorName}/power_grid/config`, JSON.stringify(consumptionConfig), {
            retain: true,
        });

        const productionConfig = {
            dev_cla: 'power',
            unit_of_meas: 'W',
            stat_cla: 'measurement',
            name: 'power_solar',
            state_topic: `homeassistant/sensor/${this.sensorName}/state`,
            stat_t: `homeassistant/sensor/${this.sensorName}/state`,
            avty_t: `homeassistant/sensor/${this.sensorName}/status`,
            uniq_id: `${this.sensorName}-solar`,
            value_template: '{{ value_json.power_solar }}',
            dev: this.devInfos,
        };
        await this.brokerPort.publish(`homeassistant/sensor/${this.sensorName}/power_solar/config`, JSON.stringify(productionConfig), {
            retain: true,
        });

        await this.brokerPort.publish(`homeassistant/sensor/${this.sensorName}/status`, 'online');

        console.log('[HomeAssistant] - Autodiscovery configured');
    }

    async publishMeteringValues(envoyMetersValues: { consumption: LightMeterReading; production: LightMeterReading }) {
        if (!this.brokerPort.isReady()) {
            console.log('[HomeAssistant] - Not connected to the broker, skipping');
            return;
        }
        await this.brokerPort.publish(`homeassistant/sensor/${this.sensorName}/status`, 'online');
        await this.brokerPort.publish(
            'homeassistant/sensor/envoy-90/state',
            JSON.stringify({
                power_grid: envoyMetersValues.consumption.instantaneousDemand,
                power_solar: envoyMetersValues.production.instantaneousDemand,
            })
        );
    }
}
