import {AccessoryConfig, GlobalConfig, PresetConfig, SourceConfig, VolumeMode} from './accessory-config';
import {API, APIDiscovery, compactMap, Info, SourceStatus} from 'soundtouch-api';
import {apiNotFoundWithName} from './errors';
import {stringUpperCaseFirst} from './utils';

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

export interface SoundTouchVolumeSettings {
    readonly onValue: number;
    readonly maxValue: number;
    readonly unmuteValue: number;
    readonly mode: VolumeMode;
}

export interface SoundTouchDevice {
    readonly api: API;
    readonly name: string;
    readonly id: string;
    readonly model: string;
    readonly version?: string;
    readonly volumeSettings: SoundTouchVolumeSettings;
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
    const globalVolume = globalConfig.volume || {};
    const accessoryVolume = accessoryConfig.volume || {};
    const onValue =  globalVolume.onValue || accessoryVolume.onValue;
    return {
        api: api,
        name: displayName,
        id: info.deviceId,
        model: info.type,
        version: component ? component.softwareVersion : undefined,
        volumeSettings: {
            onValue: onValue || -1,
            maxValue: globalVolume.maxValue || accessoryVolume.maxValue || 100,
            unmuteValue: globalVolume.unmuteValue || accessoryVolume.unmuteValue || onValue || 35,
            mode: globalVolume.mode || accessoryVolume.mode || VolumeMode.lightbulb
        },
        presets: presets,
        sources: sources
    };
}

export interface DeviceOnOffListener {
    deviceDidTurnOff(updateOn?: boolean, updateVolume?: boolean): Promise<boolean>;
    deviceDidTurnOn(updateOn?: boolean, updateVolume?: boolean): Promise<boolean>;
}

export async function deviceIsOn(device: SoundTouchDevice): Promise<boolean> {
    const nowPlaying = await device.api.getNowPlaying();
    return nowPlaying.source !== SourceStatus.standBy;
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