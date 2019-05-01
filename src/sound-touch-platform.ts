import {PlatformConfig} from './platform-config';
import {AccessoryConfig} from './accessory-config';
import {SoundTouchAccessory} from './sound-touch-accessory';
import {deviceFromConfig, searchAllDevices, SoundTouchDevice} from './sound-touch-device';

export enum HomebridgeInfo {
    plugin = 'homebridge-soundtouch-platform',
    name = 'SoundTouchPlatform'
}

export class SoundTouchPlatform {

    private readonly log: Function;
    private readonly config: PlatformConfig;
    private readonly _accessories: any[]; // homebridge registry
    private accessories: SoundTouchAccessory[];

    constructor(log: Function, config: PlatformConfig, homebridge: any) {
        this.log = log;
        this.config = config;
        this._accessories = [];
        homebridge.on('didFinishLaunching', async () => {
            if(config) {
                this.accessories = await this.searchAccessories(homebridge);
            }
        });
    }

    private async searchAccessories(homebridge: any): Promise<SoundTouchAccessory[]> {
        const configAccessories = this.config.accessories || [];
        if(this.config.discoverAllAccessories === true) {
            const devices = await searchAllDevices(configAccessories);
            return devices.map((device) => this.accessoryFromDevice(device, homebridge));
        }
        return Promise.all(configAccessories.map((ac) => this.findAccessory(ac, homebridge)));
    }

    private async findAccessory(config: AccessoryConfig, homebridge: any): Promise<SoundTouchAccessory> {
        const device = await deviceFromConfig(config);
        return this.accessoryFromDevice(device, homebridge);
    }

    private accessoryFromDevice(device: SoundTouchDevice, homebridge: any): SoundTouchAccessory {
        const uuid = homebridge.hap.uuid.generate(device.id);
        const cachedAccessory = this._accessories.find((item) => item.UUID === uuid);
        if(cachedAccessory) {
            cachedAccessory.displayName = device.name;
            const sta = new SoundTouchAccessory(device, cachedAccessory, homebridge);
            homebridge.updatePlatformAccessories([cachedAccessory]);
            return sta;
        }
        const accessory = new homebridge.platformAccessory(device.name, uuid);
        const sta = new SoundTouchAccessory(device, accessory, homebridge);
        this.configureAccessory(accessory);
        homebridge.registerPlatformAccessories(HomebridgeInfo.plugin, HomebridgeInfo.name, [accessory]);
        return sta;
    }

    configureAccessory(accessory: any) {
        accessory.reachable = true;
        this._accessories.push(accessory);
    }
}