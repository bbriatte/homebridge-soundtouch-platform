import {ContentItem, KeyValue, SourceStatus} from 'soundtouch-api';
import {callbackify, Logger} from './utils';
import {SoundTouchDevice} from './sound-touch-device';

interface SoundTouchSelectedSource {
    readonly sourceItem?: ContentItem;
    readonly presetIndex?: number;
}

export class SoundTouchAccessory {

    readonly log: Logger;
    readonly device: SoundTouchDevice;
    readonly accessory: any;
    readonly homebridge: any;

    private readonly onService: any;
    private readonly volumeService: any;
    private readonly presetServices: any[];
    private readonly sourceServices: any[];
    private readonly informationService: any;

    private static readonly presetValues: KeyValue[] = [
        KeyValue.preset1,
        KeyValue.preset2,
        KeyValue.preset3,
        KeyValue.preset4,
        KeyValue.preset5,
        KeyValue.preset6
    ];

    constructor(log: Logger, device: SoundTouchDevice, accessory: any, homebridge: any) {
        this.log = log;
        this.device = device;
        this.accessory = accessory;
        this.homebridge = homebridge;

        this.informationService = this.initInformationService();
        this.onService = this.initOnService();
        this.volumeService = this.initVolumeService();
        this.presetServices = this.initPresetServices();
        this.sourceServices = this.initSourceServices();

        this.log(`Found device [${device.name}]`);
    }

    private initOnService(): any {
        const Service = this.homebridge.hap.Service;
        const Characteristic = this.homebridge.hap.Characteristic;
        const onService = this.getAccessoryService(Service.Switch, this.accessory.displayName, 'onService');
        onService
            .getCharacteristic(Characteristic.On)
            .on('get', callbackify(async () => {
                const isOn = await this.isOn();
                this.log(`[${this.device.name}] ${isOn ? 'Is on' : 'Is off'}`);
                return isOn;
            }))
            .on('set', callbackify(this.setOn.bind(this)));
        return onService;
    }

    private initVolumeService(): any {
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

    private initPresetServices(): any[] {
        const Service = this.homebridge.hap.Service;
        const Characteristic = this.homebridge.hap.Characteristic;
        const presetServices = [];
        for(let i = 1; i <= 6; i++) {
            const presetType = _presetIndexToServiceType(i);
            const preset = this.device.presets.find((p) => p.index === i);
            if(preset === undefined) {
                this.removeUnusedService(Service.Switch, presetType);
                continue;
            }
            const service = this.getAccessoryService(Service.Switch, preset.name, presetType);
            const characteristic = service.getCharacteristic(Characteristic.On);
            characteristic.on('get', callbackify(() => this.isSelectedPreset(preset.index)));
            characteristic.on('set', callbackify((on: boolean) => this.setPreset(on, preset.index)));
            presetServices.push(service);
        }
        return presetServices;
    }

    private initSourceServices(): any[] {
        const Service = this.homebridge.hap.Service;
        const Characteristic = this.homebridge.hap.Characteristic;
        const sourceServices = [];
        for(let src of this.device.sources) {
            const sourceType = _sourceToServiceType(src.source, src.account);
            if(src.enabled === false) {
                this.removeUnusedService(Service.Switch, sourceType);
                continue;
            }
            const service = this.getAccessoryService(Service.Switch, src.name, sourceType);
            const characteristic = service.getCharacteristic(Characteristic.On);
            characteristic.on('get', callbackify(() => this.isSelectedSource(src.source, src.account)));
            characteristic.on('set', callbackify((on: boolean) => this.setSource(on, src.source, src.account)));
            sourceServices.push(service);
        }
        return sourceServices;
    }

    private initInformationService(): any {
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

    private async isOn(): Promise<boolean> {
        const nowPlaying = await this.device.api.getNowPlaying();
        return nowPlaying.source !== SourceStatus.standBy;
    }

    private async setOn(on: boolean, updateOn?: boolean): Promise<boolean> {
        const nowPlaying = await this.device.api.getNowPlaying();
        let success = false;
        if(nowPlaying.source === SourceStatus.standBy) {
            if(on) {
                success = await this.device.api.pressKey(KeyValue.power);
                if(!success) {
                    return false;
                }
                success = await this.deviceDidTurnOn(updateOn, true, true);
                if(!success) {
                    return false;
                }
                await new Promise((resolve => setTimeout(resolve, 500)));
                const selectedSource = await this.getSelectedSource();
                this.switchSelectedSource(on, selectedSource);
            }
        } else if(!on) {
            const selectedSource = await this.getSelectedSource();
            success = await this.device.api.pressKey(KeyValue.power);
            if(!success) {
                return false;
            }
            success = await this.deviceDidTurnOff(updateOn, true);
            this.switchSelectedSource(on, selectedSource);
        }
        return success;
    }

    private async isNotMuted(): Promise<boolean> {
        const isOn = await this.isOn();
        if(isOn) {
            const volume = await this.device.api.getVolume();
            return !volume.isMuted;
        }
        return false;
    }

    private async unMuteDevice(unmute: boolean): Promise<boolean> {
        let isOn = await this.isOn();
        if(isOn) {
            const volume = await this.device.api.getVolume();
            if((unmute && volume.isMuted) || (!unmute && !volume.isMuted)) {
                this.log(`[${this.device.name}] ${unmute ? 'Unmuted' : 'Muted'}`);
                return this.device.api.pressKey(KeyValue.mute);
            }
        } else if(unmute) {
            isOn = await this.device.api.pressKey(KeyValue.power);
            if(isOn) {
                return this.deviceDidTurnOn(true);
            }
        }
        return false;
    }

    private async getVolume(): Promise<number> {
        const volume = await this.device.api.getVolume();
        this.log(`[${this.device.name}] Current volume ${volume.actual}`);
        return volume.actual;
    }

    private async setVolume(volume: number, updateBrightness?: boolean): Promise<boolean> {
        const Characteristic = this.homebridge.hap.Characteristic;
        const volumeCharacteristic = this.volumeService.getCharacteristic(Characteristic.Brightness);
        const oldVolume = volumeCharacteristic.value;
        const maxValue = volumeCharacteristic.props.maxValue;
        if(volume === maxValue && oldVolume <= maxValue / 2) {
            volume = Math.max(oldVolume, this.device.unmuteVolume);
        }
        this.log(`[${this.device.name}] Volume change to ${volume}`);
        if(updateBrightness === true) {
            volumeCharacteristic.updateValue(volume);
        }
        return this.device.api.setVolume(volume);
    }

    private async getSelectedSource(): Promise<SoundTouchSelectedSource | undefined> {
        const nowPlaying = await this.device.api.getNowPlaying();
        if(nowPlaying.source === SourceStatus.standBy) {
            return undefined;
        }
        const presets = await this.device.api.getPresets();
        for(const preset of presets) {
            if (JSON.stringify(preset.contentItem) === JSON.stringify(nowPlaying.contentItem)) {
                return {
                    presetIndex: preset.id
                }
            }
        }
        const selectedSource = this.device.sources.find((src) => {
            if(src.enabled === false) {
                return false;
            }
            return src.source === nowPlaying.source && src.account === nowPlaying.sourceAccount;
        });
        if(selectedSource !== undefined) {
            return {
                sourceItem: {
                    source: selectedSource.source,
                    sourceAccount: selectedSource.account
                }
            };
        }
        return undefined;
    }

    private async isSelectedPreset(index: number): Promise<boolean> {
        const selectedPreset = await this.getSelectedSource();
        if(selectedPreset !== undefined) {
            if(selectedPreset.presetIndex === index) {
                this.log(`[${this.device.name}] Current preset n°${index}`);
                return true;
            }
        }
        return false;
    }

    private async setPreset(on: boolean, index: number): Promise<boolean> {
        let success = false;
        if(on) {
            const isOn = await this.isOn();
            if (!isOn) {
                success = await this.setOn(on, true);
                if (!success) {
                    return false;
                }
            }
            const selectedSource: SoundTouchSelectedSource = await this.getSelectedSource();
            success = await this.device.api.pressKey(SoundTouchAccessory.presetValues[index - 1]);
            if (!success) {
                return false;
            }
            if (success) {
                this.log(`[${this.device.name}] Set preset n°${index}`);
                this.switchSelectedSource(false, selectedSource);
            }
        } else {
            success = await this.setOn(on, true);
        }
        return success;
    }

    private async deviceDidTurnOn(updateOn?: boolean, updateVolume?: boolean, updateBrightness?: boolean): Promise<boolean> {
        let success = true;
        const Characteristic = this.homebridge.hap.Characteristic;
        this.log(`[${this.device.name}] Turn on`);
        if(updateOn === true) {
            this.onService.getCharacteristic(Characteristic.On).updateValue(true);
        }
        if(updateVolume === true) {
            this.volumeService.getCharacteristic(Characteristic.On).updateValue(true);
        }
        if(updateBrightness === true && this.device.onVolume >= 0) {
            success = await this.setVolume(this.device.onVolume, true);
        }
        return success;
    }

    private async deviceDidTurnOff(updateOn?: boolean, updateVolume?: boolean): Promise<boolean> {
        const Characteristic = this.homebridge.hap.Characteristic;
        this.log(`[${this.device.name}] Turn off`);
        if(updateOn === true) {
            this.onService.getCharacteristic(Characteristic.On).updateValue(false);
        }
        if(updateVolume === true) {
            this.volumeService.getCharacteristic(Characteristic.On).updateValue(false);
        }
        return true;
    }

    private switchSelectedSource(on: boolean, selectedSource?: SoundTouchSelectedSource): void {
        if(selectedSource) {
            if(selectedSource.presetIndex !== undefined) {
                this.switchPresetService(on, selectedSource.presetIndex);
            } else if(selectedSource.sourceItem !== undefined) {
                this.switchSourceService(on, selectedSource.sourceItem.source, selectedSource.sourceItem.sourceAccount);
            }
        }
    }

    private switchService(on: boolean, type: string, services: any[]) {
        const Characteristic = this.homebridge.hap.Characteristic;
        for(const service of services) {
            if(service.subtype === type) {
                service.getCharacteristic(Characteristic.On).updateValue(on);
                return;
            }
        }
    }

    private removeUnusedService(type: any, subType: string) {
        const oldService = this.accessory.getServiceByUUIDAndSubType(type, subType);
        if(oldService !== undefined) {
            this.accessory.removeService(oldService);
        }
    }

    private switchPresetService(on: boolean, index: number): void {
        this.switchService(on, _presetIndexToServiceType(index), this.presetServices);
    }

    private switchSourceService(on: boolean, source: string, account?: string): void {
        this.switchService(on, _sourceToServiceType(source, account), this.sourceServices);
    }

    private async isSelectedSource(source: string, account: string): Promise<boolean> {
        const selectedSource = await this.getSelectedSource();
        if(selectedSource !== undefined) {
            const sourceItem = selectedSource.sourceItem;
            if(sourceItem !== undefined && sourceItem.source === source && sourceItem.sourceAccount === account) {
                this.log(`[${this.device.name}] Current source: '${source}', account: '${account}'`);
                return true;
            }
        }
        return false;
    }

    private async setSource(on: boolean, source: string, account: string): Promise<boolean> {
        let success = false;
        if(on) {
            const isOn = await this.isOn();
            if(!isOn) {
                success = await this.setOn(on, true);
                if(!success) {
                    return false;
                }
            }
            const selectedSource = await this.getSelectedSource();
            success = await this.device.api.selectSource({
                source: source,
                sourceAccount: account
            });
            if(success) {
                this.log(`[${this.device.name}] Select source: '${source}', account: '${account}'`);
                this.switchSelectedSource(false, selectedSource);
            }
        } else {
            success = await this.setOn(on,true);
        }
        return success;
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

function _sourceToServiceType(source: string, account?: string): string {
    return `${source.toLowerCase()}${account || ''}Service`;
}

function _presetIndexToServiceType(index: number): string {
    return `preset${index}Service`;
}