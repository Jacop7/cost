/**
 * Icon — kit.jsx 의 라인 아이콘 세트를 react-native-svg 로 이식.
 * 동일 viewBox(24)·stroke 스타일 유지. fill 변형(box/clipboard/receipt/user)은 탭 활성 시 사용.
 */
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { T } from '@/theme/tokens';

export type IconName =
  | 'back' | 'chevron' | 'chevronDown' | 'plus' | 'minus' | 'search' | 'close'
  | 'edit' | 'check' | 'sort' | 'bell' | 'warn' | 'up' | 'down' | 'box'
  | 'clipboard' | 'receipt' | 'user' | 'truck' | 'link' | 'camera' | 'calendar'
  | 'cart' | 'trend' | 'won' | 'history' | 'tag' | 'swap' | 'grid' | 'ruler'
  | 'store' | 'info' | 'arrowRight' | 'download' | 'note' | 'grip';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  sw?: number;
  fill?: boolean;
}

export function Icon({ name, size = 24, color = T.ink, sw = 1.9, fill = false }: Props) {
  // 공통 line 스타일
  const p = { fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  const content = (() => {
    switch (name) {
      case 'back': return <Path d="M15 5l-7 7 7 7" {...p} />;
      case 'chevron': return <Path d="M9 6l6 6-6 6" {...p} />;
      case 'chevronDown': return <Path d="M6 9l6 6 6-6" {...p} />;
      case 'plus': return <Path d="M12 5v14M5 12h14" {...p} />;
      case 'minus': return <Path d="M5 12h14" {...p} />;
      case 'search': return <G {...p}><Circle cx={11} cy={11} r={7} /><Path d="M20 20l-3.2-3.2" /></G>;
      case 'close': return <Path d="M6 6l12 12M18 6L6 18" {...p} />;
      case 'edit': return fill
        ? <Path fill={color} d="M15.9 3.9L5.9 13.9 4.5 19.5l5.6-1.4 10-9.9A3 3 0 0 0 15.9 3.9z" />
        : <Path {...p} d="M15.9 3.9L5.9 13.9 4.5 19.5l5.6-1.4 10-9.9A3 3 0 0 0 15.9 3.9z" />;
      case 'check': return <Path d="M5 12.5l5 5 9-11" {...p} />;
      case 'sort': return <G {...p}><Path d="M7 4v16M7 20l-3-3M7 4l3 3" /><Path d="M17 20V4M17 4l3 3M17 20l-3-3" opacity={0.5} /></G>;
      case 'bell': return <G {...p}><Path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z" /><Path d="M10 20a2 2 0 004 0" /></G>;
      case 'warn': return <G {...p}><Path d="M12 4l9 16H3l9-16z" /><Path d="M12 10v4" /><Circle cx={12} cy={17} r={0.5} fill={color} stroke="none" /></G>;
      case 'up': return <Path d="M12 19V5M12 5l-6 6M12 5l6 6" {...p} />;
      case 'down': return <Path d="M12 5v14M12 19l6-6M12 19l-6-6" {...p} />;
      case 'box': return fill
        ? <G><Path d="M12 2.5l8.5 4.6v9.8L12 21.5 3.5 16.9V7.1L12 2.5z" fill={color} /><Path d="M3.7 7L12 11.6 20.3 7M12 11.6V21" stroke="#fff" strokeWidth={1.4} fill="none" strokeLinejoin="round" /></G>
        : <G {...p}><Path d="M12 2.8l8 4.4v9.6l-8 4.4-8-4.4V7.2l8-4.4z" /><Path d="M4 7.2l8 4.4 8-4.4M12 11.6V21" /></G>;
      case 'clipboard': return fill
        ? <G><Rect x={4.5} y={4} width={15} height={18} rx={3} fill={color} /><Rect x={8.5} y={2.5} width={7} height={3.5} rx={1.75} fill={color} stroke="#fff" strokeWidth={1.2} /><Path d="M8.2 12l2.4 2.4 4.8-5" stroke="#fff" strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" /></G>
        : <G {...p}><Rect x={5} y={4.5} width={14} height={17} rx={3} /><Rect x={9} y={3} width={6} height={3} rx={1.5} /><Path d="M8.5 12l2.2 2.2 4.4-4.6" /></G>;
      case 'receipt': return fill
        ? <G><Path d="M5.5 3h13v18l-2.2-1.4-2.1 1.4-2.2-1.4-2.1 1.4L5.5 21V3z" fill={color} /><Path d="M9 8h6M9 12h6M9 16h3.5" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" /></G>
        : <G {...p}><Path d="M6 3h12v18l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3L6 21V3z" /><Path d="M9.5 8h5M9.5 12h5M9.5 16h3" /></G>;
      case 'user': return fill
        ? <G><Circle cx={12} cy={8.5} r={4} fill={color} /><Path d="M4.5 20c0-4.2 3.4-6.5 7.5-6.5s7.5 2.3 7.5 6.5" fill={color} /></G>
        : <G {...p}><Circle cx={12} cy={8} r={4} /><Path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6" /></G>;
      case 'truck': return <G {...p}><Rect x={2.5} y={6.5} width={11} height={9} rx={1.5} /><Path d="M13.5 9.5H18l3 3v3h-7.5" /><Circle cx={7} cy={17.5} r={1.8} /><Circle cx={17} cy={17.5} r={1.8} /></G>;
      case 'link': return <G {...p}><Path d="M9 14.5l6-5M10 6.5l1.5-1.5a3.5 3.5 0 015 5L16 11.5M14 17.5L12.5 19a3.5 3.5 0 01-5-5L9 12.5" /></G>;
      case 'camera': return <G {...p}><Rect x={3} y={7} width={18} height={13} rx={3} /><Circle cx={12} cy={13.5} r={3.5} /><Path d="M8 7l1.5-2.5h5L16 7" /></G>;
      case 'calendar': return <G {...p}><Rect x={4} y={5.5} width={16} height={15} rx={3} /><Path d="M4 10h16M8 3.5v3.5M16 3.5v3.5" /></G>;
      case 'cart': return <G {...p}><Path d="M3 4h2.2l2 11.5h10l2-8.5H6.5" /><Circle cx={9} cy={19} r={1.4} /><Circle cx={17} cy={19} r={1.4} /></G>;
      case 'trend': return <G {...p}><Path d="M3 16l5-5 4 3 6-7" /><Path d="M18 4h3v3" /></G>;
      case 'won': return <G {...p}><Path d="M4 7l2.5 10L9.5 8 12.5 17 15 7M4.5 11h11" /></G>;
      case 'history': return <G {...p}><Path d="M4 12a8 8 0 108-8 8 8 0 00-6.5 3.3M4 4v3.3h3.3" /><Path d="M12 8v4.5l3 1.8" /></G>;
      case 'tag': return <G {...p}><Path d="M4 4h7l9 9-7 7-9-9V4z" /><Circle cx={8} cy={8} r={1.3} fill={color} stroke="none" /></G>;
      case 'swap': return <G {...p}><Path d="M7 4L4 7l3 3M4 7h13M17 20l3-3-3-3M20 17H7" /></G>;
      case 'grid': return <G {...p}><Rect x={4} y={4} width={7} height={7} rx={1.5} /><Rect x={13} y={4} width={7} height={7} rx={1.5} /><Rect x={4} y={13} width={7} height={7} rx={1.5} /><Rect x={13} y={13} width={7} height={7} rx={1.5} /></G>;
      case 'ruler': return <G {...p}><Rect x={3} y={8} width={18} height={8} rx={1.5} /><Path d="M7 8v3M11 8v4M15 8v3M19 8v4" /></G>;
      case 'store': return <G {...p}><Path d="M4 10v9h16v-9M3 5h18l-1 5H4L3 5z" /><Path d="M9 19v-5h6v5" /></G>;
      case 'info': return <G {...p}><Circle cx={12} cy={12} r={8.5} /><Path d="M12 11v5" /><Circle cx={12} cy={8} r={0.6} fill={color} stroke="none" /></G>;
      case 'arrowRight': return <Path d="M5 12h14M13 6l6 6-6 6" {...p} />;
      case 'download': return <G {...p}><Path d="M12 4v11M12 15l-4-4M12 15l4-4M5 19h14" /></G>;
      case 'note': return <G {...p}><Path d="M5 4.5h14v10l-4.5 4.5H5v-14z" /><Path d="M19 14.5h-4.5v4.5" /><Path d="M8.5 9h7M8.5 12.5h4" /></G>;
      case 'grip': return <G fill={color} stroke="none"><Circle cx={9} cy={6} r={1.5} /><Circle cx={9} cy={12} r={1.5} /><Circle cx={9} cy={18} r={1.5} /><Circle cx={15} cy={6} r={1.5} /><Circle cx={15} cy={12} r={1.5} /><Circle cx={15} cy={18} r={1.5} /></G>;
      default: return null;
    }
  })();

  return <Svg width={size} height={size} viewBox="0 0 24 24">{content}</Svg>;
}
