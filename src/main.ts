import { App, Plugin, PluginSettingTab, Setting, Notice, TFolder, TFile, Modal, Menu, TAbstractFile, normalizePath } from 'obsidian';

interface EzIndexSettings {
	indexHeader: string;
	showExtension: boolean;
	indexFilename: string;
	indexLocation: 'inFolder' | 'vaultRoot' | 'customFolder';
	customFolderPath: string;
	overwriteExisting: boolean;
	excludeList: string;
}

const DEFAULT_SETTINGS: EzIndexSettings = {
	indexHeader: '# Directory Index',
	showExtension: false,
	indexFilename: '_Index.md',
	indexLocation: 'inFolder',
	customFolderPath: '',
	overwriteExisting: true,
	excludeList: '',
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

		console.log('Loading EzIndex plugin');

		// Ribbon icon: Open Generator Modal with execute button
		this.addRibbonIcon('list-ordered', 'EzIndex Directory Generator', () => {
			new EzIndexGeneratorModal(this.app, this).open();
		});

		// Command 1: Open Generator Modal to select folder & generate
		this.addCommand({
			id: 'open-ezindex-generator-modal',
			name: 'Open Index Generator Modal...',
			callback: () => {
				new EzIndexGeneratorModal(this.app, this).open();
			}
		});

		// Command 2: Quick generate index for active file's folder
		this.addCommand({
			id: 'generate-active-folder-index',
			name: 'Quick Generate Index for Current Folder',
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice('EzIndex: No active file selected.');
					return;
				}
				const folder = activeFile.parent;
				if (!folder) {
					new Notice('EzIndex: Could not determine folder for active file.');
					return;
				}
				this.generateIndexForFolder(folder);
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
		console.log('Unloading EzIndex plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
		let dirPath = '';
		let locationLabel = '';
		if (this.settings.indexLocation === 'vaultRoot') {
			dirPath = '';
			locationLabel = 'Vault 根目錄 (Vault Root)';
		} else if (this.settings.indexLocation === 'customFolder') {
			const rawPath = this.settings.customFolderPath.trim();
			dirPath = rawPath ? normalizePath(rawPath) : '';
			locationLabel = dirPath
				? `自訂資料夾 (Custom Folder)：${dirPath}`
				: '自訂資料夾未設定，將寫入 Vault 根目錄';
		} else {
			dirPath = targetFolder.path === '/' ? '' : targetFolder.path;
			locationLabel = dirPath
				? `目標資料夾內 (Inside Target Folder)：${dirPath}`
				: '目標資料夾內 (Inside Target Folder)：Vault 根目錄';
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
				} catch (err) {
					console.error('EzIndex: Error creating custom directory', err);
				}
			}
		}

		const excludeItems = this.getExcludeItems();

		// Build recursive markdown content
		let content = `${this.settings.indexHeader}\n\n`;

		const { text: treeContent, totalFiles } = this.renderFolderTree(targetFolder, targetFolder, targetFilePath, 1, excludeItems);
		content += treeContent;

		// Create or update the index note file
		const existingFile = this.app.vault.getAbstractFileByPath(targetFilePath);
		if (existingFile && existingFile instanceof TFile) {
			if (this.settings.overwriteExisting) {
				await this.app.vault.modify(existingFile, content);
				new Notice(`EzIndex: Updated index note at "${targetFilePath}" (${totalFiles} files indexed).`);
			} else {
				new Notice(`EzIndex: Index note "${targetFilePath}" already exists (overwrite disabled).`);
			}
		} else {
			await this.app.vault.create(targetFilePath, content);
			new Notice(`EzIndex: Created new index note at "${targetFilePath}" (${totalFiles} files indexed).`);
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

		contentEl.createEl('h2', { text: 'EzIndex - 建立目錄索引' });

		// Folder selection dropdown
		const allFolders = this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder);
		allFolders.sort((a, b) => a.path.localeCompare(b.path));

		new Setting(contentEl)
			.setName('目標目錄 (Target Directory)')
			.setDesc('請選擇要建立索引的目錄')
			.addDropdown(dropdown => {
				for (const folder of allFolders) {
					const displayPath = folder.path === '/' ? '/ (Vault 根目錄)' : folder.path;
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
			.setName('索引檔名 (Index Filename)')
			.setDesc('支援 {{folderName}} 動態資料夾名稱替代變數')
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
					.setButtonText('🚀 執行建立索引 (Generate Index)')
					.setCta()
					.onClick(async () => {
						if (!this.selectedFolder) {
							new Notice('請先選擇一個目錄！');
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
function describe(segments: Array<string | { code: string }>): DocumentFragment {
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

		const allFolders = this.app.vault.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder)
			.sort((a, b) => a.path.localeCompare(b.path));

		if (!this.selectedTargetFolder || !allFolders.includes(this.selectedTargetFolder)) {
			const activeFolder = this.app.workspace.getActiveFile()?.parent;
			this.selectedTargetFolder = (activeFolder instanceof TFolder ? activeFolder : null)
				?? this.app.vault.getRoot();
		}

		// ── 1. 目標與輸出 ──────────────────────────────────────────
		this.addSectionHeading(containerEl, '目標與輸出 (Target & Output)');

		const targetSetting = new Setting(containerEl)
			.setName('目標目錄 (Target Directory)')
			.setDesc(describe([
				'要建立索引的資料夾；其所有子資料夾與檔案都會被收進同一份索引。共 ',
				{ code: String(allFolders.length) },
				' 個資料夾可選。',
			]))
			.addDropdown(dropdown => {
				for (const folder of allFolders) {
					const displayPath = folder.path === '/' ? '/ (Vault 根目錄)' : folder.path;
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
			.setName('索引存放位置 (Index Location)')
			.setDesc('索引筆記要寫入哪個資料夾，不影響索引收錄的內容範圍。')
			.addDropdown(dropdown => {
				dropdown
					.addOption('inFolder', '與目標資料夾相同 (Inside Target Folder)')
					.addOption('vaultRoot', 'Vault 根目錄 (Vault Root)')
					.addOption('customFolder', '自訂資料夾 (Custom Folder)')
					.setValue(this.plugin.settings.indexLocation)
					.onChange(async (value) => {
						this.plugin.settings.indexLocation = value as EzIndexSettings['indexLocation'];
						await this.plugin.saveSettings();
						this.display();
					});
			});

		if (this.plugin.settings.indexLocation === 'customFolder') {
			new Setting(containerEl)
				.setName('自訂資料夾路徑 (Custom Folder Path)')
				.setDesc(describe([
					'相對於 Vault 根目錄的路徑，例如 ',
					{ code: 'Indices' },
					' 或 ',
					{ code: '大覺藏集/索引' },
					'。資料夾不存在時，執行會自動建立。',
				]))
				.addText(text => text
					.setPlaceholder('Indices')
					.setValue(this.plugin.settings.customFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.customFolderPath = value;
						await this.plugin.saveSettings();
						this.renderPreview();
					}));
		}

		new Setting(containerEl)
			.setName('索引檔名 (Index Filename)')
			.setDesc(describe([
				'可用 ',
				{ code: '{{folderName}}' },
				' 代入目標資料夾名稱，例如 ',
				{ code: '{{folderName}}-索引.md' },
				'。省略 ',
				{ code: '.md' },
				' 時會自動補上。',
			]))
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.indexFilename)
				.setValue(this.plugin.settings.indexFilename)
				.onChange(async (value) => {
					this.plugin.settings.indexFilename = value;
					await this.plugin.saveSettings();
					this.renderPreview();
				}));

		// ── 2. 輸出路徑預覽 ────────────────────────────────────────
		this.addSectionHeading(containerEl, '輸出路徑預覽 (Output Preview)');

		const previewSetting = new Setting(containerEl)
			.setName('即將產生的索引筆記 (Resulting Index Note)')
			.setDesc('依上方設定即時計算；實際寫入的就是這個路徑。');
		previewSetting.setClass('ezindex-setting-preview');
		this.previewEl = previewSetting.controlEl.createDiv({ cls: 'ezindex-preview ezindex-preview--wide' });

		// ── 3. 索引內容 ────────────────────────────────────────────
		this.addSectionHeading(containerEl, '索引內容 (Index Content)');

		new Setting(containerEl)
			.setName('索引標題 (Index Header)')
			.setDesc(describe([
				'寫在索引筆記最上方的一行，通常使用 Markdown 標題，例如 ',
				{ code: '# 目錄' },
				' 或 ',
				{ code: '## 大覺藏集目錄' },
				'。留空則不顯示標題。',
			]))
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.indexHeader)
				.setValue(this.plugin.settings.indexHeader)
				.onChange(async (value) => {
					this.plugin.settings.indexHeader = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('顯示副檔名 (Show File Extensions)')
			.setDesc(describe([
				'開啟時連結顯示 ',
				{ code: 'note.md' },
				'；關閉時只顯示 ',
				{ code: 'note' },
				'。僅影響顯示，連結仍可正常開啟。',
			]))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showExtension)
				.onChange(async (value) => {
					this.plugin.settings.showExtension = value;
					await this.plugin.saveSettings();
				}));

		// ── 4. 篩選與覆寫 ──────────────────────────────────────────
		this.addSectionHeading(containerEl, '篩選與覆寫 (Filtering & Overwrite)');

		new Setting(containerEl)
			.setName('排除清單 (Exclude List)')
			.setDesc(describe([
				'以逗號或換行分隔，可填檔名、資料夾名稱或副檔名，比對不分大小寫。例如 ',
				{ code: 'z-附件, .png, .jpg' },
				'。留空表示不排除任何項目。',
			]))
			.addTextArea(text => {
				text
					.setPlaceholder('templates, z-附件, .png')
					.setValue(this.plugin.settings.excludeList)
					.onChange(async (value) => {
						this.plugin.settings.excludeList = value;
						await this.plugin.saveSettings();
						this.renderPreview();
					});
				text.inputEl.rows = 4;
				text.inputEl.style.width = '100%';
				text.inputEl.style.resize = 'vertical';
			});

		new Setting(containerEl)
			.setName('覆寫既有索引 (Overwrite Existing Index)')
			.setDesc(describe([
				'關閉後，若同名索引筆記已存在就略過不寫入，適合手動編輯過的索引；開啟則每次重新產生並覆蓋。',
			]))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.overwriteExisting)
				.onChange(async (value) => {
					this.plugin.settings.overwriteExisting = value;
					await this.plugin.saveSettings();
					this.renderPreview();
				}));

		// ── 5. 執行 ────────────────────────────────────────────────
		this.addSectionHeading(containerEl, '執行 (Run)');

		new Setting(containerEl)
			.setName('立即建立索引 (Generate Index Now)')
			.setDesc('依目前設定，為上方選取的目標目錄產生索引筆記。')
			.addButton(button => {
				button
					.setButtonText('🚀 建立索引 (Generate Index)')
					.setCta()
					.onClick(async () => {
						if (!this.selectedTargetFolder) {
							new Notice('請先選擇一個目標目錄！');
							return;
						}
						await this.plugin.generateIndexForFolder(this.selectedTargetFolder);
					});
			});

		this.renderPreview();
	}

	private addSectionHeading(containerEl: HTMLElement, title: string): void {
		new Setting(containerEl).setName(title).setHeading();
	}

	private renderPreview(): void {
		const el = this.previewEl;
		if (!el) return;
		el.empty();

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

		addRow('輸出位置', resolved.locationLabel);
		addRow('檔名', resolved.filename, true);
		addRow('完整路徑', resolved.filePath, true);

		// Status: create / overwrite / skip
		const existing = this.app.vault.getAbstractFileByPath(resolved.filePath);
		let statusText: string;
		let statusClass: string;
		if (existing instanceof TFile) {
			if (this.plugin.settings.overwriteExisting) {
				statusText = '已存在，執行時將覆寫 (Will overwrite)';
				statusClass = 'is-update';
			} else {
				statusText = '已存在，覆寫已關閉，執行時將略過 (Will skip)';
				statusClass = 'is-skip';
			}
		} else if (existing) {
			statusText = '同名路徑是資料夾，無法寫入 (Path is a folder)';
			statusClass = 'is-skip';
		} else {
			statusText = '尚未建立，執行時將新建 (Will create)';
			statusClass = 'is-create';
		}

		const statusRow = el.createDiv({ cls: 'ezindex-preview-row' });
		statusRow.createSpan({ cls: 'ezindex-preview-label', text: '狀態' });
		statusRow.createSpan({ cls: `ezindex-preview-status ${statusClass}`, text: statusText });

		const hints: string[] = [];
		if (excludeCount > 0) {
			hints.push(`排除清單 ${excludeCount} 項`);
		}
		if (
			this.plugin.settings.indexLocation === 'customFolder' &&
			resolved.dirPath &&
			!this.app.vault.getAbstractFileByPath(resolved.dirPath)
		) {
			hints.push('自訂資料夾尚未存在，執行時會自動建立');
		}
		if (hints.length > 0) {
			el.createDiv({ cls: 'ezindex-preview-hints', text: hints.join(' ｜ ') });
		}
	}
}
