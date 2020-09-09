import {AccessoryConfig, GlobalConfig} from './accessory-config';
import {SoundTouchAccessoryWrapper} from './sound-touch-accessory-wrapper';
import {deviceFromConfig, searchAllDevices, SoundTouchDevice} from './sound-touch-device';
import {
    HomebridgeAccessoryWrapperConstructor,
    HomebridgePlatform,
    PlatformSettings
} from 'homebridge-base-platform';
import {SountTouchPlatformConfig} from './platform-config';
import {API, Logging} from "homebridge";

export enum SoundTouchPlatformInfo {
    plugin = 'homebridge-soundtouch-platform',
    name = 'SoundTouchPlatform'
}

export class SoundTouchPlatform extends HomebridgePlatform<SountTouchPlatformConfig, SoundTouchDevice, SoundTouchAccessoryWrapper> {

    public constructor(logger: Logging, config: SountTouchPlatformConfig, api: API) {
        super(logger, config, api);
    }

    protected getDefaultPlatformConfig(): SountTouchPlatformConfig | undefined{
        return {
            platform: SoundTouchPlatformInfo.name,
            discoverAllAccessories: true
        };
    }

    protected initPlatformSettings(): PlatformSettings {
        return {
            name: SoundTouchPlatformInfo.name,
            plugin: SoundTouchPlatformInfo.plugin
        }
    }

    protected getAccessoryWrapperConstructorForDevice(device: SoundTouchDevice): HomebridgeAccessoryWrapperConstructor<SoundTouchAccessoryWrapper, SoundTouchDevice> {
        return SoundTouchAccessoryWrapper
    }

    protected async searchDevices(): Promise<SoundTouchDevice[]> {
        const accessoryConfigs: AccessoryConfig[] = this.config.accessories || [];
        const globalConfig: GlobalConfig = this.config.global || {};
        if(this.config.discoverAllAccessories === true) {
            return searchAllDevices(globalConfig, accessoryConfigs, this.log);
        }
        return Promise.all(accessoryConfigs.map((ac) => deviceFromConfig(globalConfig, ac, this.log)));
    }
}
