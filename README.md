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
- 🚫 **Custom Exclude List**: Easily exclude specific file names, subfolder names, or file extensions (e.g. `templates, archive, .png, _Index`) using a multi-line text box.
- 🎯 **Multiple Convenient Ways to Trigger**:
  1. **Plugin Settings Page**: Pick a target directory and click `🚀 執行建立索引 (Generate Index)` right inside settings!
  2. **Interactive Modal**: Open via Ribbon Icon or Command Palette (`EzIndex: Open Index Generator Modal...`).
  3. **File Explorer Context Menu**: Right-click any folder in the left sidebar -> `EzIndex: Generate Index for this folder`.
- 🛠️ **Flexible Filename & Output Location**:
  - Dynamic placeholders like `{{folderName}}-Index.md`.
  - Save inside the target folder, at vault root, or in a custom folder.

---

## 🚀 Quick Start & Usage

### 1. Generate Index via Settings Page
1. Go to **Obsidian Settings** -> **EzIndex**.
2. Select your **Target Directory to Index**.
3. (Optional) Customize **Index Filename Pattern** and **Exclude List**.
4. Click **`🚀 執行建立索引 (Generate Index)`** at the bottom.

### 2. Generate Index via File Explorer
1. Right-click any folder in the left sidebar File Explorer.
2. Click **`EzIndex: Generate Index for this folder`**.

### 3. Generate Index via Modal
1. Click the **Ribbon Icon** on the left sidebar (or press `Cmd + P` and search `EzIndex`).
2. Pick the target folder and click **`🚀 執行建立索引 (Generate Index)`**.

---

## ⚙️ Configuration Options

| Option | Description | Default |
|---|---|---|
| **Target Directory to Index** | Select the directory to index directly from settings | Active folder / Vault Root |
| **Index Header** | Title heading at the top of the generated note | `# Directory Index` |
| **Index Filename Pattern** | Filename pattern (supports `{{folderName}}`) | `_Index.md` |
| **Exclude List** | Comma-separated names or extensions to ignore | *(empty)* |
| **Index Output Location** | Where to save (`Inside Target Folder`, `Vault Root`, or `Custom Folder Path`) | `Inside Target Folder` |
| **Show File Extensions** | Display or hide `.md` extension in generated links | `Off` |
| **Overwrite Existing** | Overwrite existing index note with same name | `On` |

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
