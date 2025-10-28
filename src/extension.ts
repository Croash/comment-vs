// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// 定义脚本项接口
interface ScriptItem {
	label: string;
	variableName: string;
	description: string;
	filePath: string;
	lineNumber: number;
}

// 树形视图提供程序类
class CommentPluginViewProvider implements vscode.TreeDataProvider<ScriptTreeItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<ScriptTreeItem | undefined | void> = new vscode.EventEmitter<ScriptTreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<ScriptTreeItem | undefined | void> = this._onDidChangeTreeData.event;

	private scriptItems: ScriptItem[] = [];

	// 刷新树形视图
	refresh(): void {
		this.scanComments();
		this._onDidChangeTreeData.fire();
	}

	// 获取树项
	getTreeItem(element: ScriptTreeItem): vscode.TreeItem {
		return element;
	}

	// 获取子项
	getChildren(element?: ScriptTreeItem): Thenable<ScriptTreeItem[]> {
		if (!element) {
			// 根节点，返回所有脚本项
			return Promise.resolve(this.scriptItems.map(item => new ScriptTreeItem(
				item.label,
				item.variableName,
				item.description,
				item.filePath,
				item.lineNumber,
				vscode.TreeItemCollapsibleState.None
			)));
		}
		return Promise.resolve([]);
	}

	// 扫描所有注释
	private scanComments(): void {
		this.scriptItems = [];
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			return;
		}

		const config = vscode.workspace.getConfiguration('commentPlugin');
		const includePaths = config.get<string[]>('includePaths', []);
		const excludePaths = config.get<string[]>('excludePaths', ['**/node_modules/**', '**/.git/**']);
		const filePatterns = config.get<string[]>('filePatterns', ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx']);

		// 扫描工作区文件
		workspaceFolders.forEach(folder => {
			this.scanFolder(folder.uri.fsPath, excludePaths, filePatterns);
		});

		// 扫描额外包含的路径
		includePaths.forEach(includePath => {
			if (fs.existsSync(includePath)) {
				this.scanFolder(includePath, [], filePatterns);
			}
		});
	}

	// 扫描文件夹
	private scanFolder(folderPath: string, excludePaths: string[], filePatterns: string[]): void {
		try {
			const files = fs.readdirSync(folderPath);
			files.forEach(file => {
				const filePath = path.join(folderPath, file);
				const stats = fs.statSync(filePath);

				// 检查是否应该排除
				if (this.shouldExclude(filePath, excludePaths)) {
					return;
				}

				if (stats.isDirectory()) {
					this.scanFolder(filePath, excludePaths, filePatterns);
				} else if (stats.isFile() && this.matchesPattern(filePath, filePatterns)) {
					this.scanFile(filePath);
				}
			});
		} catch (error) {
			console.error('扫描文件夹失败:', error);
		}
	}

	// 检查是否应该排除
	private shouldExclude(filePath: string, excludePaths: string[]): boolean {
		return excludePaths.some(excludePath => {
			const regex = this.wildcardToRegex(excludePath);
			return regex.test(filePath);
		});
	}

	// 检查是否匹配文件模式
	private matchesPattern(filePath: string, filePatterns: string[]): boolean {
		return filePatterns.some(pattern => {
			const regex = this.wildcardToRegex(pattern);
			return regex.test(filePath);
		});
	}

	// 通配符转换为正则表达式
	private wildcardToRegex(pattern: string): RegExp {
		const regexString = pattern
			.replace(/\./g, '\\.')
			.replace(/\*/g, '.*')
			.replace(/\?/g, '.');
		return new RegExp(`^${regexString}$`);
	}

	// 扫描文件内容
	private scanFile(filePath: string): void {
		try {
			const content = fs.readFileSync(filePath, 'utf8');
			const lines = content.split('\n');
			const commentPluginRegex = /\/\/\s*comment_plugin\s+add\s*([^\n]*)/;
			// 用于匹配下一行可能的变量声明（enum, const, function, class等）
			const variableDeclarationRegex = /^(?:enum|const|let|var|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/;

			lines.forEach((line, index) => {
				const match = line.match(commentPluginRegex);
				if (match) {
					const label = match[1]?.trim() || '未命名脚本';
					let variableName = label;
					
					// 尝试从下一行提取实际的变量名
					if (index + 1 < lines.length) {
						const nextLine = lines[index + 1].trim();
						const varMatch = nextLine.match(variableDeclarationRegex);
						if (varMatch && varMatch[1]) {
							variableName = varMatch[1];
						}
					}
					
					this.scriptItems.push({
						label,
						variableName,
						description: path.basename(filePath),
						filePath,
						lineNumber: index + 1
					});
				}
			});
		} catch (error) {
			console.error('扫描文件失败:', error);
		}
	}

	// 获取脚本项的相对导入路径
	getRelativeImportPath(filePath: string): string {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			return filePath;
		}

		const activeFilePath = activeEditor.document.uri.fsPath;
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(activeFilePath));

		if (workspaceFolder) {
			const relativePath = path.relative(path.dirname(activeFilePath), filePath);
			// 转换为ES模块导入路径格式
			return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
		}

		return filePath;
	}
}

// 树形项类
class ScriptTreeItem extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		public readonly variableName: string,
		public readonly description: string,
		public readonly filePath: string,
		public readonly lineNumber: number,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(label, collapsibleState);
		this.tooltip = `${this.filePath}:${this.lineNumber}`;
		this.description = description;
		this.contextValue = 'scriptItem';

		// 添加打开文件的命令
		this.command = {
			command: 'vscode.open',
			arguments: [vscode.Uri.file(filePath), { selection: new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0) }],
			title: '打开文件'
		};
	}
}

// 全局视图提供程序实例
let commentPluginViewProvider: CommentPluginViewProvider;

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

	console.log('恭喜，您的扩展 "comment-vs" 已激活！');

	// 创建视图提供程序
	commentPluginViewProvider = new CommentPluginViewProvider();

	// 注册树形视图
	vscode.window.registerTreeDataProvider('commentPluginView', commentPluginViewProvider);

	// 注册刷新命令
	context.subscriptions.push(vscode.commands.registerCommand('commentPlugin.refresh', () => {
		commentPluginViewProvider.refresh();
	}));

	// 注册复制导入路径命令
	context.subscriptions.push(vscode.commands.registerCommand('commentPlugin.copyImport', (item: ScriptTreeItem) => {
		const importPath = commentPluginViewProvider.getRelativeImportPath(item.filePath);
		// 使用实际的变量名作为导入名称
		const importName = item.variableName;
		// 构建完整的import语句
		const fullImportStatement = `import { ${importName} } from "${importPath}"`;
		vscode.env.clipboard.writeText(fullImportStatement).then(() => {
			vscode.window.showInformationMessage(`已复制导入语句: ${fullImportStatement}`);
		});
	}));

	// 注册Hello World命令
	context.subscriptions.push(vscode.commands.registerCommand('comment-vs.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from comment-vs!');
	}));

	// 初始扫描
	commentPluginViewProvider.refresh();

	// 监听文件保存事件，自动刷新
	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(() => {
		commentPluginViewProvider.refresh();
	}));
}

// This method is called when your extension is deactivated
export function deactivate() {}
