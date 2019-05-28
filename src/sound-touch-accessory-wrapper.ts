import {ContentItem, KeyValue, SourceStatus} from 'soundtouch-api';
import {deviceIsOn, DeviceOnOffListener, SoundTouchDevice} from './sound-touch-device';
import {SoundTouchVolume} from './sound-touch-volume';
import {SoundTouchSpeakerVolume} from './sound-touch-speaker-volume';
import {VolumeMode} from './accessory-config';
import {SoundTouchLightbulbVolume} from './sound-touch-lightbulb-volume';
import {callbackify, Context, HomebridgeAccessoryWrapper} from 'homebridge-base-platform';

interface SoundTouchSelectedSource {
    readonly sourceItem?: ContentItem;
    readonly presetIndex?: number;
}

export class SoundTouchAccessoryWrapper extends HomebridgeAccessoryWrapper<SoundTouchDevice> implements DeviceOnOffListener {

    private readonly volume?: SoundTouchVolume;
    private readonly onService: any;
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

    constructor(context: Context, accessory: any, device: SoundTouchDevice) {
        super(context, accessory, device);

        this.informationService = this.initInformationService();
        this.onService = this.initOnService();
        this.volume = this.initVolumeService();
        this.presetServices = this.initPresetServices();
        this.sourceServices = this.initSourceServices();

        this.log(`[${this.getDisplayName()}] Accessory ready`);
    }

    private initVolumeService(): SoundTouchVolume | undefined {
        if(this.device.volumeSettings.mode !== VolumeMode.none) {
            if(this.device.volumeSettings.mode === VolumeMode.lightbulb) {
                SoundTouchSpeakerVolume.clearServices(this);
                return new SoundTouchLightbulbVolume(this.device, this);
            }
            if(this.device.volumeSettings.mode === VolumeMode.speaker) {
                SoundTouchLightbulbVolume.clearServices(this);
                return new SoundTouchSpeakerVolume(this.device, this);
            }
        }
        SoundTouchLightbulbVolume.clearServices(this);
        SoundTouchSpeakerVolume.clearServices(this);
        return undefined;
    }

    private initOnService(): any {
        const onService = this.getService(this.Service.Switch, this.getDisplayName(), 'onService');
        onService
            .getCharacteristic(this.Characteristic.On)
            .on('get', callbackify(async () => {
                const isOn = await deviceIsOn(this.device);
                this.log(`[${this.getDisplayName()}] ${isOn ? 'Is on' : 'Is off'}`);
                return isOn;
            }))
            .on('set', callbackify(this.setOn.bind(this)));
        return onService;
    }

    private initPresetServices(): any[] {
        const presetServices = [];
        for(let i = 1; i <= 6; i++) {
            const presetType = _presetIndexToServiceType(i);
            const preset = this.device.presets.find((p) => p.index === i);
            if(preset === undefined) {
                this.removeService(this.Service.Switch, presetType);
                continue;
            }
            const service = this.getService(this.Service.Switch, preset.name, presetType);
            const characteristic = service.getCharacteristic(this.Characteristic.On);
            characteristic.on('get', callbackify(() => this.isSelectedPreset(preset.index)));
            characteristic.on('set', callbackify((on: boolean) => this.setPreset(on, preset.index)));
            presetServices.push(service);
        }
        return presetServices;
    }

    private initSourceServices(): any[] {
        const sourceServices = [];
        for(let src of this.device.sources) {
            const sourceType = _sourceToServiceType(src.source, src.account);
            if(src.enabled === false) {
                this.removeService(this.Service.Switch, sourceType);
                continue;
            }
            const service = this.getService(this.Service.Switch, src.name, sourceType);
            const characteristic = service.getCharacteristic(this.Characteristic.On);
            characteristic.on('get', callbackify(() => this.isSelectedSource(src.source, src.account)));
            characteristic.on('set', callbackify((on: boolean) => this.setSource(on, src.source, src.account)));
            sourceServices.push(service);
        }
        return sourceServices;
    }

    private initInformationService(): any {
        const informationService = this.accessory.getService(this.Service.AccessoryInformation);
        informationService
            .setCharacteristic(this.Characteristic.Name, this.getDisplayName())
            .setCharacteristic(this.Characteristic.Manufacturer, 'Bose')
            .setCharacteristic(this.Characteristic.Model, this.device.model)
            .setCharacteristic(this.Characteristic.SerialNumber, this.device.id);
        if(this.device.version) {
            informationService.setCharacteristic(this.Characteristic.FirmwareRevision, this.device.version);
        }
        return informationService;
    };

    public async setOn(on: boolean, updateOn?: boolean): Promise<boolean> {
        const nowPlaying = await this.device.api.getNowPlaying();
        let success = false;
        if(nowPlaying.source === SourceStatus.standBy) {
            if(on) {
                success = await this.device.api.pressKey(KeyValue.power);
                if(!success) {
                    return false;
                }
                success = await this.deviceDidTurnOn(updateOn, true);
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
                this.log(`[${this.getDisplayName()}] Current preset n°${index}`);
                return true;
            }
        }
        return false;
    }

    private async setPreset(on: boolean, index: number): Promise<boolean> {
        let success = false;
        if(on) {
            const isOn = await deviceIsOn(this.device);
            if (!isOn) {
                success = await this.setOn(on, true);
                if (!success) {
                    return false;
                }
            }
            const selectedSource: SoundTouchSelectedSource = await this.getSelectedSource();
            success = await this.device.api.pressKey(SoundTouchAccessoryWrapper.presetValues[index - 1]);
            if (!success) {
                return false;
            }
            if (success) {
                this.log(`[${this.getDisplayName()}] Set preset n°${index}`);
                this.switchSelectedSource(false, selectedSource);
            }
        } else {
            success = await this.setOn(on, true);
        }
        return success;
    }

    public async deviceDidTurnOn(updateOn?: boolean, updateVolume?: boolean): Promise<boolean> {
        let success = true;
        this.log(`[${this.getDisplayName()}] Turn on`);
        if(updateOn === true) {
            this.onService.getCharacteristic(this.Characteristic.On).updateValue(true);
            if(this.volume !== undefined) {
                this.volume.getMuteCharacteristic().updateValue(true);
            }
        }
        if(this.volume !== undefined && updateVolume === true && this.device.volumeSettings.onValue >= 0) {
            success = await this.volume.setVolume(this.device.volumeSettings.onValue, true);
        }
        return success;
    }

    public async deviceDidTurnOff(updateOn?: boolean, updateVolume?: boolean): Promise<boolean> {
        this.log(`[${this.getDisplayName()}] Turn off`);
        if(updateOn === true) {
            this.onService.getCharacteristic(this.Characteristic.On).updateValue(false);
        }
        if(updateVolume === true) {
            this.volume.getMuteCharacteristic().updateValue(false);
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
        for(const service of services) {
            if(service.subtype === type) {
                service.getCharacteristic(this.Characteristic.On).updateValue(on);
                return;
            }
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
                this.log(`[${this.getDisplayName()}] Current source: '${source}', account: '${account}'`);
                return true;
            }
        }
        return false;
    }

    private async setSource(on: boolean, source: string, account: string): Promise<boolean> {
        let success = false;
        if(on) {
            const isOn = await deviceIsOn(this.device);
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
                this.log(`[${this.getDisplayName()}] Select source: '${source}', account: '${account}'`);
                this.switchSelectedSource(false, selectedSource);
            }
        } else {
            success = await this.setOn(on,true);
        }
        return success;
    }
}

function _sourceToServiceType(source: string, account?: string): string {
    return `${source.toLowerCase()}${account || ''}Service`;
}

function _presetIndexToServiceType(index: number): string {
    return `preset${index}Service`;
}