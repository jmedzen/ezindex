import { App, Plugin, PluginSettingTab, Setting, Notice, TFolder, TFile, Modal, Menu, TAbstractFile, normalizePath } from 'obsidian';
import {
	DEFAULT_UI_LANGUAGE,
	getStrings,
	resolveLanguage,
	type ResolvedLanguage,
	type Segments,
	type UiLanguage,
	type UiStrings,
} from './i18n';

interface EzIndexSettings {
	indexHeader: string;
	showExtension: boolean;
	indexFilename: string;
	indexLocation: 'inFolder' | 'vaultRoot' | 'customFolder';
	customFolderPath: string;
	overwriteExisting: boolean;
	excludeList: string;
	uiLanguage: UiLanguage;
}

const DEFAULT_SETTINGS: EzIndexSettings = {
	indexHeader: '# Directory Index',
	showExtension: false,
	indexFilename: '_Index.md',
	indexLocation: 'inFolder',
	customFolderPath: '',
	overwriteExisting: true,
	excludeList: '',
	uiLanguage: DEFAULT_UI_LANGUAGE,
};

/** 解析後的最終輸出路徑，供實際寫入與設定頁預覽共用。 */
interface ResolvedIndexTarget {
	filename: string;
	dirPath: string;
	filePath: string;
	locationLabel: string;
}

export default class EzIndexPlugin extends Plugin {
	settings!: EzIndexSettings;

	async onload() {
		await this.loadSettings();

		const t = this.t();

		// Ribbon icon: Open Generator Modal with execute button
		this.addRibbonIcon('list-ordered', 'EzIndex Directory Generator', () => {
			new EzIndexGeneratorModal(this.app, this).open();
		});

		// Command 1: Open Generator Modal to select folder & generate
		this.addCommand({
			id: 'open-generator-modal',
			name: 'Open Index Generator Modal...',
			callback: () => {
				new EzIndexGeneratorModal(this.app, this).open();
			}
		});

		// Command 2: Quick generate index for active file's folder
		this.addCommand({
			id: 'generate-active-folder-index',
			name: 'Quick Generate Index for Current Folder',
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice(t.notices.noActiveFile);
					return;
				}
				const folder = activeFile.parent;
				if (!folder) {
					new Notice(t.notices.noActiveFolder);
					return;
				}
				await this.generateIndexForFolder(folder);
			}
		});

		// Add right-click context menu on folders in File Explorer
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
				if (file instanceof TFolder) {
					menu.addItem((item) => {
						item
							.setTitle('EzIndex: Generate Index for this folder')
							.setIcon('list-ordered')
							.onClick(() => {
								new EzIndexGeneratorModal(this.app, this, file).open();
							});
					});
				}
			})
		);

		// Add settings tab
		this.addSettingTab(new EzIndexSettingTab(this.app, this));
	}

	onunload() {
		// Nothing to tear down: registered events are cleaned up by Obsidian.
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** 目前生效的介面語言。 */
	getLanguage(): ResolvedLanguage {
		return resolveLanguage(this.settings.uiLanguage);
	}

	/** 目前語言的說明文字。 */
	t(): UiStrings {
		return getStrings(this.getLanguage());
	}

	/** 解析排除清單：支援逗號、頓號、分號與換行分隔。 */
	getExcludeItems(): string[] {
		return this.settings.excludeList
			.split(/[,\n;、]/)
			.map(item => item.trim())
			.filter(item => item.length > 0);
	}

	/**
	 * 依目前設定計算索引筆記的最終路徑。
	 * 設定頁預覽與實際寫入都走這條路徑，確保「看到什麼就產生什麼」。
	 */
	resolveIndexTarget(targetFolder: TFolder, overrideFilename?: string): ResolvedIndexTarget {
		const folderName = targetFolder.path === '/' || !targetFolder.name ? 'Vault' : targetFolder.name;

		// Determine index filename (replacing {{folderName}} placeholder)
		let filename = (overrideFilename !== undefined && overrideFilename.trim() !== '')
			? overrideFilename.trim()
			: (this.settings.indexFilename.trim() || DEFAULT_SETTINGS.indexFilename);

		filename = filename.replace(/\{\{folderName\}\}/g, folderName);
		filename = filename.replace(/^[\\/]+/, '');
		if (!filename) {
			filename = folderName;
		}
		if (!/\.md$/i.test(filename)) {
			filename += '.md';
		}

		// Determine target directory path based on settings
		const t = this.t();
		let dirPath = '';
		let locationLabel = '';
		if (this.settings.indexLocation === 'vaultRoot') {
			dirPath = '';
			locationLabel = t.locationLabel.vaultRoot;
		} else if (this.settings.indexLocation === 'customFolder') {
			const rawPath = this.settings.customFolderPath.trim();
			dirPath = rawPath ? normalizePath(rawPath) : '';
			locationLabel = dirPath
				? t.locationLabel.customFolder(dirPath)
				: t.locationLabel.customUnset;
		} else {
			dirPath = targetFolder.path === '/' ? '' : targetFolder.path;
			locationLabel = dirPath
				? t.locationLabel.inFolder(dirPath)
				: t.locationLabel.inVaultRoot;
		}

		const filePath = dirPath ? normalizePath(`${dirPath}/${filename}`) : filename;

		return { filename, dirPath, filePath, locationLabel };
	}

	async generateIndexForFolder(targetFolder: TFolder, overrideFilename?: string) {
		const resolved = this.resolveIndexTarget(targetFolder, overrideFilename);
		const targetFilePath = resolved.filePath;

		// Create the custom folder on demand
		if (this.settings.indexLocation === 'customFolder' && resolved.dirPath) {
			if (!this.app.vault.getAbstractFileByPath(resolved.dirPath)) {
				try {
					await this.app.vault.createFolder(resolved.dirPath);
				} catch {
					new Notice(this.t().notices.createFolderFailed(resolved.dirPath));
					throw new Error(`EzIndex: could not create folder "${resolved.dirPath}"`);
				}
			}
		}

		const excludeItems = this.getExcludeItems();

		// Build recursive markdown content
		let content = `${this.settings.indexHeader}\n\n`;

		const { text: treeContent, totalFiles } = this.renderFolderTree(targetFolder, targetFolder, targetFilePath, 1, excludeItems);
		content += treeContent;

		// Create or update the index note file
		const t = this.t();
		const existingFile = this.app.vault.getAbstractFileByPath(targetFilePath);
		if (existingFile && existingFile instanceof TFile) {
			if (this.settings.overwriteExisting) {
				await this.app.vault.modify(existingFile, content);
				new Notice(t.notices.updated(targetFilePath, totalFiles));
			} else {
				new Notice(t.notices.exists(targetFilePath));
			}
		} else {
			await this.app.vault.create(targetFilePath, content);
			new Notice(t.notices.created(targetFilePath, totalFiles));
		}
	}

	private isExcluded(fileName: string, excludeItems: string[]): boolean {
		if (excludeItems.length === 0) return false;
		const lowerName = fileName.toLowerCase();
		const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '').toLowerCase();

		for (const rawItem of excludeItems) {
			const item = rawItem.toLowerCase();
			if (!item) continue;

			// Exact name or name without extension match
			if (lowerName === item || nameWithoutExt === item) {
				return true;
			}

			// Extension match (e.g. ".png" or "png")
			if ((item.startsWith('.') && lowerName.endsWith(item)) || lowerName.endsWith(`.${item}`)) {
				return true;
			}
		}
		return false;
	}

	private renderFolderTree(
		folder: TFolder,
		baseTargetFolder: TFolder,
		targetFilePath: string,
		currentDepth: number,
		excludeItems: string[]
	): { text: string; totalFiles: number } {
		let result = '';
		let totalFiles = 0;

		const children = folder.children.filter(file => {
			if (file.path === targetFilePath) return false;
			if (this.isExcluded(file.name, excludeItems)) return false;
			return true;
		});

		const directFiles: TFile[] = [];
		const directSubfolders: TFolder[] = [];

		for (const child of children) {
			if (child instanceof TFolder) {
				directSubfolders.push(child);
			} else if (child instanceof TFile) {
				directFiles.push(child);
			}
		}

		// Sort files and subfolders alphabetically
		directFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
		directSubfolders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

		// Render direct files in current folder
		if (directFiles.length > 0) {
			totalFiles += directFiles.length;
			for (const file of directFiles) {
				// Strip targetFolder prefix to use relative path relative to target folder
				let relPath = file.path;
				if (baseTargetFolder.path !== '/' && file.path.startsWith(baseTargetFolder.path + '/')) {
					relPath = file.path.substring(baseTargetFolder.path.length + 1);
				}

				let linkTarget = relPath;
				let displayName = file.name;

				if (!this.settings.showExtension) {
					linkTarget = relPath.replace(/\.[^/.]+$/, '');
					displayName = file.name.replace(/\.[^/.]+$/, '');
				}

				result += `- [[${linkTarget}|${displayName}]]\n`;
			}
			result += '\n';
		}

		// Render subfolders recursively
		for (const subfolder of directSubfolders) {
			const headingLevel = Math.min(6, currentDepth + 1);
			const hashtags = '#'.repeat(headingLevel);

			const subResult = this.renderFolderTree(subfolder, baseTargetFolder, targetFilePath, currentDepth + 1, excludeItems);

			result += `${hashtags} ${subfolder.name}\n\n`;
			result += subResult.text;
			totalFiles += subResult.totalFiles;
		}

		return { text: result, totalFiles };
	}
}

class EzIndexGeneratorModal extends Modal {
	plugin: EzIndexPlugin;
	selectedFolder: TFolder | null = null;
	customFilename: string = '';

	constructor(app: App, plugin: EzIndexPlugin, initialFolder?: TFolder) {
		super(app);
		this.plugin = plugin;
		const activeFile = this.app.workspace.getActiveFile();
		this.selectedFolder = initialFolder || activeFile?.parent || this.app.vault.getRoot();
		this.customFilename = this.plugin.settings.indexFilename;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ezindex-modal');

		const t = this.plugin.t();
		contentEl.createEl('h2', { text: t.modal.title });

		// Folder selection dropdown
		const allFolders = this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder);
		allFolders.sort((a, b) => a.path.localeCompare(b.path));

		new Setting(contentEl)
			.setName(t.modal.folderName)
			.setDesc(t.modal.folderDesc)
			.addDropdown(dropdown => {
				for (const folder of allFolders) {
					const displayPath = folder.path === '/' ? t.target.vaultRootOption : folder.path;
					dropdown.addOption(folder.path, displayPath);
				}
				if (this.selectedFolder) {
					dropdown.setValue(this.selectedFolder.path);
				}
				dropdown.onChange((value) => {
					const folder = this.app.vault.getAbstractFileByPath(value);
					if (folder instanceof TFolder) {
						this.selectedFolder = folder;
					}
				});
			});

		// Custom index filename field inside modal
		new Setting(contentEl)
			.setName(t.modal.filenameName)
			.setDesc(t.modal.filenameDesc)
			.addText(text => {
				text.setValue(this.customFilename);
				text.onChange((val) => {
					this.customFilename = val;
				});
			});

		// Execute action button at the bottom
		new Setting(contentEl)
			.addButton(button => {
				button
					.setButtonText(t.modal.button)
					.setCta()
					.onClick(async () => {
						if (!this.selectedFolder) {
							new Notice(this.plugin.t().notices.pickFolder);
							return;
						}
						await this.plugin.generateIndexForFolder(this.selectedFolder, this.customFilename);
						this.close();
					});
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/** 建立含 <code> 片段的說明文字，讓範例在設定頁中易於辨識。 */
function describe(segments: Segments): DocumentFragment {
	return createFragment((frag: DocumentFragment) => {
		for (const segment of segments) {
			if (typeof segment === 'string') {
				frag.appendText(segment);
			} else {
				frag.createEl('code', { text: segment.code });
			}
		}
	});
}

class EzIndexSettingTab extends PluginSettingTab {
	plugin: EzIndexPlugin;
	selectedTargetFolder: TFolder | null = null;
	private previewEl: HTMLElement | null = null;

	constructor(app: App, plugin: EzIndexPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('ezindex-settings');

		const t = this.plugin.t();

		const allFolders = this.app.vault.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder)
			.sort((a, b) => a.path.localeCompare(b.path));

		if (!this.selectedTargetFolder || !allFolders.includes(this.selectedTargetFolder)) {
			const activeFolder = this.app.workspace.getActiveFile()?.parent;
			this.selectedTargetFolder = (activeFolder instanceof TFolder ? activeFolder : null)
				?? this.app.vault.getRoot();
		}

		// ── 1. Target & Output ─────────────────────────────────────
		this.addSectionHeading(containerEl, t.sections.target);

		const targetSetting = new Setting(containerEl)
			.setName(t.target.name)
			.setDesc(describe(t.target.desc(allFolders.length)))
			.addDropdown(dropdown => {
				for (const folder of allFolders) {
					const displayPath = folder.path === '/' ? t.target.vaultRootOption : folder.path;
					dropdown.addOption(folder.path, displayPath);
				}
				if (this.selectedTargetFolder) {
					dropdown.setValue(this.selectedTargetFolder.path);
				}
				dropdown.onChange((value) => {
					const folder = this.app.vault.getAbstractFileByPath(value);
					if (folder instanceof TFolder) {
						this.selectedTargetFolder = folder;
						this.renderPreview();
					}
				});
			});
		targetSetting.setClass('ezindex-setting-target');

		new Setting(containerEl)
			.setName(t.location.name)
			.setDesc(t.location.desc)
			.addDropdown(dropdown => {
				dropdown
					.addOption('inFolder', t.location.inFolder)
					.addOption('vaultRoot', t.location.vaultRoot)
					.addOption('customFolder', t.location.customFolder)
					.setValue(this.plugin.settings.indexLocation)
					.onChange(async (value) => {
						this.plugin.settings.indexLocation = value as EzIndexSettings['indexLocation'];
						await this.plugin.saveSettings();
						this.display();
					});
			});

		if (this.plugin.settings.indexLocation === 'customFolder') {
			new Setting(containerEl)
				.setName(t.customPath.name)
				.setDesc(describe(t.customPath.desc))
				.addText(text => text
					.setPlaceholder(t.customPath.placeholder)
					.setValue(this.plugin.settings.customFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.customFolderPath = value;
						await this.plugin.saveSettings();
						this.renderPreview();
					}));
		}

		new Setting(containerEl)
			.setName(t.filename.name)
			.setDesc(describe(t.filename.desc))
			.addText(text => text
				.setPlaceholder(t.filename.placeholder)
				.setValue(this.plugin.settings.indexFilename)
				.onChange(async (value) => {
					this.plugin.settings.indexFilename = value;
					await this.plugin.saveSettings();
					this.renderPreview();
				}));

		// ── 2. Output Preview ──────────────────────────────────────
		this.addSectionHeading(containerEl, t.sections.preview);

		const previewSetting = new Setting(containerEl)
			.setName(t.previewSetting.name)
			.setDesc(t.previewSetting.desc);
		previewSetting.setClass('ezindex-setting-preview');
		this.previewEl = previewSetting.controlEl.createDiv({ cls: 'ezindex-preview ezindex-preview--wide' });

		// ── 3. Index Content ───────────────────────────────────────
		this.addSectionHeading(containerEl, t.sections.content);

		new Setting(containerEl)
			.setName(t.header.name)
			.setDesc(describe(t.header.desc))
			.addText(text => text
				.setPlaceholder(t.header.placeholder)
				.setValue(this.plugin.settings.indexHeader)
				.onChange(async (value) => {
					this.plugin.settings.indexHeader = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t.extension.name)
			.setDesc(describe(t.extension.desc))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showExtension)
				.onChange(async (value) => {
					this.plugin.settings.showExtension = value;
					await this.plugin.saveSettings();
				}));

		// ── 4. Filtering & Overwrite ───────────────────────────────
		this.addSectionHeading(containerEl, t.sections.filter);

		new Setting(containerEl)
			.setName(t.exclude.name)
			.setDesc(describe(t.exclude.desc))
			.addTextArea(text => {
				text
					.setPlaceholder(t.exclude.placeholder)
					.setValue(this.plugin.settings.excludeList)
					.onChange(async (value) => {
						this.plugin.settings.excludeList = value;
						await this.plugin.saveSettings();
						this.renderPreview();
					});
				text.inputEl.rows = 4;
				text.inputEl.addClass('ezindex-exclude-input');
			});

		new Setting(containerEl)
			.setName(t.overwrite.name)
			.setDesc(t.overwrite.desc)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.overwriteExisting)
				.onChange(async (value) => {
					this.plugin.settings.overwriteExisting = value;
					await this.plugin.saveSettings();
					this.renderPreview();
				}));

		// ── 5. Run ─────────────────────────────────────────────────
		this.addSectionHeading(containerEl, t.sections.run);

		new Setting(containerEl)
			.setName(t.run.name)
			.setDesc(t.run.desc)
			.addButton(button => {
				button
					.setButtonText(t.run.button)
					.setCta()
					.onClick(async () => {
						if (!this.selectedTargetFolder) {
							new Notice(this.plugin.t().notices.pickTargetFolder);
							return;
						}
						await this.plugin.generateIndexForFolder(this.selectedTargetFolder);
					});
			});

		// ── 6. Interface language ──────────────────────────────────
		this.addSectionHeading(containerEl, t.sections.language);

		new Setting(containerEl)
			.setName(t.language.name)
			.setDesc(t.language.desc)
			.addDropdown(dropdown => {
				dropdown
					.addOption('auto', this.autoLanguageLabel(t))
					.addOption('en', 'English')
					.addOption('zh-tw', '繁體中文 (Traditional Chinese)')
					.setValue(this.plugin.settings.uiLanguage)
					.onChange(async (value) => {
						this.plugin.settings.uiLanguage = value as UiLanguage;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		this.renderPreview();
	}

	/** 「自動」選項會標示目前實際偵測到的語言，方便確認效果。 */
	private autoLanguageLabel(t: UiStrings): string {
		if (this.plugin.settings.uiLanguage !== 'auto') {
			return t.language.auto;
		}
		const detected = this.plugin.getLanguage();
		const tag = detected === 'zh-tw' ? 'zh-tw' : 'en';
		return `${t.language.auto} — ${tag} (${t.language.autoSuffix})`;
	}


	private addSectionHeading(containerEl: HTMLElement, title: string): void {
		new Setting(containerEl).setName(title).setHeading();
	}

	private renderPreview(): void {
		const el = this.previewEl;
		if (!el) return;
		el.empty();

		const t = this.plugin.t();
		const folder = this.selectedTargetFolder ?? this.app.vault.getRoot();
		const resolved = this.plugin.resolveIndexTarget(folder);
		const excludeCount = this.plugin.getExcludeItems().length;

		const addRow = (label: string, value: string, mono = false): HTMLElement => {
			const rowEl = el.createDiv({ cls: 'ezindex-preview-row' });
			rowEl.createSpan({ cls: 'ezindex-preview-label', text: label });
			rowEl.createSpan({
				cls: mono ? 'ezindex-preview-value' : 'ezindex-preview-text',
				text: value,
			});
			return rowEl;
		};

		addRow(t.preview.output, resolved.locationLabel);
		addRow(t.preview.filename, resolved.filename, true);
		addRow(t.preview.fullPath, resolved.filePath, true);

		// Status: create / overwrite / skip
		const existing = this.app.vault.getAbstractFileByPath(resolved.filePath);
		let statusText: string;
		let statusClass: string;
		if (existing instanceof TFile) {
			if (this.plugin.settings.overwriteExisting) {
				statusText = t.preview.overwrite;
				statusClass = 'is-update';
			} else {
				statusText = t.preview.skip;
				statusClass = 'is-skip';
			}
		} else if (existing) {
			statusText = t.preview.isFolder;
			statusClass = 'is-skip';
		} else {
			statusText = t.preview.create;
			statusClass = 'is-create';
		}

		const statusRow = el.createDiv({ cls: 'ezindex-preview-row' });
		statusRow.createSpan({ cls: 'ezindex-preview-label', text: t.preview.status });
		statusRow.createSpan({ cls: `ezindex-preview-status ${statusClass}`, text: statusText });

		const hints: string[] = [];
		if (excludeCount > 0) {
			hints.push(t.preview.hintsExcluded(excludeCount));
		}
		if (
			this.plugin.settings.indexLocation === 'customFolder' &&
			resolved.dirPath &&
			!this.app.vault.getAbstractFileByPath(resolved.dirPath)
		) {
			hints.push(t.preview.hintCustomFolder);
		}
		if (hints.length > 0) {
			el.createDiv({ cls: 'ezindex-preview-hints', text: hints.join(t.preview.hintSeparator) });
		}
	}
}
