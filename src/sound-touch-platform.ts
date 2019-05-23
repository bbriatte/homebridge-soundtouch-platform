import {AccessoryConfig, GlobalConfig} from './accessory-config';
import {SoundTouchAccessory} from './sound-touch-accessory';
import {deviceFromConfig, searchAllDevices, SoundTouchDevice} from './sound-touch-device';
import {HomebridgePlatform} from 'homebridge-base-platform';
import {SountTouchPlatformConfig} from './platform-config';

export enum HomebridgeInfo {
    plugin = 'homebridge-soundtouch-platform',
    name = 'SoundTouchPlatform'
}

export class SoundTouchPlatform extends HomebridgePlatform<SountTouchPlatformConfig, SoundTouchDevice, SoundTouchAccessory> {

    protected getPluginName(): string {
        return HomebridgeInfo.plugin;
    }

    protected async searchAccessories(homebridge: any): Promise<SoundTouchAccessory[]> {
        const accessoryConfigs = this.config.accessories || [];
        const globaConfig = this.config.global || {};
        if(this.config.discoverAllAccessories === true) {
            const devices = await searchAllDevices(globaConfig, accessoryConfigs);
            return devices.map((device) => this._accessoryFromDevice(device, homebridge));
        }
        const accessories = await Promise.all(accessoryConfigs.map((ac) => this._findAccessory(globaConfig, ac, homebridge)));
        return accessories.filter((acc) => acc !== undefined);
    }

    private async _findAccessory(globaConfig: GlobalConfig, accessoryConfig: AccessoryConfig, homebridge: any): Promise<SoundTouchAccessory | undefined> {
        try {
            const device = await deviceFromConfig(globaConfig, accessoryConfig);
            return this._accessoryFromDevice(device, homebridge);
        } catch(err) {
            this.log.error(err);
            return undefined;
        }
    }

    private _accessoryFromDevice(device: SoundTouchDevice, homebridge: any): SoundTouchAccessory {
        const uuid = homebridge.hap.uuid.generate(device.id);
        const cachedAccessory = this._accessories.find((item) => item.UUID === uuid);
        if(cachedAccessory) {
            cachedAccessory.displayName = device.name;
            const sta = new SoundTouchAccessory(this.log, cachedAccessory, homebridge, device);
            homebridge.updatePlatformAccessories([cachedAccessory]);
            return sta;
        }
        const accessory = new homebridge.platformAccessory(device.name, uuid);
        const sta = new SoundTouchAccessory(this.log, accessory, homebridge, device);
        this.configureAccessory(accessory);
        homebridge.registerPlatformAccessories(HomebridgeInfo.plugin, HomebridgeInfo.name, [accessory]);
        return sta;
    }

    public configureAccessory(accessory: any) {
        accessory.reachable = true;
        this._accessories.push(accessory);
    }
}