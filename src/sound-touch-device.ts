import {AccessoryConfig, PresetConfig, ProductConfig} from './accessory-config';
import {API, APIDiscovery, compactMap, Info, SourceStatus} from 'soundtouch-api';
import {apiNotFoundWithName} from './errors';

export interface SoundTouchPreset {
    readonly name: string;
    readonly index: number;
}

export interface SoundTouchProduct {
    readonly name: string;
    readonly account: string;
    readonly enabled: boolean;
}

export interface SoundTouchDevice {
    readonly api: API;
    readonly name: string;
    readonly id: string;
    readonly model: string;
    readonly version?: string;
    readonly maxVolume: number;
    readonly unmuteVolume: number;
    readonly presets: SoundTouchPreset[];
    readonly products: SoundTouchProduct[];
}

export async function searchAllDevices(configAccessories: AccessoryConfig[]): Promise<SoundTouchDevice[]> {
    const apis = await APIDiscovery.search();
    return Promise.all(apis.map(async (api) => {
        const info = await api.getInfo();
        const config: AccessoryConfig = configAccessories.find((c) => c.room === info.name || c.ip === api.host);
        return _deviceFromApi(api, info, config || {});
    }));
}

export async function deviceFromConfig(config: AccessoryConfig): Promise<SoundTouchDevice> {
    let api: API;
    if(config.ip) {
        api = new API(config.ip, config.port);
    } else if(config.room) {
        api = await APIDiscovery.find(config.room);
        if(!api) {
            throw apiNotFoundWithName(config.name);
        }
    }
    return _deviceFromApi(api, await api.getInfo(), config);
}

async function _availablePresets(api: API, configPresets: PresetConfig[]): Promise<SoundTouchPreset[]> {
    const presets = await api.getPresets();
    return compactMap(presets, (preset) => {
        const presetConfig: PresetConfig = configPresets.find((p) => p.index === preset.id) || {index: preset.id};
        if (presetConfig.enabled === false) {
            return undefined;
        }
        return {
            name: presetConfig.name || preset.contentItem.itemName,
            index: preset.id
        };
    });
}

async function _deviceFromApi(api: API, info: Info, config: AccessoryConfig): Promise<SoundTouchDevice> {
    const displayName = config.name || info.name;
    const component = info.components.find((c) => c.serialNumber.toLowerCase() === info.deviceId.toLowerCase());
    const presets = await _availablePresets(api, config.presets || []);
    const products = await _availableProducts(api, displayName, config.products || []);
    return {
        api: api,
        name: displayName,
        id: info.deviceId,
        model: info.type,
        version: component ? component.softwareVersion : undefined,
        maxVolume: config.maxVolume || 100,
        unmuteVolume: config.unmuteVolume || 35,
        presets: presets,
        products: products
    };
}

async function _availableProducts(api: API, deviceName: string, configProducts: ProductConfig[]): Promise<SoundTouchProduct[]> {
    const sources = await api.getSources();
    const productSouces = sources.items.filter((src) => src.status === SourceStatus.ready && src.source === 'PRODUCT');
    return productSouces.map((ps) => {
        const productConfig: ProductConfig = configProducts.find((p) => p.account === ps.sourceAccount) || {account: ps.sourceAccount};
        return {
            name: productConfig.name || `${deviceName} ${ps.name}`,
            account: productConfig.account,
            enabled: productConfig.enabled !== false
        };
    });
}