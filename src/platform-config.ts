import {AccessoryConfig} from './accessory-config';

export interface PlatformConfig {
    readonly name: string;
    readonly discoverAllAccessories?: boolean;
    readonly accessories?: AccessoryConfig[];
}