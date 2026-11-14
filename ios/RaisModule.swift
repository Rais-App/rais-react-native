import ExpoModulesCore
import Rais
import UIKit

/// What JavaScript sends (see src/options.ts): flat, already validated.
struct CheckoutOptions: Record {
    @Field var checkoutUrl: String = ""
    @Field var colorScheme: String = "automatic"
    @Field var colorsLight: [String: String] = [:]
    @Field var colorsDark: [String: String] = [:]
    @Field var cornerRadius: Double?
    @Field var fontFamily: String = "default"
    @Field var fonts: [String: String] = [:]
    @Field var style: String = "native"
    @Field var merchantLogoUrl: String?
    @Field var language: String = "automatic"
    @Field var presentationStyle: String = "fullScreen"
    @Field var showsCloseButton: Bool = true
    @Field var returnUrlScheme: String?
    @Field var additionalTrustedHosts: [String] = []
}

public class RaisModule: Module {
    public func definition() -> ModuleDefinition {
        Name("Rais")

        AsyncFunction("presentCheckout") { (options: CheckoutOptions, promise: Promise) in
            DispatchQueue.main.async {
                guard let url = URL(string: options.checkoutUrl) else {
                    promise.resolve(Self.failure("invalidUrl", "This is not a valid Raïs checkout address.", nil))
                    return
                }
                guard let presenter = self.appContext?.utilities?.currentViewController() else {
                    promise.resolve(Self.failure("cannotPresent", "There is no screen to present the checkout from.", nil))
                    return
                }
                Task { @MainActor in
                    var configuration = Self.configuration(from: options)
                    // the merchant's logo is fetched before the checkout opens (a second at most: without it the store's own logo is shown)
                    if let address = options.merchantLogoUrl, let logoURL = URL(string: address) {
                        configuration.merchantLogo = await Self.image(at: logoURL)
                    }
                    RaisCheckout(checkoutURL: url, configuration: configuration)
                        .present(from: presenter) { result in promise.resolve(Self.encode(result)) }
                }
            }
        }
    }

    // MARK: JavaScript → SDK

    private static func configuration(from options: CheckoutOptions) -> RaisCheckout.Configuration {
        var configuration = RaisCheckout.Configuration()
        switch options.colorScheme {
        case "light": configuration.appearance.colorScheme = .light
        case "dark": configuration.appearance.colorScheme = .dark
        default: configuration.appearance.colorScheme = .automatic
        }
        // One dynamic color per role: the SDK reads it for the palette on screen, and again when the device switches.
        func color(_ key: String) -> UIColor? {
            let light = options.colorsLight[key].flatMap(UIColor.init(raisHex:))
            let dark = options.colorsDark[key].flatMap(UIColor.init(raisHex:))
            guard light != nil || dark != nil else { return nil }
            return UIColor { $0.userInterfaceStyle == .dark ? (dark ?? light ?? .clear) : (light ?? dark ?? .clear) }
        }
        configuration.appearance.colors.primary = color("primary")
        configuration.appearance.colors.onPrimary = color("onPrimary")
        configuration.appearance.colors.background = color("background")
        configuration.appearance.colors.surface = color("surface")
        configuration.appearance.colors.text = color("text")
        configuration.appearance.colors.textSecondary = color("textSecondary")
        configuration.appearance.colors.border = color("border")
        configuration.appearance.colors.danger = color("danger")
        configuration.appearance.colors.success = color("success")
        configuration.appearance.cornerRadius = options.cornerRadius.map { CGFloat($0) }
        configuration.appearance.fontFamily = RaisCheckout.Appearance.FontFamily(rawValue: options.fontFamily) ?? .default
        if !options.fonts.isEmpty {
            let names = options.fonts
            configuration.appearance.fontProvider = { size, weight in
                // the name for this weight, else the nearest one given
                let w = weight.rawValue
                let order: [String]
                if w < UIFont.Weight.medium.rawValue { order = ["regular", "medium", "semibold", "bold"] }
                else if w < UIFont.Weight.semibold.rawValue { order = ["medium", "regular", "semibold", "bold"] }
                else if w < UIFont.Weight.bold.rawValue { order = ["semibold", "bold", "medium", "regular"] }
                else { order = ["bold", "semibold", "medium", "regular"] }
                return order.lazy.compactMap { names[$0] }.compactMap { UIFont(name: $0, size: size) }.first
            }
        }
        configuration.style = options.style == "web" ? .web : .native
        configuration.language = RaisCheckout.Language(rawValue: options.language) ?? .automatic
        configuration.presentationStyle = options.presentationStyle == "sheet" ? .sheet : .fullScreen
        configuration.showsCloseButton = options.showsCloseButton
        configuration.returnURLScheme = options.returnUrlScheme
        configuration.additionalTrustedHosts = options.additionalTrustedHosts
        return configuration
    }

    // MARK: SDK → JavaScript

    private static func image(at url: URL) async -> UIImage? {
        guard url.scheme?.lowercased() == "https" else { return nil }
        var request = URLRequest(url: url)
        request.timeoutInterval = 1.5
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200, data.count < 2_000_000 else { return nil }
        return UIImage(data: data)
    }

    private static func failure(_ code: String, _ message: String, _ paymentId: String?) -> [String: Any] {
        var error: [String: Any] = ["code": code, "message": message]
        if let paymentId { error["paymentId"] = paymentId }
        return ["status": "failed", "error": error]
    }

    private static func encode(_ result: RaisCheckout.Result) -> [String: Any] {
        switch result {
        case .completed(let payment):
            var body: [String: Any] = ["id": payment.id]
            if let reference = payment.reference { body["reference"] = reference }
            if let orderNumber = payment.orderNumber { body["orderNumber"] = orderNumber }
            return ["status": "completed", "payment": body]
        case .cancelled:
            return ["status": "cancelled"]
        case .failed(let failure):
            // the iOS SDK spells it invalidURL; the JavaScript API (and Android) say invalidUrl
            return Self.failure(failure.code == .invalidURL ? "invalidUrl" : failure.code.rawValue, failure.message, failure.paymentID)
        }
    }
}

private extension UIColor {
    /// `#rgb`, `#rrggbb` or `#rrggbbaa`.
    convenience init?(raisHex: String) {
        var digits = raisHex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        if digits.count == 3 { digits = digits.map { "\($0)\($0)" }.joined() }
        guard digits.count == 6 || digits.count == 8, let value = UInt64(digits, radix: 16) else { return nil }
        let hasAlpha = digits.count == 8
        let r = CGFloat((value >> (hasAlpha ? 24 : 16)) & 0xff) / 255
        let g = CGFloat((value >> (hasAlpha ? 16 : 8)) & 0xff) / 255
        let b = CGFloat((value >> (hasAlpha ? 8 : 0)) & 0xff) / 255
        let a = hasAlpha ? CGFloat(value & 0xff) / 255 : 1
        self.init(red: r, green: g, blue: b, alpha: a)
    }
}
