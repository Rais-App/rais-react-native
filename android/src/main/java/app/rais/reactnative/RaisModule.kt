package app.rais.reactnative

import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import com.facebook.react.common.assets.ReactFontManager
import app.rais.checkout.RaisCheckout
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** What JavaScript sends (see src/options.ts): flat, already validated. */
class CheckoutOptions : Record {
    @Field var checkoutUrl: String = ""
    @Field var colorScheme: String = "automatic"
    @Field var colorsLight: Map<String, String> = emptyMap()
    @Field var colorsDark: Map<String, String> = emptyMap()
    @Field var cornerRadius: Double? = null
    @Field var fontFamily: String = "default"
    @Field var fonts: Map<String, String> = emptyMap()
    @Field var style: String = "native"
    @Field var merchantLogoUrl: String? = null
    @Field var language: String = "automatic"
    @Field var showsCloseButton: Boolean = true
    @Field var returnUrlScheme: String? = null
    @Field var additionalTrustedHosts: List<String> = emptyList()
}

class RaisModule : Module() {
    /** The checkout is a screen of its own: its result arrives as an activity result, and there is one at a time. */
    private var pending: Promise? = null

    override fun definition() = ModuleDefinition {
        Name("Rais")

        AsyncFunction("presentCheckout") { options: CheckoutOptions, promise: Promise ->
            val activity = appContext.currentActivity
            when {
                activity == null -> promise.resolve(failure("cannotPresent", "There is no screen to present the checkout from.", null))
                pending != null -> promise.resolve(failure("cannotPresent", "A checkout is already open.", null))
                else -> {
                    pending = promise
                    activity.startActivityForResult(
                        RaisCheckout.createIntent(activity, options.checkoutUrl, configuration(options)),
                        REQUEST_CODE,
                    )
                }
            }
        }

        OnActivityResult { _, payload ->
            if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
            val promise = pending ?: return@OnActivityResult
            pending = null
            promise.resolve(encode(RaisCheckout.parseResult(payload.resultCode, payload.data)))
        }
    }

    // JavaScript → SDK

    private fun configuration(options: CheckoutOptions): RaisCheckout.Configuration {
        val assets = appContext.reactContext?.assets
        val names = options.fonts
        // the app's fonts by weight (registered with expo-font, or bundled): the name for this weight, else the nearest one given
        // the app's fonts by weight (registered with expo-font, or bundled): the name for this weight, else the nearest one given, drawn at
        // this weight. A name the app has not registered gives null, so the SDK's own typeface is used (React Native answers an unknown
        // name with the platform's default, which would lose every bold of the page).
        val fontProvider = if (names.isEmpty() || assets == null) null else RaisCheckout.FontProvider { weight ->
            val order = when {
                weight < 500 -> listOf("regular", "medium", "semibold", "bold")
                weight < 600 -> listOf("medium", "regular", "semibold", "bold")
                weight < 700 -> listOf("semibold", "bold", "medium", "regular")
                else -> listOf("bold", "semibold", "medium", "regular")
            }
            val exact = order.first()
            order.firstNotNullOfOrNull { key ->
                val name = names[key] ?: return@firstNotNullOfOrNull null
                val face = runCatching { ReactFontManager.getInstance().getTypeface(name, Typeface.NORMAL, assets) }.getOrNull()
                    ?.takeUnless { it == Typeface.DEFAULT || it == Typeface.SANS_SERIF }
                    ?: return@firstNotNullOfOrNull null
                if (key == exact || Build.VERSION.SDK_INT < 28) face else Typeface.create(face, weight, false)
            }
        }
        fun colors(map: Map<String, String>) = RaisCheckout.Colors(
            primary = hex(map["primary"]), onPrimary = hex(map["onPrimary"]), background = hex(map["background"]),
            surface = hex(map["surface"]), text = hex(map["text"]), textSecondary = hex(map["textSecondary"]),
            border = hex(map["border"]), danger = hex(map["danger"]), success = hex(map["success"]),
        )
        return RaisCheckout.Configuration(
            appearance = RaisCheckout.Appearance(
                colorScheme = when (options.colorScheme) {
                    "light" -> RaisCheckout.ColorScheme.Light
                    "dark" -> RaisCheckout.ColorScheme.Dark
                    else -> RaisCheckout.ColorScheme.Automatic
                },
                colorsLight = colors(options.colorsLight),
                colorsDark = colors(options.colorsDark),
                cornerRadiusDp = options.cornerRadius?.toFloat(),
                fontFamily = when (options.fontFamily) {
                    "system" -> RaisCheckout.FontFamily.System
                    "serif" -> RaisCheckout.FontFamily.Serif
                    "monospace" -> RaisCheckout.FontFamily.Monospace
                    else -> RaisCheckout.FontFamily.Default
                },
                fontProvider = fontProvider,
            ),
            style = if (options.style == "web") RaisCheckout.Style.Web else RaisCheckout.Style.Native,
            merchantLogoUrl = options.merchantLogoUrl,
            language = when (options.language) {
                "en" -> RaisCheckout.Language.English
                "fr" -> RaisCheckout.Language.French
                "ar" -> RaisCheckout.Language.Arabic
                else -> RaisCheckout.Language.Automatic
            },
            showsCloseButton = options.showsCloseButton,
            returnUrlScheme = options.returnUrlScheme,
            additionalTrustedHosts = options.additionalTrustedHosts,
        )
    }

    /** `#rgb`, `#rrggbb` or `#rrggbbaa` to a `Color` int (Android's own order is AARRGGBB, so `Color.parseColor` cannot read the last form). */
    private fun hex(value: String?): Int? {
        var digits = value?.removePrefix("#") ?: return null
        if (digits.length == 3) digits = digits.map { "$it$it" }.joinToString("")
        if (digits.length != 6 && digits.length != 8) return null
        val number = digits.toLongOrNull(16) ?: return null
        return if (digits.length == 6) {
            Color.rgb(((number shr 16) and 0xff).toInt(), ((number shr 8) and 0xff).toInt(), (number and 0xff).toInt())
        } else {
            Color.argb((number and 0xff).toInt(), ((number shr 24) and 0xff).toInt(), ((number shr 16) and 0xff).toInt(), ((number shr 8) and 0xff).toInt())
        }
    }

    // SDK → JavaScript

    private fun failure(code: String, message: String, paymentId: String?): Map<String, Any?> {
        val error = mutableMapOf<String, Any?>("code" to code, "message" to message)
        if (paymentId != null) error["paymentId"] = paymentId
        return mapOf("status" to "failed", "error" to error)
    }

    private fun encode(result: RaisCheckout.Result): Map<String, Any?> = when (result) {
        is RaisCheckout.Result.Completed -> {
            val payment = mutableMapOf<String, Any?>("id" to result.payment.id)
            result.payment.reference?.let { payment["reference"] = it }
            result.payment.orderNumber?.let { payment["orderNumber"] = it }
            mapOf("status" to "completed", "payment" to payment)
        }
        RaisCheckout.Result.Cancelled -> mapOf("status" to "cancelled")
        is RaisCheckout.Result.Failed -> failure(
            result.failure.code.name.replaceFirstChar { it.lowercase() }, result.failure.message, result.failure.paymentId,
        )
    }

    private companion object {
        const val REQUEST_CODE = 0x5241   // "RA"
    }
}
