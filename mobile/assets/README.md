# Assets

Placeholder directory. Before your first build, add:

- `icon.png` — 1024×1024 app icon
- `splash.png` — splash image (≈1284×2778 or a centered 200px logo)
- `adaptive-icon.png` — Android adaptive icon foreground (432×432 safe area)
- `favicon.png` — 48×48 web favicon

Generate a starter set with:

```bash
npx @expo/image-utils   # or design in Figma / use `npx expo-asset`
```

Paths are referenced in `app.json` under `expo.icon`, `expo.splash`, and
`expo.android.adaptiveIcon`.
