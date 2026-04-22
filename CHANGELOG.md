# Changelog

## [2.1.0](https://github.com/grantcodes/micropub/compare/v2.0.1...v2.1.0) (2026-04-22)


### Features

* **cleanup:** make PKCE default for getAuthUrl and remove second auth URL method; add code verifier to options and use it automatically if it exists ([51b207e](https://github.com/grantcodes/micropub/commit/51b207e9bc809312ff2b8d07893326173aad98d8))
* **cleanup:** stop importing TextEncoder, since it is available in the global namespace ([0ec166e](https://github.com/grantcodes/micropub/commit/0ec166e03a7cc769339215fe00659bf502fcdcf1))
* **cleanup:** switch base64url-js with custom base64url code; add test for base64url code; update pkce generation ([c8d053b](https://github.com/grantcodes/micropub/commit/c8d053b1fb62924df8e87fdb8f4e08ffba34fe7d))
* **security:** Add PKCE specific method for getting auth url; add code verifier functionality to getToken; add tests ([ce13c13](https://github.com/grantcodes/micropub/commit/ce13c130ff8f111f301dbc478484090fc4b2683c))
* **security:** add PKCE support ([8a944f6](https://github.com/grantcodes/micropub/commit/8a944f66e49a2e914d94f0fd5e84db749053e19f))


### Bug Fixes

* **bug:** add `g` to first regex in order to replace all instances of `+` instead of just the first ([a02a1a6](https://github.com/grantcodes/micropub/commit/a02a1a6d9a92e258a1fcc26f8b823403e6e70a45))
* **bug:** update getAuthUrl() to properly update options object when using PKCE ([900f2fb](https://github.com/grantcodes/micropub/commit/900f2fb9c4f4648cd8f712334172c814b7ccd884))
* change test file loading ([550cacd](https://github.com/grantcodes/micropub/commit/550cacd2f0fbc8d9242402912cc1491f80e87b23))
* test files not found ([8c917ad](https://github.com/grantcodes/micropub/commit/8c917ad9c6f7d316c25e789e1de8292e8d2b103c))

## [2.0.1](https://github.com/grantcodes/micropub/compare/v2.0.0...v2.0.1) (2025-02-15)


### ⚠ BREAKING CHANGES

* Minimum node version updated. Option getter and setters.

### Features

* add improved validation to options ([039b6d8](https://github.com/grantcodes/micropub/commit/039b6d890115cdd0333e6b32adeba1810c2f006e))


### Bug Fixes

* fix exports ([40ceaed](https://github.com/grantcodes/micropub/commit/40ceaed6fb65bfe35d83d9d757c2bd79f2fc1cc9))
* ignore any in micropub types ([2d82d84](https://github.com/grantcodes/micropub/commit/2d82d843ec8ae23b9a957feb88dc205307ba41f1))
* **tests:** fix tests after refactor ([03950e9](https://github.com/grantcodes/micropub/commit/03950e9c6c5883a20bb595ab91913f929dacac98))


### Miscellaneous Chores

* release 2.0.1 ([645eac4](https://github.com/grantcodes/micropub/commit/645eac4e3692865af151ae255e0744abad88faf7))


### Code Refactoring

* update dependencies and refactor typescript ([f568c91](https://github.com/grantcodes/micropub/commit/f568c91a2154715dc4f30c9e8d7b3a3f97e84ef4))

## [2.0.0](https://github.com/grantcodes/micropub/compare/v2.0.0-beta01...v2.0.0) (2025-02-15)


### ⚠ BREAKING CHANGES

* Minimum node version updated. Option getter and setters.

### Features

* add improved validation to options ([039b6d8](https://github.com/grantcodes/micropub/commit/039b6d890115cdd0333e6b32adeba1810c2f006e))
* replace axios with native fetch and fix tests ([6492e34](https://github.com/grantcodes/micropub/commit/6492e34e61caf371f88532b77d768117f12ea056))


### Bug Fixes

* fix exports ([40ceaed](https://github.com/grantcodes/micropub/commit/40ceaed6fb65bfe35d83d9d757c2bd79f2fc1cc9))
* ignore any in micropub types ([2d82d84](https://github.com/grantcodes/micropub/commit/2d82d843ec8ae23b9a957feb88dc205307ba41f1))
* **tests:** fix tests after refactor ([03950e9](https://github.com/grantcodes/micropub/commit/03950e9c6c5883a20bb595ab91913f929dacac98))


### Miscellaneous Chores

* release 2.0.0 ([87f5523](https://github.com/grantcodes/micropub/commit/87f5523df58e2fa6e71034547307b209bd6f63b1))


### Code Refactoring

* update dependencies and refactor typescript ([f568c91](https://github.com/grantcodes/micropub/commit/f568c91a2154715dc4f30c9e8d7b3a3f97e84ef4))

## [2.0.0-beta01](https://github.com/grantcodes/micropub/compare/v2.0.0...v2.0.0-beta01) (2025-02-15)


### ⚠ BREAKING CHANGES

* Minimum node version updated. Option getter and setters.

### Features

* add improved validation to options ([039b6d8](https://github.com/grantcodes/micropub/commit/039b6d890115cdd0333e6b32adeba1810c2f006e))


### Bug Fixes

* fix exports ([40ceaed](https://github.com/grantcodes/micropub/commit/40ceaed6fb65bfe35d83d9d757c2bd79f2fc1cc9))
* ignore any in micropub types ([2d82d84](https://github.com/grantcodes/micropub/commit/2d82d843ec8ae23b9a957feb88dc205307ba41f1))
* **tests:** fix tests after refactor ([03950e9](https://github.com/grantcodes/micropub/commit/03950e9c6c5883a20bb595ab91913f929dacac98))


### Code Refactoring

* update dependencies and refactor typescript ([f568c91](https://github.com/grantcodes/micropub/commit/f568c91a2154715dc4f30c9e8d7b3a3f97e84ef4))

## [2.0.0](https://github.com/grantcodes/micropub/compare/v1.6.2...v2.0.0) (2024-03-19)


### Features

* replace axios with native fetch and fix tests ([6492e34](https://github.com/grantcodes/micropub/commit/6492e34e61caf371f88532b77d768117f12ea056))


### Miscellaneous Chores

* release 2.0.0 ([87f5523](https://github.com/grantcodes/micropub/commit/87f5523df58e2fa6e71034547307b209bd6f63b1))
