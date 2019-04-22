# homebridge-soundtouch-volume

[Bose SoundTouch](https://www.bose.com/soundtouch-systems.html) plugin for [Homebridge](https://github.com/nfarina/homebridge)

This allows you to control your SoundTouch devices with HomeKit and Siri.

## Installation
1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-soundtouch-volume
3. Update your configuration file. See the sample below.

##Configuration
Example config.json:

```
"accessories": [
    {
        "accessory": "SoundTouchVolume",
        "name": "Speaker Bathroom",
        "room": "Bathroom",
        "ip": "<ip>",
        "mac_address": "XX:XX:XX:XX:XX:XX",
        "unmute_volume": 40,
        "max_volume": 80
    }
],
```
Example config.json for multiple speakers and presets:

```
"accessories": [
    {
        "accessory": "SoundTouchVolume",
        "name": "Speaker Bathroom",
        "room": "Bathroom",
        "ip": "<ip>",
        "mac_address": "XX:XX:XX:XX:XX:XX",
        "unmute_volume": 40,
        "max_volume": 80,
        "presets": [
            {
                "name": "Radio 1",
                "index": 3
            }
        ]
	},
	{
	    "accessory": "SoundTouchVolume",
	    "name": "Speaker Kitchen",
	    "room": "Kitchen",
	    "ip": "<ip>",
	    "mac_address": "XX:XX:XX:XX:XX:XX",
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
],
```
*Required fields*: 

* `accessory`: Must always be **SoundTouchVolume** 
* `name`: The name you want to use to control the SoundTouch.
* `room`: Should match exactly with the name of the SoundTouch device.
* `ip`: The ip address of your device on your network.
* `mac_address`: The mac address used on the device.

*Optional fields*

* `unmute_volume`: The expected volume that you want back to mute mode with 0 volume. **default: 35%**
* `max_volume`: The maximum volume of the device. **default: 100%**
* `presets`: Contains all presets action that you want to trigger using HomeKit on your device. Adds a lighthub for each preset with the given `name
 Preset index start from 0 to 6 included. The 0 is a special preset used to restore the tv mode. 

Don't use soundtouch or music as name, because Siri will try to open the SoundTouch or Apple Music app.