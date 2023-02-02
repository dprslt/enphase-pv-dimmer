export type LightMeterReading = {
    instantaneousDemand: number;
};

export type MeterReading = {
    eid: number;
    timestamp: number;
    actEnergyDlvd: number;
    actEnergyRcvd: number;
    apparentEnergy: number;
    reactEnergyLagg: number;
    reactEnergyLead: number;
    instantaneousDemand: number;
    activePower: number;
    apparentPower: number;
    reactivePower: number;
    pwrFactor: number;
    voltage: number;
    current: number;
    freq: number;
    // TODO type this
    channels: Array<any>;
};

export type MeterReadings = [MeterReading, MeterReading];
export type LightMeterReadings = [LightMeterReading, LightMeterReading];
