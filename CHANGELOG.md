# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-09-26

### Added
- **Riso: Remove All Riso Settings…** (also in the options menu): resets every
  `riso.*` option and deletes the bracket and indent-guide colors the extension
  wrote, for a clean uninstall. The color theme and VS Code's own settings are
  left alone.

### Changed
- The changelog follows Keep a Changelog.

## [1.2.2] - 2026-09-26

### Fixed
- README badges moved to badgen.net: shields.io retired its Marketplace badges.

## [1.2.1] - 2026-09-26

### Changed
- README rewritten: screenshots of every ink, the three papers, the duotone and
  color by name; install steps, language support, a full settings and commands
  reference, and an FAQ.

## [1.2.0] - 2026-09-25

### Added
- Three inks from the risograph catalogue: **Pink** (fluorescent), **Federal
  Blue** and **Sunflower**.
- **Pink × Blue**: a duotone printed with two inks and their purple overprint.
- **Paper**: every theme also comes light, ink on warm cream stock. *Background*
  in the options menu picks Normal, Dimmed or Paper.
- The build audits the contrast of every text color on every paper.

### Changed
- Color by name uses each paper's own set of colors, deep inks on the light one.

## [1.1.0] - 2026-09-25

### Added
- Options menu rows *Theme · this project* and *Theme · all projects*, sharing
  one ink picker with live preview; *Follow all projects* removes a project's
  own theme.
- The status bar button shows a folder icon when the project has its own theme.
- *Bracket pair guides* row, cycling `editor.guides.bracketPairs`.

### Fixed
- Bracket and indent-guide colors left behind for themes that no longer exist
  are removed.

## [1.0.0] - 2026-09-25

### Added
- Eight inks — Touge, Green, Blue, Purple, Grey, Orange, Teal, Mustard — each with
  a Dimmed variant tinted with its own ink.
- Rainbow and duotone brackets and indent guides.
- Color by name for parameters, locals, attributes, constants and types.
- Per-project themes and the **Riso: Options…** menu.

---

[Unreleased]: https://github.com/lucaschf/riso-themes/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/lucaschf/riso-themes/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/lucaschf/riso-themes/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/lucaschf/riso-themes/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/lucaschf/riso-themes/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/lucaschf/riso-themes/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/lucaschf/riso-themes/releases/tag/v1.0.0
