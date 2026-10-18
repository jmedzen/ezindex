import { moment } from 'obsidian';

export type UiLanguage = 'auto' | 'en' | 'zh-tw';
export type ResolvedLanguage = 'en' | 'zh-tw';

/** 說明文字片段：字串直接輸出，{ code } 會以 <code> 標籤呈現。 */
export type Segment = string | { code: string };
export type Segments = Segment[];

export const DEFAULT_UI_LANGUAGE: UiLanguage = 'auto';

/**
 * 讀取 Obsidian 目前的介面語言。
 * moment.locale() 會隨 Obsidian 的語言設定變動，是外掛偵測語言的標準做法。
 */
export function detectObsidianLanguage(): ResolvedLanguage {
	try {
		const locale = String(moment.locale() ?? '').toLowerCase();
		if (locale.startsWith('zh')) {
			// 目前僅提供繁體中文；zh-cn 等其他中文語系一併歸到 zh-tw。
			return 'zh-tw';
		}
	} catch {
		// 取不到就退回英文，避免設定頁因偵測失敗而空白。
	}
	return 'en';
}

export function resolveLanguage(preference: UiLanguage): ResolvedLanguage {
	if (preference === 'en' || preference === 'zh-tw') {
		return preference;
	}
	return detectObsidianLanguage();
}

export interface UiStrings {
	language: {
		name: string;
		desc: string;
		auto: string;
		autoSuffix: string;
	};
	sections: {
		target: string;
		preview: string;
		content: string;
		filter: string;
		run: string;
		language: string;
	};
	target: {
		name: string;
		desc: (count: number) => Segments;
		vaultRootOption: string;
	};
	location: {
		name: string;
		desc: string;
		inFolder: string;
		vaultRoot: string;
		customFolder: string;
	};
	customPath: {
		name: string;
		desc: Segments;
		placeholder: string;
	};
	filename: {
		name: string;
		desc: Segments;
		placeholder: string;
	};
	previewSetting: {
		name: string;
		desc: string;
	};
	preview: {
		output: string;
		filename: string;
		fullPath: string;
		status: string;
		create: string;
		overwrite: string;
		skip: string;
		isFolder: string;
		hintsExcluded: (count: number) => string;
		hintCustomFolder: string;
		hintSeparator: string;
	};
	header: {
		name: string;
		desc: Segments;
		placeholder: string;
	};
	extension: {
		name: string;
		desc: Segments;
	};
	exclude: {
		name: string;
		desc: Segments;
		placeholder: string;
	};
	overwrite: {
		name: string;
		desc: string;
	};
	run: {
		name: string;
		desc: string;
		button: string;
	};
	modal: {
		title: string;
		folderName: string;
		folderDesc: string;
		filenameName: string;
		filenameDesc: string;
		button: string;
	};
	notices: {
		pickTargetFolder: string;
		pickFolder: string;
		noActiveFile: string;
		noActiveFolder: string;
		created: (path: string, count: number) => string;
		updated: (path: string, count: number) => string;
		exists: (path: string) => string;
		createFolderFailed: (path: string) => string;
	};
	/** resolveIndexTarget 產生的位置描述 */
	locationLabel: {
		vaultRoot: string;
		customFolder: (path: string) => string;
		customUnset: string;
		inFolder: (path: string) => string;
		inVaultRoot: string;
	};
}

const EN: UiStrings = {
	language: {
		name: 'Description language',
		desc: 'Follow the Obsidian interface language by default, or force one language. This only affects the wording in this settings page, not your notes.',
		auto: 'Follow Obsidian interface',
		autoSuffix: 'auto',
	},
	sections: {
		target: 'Target & Output',
		preview: 'Output Preview',
		content: 'Index Content',
		filter: 'Filtering & Overwrite',
		run: 'Run',
		language: 'Descriptions',
	},
	target: {
		name: 'Target directory',
		desc: (count) => [
			'The folder to index. Every subfolder and file inside it is collected into a single index note. ',
			{ code: String(count) },
			' folders available.',
		],
		vaultRootOption: '/ (Vault root)',
	},
	location: {
		name: 'Index location',
		desc: 'Which folder the index note is written to. This does not change what gets indexed.',
		inFolder: 'Inside the target folder',
		vaultRoot: 'Vault root',
		customFolder: 'Custom folder',
	},
	customPath: {
		name: 'Custom folder path',
		desc: [
			'Path relative to the vault root, for example ',
			{ code: 'Indices' },
			' or ',
			{ code: 'Archive/Indices' },
			'. The folder is created automatically if it does not exist.',
		],
		placeholder: 'Indices',
	},
	filename: {
		name: 'Index filename',
		desc: [
			'Use ',
			{ code: '{{folderName}}' },
			' to insert the target folder name, for example ',
			{ code: '{{folderName}}-Index.md' },
			'. ',
			{ code: '.md' },
			' is appended automatically when omitted.',
		],
		placeholder: '_Index.md',
	},
	previewSetting: {
		name: 'Resulting index note',
		desc: 'Calculated live from the settings above. This is exactly the path that will be written.',
	},
	preview: {
		output: 'Location',
		filename: 'Filename',
		fullPath: 'Full path',
		status: 'Status',
		create: 'Not created yet — will be created',
		overwrite: 'Already exists — will be overwritten',
		skip: 'Already exists — overwrite is off, will be skipped',
		isFolder: 'A folder already uses this path — cannot write',
		hintsExcluded: (count) => `${count} exclusion rule(s) active`,
		hintCustomFolder: 'Custom folder does not exist yet and will be created on run',
		hintSeparator: '  ·  ',
	},
	header: {
		name: 'Index header',
		desc: [
			'A single line placed at the very top of the index note, usually a Markdown heading such as ',
			{ code: '# Contents' },
			' or ',
			{ code: '## Book Index' },
			'. Leave empty for no header.',
		],
		placeholder: '# Directory Index',
	},
	extension: {
		name: 'Show file extensions',
		desc: [
			'On, links read ',
			{ code: 'note.md' },
			'; off, they read ',
			{ code: 'note' },
			'. Display only — links keep working either way.',
		],
	},
	exclude: {
		name: 'Exclude list',
		desc: [
			'Separate with commas or newlines. Accepts file names, folder names or extensions, matched case-insensitively. For example ',
			{ code: 'templates, archive, .png' },
			'. Leave empty to exclude nothing.',
		],
		placeholder: 'templates, archive, .png',
	},
	overwrite: {
		name: 'Overwrite existing index',
		desc: 'When off, an existing index note with the same name is left untouched — useful if you edit it by hand. When on, it is regenerated and replaced every run.',
	},
	run: {
		name: 'Generate index now',
		desc: 'Builds the index note for the target folder selected above, using the current settings.',
		button: '🚀 Generate index',
	},
	modal: {
		title: 'EzIndex — Generate Index',
		folderName: 'Target directory',
		folderDesc: 'Choose the folder to build an index for.',
		filenameName: 'Index filename',
		filenameDesc: 'Supports the {{folderName}} placeholder.',
		button: '🚀 Generate index',
	},
	notices: {
		pickTargetFolder: 'Please choose a target directory first.',
		pickFolder: 'Please choose a directory first.',
		noActiveFile: 'EzIndex: No active file selected.',
		noActiveFolder: 'EzIndex: Could not determine the folder for the active file.',
		created: (path, count) => `EzIndex: Created index note at "${path}" (${count} files indexed).`,
		updated: (path, count) => `EzIndex: Updated index note at "${path}" (${count} files indexed).`,
		exists: (path) => `EzIndex: Index note "${path}" already exists (overwrite disabled).`,
		createFolderFailed: (path) => `EzIndex: Could not create the folder "${path}".`,
	},
	locationLabel: {
		vaultRoot: 'Vault root',
		customFolder: (path) => `Custom folder: ${path}`,
		customUnset: 'Custom folder is not set — writing to the vault root',
		inFolder: (path) => `Inside target folder: ${path}`,
		inVaultRoot: 'Inside target folder: vault root',
	},
};

const ZH_TW: UiStrings = {
	language: {
		name: '說明語言 (Description language)',
		desc: '預設跟隨 Obsidian 介面語言，也可固定使用一種語言。此設定只影響本設定頁的說明文字，不影響你的筆記內容。',
		auto: '跟隨 Obsidian 介面語言',
		autoSuffix: '自動',
	},
	sections: {
		target: '目標與輸出 (Target & Output)',
		preview: '輸出路徑預覽 (Output Preview)',
		content: '索引內容 (Index Content)',
		filter: '篩選與覆寫 (Filtering & Overwrite)',
		run: '執行 (Run)',
		language: '說明文字 (Descriptions)',
	},
	target: {
		name: '目標目錄 (Target directory)',
		desc: (count) => [
			'要建立索引的資料夾；其所有子資料夾與檔案都會被收進同一份索引。共 ',
			{ code: String(count) },
			' 個資料夾可選。',
		],
		vaultRootOption: '/ (Vault 根目錄)',
	},
	location: {
		name: '索引存放位置 (Index location)',
		desc: '索引筆記要寫入哪個資料夾，不影響索引收錄的內容範圍。',
		inFolder: '與目標資料夾相同',
		vaultRoot: 'Vault 根目錄',
		customFolder: '自訂資料夾',
	},
	customPath: {
		name: '自訂資料夾路徑 (Custom folder path)',
		desc: [
			'相對於 Vault 根目錄的路徑，例如 ',
			{ code: 'Indices' },
			' 或 ',
			{ code: '大覺藏集/索引' },
			'。資料夾不存在時，執行會自動建立。',
		],
		placeholder: 'Indices',
	},
	filename: {
		name: '索引檔名 (Index filename)',
		desc: [
			'可用 ',
			{ code: '{{folderName}}' },
			' 代入目標資料夾名稱，例如 ',
			{ code: '{{folderName}}-索引.md' },
			'。省略 ',
			{ code: '.md' },
			' 時會自動補上。',
		],
		placeholder: '_Index.md',
	},
	previewSetting: {
		name: '即將產生的索引筆記 (Resulting index note)',
		desc: '依上方設定即時計算；實際寫入的就是這個路徑。',
	},
	preview: {
		output: '輸出位置',
		filename: '檔名',
		fullPath: '完整路徑',
		status: '狀態',
		create: '尚未建立，執行時將新建',
		overwrite: '已存在，執行時將覆寫',
		skip: '已存在，覆寫已關閉，執行時將略過',
		isFolder: '同名路徑是資料夾，無法寫入',
		hintsExcluded: (count) => `排除清單 ${count} 項生效中`,
		hintCustomFolder: '自訂資料夾尚未存在，執行時會自動建立',
		hintSeparator: ' ｜ ',
	},
	header: {
		name: '索引標題 (Index header)',
		desc: [
			'寫在索引筆記最上方的一行，通常使用 Markdown 標題，例如 ',
			{ code: '# 目錄' },
			' 或 ',
			{ code: '## 大覺藏集目錄' },
			'。留空則不顯示標題。',
		],
		placeholder: '# Directory Index',
	},
	extension: {
		name: '顯示副檔名 (Show file extensions)',
		desc: [
			'開啟時連結顯示 ',
			{ code: 'note.md' },
			'；關閉時只顯示 ',
			{ code: 'note' },
			'。僅影響顯示，連結仍可正常開啟。',
		],
	},
	exclude: {
		name: '排除清單 (Exclude list)',
		desc: [
			'以逗號或換行分隔，可填檔名、資料夾名稱或副檔名，比對不分大小寫。例如 ',
			{ code: 'z-附件, .png, .jpg' },
			'。留空表示不排除任何項目。',
		],
		placeholder: 'templates, z-附件, .png',
	},
	overwrite: {
		name: '覆寫既有索引 (Overwrite existing index)',
		desc: '關閉後，若同名索引筆記已存在就略過不寫入，適合手動編輯過的索引；開啟則每次重新產生並覆蓋。',
	},
	run: {
		name: '立即建立索引 (Generate index now)',
		desc: '依目前設定，為上方選取的目標目錄產生索引筆記。',
		button: '🚀 建立索引',
	},
	modal: {
		title: 'EzIndex － 建立目錄索引',
		folderName: '目標目錄 (Target directory)',
		folderDesc: '請選擇要建立索引的目錄。',
		filenameName: '索引檔名 (Index filename)',
		filenameDesc: '支援 {{folderName}} 動態資料夾名稱替代變數。',
		button: '🚀 執行建立索引',
	},
	notices: {
		pickTargetFolder: '請先選擇一個目標目錄！',
		pickFolder: '請先選擇一個目錄！',
		noActiveFile: 'EzIndex: 未選取任何檔案。',
		noActiveFolder: 'EzIndex: 無法判定目前檔案所屬的資料夾。',
		created: (path, count) => `EzIndex: 已建立索引筆記「${path}」（收錄 ${count} 個檔案）。`,
		updated: (path, count) => `EzIndex: 已更新索引筆記「${path}」（收錄 ${count} 個檔案）。`,
		exists: (path) => `EzIndex: 索引筆記「${path}」已存在（覆寫已關閉）。`,
		createFolderFailed: (path) => `EzIndex: 無法建立資料夾「${path}」。`,
	},
	locationLabel: {
		vaultRoot: 'Vault 根目錄',
		customFolder: (path) => `自訂資料夾：${path}`,
		customUnset: '自訂資料夾未設定，將寫入 Vault 根目錄',
		inFolder: (path) => `目標資料夾內：${path}`,
		inVaultRoot: '目標資料夾內：Vault 根目錄',
	},
};

export function getStrings(language: ResolvedLanguage): UiStrings {
	return language === 'zh-tw' ? ZH_TW : EN;
}
