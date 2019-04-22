/*
const api = new SoundTouchAPI({
  name: "Salon",
  mac: "7c:01:0a:75:e9:d8",
  ip: "192.168.0.22",
});
*/
const SoundTouchAPI = require('./api');
const TYPES = require('./utils/types');
let Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-soundtouch-volume', "SoundTouchVolume", SoundTouchAccessory);
};

function SoundTouchAccessory(log, config) {
  this.log = log;
  this.config = config;
  this.name = config['name'];

  this.unmuteVolume = config['unmute_volume'] || 35;

  if (!config['room']) throw new Error("You must provide a config value for 'room'.");
  if (!config['ip']) throw new Error("You must provide a config value for 'ip'.");
  if (!config['mac_address']) throw new Error("You must provide a config value for 'mac_address'.");

  this.api = new SoundTouchAPI({
    ip: config['ip'],
    name: config['room'],
    macAddress: config['mac_address'],
    port: config['port']
  });

  this.onService = new Service.Switch(this.name);
  this.onService
      .getCharacteristic(Characteristic.On)
      .on('get', this._getOn.bind(this))
      .on('set', this._setOn.bind(this));

  this.volumeService = new Service.Lightbulb(this.name + ' Volume', 'volumeService');
  this.volumeService
      .getCharacteristic(Characteristic.On)
      .on('get', this._getMute.bind(this))
      .on('set', this._setMute.bind(this));
  const brightnessCharacteristic = new Characteristic.Brightness();
  if(config['max_volume'] && typeof(config['max_volume'] === 'number')) {
    brightnessCharacteristic.props.maxValue = Math.min(config['max_volume'], 100);
  }
  this.volumeService
      .addCharacteristic(brightnessCharacteristic)
      .on('get', this._getVolume.bind(this))
      .on('set', this._setVolume.bind(this));

  const presets = config['presets'];
  this.presetServices = [];
  if(typeof presets === 'object') {
    for(const preset of presets) {
      const service = new Service.Lightbulb(preset.name, `preset${preset.index}Service`);
      const characteristic = service.getCharacteristic(Characteristic.On);
      characteristic.on('get', (callback) => {
        this._isSelectedPreset(preset.index, callback);
      });
      characteristic.on('set', (on, callback) => {
        this._setPreset(preset.index, on, callback);
      });
      this.presetServices.push(service);
    }
  }
  this._updateValues();
}

SoundTouchAccessory.prototype.getInformationService = function() {
  const informationService = new Service.AccessoryInformation();
  informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, 'Bose SoundTouch')
      .setCharacteristic(Characteristic.Model, '1.0.0')
      .setCharacteristic(Characteristic.SerialNumber, this.api.name);
  return informationService;
};

SoundTouchAccessory.prototype.getServices = function() {
  return [this.onService, this.volumeService, ...this.presetServices, this.getInformationService()];
};

SoundTouchAccessory.prototype._getOn = function(callback) {
  if (!this.api) {
    this.log.warn('Ignoring request; SoundTouch device has not yet been discovered.');
    callback(new Error('SoundTouch has not been discovered yet.'));
    return;
  }
  this.api.isAlive((isOn) => {
    this.log('Check if is playing: %s', isOn);
    callback(null, isOn);
  });
};

SoundTouchAccessory.prototype._setOn = function(on, callback) {
  if (!this.api) {
    this.log.warn('Ignoring request; SoundTouch device has not yet been discovered.');
    callback(new Error('SoundTouch has not been discovered yet.'));
    return;
  }
  if (on) {
    this.api.powerOn((isTurnedOn) => {
      if(isTurnedOn) {
        this.log('Power on');
        this.volumeService.getCharacteristic(Characteristic.On).updateValue(true);
      } else {
        this.log('Was already powered on');
      }
      callback();
    });
  } else {
    this.api.powerOff(() => {
      this.volumeService.getCharacteristic(Characteristic.On).updateValue(false);
      this._switchPresetServices()
      this.log('Powering Off...');
      callback();
    });
  }
};

SoundTouchAccessory.prototype._updateValues = function() {
  if (!this.api) {
    this.log.warn('Ignoring request; SoundTouch device has not yet been discovered.');
    return;
  }
  this.api.isAlive((isOn) => {
    this.log('Check if is playing: %s', isOn);
    this.onService.getCharacteristic(Characteristic.On).updateValue(isOn);
    if(isOn) {
      this.api.getVolume((volume) => {
        this.volumeService.getCharacteristic(Characteristic.Brightness).updateValue(volume);
      });
      this._getPreset((err, preset) => {
        if(err) { return; }
        this._switchPresetServices(preset);
      });
    } else {
      this.volumeService.getCharacteristic(Characteristic.On).updateValue(false);
      this._switchPresetServices();
    }
  });
};

SoundTouchAccessory.prototype._getMute = function(callback) {
  if (!this.api) {
    this.log.warn('Ignoring request; SoundTouch device has not yet been discovered.');
    callback(new Error('SoundTouch has not been discovered yet.'));
    return;
  }
  if(this.onService.getCharacteristic(Characteristic.On).value === false) {
    callback(null, false);
    return;
  }
  this.api.getVolume((json) => {
    const isMute = json.volume.muteenabled === 'true';
    this.log('Check if is muted: %s', isMute);
    callback(null, !isMute);
  });
};

SoundTouchAccessory.prototype._setOnManually = function(callback) {
  this.api.powerOn((isTurnedOn) => {
    this.log(isTurnedOn ? 'Power On' : 'Was already powered on');
    this.api.play(() => {
      this.onService.getCharacteristic(Characteristic.On).updateValue(true);
      callback();
    });
  });
};

SoundTouchAccessory.prototype._setMute = function(state, callback) {
  if (!this.api) {
    this.log.warn('Ignoring request; SoundTouch device has not yet been discovered.');
    callback(new Error('SoundTouch has not been discovered yet.'));
    return;
  }
  if(this.volumeService.getCharacteristic(Characteristic.On).value === state) {
    callback();
    return
  }
  if(state === true && this.onService.getCharacteristic(Characteristic.On).value === false) {
    this._setOnManually(callback);
    return;
  }
  this.api.pressKey(TYPES.KEYS.MUTE, () => {
    this.log(!state ? 'Muting ...' : 'Unmuting ...');
    callback();
  });
};

SoundTouchAccessory.prototype._getVolume = function(callback) {
  if (!this.api) {
    this.log.warn('Ignoring request; SoundTouch device has not yet been discovered.');
    callback(new Error('SoundTouch has not been discovered yet.'));
    return;
  }
  this.api.getVolume((json) => {
    const volume = json.volume.actualvolume;
    this.log("Current volume: %s", volume);
    callback(null, volume * 1);
  });
};

SoundTouchAccessory.prototype._setVolume = function(volume, callback) {
  if (!this.api) {
    this.log.warn('Ignoring request; SoundTouch device has not yet been discovered.');
    callback(new Error('SoundTouch has not been discovered yet.'));
    return;
  }
  if(volume > 0 && this.onService.getCharacteristic(Characteristic.On).value === false) {
    this._setOnManually(() => this._setVolume(volume, callback));
    return;
  }
  const volumeCharacteristic = this.volumeService.getCharacteristic(Characteristic.Brightness);
  const oldVolume = volumeCharacteristic.value;
  const maxValue = volumeCharacteristic.props.maxValue;
  if(volume === maxValue && oldVolume <= maxValue / 2) {
    volume = Math.max(oldVolume, this.unmuteVolume);
  }
  this.api.setVolume(volume, () => {
    this.log('Setting volume to %s', volume);
    callback();
  });
};

SoundTouchAccessory.prototype._getPreset = function(callback) {
  if (!this.api) {
    this.log.warn('Ignoring request; SoundTouch device has not yet been discovered.');
    callback(new Error('SoundTouch has not been discovered yet.'));
    return;
  }
  this.api.getPresets((json) => {
    this.api.getNowPlaying((jsonNowPlaying) => {
      const presets = json.presets.preset;
      for (const idx in presets) {
        const preset = presets[idx];
        if (JSON.stringify(preset.ContentItem) === JSON.stringify(jsonNowPlaying.nowPlaying.ContentItem)) {
          this.log("Current preset: %s", preset.id);
          callback(null, preset.id * 1);
          return;
        }
      }
      callback(null, 0);
    });
  });
};

SoundTouchAccessory.prototype._isSelectedPreset = function(preset, callback) {
  this._getPreset((err, current) => {
    callback(err, preset === current);
  });
};

SoundTouchAccessory.prototype._setPreset = function(preset, on, callback) {
  if (!this.api) {
    this.log.warn('Ignoring request; SoundTouch device has not yet been discovered.');
    callback(new Error('SoundTouch has not been discovered yet.'));
    return;
  }
  if(on) {
    this._switchPresetServices(preset);
    if(preset === 0) { // special preset select tv
      this.api.select('PRODUCT', undefined, 'TV', undefined, () => {
        this.volumeService.getCharacteristic(Characteristic.On).updateValue(true);
        this.onService.getCharacteristic(Characteristic.On).updateValue(true);
        callback();
      });
    } else {
      this.api.setPreset(preset, () => {
        this.log('Setting preset to %s', preset);
        this.volumeService.getCharacteristic(Characteristic.On).updateValue(true);
        this.onService.getCharacteristic(Characteristic.On).updateValue(true);
        callback();
      });
    }
  } else {
    this.api.powerOff(() => {
      this.volumeService.getCharacteristic(Characteristic.On).updateValue(false);
      this.onService.getCharacteristic(Characteristic.On).updateValue(false);
      this._switchPresetServices();
      this.log('Powering Off...');
      callback();
    });
  }
};

SoundTouchAccessory.prototype._switchPresetServices = function(index) {
  const type = `preset${index}Service`;
  for(const service of this.presetServices) {
    service.getCharacteristic(Characteristic.On).updateValue(service.subtype === type);
  }
}


