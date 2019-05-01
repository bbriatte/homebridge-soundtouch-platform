import {HomebridgeInfo, SoundTouchPlatform} from './sound-touch-platform';

export default function(homebridge: any) {
    homebridge.registerPlatform(HomebridgeInfo.plugin, HomebridgeInfo.name, SoundTouchPlatform, true);
}