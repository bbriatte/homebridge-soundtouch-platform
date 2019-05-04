import {KeyValue, SourceStatus} from 'soundtouch-api';
import {callbackify} from './utils';
import {SoundTouchDevice} from './sound-touch-device';

interface SoundTouchSelectedSource {
    readonly productAccount?: string;
    readonly presetIndex?: number;
}

export class SoundTouchAccessory {

    readonly device: SoundTouchDevice;
    readonly accessory: any;
    readonly homebridge: any;

    private readonly onService: any;
    private readonly volumeService: any;
    private readonly presetServices: any[];
    private readonly productServices: any[];
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
        this.productServices = this.initProductServices();
    }

    private initOnService(): any {
        const Service = this.homebridge.hap.Service;
        const Characteristic = this.homebridge.hap.Characteristic;
        const onService = this.getAccessoryService(Service.Switch, this.accessory.displayName, 'onService');
        onService
            .getCharacteristic(Characteristic.On)
            .on('get', callbackify(this.isOn.bind(this)))
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
            const presetType = `preset${i}Service`;
            const preset = this.device.presets.find((p) => p.index === i);
            if(preset === undefined) {
                this.removeUnusedService(Service.Switch, presetType);
                continue;
            }
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
        return presetServices;
    }

    private initProductServices(): any[] {
        const Service = this.homebridge.hap.Service;
        const Characteristic = this.homebridge.hap.Characteristic;
        const productServices = [];
        for(let product of this.device.products) {
            const productType = `product${product.account}Service`;
            if(product.enabled === false) {
                this.removeUnusedService(Service.Switch, productType);
                continue;
            }
            const service = this.getAccessoryService(Service.Switch, product.name, productType);
            const characteristic = service.getCharacteristic(Characteristic.On);
            characteristic.on('get', async (callback) => {
                try {
                    callback(undefined, await this.isSelectedProduct(product.account));
                } catch(err) {
                    callback(err);
                }
            });
            characteristic.on('set', async (on, callback) => {
                try {
                    callback(undefined, await this.setProduct(on, product.account));
                } catch(err) {
                    callback(err);
                }
            });
            productServices.push(service);
        }
        return productServices;
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
                    const selectedSource = await this.getSelectedSource();
                    this.switchSelectedSource(on, selectedSource);
                    this.volumeService.getCharacteristic(Characteristic.On).updateValue(on);
                }
                return success;
            }
        } else if(!on) {
            const selectedSource = await this.getSelectedSource();
            const success = await this.device.api.pressKey(KeyValue.power);
            if(success) {
                this.switchSelectedSource(on, selectedSource);
                this.volumeService.getCharacteristic(Characteristic.On).updateValue(on);
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
                this.onService.getCharacteristic(Characteristic.On).updateValue(isOn);
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

    async getSelectedSource(): Promise<SoundTouchSelectedSource | undefined> {
        const nowPlaying = await this.device.api.getNowPlaying();
        if(nowPlaying.source === SourceStatus.standBy) {
            return undefined;
        }
        if(nowPlaying.source === 'PRODUCT') {
            for(const product of this.device.products) {
                if(product.enabled === false) {
                    continue;
                }
                if (product.account === nowPlaying.sourceAccount) {
                    return {
                        productAccount: product.account
                    };
                }
            }
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
        return undefined;
    }

    async isSelectedPreset(index: number): Promise<boolean> {
        const selectedPreset = await this.getSelectedSource();
        return selectedPreset !== undefined && selectedPreset.presetIndex === index;
    }

    async setPreset(on: boolean, index: number): Promise<boolean> {
        const Characteristic = this.homebridge.hap.Characteristic;
        let success = false;
        if(on) {
            const selectedSource = await this.getSelectedSource();
            success = await this.device.api.pressKey(SoundTouchAccessory.presetValues[index - 1]);
            if(success) {
                this.switchSelectedSource(false, selectedSource);
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

    private switchSelectedSource(on: boolean, selectedSource?: SoundTouchSelectedSource): void {
        if(selectedSource) {
            if(selectedSource.productAccount !== undefined) {
                this.switchProductService(on, selectedSource.productAccount);
            } else if(selectedSource.presetIndex !== undefined) {
                this.switchPresetService(on, selectedSource.presetIndex);
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
        this.switchService(on, `preset${index}Service`, this.presetServices);
    }

    private switchProductService(on: boolean, account: string): void {
        this.switchService(on, `product${account}Service`, this.productServices);
    }

    private async isSelectedProduct(account: string): Promise<boolean> {
        const selectedSource = await this.getSelectedSource();
        return selectedSource !== undefined && selectedSource.productAccount === account;
    }

    private async setProduct(on: boolean, account: string): Promise<boolean> {
        const Characteristic = this.homebridge.hap.Characteristic;
        let success = false;
        if(on) {
            const selectedSource = await this.getSelectedSource();
            success = await this.device.api.selectSource('PRODUCT', account);
            if(success) {
                this.switchSelectedSource(false, selectedSource);
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