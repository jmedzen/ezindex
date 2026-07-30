import { App, Plugin, PluginSettingTab, Setting, Notice, TFolder, TFile, FuzzySuggestModal, normalizePath } from 'obsidian';

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

		// Ribbon icon: Open folder selection modal
		this.addRibbonIcon('list-ordered', 'Generate EzIndex for a Folder', () => {
			new FolderSuggestModal(this.app, this).open();
		});

		// Command 1: Generate index for current active file's folder
		this.addCommand({
			id: 'generate-active-folder-index',
			name: 'Generate Index for Current Active Folder',
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

		// Command 2: Open folder suggestion modal to select any folder
		this.addCommand({
			id: 'select-folder-generate-index',
			name: 'Select Folder to Generate Index...',
			callback: () => {
				new FolderSuggestModal(this.app, this).open();
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
								this.generateIndexForFolder(folder);
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

	async generateIndexForFolder(targetFolder: TFolder) {
		const folderName = targetFolder.path === '/' || !targetFolder.name ? 'Vault' : targetFolder.name;
		
		// Determine index filename (replacing {{folderName}} placeholder)
		let filename = this.settings.indexFilename.trim() || '_Index.md';
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

class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	plugin: EzIndexPlugin;

	constructor(app: App, plugin: EzIndexPlugin) {
		super(app);
		this.plugin = plugin;
		this.setPlaceholder('Type to search for a folder...');
	}

	getItems(): TFolder[] {
		const files = this.app.vault.getAllLoadedFiles();
		const folders: TFolder[] = [];
		for (const file of files) {
			if (file instanceof TFolder) {
				folders.push(file);
			}
		}
		return folders;
	}

	getItemText(folder: TFolder): string {
		return folder.path === '/' ? '/ (Vault Root)' : folder.path;
	}

	onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
		this.plugin.generateIndexForFolder(folder);
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
			.setDesc('Name of the generated index note. Use {{folderName}} to dynamically insert the folder name.')
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
						this.display(); // Refresh settings to show/hide custom path input
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
