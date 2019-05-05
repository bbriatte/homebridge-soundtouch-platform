import {PlatformConfig} from './platform-config';
import {AccessoryConfig, GlobalConfig} from './accessory-config';
import {SoundTouchAccessory} from './sound-touch-accessory';
import {deviceFromConfig, searchAllDevices, SoundTouchDevice} from './sound-touch-device';
import {Logger} from './utils';

export enum HomebridgeInfo {
    plugin = 'homebridge-soundtouch-platform',
    name = 'SoundTouchPlatform'
}

export class SoundTouchPlatform {

    private readonly log: Logger;
    private readonly config: PlatformConfig;
    private readonly _accessories: any[]; // homebridge registry
    private accessories: SoundTouchAccessory[];

    constructor(log: Logger, config: PlatformConfig, homebridge: any) {
        this.log = log;
        this.config = config;
        this._accessories = [];
        homebridge.on('didFinishLaunching', async () => {
            if(config) {
                this.log('Searching accessories...');
                this.accessories = await this._searchAccessories(homebridge);
                this.log('Finish searching accessories');
            } else {
                this.log.error(`No config provided for the ${HomebridgeInfo.name}`);
            }
        });
    }

    private async _searchAccessories(homebridge: any): Promise<SoundTouchAccessory[]> {
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
            const sta = new SoundTouchAccessory(this.log, device, cachedAccessory, homebridge);
            homebridge.updatePlatformAccessories([cachedAccessory]);
            return sta;
        }
        const accessory = new homebridge.platformAccessory(device.name, uuid);
        const sta = new SoundTouchAccessory(this.log, device, accessory, homebridge);
        this.configureAccessory(accessory);
        homebridge.registerPlatformAccessories(HomebridgeInfo.plugin, HomebridgeInfo.name, [accessory]);
        return sta;
    }

    configureAccessory(accessory: any) {
        accessory.reachable = true;
        this._accessories.push(accessory);
    }
}