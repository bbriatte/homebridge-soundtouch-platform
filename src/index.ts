import {SoundTouchPlatform, SoundTouchPlatformInfo} from './sound-touch-platform';

export default function(homebridge: any) {
    homebridge.registerPlatform(SoundTouchPlatformInfo.plugin, SoundTouchPlatformInfo.name, SoundTouchPlatform, true);
}