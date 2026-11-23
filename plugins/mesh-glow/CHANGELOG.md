# Changelog

All notable changes to mesh-glow. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `mesh-glow--v<version>`.

## [0.1.2] - 2026-11-23

### Fixed

- Trying Mesh Glow or changing its glass from the themes picker no longer adds a `/mesh-glow` line and its reply to the chat. It hears the picker through the picker's own state and acts on its request directly; `/mesh-glow` typed by hand works as before.

## [0.1.1] - 2026-11-22

### Fixed

- `/mesh-glow off` and `/mesh-glow forget` clear the session's theme only while it is Mesh Glow's, so they no longer take down another theme that showed after it.
- Installed beside another theme and never turned on by name, Mesh Glow no longer covers it at every start: it yields to a theme already showing, and `/mesh-glow on` puts it in place and keeps that choice. While another theme shows, a glass change, a clear, a resume or a fork no longer sets Mesh Glow over it.
- `/mesh-glow` names why it isn't drawn: no window here, another theme showing, or held back by the themes picker, instead of always saying this window draws no backdrops.
- In a desktop session left open for days, the noise no longer coarsens into blocky patches: the drift now runs on a bounded phase.
- The shader no longer sweeps through daylight colours at midnight, and a long session's counts no longer burst when they pass 1,023: night and warmth come from the clock as smooth values, and each count turns at its top instead of wrapping.
- A turn started without a typed message, such as a continuation or a wake-up, no longer plays the message-sent glow.

## [0.1.0] - 2026-11-20

### Added

- A slow colour field behind the conversation in the desktop app, drawn on the GPU at 30 fps: deep slate, sea teal and plum over near-black, with a low warm light behind the prompt box.
- The field answers the main conversation: it lifts while Claude works, swells from the prompt at each tool call, warms toward rose at an error, brightens gently when a turn ends and sends a band of light up from the prompt when you send a message. The warm light rises as the prompt box grows, and a faint glow follows the pointer.
- The hour from your computer's clock: cool by day, deeper at night, warmer at dawn and dusk.
- A still picture of the field, by day and by night, for the mobile app, Reduce Motion, builds before 2.1.326 and wherever the shader can't run.
- The app's colours in blue-slate grays from the field, with a steel-teal accent and a warning amber from the warm light.
- `/mesh-glow`, with `on`, `off`, `glass clear|soft|frosted` and `forget`.

[0.1.2]: https://github.com/Samarth2001/claude-plugins/releases/tag/mesh-glow--v0.1.2
[0.1.1]: https://github.com/Samarth2001/claude-plugins/releases/tag/mesh-glow--v0.1.1
[0.1.0]: https://github.com/Samarth2001/claude-plugins/releases/tag/mesh-glow--v0.1.0
