import type { LoadConfig } from '../config';
import { Broker } from '../ports-adapters/broker/broker';
import { Clock } from '../ports-adapters/clock/clock';
import { Dimmer } from '../ports-adapters/dimmer/dimmer';
import { HomeAssistant } from '../ports-adapters/domotic/HomeAssistant';
import { Meter } from '../ports-adapters/meters/meter';
import { GridState } from './grid-state';

export type RouterPorts = {
    broker: Broker;
    dimmer: Dimmer;
    meter: Meter;
    clock: Clock;
};

export class Router {
    private homeAssistant: HomeAssistant;

    constructor(private readonly ports: RouterPorts, private readonly loadConfig: LoadConfig) {
        this.homeAssistant = new HomeAssistant(ports.broker, 'envoy-90');
    }

    async loopIteration() {
        const envoyMetersValues = await this.ports.meter.readValues();
        const sendToHaPromise = this.homeAssistant.publishMeteringValues(envoyMetersValues);
        const currentDimmerValues = await this.ports.dimmer.readValues();

        const gridState = new GridState(envoyMetersValues, currentDimmerValues, this.loadConfig);

        /*
            It's day
                have we reached the max temp ?
                    check load is stopped then break

                Are we overflowing ?
                    module the load to cover the output
                    Store the last values for maybe one hour
                    find a function to check if the progression is slow between measures (slow variance)
                    If the variance is slow, and the needed load is over 110% trigger the relay
                    We shoul'nt trigger the relay more than twice per hour ?
                    The alg should auto adapt but we can help him dans modulate the load acordingly (NEW_PERC - 100) 
                Nope
                    Simply log

            Is the night ? How to determine this ? Datetime after 22 ? API coucher de soleil ?
                is temps lower than 50 deg ?
                    Heat until 50, use meteo forecast to determine if we should heat more ?
                    This should be done using the relay to avoid useless harmonics
                Nope
                    Do nothing

        */

        if (this.ports.clock.isDay()) {
            // It's the day let's see if we can route some power from the pvs
            if (gridState.isOverflowOverThreesold() || !gridState.isDimmerInactive()) {
                const neededChange = (gridState.overflow / this.loadConfig.loadPower) * 100;
                const newPercValue = gridState.dimmerSetting + neededChange;
                // If the value is < 0 we just need to cut the load
                const flooredValue = Math.max(Math.min(Math.floor(newPercValue), this.loadConfig.maxPower), 0);
                await this.ports.dimmer.modulePower(flooredValue);
                // TODO add these sinfo tho the logger
                gridState.logDimmer(neededChange, flooredValue, Math.round((flooredValue / 100) * this.loadConfig.loadPower));
            } else {
                // TODO replace this by a logger
                gridState.logNoProd();
            }
        } else {
            // Night time, it's time to control water temp
            if (gridState.isWaterUnderLowRange()) {
                // Stay far from 50 to avoid harmonics
                // TODO improve this to handle a relay with a new function in the dimmer
                if (gridState.dimmerSetting < this.loadConfig.maxPower) {
                    // TODO this code must change to handle a relay during the night
                    await this.ports.dimmer.modulePower(this.loadConfig.maxPower);
                }
                gridState.logNight(true);
            } else if (gridState.isWaterOverTarget() && gridState.isDimmerActive()) {
                await this.ports.dimmer.modulePower(0);
                gridState.logNight(false);
            } else {
                gridState.logNight(false);
            }
        }
        await sendToHaPromise;
    }

    async initialize() {
        this.ports.broker.onConnect(() => {
            console.log('[MQTT] - Connected');
            this.homeAssistant.installAutoDiscovery();
        });

        this.ports.broker.onDisconnect(() => {
            console.log('[MQTT] - Connection lost');
        });
        this.ports.broker.onError(() => {
            console.log('[MQTT] - An error occured');
        });
    }

    async stop() {
        console.log('[ROUTER] - Turning off and setting load to 0');
        // shouldStop = true;
        await this.ports.dimmer.modulePower(0);
        await this.ports.broker.publish('homeassistant/sensor/envoy-90/status', 'offline');
    }
}
