# Raïs for React Native and Expo

The Raïs payment page, inside your React Native or Expo app: a native screen that shows the hosted checkout, takes the payer through card entry and 3-D Secure, and resolves with a typed result. Light and dark mode, an appearance you can customize, and a keyboard that never makes the page jump.

It is a thin Expo Module over the native [iOS](https://rais.app/sdk/ios) and [Android](https://rais.app/sdk/android) SDKs, so the keyboard handling and the security rules are the same ones, tested natively.

- React Native 0.73+ and Expo SDK 50+, iOS 15+, Android 7.0+ (API 24)
- No Raïs key in your app
- Documentation: <https://rais.app/sdk/react-native> · API reference: <https://rais.app/docs/api> · Changelog: [CHANGELOG.md](CHANGELOG.md)

## How it works

Your **server** creates the payment (`POST /payments` with your secret key) and returns its `checkout_url` to the app. The app never holds a Raïs key. The app shows the checkout, and your **server** confirms the payment (signed webhook, or `GET /payments/{id}`) before anything is shipped: the result in the app is what the payer saw, not proof of payment.

## Install

```sh
npx expo install @rais-app/react-native
```

or `npm install @rais-app/react-native` in a bare app that has [Expo modules installed](https://docs.expo.dev/bare/installing-expo-modules/). The SDK has native code: **it does not run in Expo Go**. Make a development build (`npx expo run:ios`, `npx expo run:android`, or EAS Build) after installing it. Without the native module `presentRaisCheckout` resolves with `{ status: "failed", error: { code: "notLinked" } }` instead of crashing.

## Show the checkout

```tsx
import { presentRaisCheckout } from "@rais-app/react-native";

async function pay() {
  const { checkoutUrl } = await myServer.startPayment(cartId);   // your server created the payment
  const result = await presentRaisCheckout({ checkoutUrl });

  switch (result.status) {
    case "completed":   // paid: result.payment.id, .reference, .orderNumber. Now ask YOUR server for the order's real status
      break;
    case "cancelled":   // the payer closed the checkout
      break;
    case "failed":      // result.error.code: invalidUrl, loadFailed, declined, expired, cannotPresent, unsupportedWebView, notLinked
      break;
  }
}
```

| `result.status` | When | What to do |
|---|---|---|
| `"completed"` | the payer paid and saw the receipt. `result.payment.id` is the payment's id, `.reference` the `reference` you gave it (absent when you gave none), `.orderNumber` is on the receipt | ask **your server** for the order's real status |
| `"cancelled"` | the payer closed the checkout (or went back to your app) without paying | nothing was charged; offer to try again |
| `"failed"` | `result.error` is `{ code, message, paymentId? }` with a `code` from the table below | show `error.message` |

| `error.code` | Meaning |
|---|---|
| `declined` | the payer saw the bank's refusal (or an error) and left; `paymentId` names the payment. Your server knows the final state |
| `expired` | the payment expired before it was paid: create a new payment |
| `loadFailed` | the checkout page could not be loaded and the payer closed the screen |
| `invalidUrl` | `checkoutUrl` is not an `https` address on `rais.app` (or a trusted host) |
| `cannotPresent` | there was no screen to present from, or a checkout is already open |
| `unsupportedWebView` | Android: the device's WebView is older than version 86 |
| `notLinked` | the native module is not part of this build (Expo Go, or the app was not rebuilt after installing the SDK) |

It never rejects for a payment outcome. With a hook, for a Pay button that must not be pressed twice:

```tsx
const { present, isPresenting } = useRaisCheckout();
<Button title="Pay" disabled={isPresenting} onPress={async () => { const result = await present({ checkoutUrl }); /* … */ }} />
```

## Customize it

Everything is optional. What you leave out keeps Raïs' value, which already has a light and a dark palette.

```tsx
await presentRaisCheckout({
  checkoutUrl,
  language: "fr",                                  // "automatic" (default), "en", "fr", "ar"
  appearance: {
    colorScheme: "automatic",                      // "light", "dark", or follow the device (default)
    colors: {
      light: { primary: "#5b5bd6" },               // or one set for both: colors: { primary: "#5b5bd6" }
      dark: { primary: "#8b8bff" },
    },
    cornerRadius: 12,                              // buttons and fields (0–24)
    fontFamily: "system",                          // "default" (Inter), "system", "serif", "monospace"
    fonts: { regular: "Inter-Regular", bold: "Inter-Bold" },   // or your app's own fonts (see below)
  },
  style: "native",                                 // "native" (default) or "web" (the hosted page in a web view)
  merchantLogoUrl: "https://shop.example/logo.png",// your logo at the head of the checkout (https)
  presentationStyle: "sheet",                      // iOS only: "fullScreen" (default) or "sheet"
});
```

**The checkout is native.** By default the SDK draws the checkout itself, from the payment's details: your colors and fonts, the keyboard handled natively, saved cards and the Raïs balance when the payer has them, the bank's code screen and the receipt. It falls back to the hosted page by itself for anything it cannot draw. `style: "web"` always shows the hosted page.

**Your app's fonts.** `appearance.fonts` takes the names of fonts your app has registered (with `expo-font`, or bundled in the native projects), one per weight (`regular`, `medium`, `semibold`, `bold`); a weight left out uses the nearest one given. It applies to the native checkout and overrides `fontFamily`.

| `colors` | What it colors |
|---|---|
| `primary` | the pay button, the accents and the focus ring of the fields |
| `onPrimary` | text on `primary` (when left out, black or white for the best contrast) |
| `background`, `surface` | the page, and cards on it |
| `text`, `textSecondary` | main text, and labels and hints |
| `border` | the border of the fields |
| `danger`, `success` | errors, and the success state |

Colors are hex strings (`#rgb`, `#rrggbb`, `#rrggbbaa`). A color given for one palette only is used for both. Options that are wrong in code throw a `TypeError` (a color that is not hex, an unknown language), so you see it in development.

| Option | Default | |
|---|---|---|
| `style` | `"native"` | `"web"` shows the hosted page in a web view instead |
| `merchantLogoUrl` | none | an https address; without it the logo saved with your store, or its initial |
| `language` | `"automatic"` | the payer can still switch on the page |
| `showsCloseButton` | `true` | the system back button always works on Android; keep it unless you draw your own |
| `returnUrlScheme` | none | your app's URL scheme, when the payment's `success_url` / `cancel_url` are deep links |
| `additionalTrustedHosts` | `[]` | extra hosts allowed as a checkout (staging); `rais.app` and loopback are always allowed |

## Security

See the [iOS](https://github.com/rais-app/rais-ios#security) and [Android](https://github.com/rais-app/rais-android#security) SDKs: the checkout address must be `https://…rais.app` (or a trusted host), the page can talk to the app only from the checkout's own origin, links that lead elsewhere open in the system browser, and the SDK never receives card data.

## License

MIT. See [LICENSE](LICENSE).
