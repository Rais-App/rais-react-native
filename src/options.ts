import type { RaisAppearance, RaisCheckoutOptions, RaisColors, RaisFonts } from "./types";

/** What the native modules receive: flat, strings and numbers only. */
export interface NativeOptions {
  checkoutUrl: string;
  colorScheme: "automatic" | "light" | "dark";
  colorsLight: Record<string, string>;
  colorsDark: Record<string, string>;
  cornerRadius: number | null;
  fontFamily: "default" | "system" | "serif" | "monospace";
  fonts: Record<string, string>;
  style: "native" | "web";
  merchantLogoUrl: string | null;
  language: "automatic" | "en" | "fr" | "ar";
  presentationStyle: "fullScreen" | "sheet";
  showsCloseButton: boolean;
  returnUrlScheme: string | null;
  additionalTrustedHosts: string[];
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_KEYS = ["primary", "onPrimary", "background", "surface", "text", "textSecondary", "border", "danger", "success"] as const;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T, name: string): T {
  if (value === undefined) return fallback;
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  throw new TypeError(`Raïs: ${name} must be one of ${allowed.join(", ")} (got ${JSON.stringify(value)})`);
}

/** Checks the colors of one palette (typos are caught here, in development, not on a payer's screen) and drops what is not set. */
function colorsOf(colors: RaisColors | undefined, name: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!colors) return out;
  for (const key of Object.keys(colors)) {
    if (!(COLOR_KEYS as readonly string[]).includes(key)) throw new TypeError(`Raïs: unknown color "${key}" in ${name}`);
  }
  for (const key of COLOR_KEYS) {
    const value = colors[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || !HEX.test(value)) {
      throw new TypeError(`Raïs: ${name}.${key} must be a hex color such as "#5b5bd6" (got ${JSON.stringify(value)})`);
    }
    out[key] = value.toLowerCase();
  }
  return out;
}

const FONT_WEIGHTS = ["regular", "medium", "semibold", "bold"] as const;

function fontsOf(fonts: RaisFonts | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fonts) return out;
  for (const key of Object.keys(fonts)) {
    if (!(FONT_WEIGHTS as readonly string[]).includes(key)) throw new TypeError(`Raïs: unknown weight "${key}" in appearance.fonts (use ${FONT_WEIGHTS.join(", ")})`);
  }
  for (const key of FONT_WEIGHTS) {
    const value = fonts[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.trim() === "") throw new TypeError(`Raïs: appearance.fonts.${key} must be a font name (got ${JSON.stringify(value)})`);
    out[key] = value;
  }
  return out;
}

function logoOf(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !/^https:\/\/[^\s/]+\/\S*$/i.test(value)) {
    throw new TypeError(`Raïs: merchantLogoUrl must be an https address (got ${JSON.stringify(value)})`);
  }
  return value;
}

function isPaired(colors: RaisAppearance["colors"]): colors is { light?: RaisColors; dark?: RaisColors } {
  return !!colors && ("light" in colors || "dark" in colors);
}

/** Validates what the app asked for and turns it into what the native modules take. */
export function toNativeOptions(options: RaisCheckoutOptions): NativeOptions {
  if (!options || typeof options.checkoutUrl !== "string" || options.checkoutUrl.length === 0) {
    throw new TypeError("Raïs: checkoutUrl is required: the checkout_url of a payment your server created");
  }
  const appearance = options.appearance ?? {};
  let light: Record<string, string>;
  let dark: Record<string, string>;
  if (isPaired(appearance.colors)) {
    const given = {
      light: colorsOf(appearance.colors.light, "appearance.colors.light"),
      dark: colorsOf(appearance.colors.dark, "appearance.colors.dark"),
    };
    // a color given for one palette only is used for both
    light = { ...given.dark, ...given.light };
    dark = { ...given.light, ...given.dark };
  } else {
    light = colorsOf(appearance.colors as RaisColors | undefined, "appearance.colors");
    dark = { ...light };
  }
  const radius = appearance.cornerRadius;
  if (radius !== undefined && (typeof radius !== "number" || !Number.isFinite(radius))) {
    throw new TypeError(`Raïs: appearance.cornerRadius must be a number (got ${JSON.stringify(radius)})`);
  }
  return {
    checkoutUrl: options.checkoutUrl,
    colorScheme: pick(appearance.colorScheme, ["automatic", "light", "dark"], "automatic", "appearance.colorScheme"),
    colorsLight: light,
    colorsDark: dark,
    cornerRadius: radius === undefined ? null : Math.min(Math.max(radius, 0), 24),
    fontFamily: pick(appearance.fontFamily, ["default", "system", "serif", "monospace"], "default", "appearance.fontFamily"),
    fonts: fontsOf(appearance.fonts),
    style: pick(options.style, ["native", "web"], "native", "style"),
    merchantLogoUrl: logoOf(options.merchantLogoUrl),
    language: pick(options.language, ["automatic", "en", "fr", "ar"], "automatic", "language"),
    presentationStyle: pick(options.presentationStyle, ["fullScreen", "sheet"], "fullScreen", "presentationStyle"),
    showsCloseButton: options.showsCloseButton ?? true,
    returnUrlScheme: options.returnUrlScheme ?? null,
    additionalTrustedHosts: options.additionalTrustedHosts ?? [],
  };
}
