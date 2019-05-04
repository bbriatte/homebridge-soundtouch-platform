export interface AccessoryConfig {
    readonly name?: string;
    readonly room?: string;
    readonly ip?: string;
    readonly port?: number;
    readonly maxVolume?: number;
    readonly unmuteVolume?: number;
    readonly presets?: PresetConfig[];
    readonly products?: ProductConfig[];
}

export interface PresetConfig {
    readonly name?: string;
    readonly index: number;
    readonly enabled?: boolean;
}

export interface ProductConfig {
    readonly name?: string;
    readonly account: string; // TV, HDMI_1, ...
    readonly enabled?: boolean;
}