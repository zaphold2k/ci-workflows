# Changelog

## 1.0.0 (2026-09-19)


### Funcionalidades

* add ready-to-copy templates for each supported language ([b1737d6](https://github.com/zaphold2k/ci-workflows/commit/b1737d639eb2ab3a90a996f62ea1250ed088c876))
* add the incremental quality ratchet ([514320b](https://github.com/zaphold2k/ci-workflows/commit/514320bc40f98b2456c68e648bf1db356f6b5165))
* add the release workflow and the component's own CI/release ([3a5b1de](https://github.com/zaphold2k/ci-workflows/commit/3a5b1debf6222d742861a1b7245124a46e70e37d))
* add the reusable CI workflow with Docker build and promotion ([ac6747a](https://github.com/zaphold2k/ci-workflows/commit/ac6747a06f5f91f1fadd6843a15d69e43524bfa9))
* build independent images per Dockerfile target ([e36008a](https://github.com/zaphold2k/ci-workflows/commit/e36008a4ed6d96fd778ccc7bc5341c32326de6a0))
* collect normalized test and coverage metrics ([3578952](https://github.com/zaphold2k/ci-workflows/commit/357895255667ae1618b09690b17987fef72a6906))
* derive branch prereleases and image tags from git tags ([69aa9da](https://github.com/zaphold2k/ci-workflows/commit/69aa9da04ffaa1c66cb922b734f3f2103865eb50))
* generate the per-repository flow documentation block ([51ccbd2](https://github.com/zaphold2k/ci-workflows/commit/51ccbd233f0c3491cdede1e34c9b00117d0e846d))
* move this component's own major-version tag on each stable release ([f6e24e8](https://github.com/zaphold2k/ci-workflows/commit/f6e24e831e022e690d973da48d912e9fe80e8d13))


### Correcciones

* anchor gitignore patterns to repo root ([3591cbb](https://github.com/zaphold2k/ci-workflows/commit/3591cbb46e6130aa5cf319d4c5692b7083617936))
* don't let a golangci-lint install failure block independent stages ([96087ed](https://github.com/zaphold2k/ci-workflows/commit/96087ed9f1629bc689ab31bf35669eed1bbd7a81))
* fail the run when the full model's integration branch is missing ([1f354ef](https://github.com/zaphold2k/ci-workflows/commit/1f354efbe0f10cc61ff1f364510bf070fe12e35a))
* serialize successive pushes to the same branch ([0e9d591](https://github.com/zaphold2k/ci-workflows/commit/0e9d591fabcd2180fb03c05db06f589a0b35a756))


### Documentación

* clarify that an image's effective version is its tag, not its manifest ([8656a27](https://github.com/zaphold2k/ci-workflows/commit/8656a276dbf83ec25e9f0bb11dbba81c0d625eaf))
* complete the README with capabilities, models, and doc links ([a3688f2](https://github.com/zaphold2k/ci-workflows/commit/a3688f212cc518368f3b5ae184f35efdd5aa3e37))
* write the component's reference documentation ([8dff573](https://github.com/zaphold2k/ci-workflows/commit/8dff57335920d78d828493dcb995fa370d26214a))
* write this repository's own operating notes and inputs reference ([5b2945e](https://github.com/zaphold2k/ci-workflows/commit/5b2945e172b2523cb4e630ca1a2f7e12af7962b2))
