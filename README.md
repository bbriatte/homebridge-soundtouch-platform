# homebridge-soundtouch-platform

[![npm version](https://badge.fury.io/js/homebridge-soundtouch-platform.svg)](https://badge.fury.io/js/homebridge-soundtouch-platform)

[Bose SoundTouch](https://www.bose.com/soundtouch-systems.html) plugin for [Homebridge](https://github.com/nfarina/homebridge)

This allows you to control your SoundTouch devices with HomeKit and Siri.

## Installation
1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-soundtouch-platform
3. Update your configuration file. See the sample below.

## Configuration
Example `config.json` to discover all SoundTouch accessories

```json
{
    "platform": "SoundTouchPlatform",
    "name": "SoundTouch",
    "discoverAllAccessories": true
}
```

Example `config.json` to register 1 SoundTouch accessory

```json
{
    "platform": "SoundTouchPlatform",
    "name": "SoundTouch",
    "accessories": [
        {
            "name": "Speaker Bathroom",
            "room": "Bathroom",
            "volume": {
              "unmuteValue": 40,
              "maxValue": 80
            }        
        }
    ]
}
```

Example `config.json` for multiple speakers and presets:

```json
{
    "platform": "SoundTouchPlatform",
    "name": "SoundTouch",
    "accessories": [
        {
            "name": "Speaker Bathroom",
            "ip": "<ip>",
            "volume": {
              "unmuteValue": 40,
              "maxValue": 80,
              "mode": "lightbulb"
            },
            "presets": [
                {
                    "name": "Radio 3",
                    "index": 3
                }
            ]
        },
        {
            "name": "Speaker Kitchen",
            "room": "Kitchen",
            "verbose": true,
            "volume": {
              "mode": "speaker"
            },
            "presets": [
                {
                    "name": "Radio 1",
                    "index": 1
                },
                {
                    "name": "Radio 2",
                    "index": 2
                }
            ]
        }
    ],
    "global": {
        "sources": [
            {
                "source": "QPLAY",
                "enabled": false
            }
        ]
    }
}
```

### Platform element
*Required fields*
* `platform`: Must always be **SoundTouchPlatform** 
* `name`: The name you want to use to control the SoundTouch for the platform.

*Optional fields*
* `discoverAllAccessories`: Discover all accessories on the local network __default__: **false**  
* `accessories`: Array of **Accessory element**
* `global`: Default configuration for all accessories. see **Global element**

### Accessory element
*Optional fields*
* `name`: The name you want to use to control the SoundTouch.
* `room`: Should match exactly with the name of the SoundTouch device.
* `ip`: The ip address of your device on your network.
* `volume`: see **Volume element**
* `presets`: Contains all presets action that you want to trigger using HomeKit on your device. Adds a switch for each preset with the given name.
 Preset index start from 1 to 6 included. see **Preset element**
* `sources`: Contains all sources action that you want to trigger using HomeKit on your device. Adds a switch for each source with the given name. see **Source element**
  
### Volume element  
*Optional fields*
* `onValue`: The expected volume that you want when the device is turning on.
* `unmuteValue`: The expected volume that you want back to mute mode with 0 volume. __default__: **onValue** if sets otherwise **35%**
* `maxValue`: The maximum volume of the device. __default__: **100%**
* `mode`: The volume accessory mode. Choose one item from the enum. see **VolumeMode enum**. __default__: **lightbulb**

### VolumeMode enum  
* `none`: Disable the volume of the accessory
* `lightbulb`: Control the accessory using a light (with this value you **can** control the volume from the Home.app & Siri).
* `speaker`: Control the accessory with a speaker slider (with this value you **cannot** controller the volume from the Home.app & Siri).

### Preset element
*Required fields*
* `index`: The preset index starting from 1 to 6

*Optional fields*
* `name`: If set, the specific name of the preset`otherwise the name on your SoundTouch product will be used.
* `enabled`: false will disable this preset to HomeKit

### Source element
*Required fields*
* `source`: The source such as PRODUCT, BLUETOOTH, ...

*Optional fields*
* `account`: The product account such as TV, HDMI_1, ...
* `name`: If set, the specific name of the preset otherwise the name on your SoundTouch product will be used.
* `enabled`: false will disable this product to HomeKit

### Global element
*Optional fields*
* `verbose`: Log all device information
* `volume`: see **Volume element**
* `presets`: Contains all presets action that you want to trigger or not using HomeKit on all devices. Adds a switch for each preset with the given name.
 Preset index start from 1 to 6 included. see **Preset element**
* `sources`: Contains all sources action that you want to trigger or not using HomeKit on all devices. Adds a switch for each source with the given name. see **Source element**
  