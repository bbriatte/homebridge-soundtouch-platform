export interface GlobalConfig {
    readonly maxVolume?: number;
    readonly unmuteVolume?: number;
    readonly presets?: PresetConfig[];
    readonly sources?: SourceConfig[];
}

export interface AccessoryConfig extends GlobalConfig {
    readonly name?: string;
    readonly room?: string;
    readonly ip?: string;
    readonly port?: number;
}

export interface PresetConfig {
    readonly name?: string;
    readonly index: number;
    readonly enabled?: boolean;
}

export interface SourceConfig {
    readonly name?: string;
    readonly source: string; // PRODUCT, BLUETOOTH, ...
    readonly account?: string; // TV, HDMI_1, ...
    readonly enabled?: boolean;
}