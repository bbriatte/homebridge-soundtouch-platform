import {AccessoryConfig, GlobalConfig} from './accessory-config';
import {PlatformConfig} from "homebridge";

export interface SountTouchPlatformConfig extends PlatformConfig {
    readonly discoverAllAccessories?: boolean;
    readonly accessories?: AccessoryConfig[];
    readonly global?: GlobalConfig;
}
