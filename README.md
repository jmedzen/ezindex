# EzIndex - Easy Index Generator for Obsidian

[![GitHub Release](https://img.shields.io/github/v/release/jmedzen/ezindex)](https://github.com/jmedzen/ezindex/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**EzIndex** is a feature-rich Obsidian plugin that automatically generates structured, hierarchical Table of Contents (TOC) and Index notes for any folder in your vault.

---

## ✨ Features

- 🌲 **Recursive Subfolder & File Indexing**: Scans all subfolders and files nested inside a target directory.
- 📑 **Hierarchical Markdown Headings**:
  - 1st-level subfolders: `## Subfolder` (H2 Heading)
  - 2nd-level subfolders: `### Subfolder` (H3 Heading)
  - 3rd-level subfolders: `#### Subfolder` (H4 Heading), and so on.
- 🚫 **Custom Exclude List**: Easily exclude specific file names, subfolder names, or file extensions (e.g. `templates, archive, .png, _Index`) using a multi-line text box. Entries may be separated by commas, newlines, semicolons or the Chinese enumeration comma `、`.
- 🔍 **Live Output Preview**: The settings page shows the exact filename and full path that will be written, plus whether the note will be created, overwritten or skipped.
- 🌐 **English / 繁體中文 Descriptions**: All labels, descriptions, the modal and notices are available in both languages. They follow the Obsidian interface language by default and can be forced to either one in settings.
- 🎯 **Multiple Convenient Ways to Trigger**:
  1. **Plugin Settings Page**: Pick a target directory and click `🚀 Generate index` right inside settings!
  2. **Interactive Modal**: Open via Ribbon Icon or Command Palette (`EzIndex: Open Index Generator Modal...`).
  3. **File Explorer Context Menu**: Right-click any folder in the left sidebar -> `EzIndex: Generate Index for this folder`.
- 🛠️ **Flexible Filename & Output Location**:
  - Dynamic placeholders like `{{folderName}}-Index.md`.
  - Save inside the target folder, at vault root, or in a custom folder.

---

## 🚀 Quick Start & Usage

### 1. Generate Index via Settings Page
1. Go to **Obsidian Settings** -> **EzIndex**.
2. Select your **Target directory**.
3. (Optional) Adjust **Index location**, **Index filename**, **Index header** and **Exclude list**.
4. Check the **Output preview** section — it shows the resulting path and what will happen.
5. Click **`🚀 Generate index`** in the **Run** section at the bottom.

### 2. Generate Index via File Explorer
1. Right-click any folder in the left sidebar File Explorer.
2. Click **`EzIndex: Generate Index for this folder`**.

### 3. Generate Index via Modal
1. Click the **Ribbon Icon** on the left sidebar (or press `Cmd + P` and search `EzIndex`).
2. Pick the target folder and click **`🚀 Generate index`**.

---

## ⚙️ Configuration Options

| Option | Description | Default |
|---|---|---|
| **Target directory** | Select the directory to index directly from settings | Active folder / Vault Root |
| **Index header** | Title heading at the top of the generated note | `# Directory Index` |
| **Index filename** | Filename pattern (supports `{{folderName}}`; `.md` is appended automatically) | `_Index.md` |
| **Exclude list** | Names or extensions to ignore, separated by commas, newlines, `;` or `、` | *(empty)* |
| **Index location** | Where to save (`Inside Target Folder`, `Vault Root`, or `Custom Folder`) | `Inside Target Folder` |
| **Custom folder path** | Vault-relative folder, created automatically if missing (only when output location is *Custom Folder*) | *(empty)* |
| **Show file extensions** | Display or hide `.md` extension in generated links | `Off` |
| **Overwrite existing index** | Overwrite existing index note with same name; off = skip and keep manual edits | `On` |
| **Description language** | `Follow Obsidian interface`, `English`, or `繁體中文` — affects UI text only, never your notes | `Follow Obsidian interface` |

---

## 📦 Installation

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [Latest Release](https://github.com/jmedzen/ezindex/releases/latest).
2. Create a folder named `ezindex` inside your vault's `.obsidian/plugins/` directory:
   ```bash
   <VaultFolder>/.obsidian/plugins/ezindex/
   ```
3. Move the downloaded files into `<VaultFolder>/.obsidian/plugins/ezindex/`.
4. Reload Obsidian -> Go to **Settings** -> **Community Plugins** -> Enable **EzIndex**.

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build production bundle
npm run build

# Start development watcher
npm run dev
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
