export interface AccessoryConfig {
    readonly name?: string;
    readonly room?: string;
    readonly ip?: string;
    readonly port?: number;
    readonly maxVolume?: number;
    readonly unmuteVolume?: number;
    readonly presets?: PresetConfig[];
}

export interface PresetConfig {
    readonly name?: string;
    readonly index: number;
    readonly enabled?: boolean;
}