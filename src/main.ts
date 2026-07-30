import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';

interface EzIndexSettings {
	indexHeader: string;
	showExtension: boolean;
}

const DEFAULT_SETTINGS: EzIndexSettings = {
	indexHeader: '## Directory Index',
	showExtension: false,
};

export default class EzIndexPlugin extends Plugin {
	settings: EzIndexSettings;

	async onload() {
		await this.loadSettings();

		console.log('Loading EzIndex plugin');

		// Add ribbon icon for generating index
		this.addRibbonIcon('list-ordered', 'Generate Folder Index', (evt: MouseEvent) => {
			this.generateFolderIndex();
		});

		// Add command to generate index for current active file's directory
		this.addCommand({
			id: 'generate-folder-index',
			name: 'Generate Index for Current Folder',
			callback: () => {
				this.generateFolderIndex();
			}
		});

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

	async generateFolderIndex() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file selected.');
			return;
		}

		const currentFolder = activeFile.parent;
		if (!currentFolder) {
			new Notice('Could not determine folder for active file.');
			return;
		}

		const files = currentFolder.children.filter(file => file !== activeFile);
		
		let content = `${this.settings.indexHeader}\n\n`;
		for (const file of files) {
			const displayName = this.settings.showExtension ? file.name : file.name.replace(/\.[^/.]+$/, '');
			content += `- [[${file.name}|${displayName}]]\n`;
		}

		new Notice(`Generated index with ${files.length} items.`);
		console.log('EzIndex generated content:', content);
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
			.setDesc('The title/header used when generating an index list')
			.addText(text => text
				.setPlaceholder('## Directory Index')
				.setValue(this.plugin.settings.indexHeader)
				.onChange(async (value) => {
					this.plugin.settings.indexHeader = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show File Extensions')
			.setDesc('Whether to display file extensions in the generated index links')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showExtension)
				.onChange(async (value) => {
					this.plugin.settings.showExtension = value;
					await this.plugin.saveSettings();
				}));
	}
}
