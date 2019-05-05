import {AccessoryConfig, GlobalConfig} from './accessory-config';

export interface PlatformConfig {
    readonly name: string;
    readonly discoverAllAccessories?: boolean;
    readonly accessories?: AccessoryConfig[];
    readonly global?: GlobalConfig;
}