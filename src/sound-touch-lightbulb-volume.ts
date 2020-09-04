import {SoundTouchVolume} from './sound-touch-volume';
import {HomebridgeAccessoryWrapper} from 'homebridge-base-platform';
import {Service, Characteristic} from 'homebridge';
import {SoundTouchDevice} from './sound-touch-device';

export class SoundTouchLightbulbVolume extends SoundTouchVolume {
    protected initService(): Service {
        const Service = this.accessoryWrapper.Service;
        const Characteristic = this.accessoryWrapper.Characteristic;
        const volumeService = this.accessoryWrapper.getService(Service.Lightbulb, this.accessoryWrapper.getDisplayName() + ' Volume', 'volumeService');
        let brightnessCharacteristic = volumeService.getCharacteristic(Characteristic.Brightness);
        if(brightnessCharacteristic === undefined) {
            volumeService.addCharacteristic(new Characteristic.Brightness());
        }
        return volumeService;
    }

    public static clearServices(accessoryWrapper: HomebridgeAccessoryWrapper<SoundTouchDevice>) {
        accessoryWrapper.removeService(accessoryWrapper.Service.Lightbulb, 'volumeService');
    }

    public getVolumeCharacteristic(): Characteristic {
        const Characteristic = this.accessoryWrapper.Characteristic;
        return this.service.getCharacteristic(Characteristic.Brightness);
    }

    public getMuteCharacteristic(): Characteristic {
        const Characteristic = this.accessoryWrapper.Characteristic;
        return this.service.getCharacteristic(Characteristic.On);
    }
}
