import {AccessoryConfig, GlobalConfig} from './accessory-config';
import {BasePlatformConfig} from "homebridge-base-platform";

export interface SountTouchPlatformConfig extends BasePlatformConfig {
    readonly discoverAllAccessories?: boolean;
    readonly accessories?: AccessoryConfig[];
    readonly global?: GlobalConfig;
}
