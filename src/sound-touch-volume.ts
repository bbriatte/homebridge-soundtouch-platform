import {KeyValue, SourceStatus} from 'soundtouch-api';
import {deviceIsOn, DeviceOnOffListener, SoundTouchDevice} from './sound-touch-device';
import {callbackify, HomebridgeAccessoryWrapper} from 'homebridge-base-platform';
import {Characteristic, Service} from 'homebridge';

export abstract class SoundTouchVolume {

    protected readonly device: SoundTouchDevice;
    protected readonly accessoryWrapper: HomebridgeAccessoryWrapper<SoundTouchDevice> & DeviceOnOffListener;
    protected readonly service: Service;

    public constructor(device: SoundTouchDevice, accessoryWrapper: HomebridgeAccessoryWrapper<SoundTouchDevice> & DeviceOnOffListener) {
        this.device = device;
        this.accessoryWrapper = accessoryWrapper;
        this.service = this.initService();
        if(this.device.volumeSettings.maxValue < 100) {
            this.getVolumeCharacteristic().props.maxValue = Math.min(this.device.volumeSettings.maxValue, 100);
        }
        this.getMuteCharacteristic()
            .on('get', callbackify(this.isNotMuted.bind(this)))
            .on('set', callbackify(this.unMuteDevice.bind(this)));
        this.getVolumeCharacteristic()
            .on('get', callbackify(this.getVolume.bind(this)))
            .on('set', callbackify(this.setVolume.bind(this)))
            .on('change', this.volumeChange.bind(this));
    }

    protected abstract initService(): Service;

    public abstract getVolumeCharacteristic(): Characteristic;

    public abstract getMuteCharacteristic(): Characteristic;

    public async isNotMuted(): Promise<boolean> {
        const nowPlaying = await this.device.api.getNowPlaying();
        const isOn = nowPlaying.source !== SourceStatus.standBy;
        if(isOn) {
            const volume = await this.device.api.getVolume();
            return !volume.isMuted;
        }
        return false;
    }

    public async unMuteDevice(unmute: boolean): Promise<boolean> {
        let isOn = await deviceIsOn(this.device);
        if(isOn) {
            const volume = await this.device.api.getVolume();
            if((unmute && volume.isMuted) || (!unmute && !volume.isMuted)) {
                if(this.device.verbose) {
                    this.accessoryWrapper.log(`[${this.accessoryWrapper.getDisplayName()}] ${unmute ? 'Unmuted' : 'Muted'}`);
                }
                return this.device.api.pressKey(KeyValue.mute);
            }
        } else if(unmute) {
            isOn = await this.device.api.pressKey(KeyValue.power);
            if(isOn) {
                return this.accessoryWrapper.deviceDidTurnOn(true);
            }
        }
        return false;
    }

    public async getVolume(): Promise<number> {
        const volume = await this.device.api.getVolume();
        if(this.device.verbose) {
            this.accessoryWrapper.log(`[${this.accessoryWrapper.getDisplayName()}] Current volume ${volume.actual}`);
        }
        return volume.actual;
    }

    public async setVolume(volume: number, updateCharacteristic?: boolean): Promise<boolean> {
        const volumeCharacteristic = this.getVolumeCharacteristic();
        const secureVolume = this.secureVolume(volumeCharacteristic, {
            newValue: volume,
            oldValue: volumeCharacteristic.value as number
        });
        if(secureVolume !== undefined) {
            volume = secureVolume;
        }
        if(this.device.verbose) {
            this.accessoryWrapper.log(`[${this.accessoryWrapper.getDisplayName()}] Volume change to ${volume}`);
        }
        if(updateCharacteristic === true) {
            volumeCharacteristic.updateValue(volume);
        }
        return this.device.api.setVolume(volume);
    }

    private secureVolume(characteristic: Characteristic, change: {newValue: number, oldValue: number}): number | undefined {
        const maxValue = characteristic.props.maxValue;
        if(change.newValue === maxValue && change.oldValue <= maxValue / 2) {
            return Math.max(change.oldValue, this.device.volumeSettings.unmuteValue);
        }
        return undefined;
    }


    protected volumeChange(change: {newValue: number, oldValue: number}) {
        const volumeCharacteristic = this.getVolumeCharacteristic();
        const newValue = this.secureVolume(volumeCharacteristic, change);
        if(newValue !== undefined) {
            setTimeout(() => volumeCharacteristic.updateValue(newValue), 1000);
        }
    }
}
