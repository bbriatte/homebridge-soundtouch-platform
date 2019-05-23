import {SoundTouchVolume} from './sound-touch-volume';
import {HomebridgeAccessory} from 'homebridge-base-platform';
import {SoundTouchDevice} from './sound-touch-device';

export class SoundTouchLightbulbVolume extends SoundTouchVolume {
    protected initService(): any {
        const hap = this.accessory.homebridge.hap;
        const volumeService = this.accessory.getService(hap.Service.Lightbulb, this.accessory.getDisplayName() + ' Volume', 'volumeService');
        let brightnessCharacteristic = volumeService.getCharacteristic(hap.Characteristic.Brightness);
        if(brightnessCharacteristic === undefined) {
            volumeService.addCharacteristic(new hap.Characteristic.Brightness());
        }
        return volumeService;
    }

    public static clearServices(accessory: HomebridgeAccessory<SoundTouchDevice>) {
        const hap = accessory.homebridge.hap;
        accessory.removeService(hap.Service.Lightbulb, 'volumeService');
    }

    public getVolumeCharacteristic(): any {
        const Characteristic = this.accessory.homebridge.hap.Characteristic;
        return this.service.getCharacteristic(Characteristic.Brightness);
    }

    public getMuteCharacteristic(): any {
        const Characteristic = this.accessory.homebridge.hap.Characteristic;
        return this.service.getCharacteristic(Characteristic.On);
    }
}