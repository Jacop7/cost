// react-native-web의 인라인 시스템 font-family보다 앱 폰트 계약을 우선합니다.
import { Asset } from 'expo-asset';
import PretendardRegular from '../../assets/fonts/Pretendard-Regular.otf';
import PretendardMedium from '../../assets/fonts/Pretendard-Medium.otf';
import PretendardSemiBold from '../../assets/fonts/Pretendard-SemiBold.otf';
import PretendardBold from '../../assets/fonts/Pretendard-Bold.otf';
import PretendardExtraBold from '../../assets/fonts/Pretendard-ExtraBold.otf';
import './fonts.web.css';

const WEB_FACES = [
  [400, PretendardRegular],
  [500, PretendardMedium],
  [600, PretendardSemiBold],
  [700, PretendardBold],
  [800, PretendardExtraBold],
] as const;

type WritableFontFaceSet = FontFaceSet & { add(face: FontFace): FontFaceSet };
type FontRegistryWindow = Window & { __pretendardAppWeights?: Set<number> };

if (typeof document !== 'undefined' && typeof FontFace !== 'undefined') {
  const registryWindow = window as FontRegistryWindow;
  const registered = registryWindow.__pretendardAppWeights ?? new Set<number>();
  registryWindow.__pretendardAppWeights = registered;

  for (const [weight, module] of WEB_FACES) {
    if (registered.has(weight)) continue;

    const uri = Asset.fromModule(module).uri;
    const face = new FontFace('PretendardApp', `url("${uri}")`, { weight: String(weight) });
    (document.fonts as WritableFontFaceSet).add(face);
    registered.add(weight);
    void face.load();
  }
}

export {};
