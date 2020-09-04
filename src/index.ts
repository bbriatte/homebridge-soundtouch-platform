import {SoundTouchPlatform, SoundTouchPlatformInfo} from './sound-touch-platform';
import {API} from "homebridge";

export default function(homebridge: API) {
    homebridge.registerPlatform(SoundTouchPlatformInfo.plugin, SoundTouchPlatformInfo.name, SoundTouchPlatform);
}
