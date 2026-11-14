require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'RaisReactNative'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'Raïs'
  s.homepage       = package['homepage']
  s.platforms      = { :ios => '15.0' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/rais-app/rais-react-native.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'Rais', '~> 1.0'   # the Raïs iOS SDK: the screen, the keyboard and the rules live there

  s.source_files = '**/*.{h,m,swift}'
end
