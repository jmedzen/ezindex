import { App, Plugin, PluginSettingTab, Setting, Notice, TFolder, TFile, FuzzySuggestModal, Modal, normalizePath } from 'obsidian';

interface EzIndexSettings {
	indexHeader: string;
	showExtension: boolean;
	indexFilename: string;
	indexLocation: 'inFolder' | 'vaultRoot' | 'customFolder';
	customFolderPath: string;
	overwriteExisting: boolean;
}

const DEFAULT_SETTINGS: EzIndexSettings = {
	indexHeader: '## Directory Index',
	showExtension: false,
	indexFilename: '_Index.md',
	indexLocation: 'inFolder',
	customFolderPath: '',
	overwriteExisting: true,
};

export default class EzIndexPlugin extends Plugin {
	settings: EzIndexSettings;

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
			this.app.workspace.on('folder-menu', (menu, folder) => {
				if (folder instanceof TFolder) {
					menu.addItem((item) => {
						item
							.setTitle('EzIndex: Generate Index for this folder')
							.setIcon('list-ordered')
							.onClick(() => {
								new EzIndexGeneratorModal(this.app, this, folder).open();
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

	async generateIndexForFolder(targetFolder: TFolder, overrideFilename?: string) {
		const folderName = targetFolder.path === '/' || !targetFolder.name ? 'Vault' : targetFolder.name;
		
		// Determine index filename (replacing {{folderName}} placeholder)
		let filename = (overrideFilename !== undefined && overrideFilename.trim() !== '') 
			? overrideFilename.trim() 
			: (this.settings.indexFilename.trim() || '_Index.md');

		filename = filename.replace(/\{\{folderName\}\}/g, folderName);
		if (!filename.endsWith('.md')) {
			filename += '.md';
		}

		// Determine target directory path based on settings
		let targetDirPath = '';
		if (this.settings.indexLocation === 'inFolder') {
			targetDirPath = targetFolder.path === '/' ? '' : targetFolder.path;
		} else if (this.settings.indexLocation === 'customFolder') {
			targetDirPath = this.settings.customFolderPath.trim();
			// Ensure custom folder exists if specified
			if (targetDirPath && !this.app.vault.getAbstractFileByPath(normalizePath(targetDirPath))) {
				try {
					await this.app.vault.createFolder(normalizePath(targetDirPath));
				} catch (err) {
					console.error('EzIndex: Error creating custom directory', err);
				}
			}
		}

		const targetFilePath = normalizePath(targetDirPath ? `${targetDirPath}/${filename}` : filename);

		// Filter files in target folder (excluding subdirectories or index file itself if inside same folder)
		const children = targetFolder.children.filter(file => {
			if (file.path === targetFilePath) return false;
			return true;
		});

		// Sort children alphabetically (folders first, then files)
		children.sort((a, b) => {
			const aIsDir = a instanceof TFolder;
			const bIsDir = b instanceof TFolder;
			if (aIsDir && !bIsDir) return -1;
			if (!aIsDir && bIsDir) return 1;
			return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
		});

		// Build index content
		let content = `${this.settings.indexHeader}\n\n`;
		for (const file of children) {
			const isDir = file instanceof TFolder;
			const prefix = isDir ? '📁 ' : '📄 ';
			let displayName = file.name;
			if (!isDir && !this.settings.showExtension) {
				displayName = displayName.replace(/\.[^/.]+$/, '');
			}
			content += `- ${prefix}[[${file.path}|${displayName}]]\n`;
		}

		// Create or update the index note file
		const existingFile = this.app.vault.getAbstractFileByPath(targetFilePath);
		if (existingFile && existingFile instanceof TFile) {
			if (this.settings.overwriteExisting) {
				await this.app.vault.modify(existingFile, content);
				new Notice(`EzIndex: Updated index note at "${targetFilePath}" (${children.length} items).`);
			} else {
				new Notice(`EzIndex: Index note "${targetFilePath}" already exists (overwrite disabled).`);
			}
		} else {
			await this.app.vault.create(targetFilePath, content);
			new Notice(`EzIndex: Created new index note at "${targetFilePath}" (${children.length} items).`);
		}
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

class EzIndexSettingTab extends PluginSettingTab {
	plugin: EzIndexPlugin;

	constructor(app: App, plugin: EzIndexPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'EzIndex Plugin Settings' });

		new Setting(containerEl)
			.setName('Index Header')
			.setDesc('The heading placed at the top of generated index notes.')
			.addText(text => text
				.setPlaceholder('## Directory Index')
				.setValue(this.plugin.settings.indexHeader)
				.onChange(async (value) => {
					this.plugin.settings.indexHeader = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Index Filename Pattern')
			.setDesc('Default name of generated index notes. Use {{folderName}} to dynamically insert the folder name.')
			.addText(text => text
				.setPlaceholder('_Index.md')
				.setValue(this.plugin.settings.indexFilename)
				.onChange(async (value) => {
					this.plugin.settings.indexFilename = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Index Output Location')
			.setDesc('Where generated index notes should be saved.')
			.addDropdown(dropdown => {
				dropdown
					.addOption('inFolder', 'Inside Target Folder')
					.addOption('vaultRoot', 'Vault Root')
					.addOption('customFolder', 'Custom Folder Path')
					.setValue(this.plugin.settings.indexLocation)
					.onChange(async (value: 'inFolder' | 'vaultRoot' | 'customFolder') => {
						this.plugin.settings.indexLocation = value;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		if (this.plugin.settings.indexLocation === 'customFolder') {
			new Setting(containerEl)
				.setName('Custom Folder Path')
				.setDesc('Directory path inside your vault where indices will be saved.')
				.addText(text => text
					.setPlaceholder('Indices')
					.setValue(this.plugin.settings.customFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.customFolderPath = value;
						await this.plugin.saveSettings();
					}));
		}

		new Setting(containerEl)
			.setName('Show File Extensions')
			.setDesc('Whether to display file extensions in the generated index links.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showExtension)
				.onChange(async (value) => {
					this.plugin.settings.showExtension = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Overwrite Existing Index Notes')
			.setDesc('If enabled, updating an index will overwrite existing index files with the same name.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.overwriteExisting)
				.onChange(async (value) => {
					this.plugin.settings.overwriteExisting = value;
					await this.plugin.saveSettings();
				}));
	}
}
