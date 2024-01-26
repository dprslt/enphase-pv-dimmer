export type RouterConfig = {
    mqttHost: string;
    mqttUsername: string;
    mqttPassword: string;
    dimmerHostname: string;
    envoyHostname: string;
    envoyToken: string;
} & LoadConfig;

export type LoadConfig = {
    loadPower: number;
    maxPower: number;
};

export const buildConfigFromEnv = (): RouterConfig => {
    return {
        mqttHost: process.env['MQTT_HOST'] || '',
        mqttUsername: process.env['MQTT_USERNAME'] || '',
        mqttPassword: process.env['MQTT_PASSWORD'] || '',
        envoyHostname: process.env['ENVOY_HOSTNAME'] || '',
        envoyToken: process.env['TOKEN'] || '',
        dimmerHostname: process.env['DIMMER_HOSTNAME'] || '',
        loadPower: process.env['LOAD_POWER'] ? Number.parseInt(process.env['LOAD_POWER']) : 100,
        maxPower: process.env['MAX_PWR'] ? Number.parseInt(process.env['MAX_PWR']) : 50,
    };
};
