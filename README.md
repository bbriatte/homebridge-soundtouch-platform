# homebridge-soundtouch-platform

[Bose SoundTouch](https://www.bose.com/soundtouch-systems.html) plugin for [Homebridge](https://github.com/nfarina/homebridge)

This allows you to control your SoundTouch devices with HomeKit and Siri.

## Installation
1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-soundtouch-platform
3. Update your configuration file. See the sample below.

## Configuration
Example `config.json` to discover all SoundTouch accessories

```
{
    "platform": "SoundTouchPlatform",
    "name": "SoundTouch",
    "discoverAllAccessories": true
}
```

Example `config.json` to register 1 SoundTouch accessory

```
{
    "platform": "SoundTouchPlatform",
    "name": "SoundTouch",
    "accessories": [
        {
            "name": "Speaker Bathroom",
            "room": "Bathroom",
            "unmuteVolume": 40,
            "maxVolume": 80
        }
    ]
}
```

Example `config.json` for multiple speakers and presets:

```
{
    "platform": "SoundTouchPlatform",
    "name": "SoundTouch",
    "accessories": [
        {
            "name": "Speaker Bathroom",
            "ip": "<ip>",
            "unmuteVolume": 40,
            "maxVolume": 80,
            "presets": [
                {
                    "name": "Radio 1",
                    "index": 3
                }
            ]
        },
        {
            "name": "Speaker Kitchen",
            "room": "Kitchen",
            "presets": [
                {
                    "name": "Speaker Kitchen TV",
                    "index": 0
                },
                {
                    "name": "Radio 1",
                    "index": 1
                }
            ]
        }
    ]
}
```

1) Platform element

*Required fields*
* `platform`: Must always be **SoundTouchPlatform** 
* `name`: The name you want to use to control the SoundTouch for the platform.

*Optional fields*
* `discoverAllAccessories`: Discover all accessories on the local network **default: false**  
* `accessories`: Array of **Accessory element**

2) Accessory element

*Optional fields*
* `name`: The name you want to use to control the SoundTouch.
* `room`: Should match exactly with the name of the SoundTouch device.
* `ip`: The ip address of your device on your network.
* `unmuteVolume`: The expected volume that you want back to mute mode with 0 volume. **default: 35%**
* `maxVolume`: The maximum volume of the device. **default: 100%**
* `presets`: Contains all presets action that you want to trigger using HomeKit on your device. Adds a switch for each preset with the given `name
 Preset index start from 0 to 6 included. The 0 is a special preset used to restore the tv mode. 

Don't use soundtouch or music as name, because Siri will try to open the SoundTouch or Apple Music app.