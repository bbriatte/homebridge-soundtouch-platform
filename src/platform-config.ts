import {AccessoryConfig, GlobalConfig} from './accessory-config';

export interface SountTouchPlatformConfig {
    readonly discoverAllAccessories?: boolean;
    readonly accessories?: AccessoryConfig[];
    readonly global?: GlobalConfig;
}