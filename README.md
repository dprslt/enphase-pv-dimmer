# DPRSLT Router

This PV Router made the bridge between an Enphase Envoy Gateway and a remote PV Dimmer [Xlyric](https://github.com/xlyric/PV-discharge-Dimmer-AC-Dimmer-KIT-Robotdyn)

It could run on any server hosted in the same network as the Envoy and the Dimmer. I made it because i've do not want to add a second metering system to route my PV overflow.
It run smoothly on an old raspberry pi in my house.

You can run it directly or using docker

### The Dimmer

This router was planned to be used with Xlyric Dimmer but the code can easily be adapted to something else.

-   [Documentation](https://pvrouteur.apper-solaire.org/)
-   [GitHub Repository](https://github.com/xlyric/PV-discharge-Dimmer-AC-Dimmer-KIT-Robotdyn)
-   [PV Forum](https://forum-photovoltaique.fr/viewtopic.php?f=110&t=41777)

### Authenticating to the Enphase Gateway

You can generate an envoy token using this link and replacing `XXX` with your Envoy Serial Number.
This will generate you an Owner token to connect locally to your envoy.
**This token is valid for one year.**

```
    https://enlighten.enphaseenergy.com/entrez-auth-token?serial_num=XXX
```

### docker-compose Configuration

Sample of a `docker-compose.yml` file :

```yaml
version: '3'

services:
    router:
        build: enphase-pv-dimmer
        environment:
            - TOKEN=<Enphase owner token>
            - ENVOY_HOSTNAME=<Envoy IP>
            - DIMMER_HOSTNAME=<Dimmer IP>
            - LOAD_POWER=<Power of the resisitive load in Watt>
            - MAX_PWR=<Max power of the dimmer 0-100>
            - MQTT_HOST=<MQTT broker host:port>
            - TZ=Europe/Paris
        restart: unless-stopped
```

### Home Assistant

Once you've connected your Home assistant to the MQTT broker you will see this as a sensor via auto discovery

### More infos

More infos on the project can be found here, it's in french and such a mess (you've been warned) : https://numerous-city-a34.notion.site/Autoconsommation-avanc-e-38a122da38d444749bfbb53cde584492
