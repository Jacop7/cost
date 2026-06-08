/**
 * Expo public 환경변수 타입. 런타임 값은 expo 번들러가 process.env.EXPO_PUBLIC_* 로 주입.
 * (@types/node 를 끌어오지 않기 위해 process 를 최소 선언)
 */
declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  };
};
