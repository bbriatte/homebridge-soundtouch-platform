import {AccessoryConfig, GlobalConfig, PresetConfig, SourceConfig} from './accessory-config';
import {API, APIDiscovery, compactMap, Info} from 'soundtouch-api';
import {apiNotFoundWithName} from './errors';
import {stringUpperCaseFirst} from './utils/string-uc-first';

export interface SoundTouchPreset {
    readonly name: string;
    readonly index: number;
}

export interface SoundTouchSource {
    readonly name: string;
    readonly source: string;
    readonly account?: string;
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
    readonly sources: SoundTouchSource[];
}

export async function searchAllDevices(globalConfig: GlobalConfig, accessoryConfigs: AccessoryConfig[]): Promise<SoundTouchDevice[]> {
    const apis = await APIDiscovery.search();
    return Promise.all(apis.map(async (api) => {
        const info = await api.getInfo();
        const accessoryConfig = accessoryConfigs.find((ac) => ac.room === info.name || ac.ip === api.host);
        return _deviceFromApi(api, info, globalConfig, accessoryConfig || {});
    }));
}

export async function deviceFromConfig(globalConfig: GlobalConfig, accessoryConfig: AccessoryConfig): Promise<SoundTouchDevice> {
    let api: API;
    if(accessoryConfig.ip) {
        api = new API(accessoryConfig.ip, accessoryConfig.port);
    } else if(accessoryConfig.room) {
        api = await APIDiscovery.find(accessoryConfig.room);
        if(!api) {
            throw apiNotFoundWithName(accessoryConfig.name);
        }
    }
    return _deviceFromApi(api, await api.getInfo(), globalConfig, accessoryConfig);
}

async function _deviceFromApi(api: API, info: Info, globalConfig: GlobalConfig, accessoryConfig: AccessoryConfig): Promise<SoundTouchDevice> {
    const displayName = accessoryConfig.name || info.name;
    const component = info.components.find((c) => c.serialNumber.toLowerCase() === info.deviceId.toLowerCase());
    const presets = await _availablePresets(api, accessoryConfig.presets, globalConfig.presets);
    const sources = await _availableSources(api, displayName, accessoryConfig.sources, globalConfig.sources);
    return {
        api: api,
        name: displayName,
        id: info.deviceId,
        model: info.type,
        version: component ? component.softwareVersion : undefined,
        maxVolume: accessoryConfig.maxVolume || globalConfig.maxVolume || 100,
        unmuteVolume: accessoryConfig.unmuteVolume || globalConfig.unmuteVolume || 35,
        presets: presets,
        sources: sources
    };
}

async function _availablePresets(api: API, accessoryPresets: PresetConfig[], globalPresets: PresetConfig[]): Promise<SoundTouchPreset[]> {
    const presets = await api.getPresets();
    return compactMap(presets, (preset) => {
        const presetConfig = _findConfig((p) => p.index === preset.id, accessoryPresets, globalPresets) || {index: preset.id};
        if (presetConfig.enabled === false) {
            return undefined;
        }
        return {
            name: presetConfig.name || preset.contentItem.itemName,
            index: preset.id
        };
    });
}

async function _availableSources(api: API, deviceName: string, accessorySources?: SourceConfig[], globalSources?: SourceConfig[]): Promise<SoundTouchSource[]> {
    const sources = await api.getSources();
    const localSources = sources.items.filter((src) => src.isLocal);
    return localSources.map((ls) => {
        const sourceConfig = _findConfig((p) => p.source === ls.source && (p.account !== undefined ? p.account === ls.sourceAccount : true), accessorySources, globalSources) || {source: ls.source};
        return {
            name: sourceConfig.name || `${deviceName} ${ls.name ? ls.name : stringUpperCaseFirst(sourceConfig.source)}`,
            source: sourceConfig.source,
            account: ls.sourceAccount,
            enabled: sourceConfig.enabled !== false
        };
    });
}

function _findConfig<Config>(predicate: (config: Config) => boolean, accessoryConfigs?: Config[], globalConfigs?: Config[]): Config | undefined {
    const config = accessoryConfigs ? accessoryConfigs.find(predicate) : undefined;
    if(config !== undefined) {
        return config;
    }
    return globalConfigs ? globalConfigs.find(predicate) : undefined;
}