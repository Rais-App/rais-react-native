import { requireOptionalNativeModule } from "expo-modules-core";
import { useCallback, useRef, useState } from "react";
import { toNativeOptions } from "./options";
import type { RaisCheckoutOptions, RaisCheckoutResult } from "./types";

export * from "./types";

interface RaisNativeModule {
  presentCheckout(options: ReturnType<typeof toNativeOptions>): Promise<RaisCheckoutResult>;
}

/** Absent in Expo Go and in a build made before the SDK was installed: reported as a result, never a crash. */
const native = requireOptionalNativeModule<RaisNativeModule>("Rais");

/**
 * Shows the Raïs checkout and resolves when the payer is done.
 *
 * Your **server** creates the payment (`POST /payments` with your secret key) and gives the app its `checkout_url`. The app never holds a
 * Raïs key.
 *
 * ```ts
 * const result = await presentRaisCheckout({ checkoutUrl });
 * if (result.status === "completed") {
 *   // paid: now ask YOUR server for the order's real status
 * }
 * ```
 *
 * It never rejects for a payment outcome: a decline, a cancel and a failure to load are all results. It throws a `TypeError` only for
 * options that are wrong in code (a color that is not hex, an unknown language), so those are caught in development.
 */
export async function presentRaisCheckout(options: RaisCheckoutOptions): Promise<RaisCheckoutResult> {
  const nativeOptions = toNativeOptions(options);
  if (!native) {
    return {
      status: "failed",
      error: {
        code: "notLinked",
        message:
          "The Raïs native module is not part of this build. It does not run in Expo Go: make a development build (npx expo run:ios / run:android, or EAS Build) after installing @rais/react-native.",
      },
    };
  }
  return native.presentCheckout(nativeOptions);
}

/** The same as `presentRaisCheckout`, with `isPresenting` for your Pay button (and one checkout at a time). */
export function useRaisCheckout(): { present: (options: RaisCheckoutOptions) => Promise<RaisCheckoutResult>; isPresenting: boolean } {
  const [isPresenting, setPresenting] = useState(false);
  const busy = useRef(false);
  const present = useCallback(async (options: RaisCheckoutOptions): Promise<RaisCheckoutResult> => {
    if (busy.current) {
      return { status: "failed", error: { code: "cannotPresent", message: "A checkout is already open." } };
    }
    busy.current = true;
    setPresenting(true);
    try {
      return await presentRaisCheckout(options);
    } finally {
      busy.current = false;
      setPresenting(false);
    }
  }, []);
  return { present, isPresenting };
}
