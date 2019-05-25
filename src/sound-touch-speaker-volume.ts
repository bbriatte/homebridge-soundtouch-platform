import {SoundTouchVolume} from './sound-touch-volume';
import {HomebridgeAccessoryWrapper} from 'homebridge-base-platform';
import {SoundTouchDevice} from './sound-touch-device';

export class SoundTouchSpeakerVolume extends SoundTouchVolume {
    protected initService(): any {
        const Characteristic = this.accessoryWrapper.Characteristic;
        const Service = this.accessoryWrapper.Service;
        const volumeService = this.accessoryWrapper.getService(Service.Speaker, this.accessoryWrapper.getDisplayName() + ' Volume', 'volumeService');
        let volumeCharacteristic = volumeService.getCharacteristic(Characteristic.Volume);
        if(volumeCharacteristic === undefined) {
            volumeService.addCharacteristic(new Characteristic.Volume());
        }
        return volumeService;
    }

    public static clearServices(accessoryWrapper: HomebridgeAccessoryWrapper<SoundTouchDevice>) {
        accessoryWrapper.removeService(accessoryWrapper.Service.Speaker, 'volumeService');
    }

    public getVolumeCharacteristic(): any {
        const Characteristic = this.accessoryWrapper.Characteristic;
        return this.service.getCharacteristic(Characteristic.Volume);
    }

    public getMuteCharacteristic(): any {
        const Characteristic = this.accessoryWrapper.Characteristic;
        return this.service.getCharacteristic(Characteristic.Mute);
    }
}