# Changelog

All notable changes to mesh-glow. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `mesh-glow--v<version>`.

## [0.1.0] - 2026-11-20

### Added

- A slow colour field behind the conversation in the desktop app, drawn on the GPU at 30 fps: deep slate, sea teal and plum over near-black, with a low warm light behind the prompt box.
- The field answers the main conversation: it lifts while Claude works, swells from the prompt at each tool call, warms toward rose at an error, brightens gently when a turn ends and sends a band of light up from the prompt when you send a message. The warm light rises as the prompt box grows, and a faint glow follows the pointer.
- The hour from your computer's clock: cool by day, deeper at night, warmer at dawn and dusk.
- A still picture of the field, by day and by night, for the mobile app, Reduce Motion, builds before 2.1.326 and wherever the shader can't run.
- The app's colours in blue-slate grays from the field, with a steel-teal accent and a warning amber from the warm light.
- `/mesh-glow`, with `on`, `off`, `glass clear|soft|frosted` and `forget`.

[0.1.0]: https://github.com/Samarth2001/claude-plugins/releases/tag/mesh-glow--v0.1.0
