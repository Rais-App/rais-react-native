# Changelog

All notable changes to the Raïs React Native SDK. The SDK follows [semantic versioning](https://semver.org) and always requires the iOS and Android SDKs of the same major version (`Rais` pod, `app.rais:rais-android`). The checkout page itself is hosted by Raïs and improves without an SDK release.

## 1.0.0 (2026-11-14)

First release.

- The checkout is native by default (the iOS and Android SDKs draw it from the payment's details); `style: "web"` shows the hosted page in a web view.
- `merchantLogoUrl`: your logo (https) at the head of the native checkout.
- `appearance.fonts`: your app's own fonts, by weight, for the native checkout.

- `presentRaisCheckout(options)` and the `useRaisCheckout()` hook: show the hosted checkout in a native screen and resolve with `completed`, `cancelled` or `failed`. A payment outcome is a result, never a rejection.
- Light and dark mode, following the device live or fixed with `appearance.colorScheme`.
- `appearance`: colors (one set, or separate `light` / `dark` sets), corner radius, font family. Options: language, iOS presentation style, close button, return URL scheme, additional trusted hosts. Options that are wrong in code (a color that is not hex, an unknown language) throw a `TypeError` in development.
- An Expo Module over the native iOS and Android SDKs: works in Expo development builds and in bare React Native with Expo modules installed; the keyboard handling and the security rules are the native SDKs'.
