import {API, APIDiscovery, KeyValue, Preset, SourceStatus} from 'soundtouch-api';
import {AccessoryConfig} from './accessory-config';
import {callbackify} from './utils';

let Service: any, Characteristic: any;

export default function(homebridge: any) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-soundtouch-volume", "SoundTouchVolume", SoundTouchAccessory);
}

class SoundTouchAccessory {

    private readonly log: Function;
    private readonly config: AccessoryConfig;
    private api?: API;

    private readonly onService: any;
    private readonly volumeService: any;
    private readonly presetServices: any[];
    private readonly informationService: any;

    private static readonly presetValues: KeyValue[] = [
        KeyValue.preset1,
        KeyValue.preset2,
        KeyValue.preset3,
        KeyValue.preset4,
        KeyValue.preset5,
        KeyValue.preset6
    ];

    constructor(log: Function, config: AccessoryConfig) {
        this.log = log;
        this.config = config;
        this.onService = this.initOnService();
        this.volumeService = this.initVolumeService();
        this.presetServices = this.initPresetServices();
        this.informationService = this.initInformationService();
    }

    private initOnService() {
        const onService = new Service.Switch(this.config.name);
        onService
            .getCharacteristic(Characteristic.On)
            .on('get', callbackify(this.isOn.bind(this)))
            .on('set', callbackify(this.setOn.bind(this)));
        return onService;
    }

    private initVolumeService() {
        const volumeService = new Service.Lightbulb(this.config.name + ' Volume', 'volumeService');
        volumeService
            .getCharacteristic(Characteristic.On)
            .on('get', callbackify(this.isNotMuted.bind(this)))
            .on('set', callbackify(this.unMuteDevice.bind(this)));
        const brightnessCharacteristic = new Characteristic.Brightness();
        if(this.config.maxVolume) {
            brightnessCharacteristic.props.maxValue = Math.min(this.config.maxVolume, 100);
        }
        volumeService
            .addCharacteristic(brightnessCharacteristic)
            .on('get', callbackify(this.getVolume.bind(this)))
            .on('set', callbackify(this.setVolume.bind(this)));
        return volumeService;
    }

    private initPresetServices() {
        const presetServices = [];
        if(this.config.presets instanceof Array) {
            for(const preset of this.config.presets) {
                const service = new Service.Lightbulb(preset.name, `preset${preset.index}Service`);
                const characteristic = service.getCharacteristic(Characteristic.On);
                characteristic.on('get', async (callback) => {
                   try {
                       callback(undefined, await this.isSelectedPreset(preset.index));
                   } catch(err) {
                       callback(err);
                   }
                });
                characteristic.on('set', async (on, callback) => {
                    try {
                        callback(undefined, await this.setPreset(on, preset.index));
                    } catch(err) {
                        callback(err);
                    }
                });
                presetServices.push(service);
            }
        }
        return presetServices;
    }

    private initInformationService() {
        const informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Name, this.config.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Bose')
            .setCharacteristic(Characteristic.Model, 'Bose SoundTouch')
            .setCharacteristic(Characteristic.SerialNumber, this.config.room);
        return informationService;
    };

    async getAPI(): Promise<API | undefined> {
        if(this.api !== undefined) {
            return this.api;
        }
        if(this.config.ip) {
            this.api = new API(this.config.ip, this.config.port);
        } else {
            this.api = await APIDiscovery.find(this.config.room);
        }
        return this.api;
    }

    getServices() {
        return [
            this.onService,
            this.volumeService,
            ...this.presetServices,
            this.informationService
        ];
    };

    async isOn(): Promise<boolean> {
        const api = await this.getAPI();
        const nowPlaying = await api.getNowPlaying();
        return nowPlaying.source !== SourceStatus.standBy;
    }

    async setOn(on: boolean): Promise<boolean> {
        const api = await this.getAPI();
        const nowPlaying = await api.getNowPlaying();
        if(nowPlaying.source === SourceStatus.standBy) {
            if(on) {
                const success = await api.pressKey(KeyValue.power);
                if(success) {
                    await new Promise((resolve => setTimeout(resolve, 500)));
                    const selectedPreset = await this.getSelectedPreset();
                    if(selectedPreset !== -1) {
                        this.switchPresetService(true, selectedPreset);
                    }
                    this.volumeService.getCharacteristic(Characteristic.On).updateValue(true);
                }
                return success;
            }
        } else if(!on) {
            const selectedPreset = await this.getSelectedPreset();
            const success = await api.pressKey(KeyValue.power);
            if(success) {
                if(selectedPreset !== -1) {
                    this.switchPresetService(false, selectedPreset);
                }
                this.volumeService.getCharacteristic(Characteristic.On).updateValue(false);
            }
            return success;
        }
        return false;
    }

    async isNotMuted(): Promise<boolean> {
        const api = await this.getAPI();
        const isOn = await this.isOn();
        if(isOn) {
            const volume = await api.getVolume();
            return !volume.isMuted;
        }
        return false;
    }

    async unMuteDevice(unmute: boolean): Promise<boolean> {
        let isOn = await this.isOn();
        const api = await this.getAPI();
        if(isOn) {
            const volume = await api.getVolume();
            if((unmute && volume.isMuted) || (!unmute && !volume.isMuted)) {
                return api.pressKey(KeyValue.mute);
            }
        } else if(unmute) {
            isOn = await api.pressKey(KeyValue.power);
            if(isOn) {
                this.onService.getCharacteristic(Characteristic.On).updateValue(true);
            }
        }
        return false;
    }

    async getVolume(): Promise<number> {
        const api = await this.getAPI();
        const volume = await api.getVolume();
        return volume.actual;
    }

    async setVolume(volume: number): Promise<boolean> {
        const volumeCharacteristic = this.volumeService.getCharacteristic(Characteristic.Brightness);
        const oldVolume = volumeCharacteristic.value;
        const maxValue = volumeCharacteristic.props.maxValue;
        if(volume === maxValue && oldVolume <= maxValue / 2) {
            volume = Math.max(oldVolume, this.config.unmuteVolume || 35);
        }
        const api = await this.getAPI();
        return api.setVolume(volume);
    }

    async getSelectedPreset(): Promise<number> {
        const api = await this.getAPI();
        const nowPlaying = await api.getNowPlaying();
        if(nowPlaying.source === SourceStatus.standBy) {
            return -1;
        }
        const presets = await api.getPresets();
        for(const preset of presets) {
            if (JSON.stringify(preset.contentItem) === JSON.stringify(nowPlaying.contentItem)) {
                return preset.id;
            }
        }
        return nowPlaying.source === 'PRODUCT' ? 0 : -1;
    }

    async isSelectedPreset(index: number): Promise<boolean> {
        const selectedPreset = await this.getSelectedPreset();
        return selectedPreset === index;
    }

    async setPreset(on: boolean, index: number): Promise<boolean> {
        let success = false;
        if(on) {
            const selectedPreset = await this.getSelectedPreset();
            if(index === 0) { // special preset select tv
                success = await this.api.selectSource('PRODUCT', 'TV');
            } else {
                success = await this.api.pressKey(SoundTouchAccessory.presetValues[index - 1]);
            }
            if(success) {
                if(selectedPreset !== -1) {
                    this.switchPresetService(false, selectedPreset);
                }
                this.volumeService.getCharacteristic(Characteristic.On).updateValue(true);
                this.onService.getCharacteristic(Characteristic.On).updateValue(true);
            }
        } else {
            success = await this.setOn(on);
            if(success) {
                this.onService.getCharacteristic(Characteristic.On).updateValue(false);
            }
        }
        return success;
    }

    private switchPresetService(on: boolean, index: number): void {
        const type = `preset${index}Service`;
        for(const service of this.presetServices) {
            if(service.subtype === type) {
                service.getCharacteristic(Characteristic.On).updateValue(on);
                return;
            }
        }
    }
}