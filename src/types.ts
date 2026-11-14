/**
 * The public types of the Raïs React Native SDK.
 *
 * Colors are hex strings: `#rgb`, `#rrggbb` or `#rrggbbaa`.
 */

/** The colors of the checkout page. Anything you leave out keeps Raïs' own value, which already has a light and a dark palette. */
export interface RaisColors {
  /** The pay button and the accents of the page. */
  primary?: string;
  /** The text and icons on top of `primary`. When left out, black or white is chosen for the best contrast. */
  onPrimary?: string;
  /** The page background. */
  background?: string;
  /** Cards and panels on top of the background. */
  surface?: string;
  /** The main text. */
  text?: string;
  /** Labels, hints and secondary text. */
  textSecondary?: string;
  /** The border of the input fields. */
  border?: string;
  /** Errors and the failure state. */
  danger?: string;
  /** The success state. */
  success?: string;
}

/** The look of the checkout page, in the spirit of Stripe's `appearance`. Everything is optional. */
export interface RaisAppearance {
  /** Which palette the page uses: follow the device live (`automatic`, the default), or fix it. */
  colorScheme?: "automatic" | "light" | "dark";
  /**
   * The colors. Give them once for both palettes, or separately:
   * `{ light: { primary: "#5b5bd6" }, dark: { primary: "#8b8bff" } }`.
   * A color given for one palette only is used for both.
   */
  colors?: RaisColors | { light?: RaisColors; dark?: RaisColors };
  /** The corner radius of buttons and input fields (0 to 24). Cards and dialogs follow it proportionally. */
  cornerRadius?: number;
  /** The typeface. Only fonts that exist on every device can be named. `default` is Raïs' own (Inter, and 29LT Bukra for Arabic). */
  fontFamily?: "default" | "system" | "serif" | "monospace";
  /**
   * Your app's own typeface for the native checkout: the names of fonts your app has registered (with `expo-font`, or bundled in the
   * native projects), one per weight. Any weight left out falls back to the nearest one given. Overrides `fontFamily`.
   *
   * ```ts
   * appearance: { fonts: { regular: "Inter-Regular", medium: "Inter-Medium", semibold: "Inter-SemiBold", bold: "Inter-Bold" } }
   * ```
   */
  fonts?: RaisFonts;
}

/** Font names, one per weight (see `RaisAppearance.fonts`). */
export interface RaisFonts {
  regular?: string;
  medium?: string;
  semibold?: string;
  bold?: string;
}

export interface RaisCheckoutOptions {
  /** The `checkout_url` of a payment your **server** created with `POST /payments`. */
  checkoutUrl: string;
  /** Colors, corner radius, font and light/dark mode. */
  appearance?: RaisAppearance;
  /** The language of the page. `automatic` (the default) lets Raïs choose; the payer can still switch on the page. */
  language?: "automatic" | "en" | "fr" | "ar";
  /**
   * `native` (the default): the checkout is drawn by the SDK itself, from the payment's details, in your app's look. `web`: the hosted
   * payment page in a web view. The native checkout falls back to the web page by itself for anything it cannot draw.
   */
  style?: "native" | "web";
  /**
   * The address (https) of your logo, shown at the head of the native checkout instead of the logo saved with your store. Optional:
   * without it the store's own logo is shown, or its initial.
   */
  merchantLogoUrl?: string;
  /** iOS only: `fullScreen` (the default) or a `sheet`. */
  presentationStyle?: "fullScreen" | "sheet";
  /**
   * Shows the SDK's close button over the top corner of the page (default `true`). Leave it on unless you provide your own way out:
   * a payer must always be able to leave the checkout.
   */
  showsCloseButton?: boolean;
  /**
   * The URL scheme of your app (for example `"myapp"`), when the payment's `success_url` / `cancel_url` are deep links into your app.
   * The SDK then finishes with the result carried by that link. Optional: without it the result still arrives from the page itself.
   */
  returnUrlScheme?: string;
  /** Hosts, besides `rais.app` and its subdomains, that may be loaded as the checkout (a staging environment). */
  additionalTrustedHosts?: string[];
}

/** The payment the payer paid. */
export interface RaisPayment {
  /** The Raïs payment id (the `id` of the payment your server created). */
  id: string;
  /** The `reference` you gave the payment, when you gave one. */
  reference?: string;
  /** The Raïs order number, as printed on the receipt. */
  orderNumber?: string;
}

export type RaisErrorCode =
  /** The URL is not a Raïs checkout address (not https, or not a trusted host). */
  | "invalidUrl"
  /** The page could not be loaded (no network, server unreachable, bad certificate). */
  | "loadFailed"
  /** The bank declined the payment, or it ended in an error. */
  | "declined"
  /** The payment expired before it was paid. */
  | "expired"
  /** The checkout could not be presented (no screen to present from, or one is already open). */
  | "cannotPresent"
  /** Android: this device's WebView is too old to show the checkout safely. */
  | "unsupportedWebView"
  /** The native module is not part of this build (Expo Go, or the app was not rebuilt after installing the SDK). */
  | "notLinked";

export interface RaisError {
  code: RaisErrorCode;
  message: string;
  /** The payment id when the failure came from a payment that exists. */
  paymentId?: string;
}

/**
 * How the checkout ended.
 *
 * `completed` is what the page showed, not proof of payment: **confirm the payment on your server** (signed webhook, or
 * `GET /payments/{id}`) before you ship anything.
 */
export type RaisCheckoutResult =
  | { status: "completed"; payment: RaisPayment }
  | { status: "cancelled" }
  | { status: "failed"; error: RaisError };
