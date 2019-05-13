import {SoundTouchVolume} from './sound-touch-volume';
import {HomebridgeAccessory} from './utils';

export class SoundTouchSpeakerVolume extends SoundTouchVolume {
    protected initService(): any {
        const hap = this.accessory.homebridge.hap;
        const volumeService = this.accessory.getService(hap.Service.Speaker, this.accessory.getDisplayName() + ' Volume', 'volumeService');
        let volumeCharacteristic = volumeService.getCharacteristic(hap.Characteristic.Volume);
        if(volumeCharacteristic === undefined) {
            volumeService.addCharacteristic(new hap.Characteristic.Volume());
        }
        return volumeService;
    }

    public static clearServices(accessory: HomebridgeAccessory) {
        const hap = accessory.homebridge.hap;
        accessory.removeService(hap.Service.Speaker, 'volumeService');
    }

    public getVolumeCharacteristic(): any {
        const Characteristic = this.accessory.homebridge.hap.Characteristic;
        return this.service.getCharacteristic(Characteristic.Volume);
    }

    public getMuteCharacteristic(): any {
        const Characteristic = this.accessory.homebridge.hap.Characteristic;
        return this.service.getCharacteristic(Characteristic.Mute);
    }
}