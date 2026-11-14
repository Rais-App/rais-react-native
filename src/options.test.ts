import assert from "node:assert/strict";
import { test } from "node:test";
import { toNativeOptions } from "./options";

const checkoutUrl = "https://pay.rais.app/pay/95855e6f-fcbd-44cb-ac78-5e2c36cf8b0f";

test("defaults are complete", () => {
  const options = toNativeOptions({ checkoutUrl });
  assert.equal(options.colorScheme, "automatic");
  assert.equal(options.language, "automatic");
  assert.equal(options.presentationStyle, "fullScreen");
  assert.equal(options.showsCloseButton, true);
  assert.equal(options.cornerRadius, null);
  assert.deepEqual(options.colorsLight, {});
  assert.deepEqual(options.additionalTrustedHosts, []);
  assert.equal(options.style, "native");
  assert.equal(options.merchantLogoUrl, null);
  assert.deepEqual(options.fonts, {});
});

test("a flat set of colors applies to both palettes, lower-cased", () => {
  const options = toNativeOptions({ checkoutUrl, appearance: { colors: { primary: "#5B5BD6" } } });
  assert.deepEqual(options.colorsLight, { primary: "#5b5bd6" });
  assert.deepEqual(options.colorsDark, { primary: "#5b5bd6" });
});

test("separate light and dark colors stay separate, and a color given once is used for both", () => {
  const options = toNativeOptions({
    checkoutUrl,
    appearance: { colors: { light: { primary: "#111111", text: "#222222" }, dark: { primary: "#eeeeee" } } },
  });
  assert.deepEqual(options.colorsLight, { primary: "#111111", text: "#222222" });
  assert.deepEqual(options.colorsDark, { primary: "#eeeeee", text: "#222222" });
});

test("colors that are not hex are refused where the developer can see it", () => {
  for (const bad of ["red", "rgb(1,2,3)", "#12", "#ggg", "url(x)", "", 5, null]) {
    assert.throws(() => toNativeOptions({ checkoutUrl, appearance: { colors: { primary: bad as never } } }), TypeError, String(bad));
  }
  assert.throws(() => toNativeOptions({ checkoutUrl, appearance: { colors: { primery: "#fff" } as never } }), /unknown color/);
});

test("the corner radius is clamped and must be a number", () => {
  assert.equal(toNativeOptions({ checkoutUrl, appearance: { cornerRadius: 99 } }).cornerRadius, 24);
  assert.equal(toNativeOptions({ checkoutUrl, appearance: { cornerRadius: -3 } }).cornerRadius, 0);
  assert.throws(() => toNativeOptions({ checkoutUrl, appearance: { cornerRadius: "12" as never } }), TypeError);
});

test("an unknown language, scheme, font or style is refused", () => {
  assert.throws(() => toNativeOptions({ checkoutUrl, language: "de" as never }), /language/);
  assert.throws(() => toNativeOptions({ checkoutUrl, appearance: { colorScheme: "sepia" as never } }), /colorScheme/);
  assert.throws(() => toNativeOptions({ checkoutUrl, appearance: { fontFamily: "Comic Sans" as never } }), /fontFamily/);
  assert.throws(() => toNativeOptions({ checkoutUrl, presentationStyle: "popover" as never }), /presentationStyle/);
});

test("a checkout URL is required", () => {
  assert.throws(() => toNativeOptions({ checkoutUrl: "" }), /checkoutUrl is required/);
  assert.throws(() => toNativeOptions(undefined as never), /checkoutUrl is required/);
});

test("the web style, a logo and the app's fonts pass through; anything else is refused", () => {
  const options = toNativeOptions({
    checkoutUrl,
    style: "web",
    merchantLogoUrl: "https://shop.example/logo.png",
    appearance: { fonts: { regular: "Inter-Regular", bold: "Inter-Bold" } },
  });
  assert.equal(options.style, "web");
  assert.equal(options.merchantLogoUrl, "https://shop.example/logo.png");
  assert.deepEqual(options.fonts, { regular: "Inter-Regular", bold: "Inter-Bold" });
  assert.throws(() => toNativeOptions({ checkoutUrl, style: "hybrid" as never }), /style/);
  assert.throws(() => toNativeOptions({ checkoutUrl, merchantLogoUrl: "http://shop.example/logo.png" }), /https/);
  assert.throws(() => toNativeOptions({ checkoutUrl, appearance: { fonts: { heavy: "X" } as never } }), /weight/);
  assert.throws(() => toNativeOptions({ checkoutUrl, appearance: { fonts: { regular: " " } } }), /font name/);
});
