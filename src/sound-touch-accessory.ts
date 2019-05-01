import {KeyValue, SourceStatus} from 'soundtouch-api';
import {callbackify} from './utils';
import {SoundTouchDevice} from './sound-touch-device';

export class SoundTouchAccessory {

    readonly device: SoundTouchDevice;
    readonly accessory: any;
    readonly homebridge: any;

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

    constructor(device: SoundTouchDevice, accessory: any, homebridge: any) {
        this.device = device;
        this.accessory = accessory;
        this.homebridge = homebridge;

        this.informationService = this.initInformationService();
        this.onService = this.initOnService();
        this.volumeService = this.initVolumeService();
        this.presetServices = this.initPresetServices();
    }

    private initOnService() {
        const Service = this.homebridge.hap.Service;
        const Characteristic = this.homebridge.hap.Characteristic;
        const onService = this.getAccessoryService(Service.Switch, this.accessory.displayName, 'onService');
        onService
            .getCharacteristic(Characteristic.On)
            .on('get', callbackify(this.isOn.bind(this)))
            .on('set', callbackify(this.setOn.bind(this)));
        return onService;
    }

    private initVolumeService() {
        const Service = this.homebridge.hap.Service;
        const Characteristic = this.homebridge.hap.Characteristic;
        const volumeService = this.getAccessoryService(Service.Lightbulb, this.accessory.displayName+ ' Volume', 'volumeService');
        volumeService
            .getCharacteristic(Characteristic.On)
            .on('get', callbackify(this.isNotMuted.bind(this)))
            .on('set', callbackify(this.unMuteDevice.bind(this)));
        let brightnessCharacteristic = volumeService.getCharacteristic(Characteristic.Brightness);
        if(brightnessCharacteristic === undefined) {
            brightnessCharacteristic = volumeService.addCharacteristic(new Characteristic.Brightness());
        }
        if(this.device.maxVolume < 100) {
            brightnessCharacteristic.props.maxValue = Math.min(this.device.maxVolume, 100);
        }
        brightnessCharacteristic
            .on('get', callbackify(this.getVolume.bind(this)))
            .on('set', callbackify(this.setVolume.bind(this)));
        return volumeService;
    }

    private initPresetServices() {
        const Service = this.homebridge.hap.Service;
        const Characteristic = this.homebridge.hap.Characteristic;
        const presetServices = [];
        for(let i = 0; i <= 6; i++) {
            const presetType = `preset${i}Service`;
            const preset = this.device.presets.find((p) => p.index === i);
            if(preset === undefined) {
                const oldService = this.accessory.getServiceByUUIDAndSubType(Service.Switch, presetType);
                if(oldService !== undefined) {
                    this.accessory.removeService(oldService);
                }
            } else {
                const service = this.getAccessoryService(Service.Switch, preset.name, presetType);
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
        const Service = this.homebridge.hap.Service;
        const Characteristic = this.homebridge.hap.Characteristic;
        const informationService = this.accessory.getService(Service.AccessoryInformation);
        informationService
            .setCharacteristic(Characteristic.Name, this.accessory.displayName)
            .setCharacteristic(Characteristic.Manufacturer, 'Bose')
            .setCharacteristic(Characteristic.Model, this.device.model)
            .setCharacteristic(Characteristic.SerialNumber, this.device.id);
        if(this.device.version) {
            informationService.setCharacteristic(Characteristic.FirmwareRevision, this.device.version);
        }
        return informationService;
    };

    async isOn(): Promise<boolean> {
        const nowPlaying = await this.device.api.getNowPlaying();
        return nowPlaying.source !== SourceStatus.standBy;
    }

    async setOn(on: boolean): Promise<boolean> {
        const Characteristic = this.homebridge.hap.Characteristic;
        const nowPlaying = await this.device.api.getNowPlaying();
        if(nowPlaying.source === SourceStatus.standBy) {
            if(on) {
                const success = await this.device.api.pressKey(KeyValue.power);
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
            const success = await this.device.api.pressKey(KeyValue.power);
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
        const isOn = await this.isOn();
        if(isOn) {
            const volume = await this.device.api.getVolume();
            return !volume.isMuted;
        }
        return false;
    }

    async unMuteDevice(unmute: boolean): Promise<boolean> {
        const Characteristic = this.homebridge.hap.Characteristic;
        let isOn = await this.isOn();
        if(isOn) {
            const volume = await this.device.api.getVolume();
            if((unmute && volume.isMuted) || (!unmute && !volume.isMuted)) {
                return this.device.api.pressKey(KeyValue.mute);
            }
        } else if(unmute) {
            isOn = await this.device.api.pressKey(KeyValue.power);
            if(isOn) {
                this.onService.getCharacteristic(Characteristic.On).updateValue(true);
            }
        }
        return false;
    }

    async getVolume(): Promise<number> {
        const volume = await this.device.api.getVolume();
        return volume.actual;
    }

    async setVolume(volume: number): Promise<boolean> {
        const Characteristic = this.homebridge.hap.Characteristic;
        const volumeCharacteristic = this.volumeService.getCharacteristic(Characteristic.Brightness);
        const oldVolume = volumeCharacteristic.value;
        const maxValue = volumeCharacteristic.props.maxValue;
        if(volume === maxValue && oldVolume <= maxValue / 2) {
            volume = Math.max(oldVolume, this.device.unmuteVolume);
        }
        return this.device.api.setVolume(volume);
    }

    async getSelectedPreset(): Promise<number> {
        const nowPlaying = await this.device.api.getNowPlaying();
        if(nowPlaying.source === SourceStatus.standBy) {
            return -1;
        }
        const presets = await this.device.api.getPresets();
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
        const Characteristic = this.homebridge.hap.Characteristic;
        let success = false;
        if(on) {
            const selectedPreset = await this.getSelectedPreset();
            if(index === 0) { // special preset select tv
                success = await this.device.api.selectSource('PRODUCT', 'TV');
            } else {
                success = await this.device.api.pressKey(SoundTouchAccessory.presetValues[index - 1]);
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
        const Characteristic = this.homebridge.hap.Characteristic;
        const type = `preset${index}Service`;
        for(const service of this.presetServices) {
            if(service.subtype === type) {
                service.getCharacteristic(Characteristic.On).updateValue(on);
                return;
            }
        }
    }

    private getAccessoryService(serviceType: any, displayName: string, subType: string): any {
        const service = this.accessory.getServiceByUUIDAndSubType(serviceType, subType);
        if (!service) {
            return this.accessory.addService(serviceType, displayName, subType);
        } else if(service.displayName !== displayName) {
            const Characteristic = this.homebridge.hap.Characteristic;
            const nameCharacteristic = service.getCharacteristic(Characteristic.Name)
                || service.addCharacteristic(Characteristic.Name);
            nameCharacteristic.setValue(displayName);
            service.displayName = displayName;
        }
        return service;
    }
}