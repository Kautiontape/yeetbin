// The public instance that Publish uploads to. Keep in sync with host_permissions in
// public/manifest.json, which lets extension pages POST there without CORS.
export const PUBLIC_URL = 'https://yeet.kautiontape.com';

// Must match the CLI's native host manifest name (yeetbin-app, `yeet --install-native-host`).
export const NATIVE_HOST = 'com.kautiontape.yeetbin';

export const CONTENT_TYPES = ['markdown', 'code', 'mermaid', 'text'] as const;
