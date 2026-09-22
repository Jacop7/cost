import { Platform, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

export function AppleSignInButton({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  if (Platform.OS !== 'ios') return null;
  return (
    <View pointerEvents={disabled ? 'none' : 'auto'} style={{ opacity: disabled ? 0.5 : 1 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={10}
        style={{ width: '100%', height: 48 }}
        onPress={onPress}
        accessibilityLabel="Apple로 계속하기"
      />
    </View>
  );
}
