const http = require('http');
const parser = require('./utils/xmltojson');
const request = require('request');
const WebSocketClient = require('websocket').client;

const TYPES = require('./utils/types');

/**
 * @param name String
 * @param ip String
 * @param macAddress String
 * @param port Number
 * @constructor
 */
const SoundTouchDevice = function(name, ip, macAddress, port) {
    this.name = name;
    this.ip = ip;
    this.macAddress = macAddress;
    this.port = port || 8090;
    this.url = "http://" + this.ip + ":" + this.port;
    this.ws_url = "ws://" + this.ip + ":" + '8080';
};

/**
 * @param device
 * @param device.name String
 * @param device.ip String
 * @param device.port Number
 * @param device.macAddress String
 * @constructor
 */
const SoundTouchAPI = function(device) {
    this.device = new SoundTouchDevice(device.name, device.ip, device.macAddress, device.port);
    this.name = device.name;
    this.socket = {
        source: undefined
    };
};

SoundTouchAPI.prototype.getDevice = function() {
    return this.device;
};

SoundTouchAPI.prototype.getNowPlaying = function(handler) {
    this._getForDevice('now_playing', handler);
};

SoundTouchAPI.prototype.getTrackInfo = function(handler) {
    this._getForDevice('trackInfo', handler);
};

SoundTouchAPI.prototype.getPresets = function(handler) {
    this._getForDevice('presets', handler);
};

SoundTouchAPI.prototype.getSources = function(handler) {
    this._getForDevice('sources', handler);
};

SoundTouchAPI.prototype.getInfo = function(handler) {
    this._getForDevice('info', handler);
};

SoundTouchAPI.prototype.isAlive = function(handler) {
    this.getNowPlaying(function(json){
        if (!json || !json.nowPlaying) {
            handler(false);
            return;
        }
        let isAlive =  json.nowPlaying.source !== TYPES.SOURCES_STATUS.STANDBY;
        if (isAlive) {
            isAlive = json.nowPlaying.playStatus === TYPES.PLAY_STATUS.PLAY_STATE;
        }
        handler(isAlive);
    });
};

SoundTouchAPI.prototype.isPoweredOn = function(handler) {
    this.getNowPlaying(function(json){
        if (!json || !json.nowPlaying) {
            handler(false);
            return;
        }
        handler(json.nowPlaying.source !== TYPES.SOURCES_STATUS.STANDBY);
    });
};

SoundTouchAPI.prototype.getVolume = function(handler) {
    this._getForDevice('volume', handler);
};

SoundTouchAPI.prototype.setVolume = function(volume, handler) {
    const data = `<volume>${volume}</volume>`;
    this._setForDevice('volume', data, handler);
};


SoundTouchAPI.prototype.select = function(source, type, sourceAccount, location, handler) {
    if (source === undefined) {
        throw new Error('Source is not optional, provide a source from the SOURCES list.');
    }

    const data = `<ContentItem source="${source}" type="${type || ""}" sourceAccount="${sourceAccount || ""}" location="${location || ""}">` +
        '<itemName>Select using API</itemName>' +
        '</ContentItem>';
    this._setForDevice('select', data, handler);
};

SoundTouchAPI.prototype.setName = function(name, handler) {
    const data = `<name>${name}</name>`;
    this._setForDevice('name', data, handler);
};

SoundTouchAPI.prototype.play = function(handler) {
    this.pressKey(TYPES.KEYS.PLAY, handler);
};

SoundTouchAPI.prototype.stop = function(handler) {
    this.pressKey(TYPES.KEYS.STOP, handler);
};

SoundTouchAPI.prototype.pause = function(handler) {
    this.pressKey(TYPES.KEYS.PAUSE, handler);
};

SoundTouchAPI.prototype.playPause = function(handler) {
    this.pressKey(TYPES.KEYS.PLAY_PAUSE, handler);
};

SoundTouchAPI.prototype.power = function(handler) {
    this.pressKey(TYPES.KEYS.POWER, handler);
};

SoundTouchAPI.prototype.powerOn = function(handler) {
    this.isPoweredOn((isPoweredOn) => {
        if (!isPoweredOn) {
            this.power(() => handler(true));
        } else {
            handler(false);
        }
    });
};

SoundTouchAPI.prototype.powerOnWithVolume = function(volume, handler) {
    this.powerOn((success) => {
        if(success) {
            this.setVolume(volume, () => handler(true));
        } else {
            handler(false);
        }
    })
};

SoundTouchAPI.prototype.powerOff = function(handler) {
    this.isPoweredOn((isPoweredOn) => {
        if (isPoweredOn) {
            this.power(() => handler(true));
        } else {
            handler(false);
        }
    });
};

SoundTouchAPI.prototype.getBassCapabilities = function(handler) {
    this._getForDevice('bassCapabilities', handler);
};

SoundTouchAPI.prototype.getBass = function(handler) {
    this._getForDevice('bass', handler);
};

SoundTouchAPI.prototype.setBass = function(bassNumber, handler) {
    this._setForDevice('bass', `<bass>${bassNumber}</bass>`, handler);
};

/**
 * Select a specific preset (this also turns on the speaker if it was disabled)
 * @param presetNumber 1, 2, 3, 4, 5 or 6
 * @param handler function (required)
 */
SoundTouchAPI.prototype.setPreset = function(presetNumber, handler) {
    this.pressKey('PRESET_' + presetNumber, handler);
};

SoundTouchAPI.prototype.pressKey = function(key, handler) {
    const press = `<key state="press" sender="Gabbo">${key}</key>`;
    const release = `<key state="release" sender="Gabbo">${key}</key>`;
    this._setForDevice('key', press, () => this._setForDevice('key', release, handler));
};

SoundTouchAPI.prototype.getZone = function(handler) {
    this._getForDevice('getZone', handler);
};

SoundTouchAPI.prototype.setZone = function(members, handler) {
    this._zones('setZone', members, handler);
};

SoundTouchAPI.prototype.addZoneSlave = function(members, handler) {
    this._zones('addZoneSlave', members, handler);
};

SoundTouchAPI.prototype.removeZoneSlave = function(members, handler) {
    this._zones('removeZoneSlave', members, handler);
};

SoundTouchAPI.prototype._zones = function(action, members, handler) {
    const item = {};
    let data = `<zone master="${this.device.macAddress}" senderIPAddress="127.0.0.1">`;
    for(const member of members) {
        if(item.slaves === undefined) {
            item.slaves = [];
        }
        item.slaves.push(member);
        data += `<member>${member}</member>`;
    }
    data += '</zone>';
    this._setForDevice(action, data, (json) => handler(json, item));
};

/*
 ****** WEB SOCKETS ***********
 */
SoundTouchAPI.prototype.socketStart = function(successCallback, errorCallback) {

    if (this.client !== undefined) {
        return;
    }

    this.client = new WebSocketClient();

    this.client.on('connect', (connection) => {
        if (successCallback !== undefined) successCallback();

        connection.on('error', (error) => {
            if (errorCallback !== undefined) errorCallback(error.toString());
        });
        connection.on('close', () => {
            this.client = undefined;
        });
        connection.on('message', (message) => {
            if (message.type === 'utf8') {
                const json = parser.convert(message.utf8Data);
                this.socketUpdate(json.updates);
            }
        });
    });

    this.client.on('connectFailed', (error) => {
        if (errorCallback !== undefined) errorCallback(error.toString());
    });

    this.client.connect(this.getMetaData().ws_url, 'gabbo');
};

SoundTouchAPI.prototype.socketUpdate = function(json) {
    if (json === undefined) {
        console.log('Update response is empty');
        return;
    }
    if (json.nowPlayingUpdated !== undefined) {
        if (this.socket.nowPlayingUpdatedListener !== undefined) {
            this.socket.nowPlayingUpdatedListener(json.nowPlayingUpdated);
        }

        //special listener: Powered On // Powered Off
        const source = json.nowPlayingUpdated.nowPlaying.source;

        if (this.socket.source !== source) {
            this.socket.source = source;
            if (this.socket.poweredListener !== undefined) {
                this.socket.poweredListener(source !== TYPES.SOURCES_STATUS.STANDBY, json.nowPlayingUpdated.nowPlaying);
            }
        }

        //special listener: Playing // Not Playing
        const playStatus = json.nowPlayingUpdated.nowPlaying.playStatus;
        if (this.socket.playStatus !== playStatus) {
            this.socket.playStatus = playStatus;
            if (this.socket.isPlayingListener !== undefined) {
                this.socket.isPlayingListener(playStatus === TYPES.PLAY_STATUS.PLAY_STATE, json.nowPlayingUpdated.nowPlaying);
            }
        }
    } else if (json.volumeUpdated !== undefined) {
        this.socket.volume = json.volumeUpdated.volume.actualvolume;

        if (this.socket.volumeUpdatedListener !== undefined) {
            this.socket.volumeUpdatedListener(json.volumeUpdated.volume.actualvolume, json.volumeUpdated);
        }
    } else if (json.connectionStateUpdated !== undefined) {
        if (this.socket.connectionStateUpdatedListener !== undefined) {
            this.socket.connectionStateUpdatedListener(json.connectionStateUpdated);
        }
    } else if (json.nowSelectionUpdated !== undefined) {
        if (this.socket.nowSelectionUpdatedListener !== undefined) {
            this.socket.nowSelectionUpdatedListener(json.nowSelectionUpdated);
        }
    } else if (json.recentsUpdated !== undefined) {
        if (this.socket.recentsUpdatedListener !== undefined) {
            this.socket.recentsUpdatedListener(json.recentsUpdated);
        }
    } else {
        console.log('Other update', json);
    }
};

SoundTouchAPI.prototype.setNowPlayingUpdatedListener = function(handler) {
    this.socket.nowPlayingUpdatedListener = handler;
};

SoundTouchAPI.prototype.setPoweredListener = function(handler) {
    this.socket.poweredListener = handler;
};

SoundTouchAPI.prototype.setIsPlayingListener = function(handler) {
    this.socket.isPlayingListener = handler;
};

SoundTouchAPI.prototype.setVolumeUpdatedListener = function(handler) {
    this.socket.volumeUpdatedListener = handler;
};

SoundTouchAPI.prototype.setConnectionStateUpdatedListener = function(handler) {
    this.socket.connectionStateUpdatedListener = handler;
};

SoundTouchAPI.prototype.setNowSelectionUpdatedListener = function(handler) {
    this.socket.nowSelectionUpdatedListener = handler;
};

SoundTouchAPI.prototype.setRecentsUpdatedListener = function(handler) {
    this.socket.recentsUpdatedListener = handler;
};

/*
****** UTILITY METHODS ***********
 */

SoundTouchAPI.prototype._getForDevice = function (action, callback) {
    http.get(this.device.url + '/' + action, (response) => {
            parser.convertResponse(response, callback);
        })
        .on('error', (e) => {
            console.error('Got error: ' + e.message);
            throw new Error(e.message);
        });
};

SoundTouchAPI.prototype._setForDevice = function (action, data, handler) {
    const options =  {
        url: this.device.url + '/' + action,
        form: data
    };
    request.post(options, (err, httpResponse, body) => handler(parser.convert(body)));
};

module.exports = SoundTouchAPI;
