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
	private scanStartTime: number = 0;
	private readonly SCAN_TIMEOUT: number = 30000; // 30秒超时
	private isScanning: boolean = false;

	// 扫描所有注释
	private scanComments(progress: vscode.Progress<{message?: string; increment?: number}>): void {
		this.scriptItems = [];
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			return;
		}

		const config = vscode.workspace.getConfiguration('commentPlugin');
		const includePaths = config.get<string[]>('includePaths', []);
		const excludePaths = config.get<string[]>('excludePaths', ['**/node_modules/**', '**/.git/**']);
		const filePatterns = config.get<string[]>('filePatterns', ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx']);

		// 预编译正则表达式以提高性能
		const compiledExcludeRegexes = excludePaths.map(path => this.wildcardToRegex(path));
		const compiledPatternRegexes = filePatterns.map(pattern => this.wildcardToRegex(pattern));

		// 扫描工作区文件
		workspaceFolders.forEach(folder => {
			this.scanFolderWithProgress(folder.uri.fsPath, compiledExcludeRegexes, compiledPatternRegexes, progress);
		});

		// 扫描额外包含的路径
		includePaths.forEach(includePath => {
			if (fs.existsSync(includePath)) {
				this.scanFolderWithProgress(includePath, compiledExcludeRegexes, compiledPatternRegexes, progress);
			}
		});
	}

	// 刷新树形视图
	refresh(): void {
		// 防止重复扫描
		if (this.isScanning) {
			vscode.window.showInformationMessage('扫描正在进行中，请稍后再试');
			return;
		}
		
		this.isScanning = true;
		this.scanStartTime = Date.now();
		
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "注释插件正在扫描文件...",
			cancellable: true
		}, (progress, token) => {
			// 添加超时检测定时器
			const timeoutTimer = setTimeout(() => {
				console.warn('扫描超时，已中断扫描');
				vscode.window.showWarningMessage('扫描超时，可能因项目过大或配置不当导致，请尝试调整excludePaths配置后重新扫描');
			}, this.SCAN_TIMEOUT);

			token.onCancellationRequested(() => {
				clearTimeout(timeoutTimer); // 清除超时定时器
				this.isScanning = false;
				console.log('扫描已取消');
			});

			return new Promise<void>((resolve) => {
				try {
					this.scanComments(progress);
					clearTimeout(timeoutTimer); // 清除超时定时器

					const scanTime = Date.now() - this.scanStartTime;
					console.log(`扫描完成，共扫描到 ${this.scriptItems.length} 个注释，耗时 ${scanTime}ms`);
					
					// 性能统计和提示
					if (scanTime > 10000) { // 如果扫描时间超过10秒
						vscode.window.showInformationMessage(`扫描完成，共找到 ${this.scriptItems.length} 个注释项，耗时 ${Math.round(scanTime/1000)}秒。提示：可以通过适当配置excludePaths来提高扫描速度。`);
					} else {
						// 对于快速扫描，也给予反馈
						vscode.window.showInformationMessage(`扫描完成，共找到 ${this.scriptItems.length} 个注释项`);
					}
				} catch (error) {
					clearTimeout(timeoutTimer); // 清除超时定时器
					console.error('扫描过程中出错:', error);
					vscode.window.showErrorMessage('扫描过程中出错，请查看开发者控制台获取详细信息');
				} finally {
					this.isScanning = false;
					this._onDidChangeTreeData.fire();
					resolve();
				}
			});
		});
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

	// 带进度显示的扫描文件夹方法
	private scanFolderWithProgress(folderPath: string, excludeRegexes: RegExp[], patternRegexes: RegExp[], progress: vscode.Progress<{message?: string; increment?: number}>): void {
		// 检查扫描是否超时
		if (Date.now() - this.scanStartTime > this.SCAN_TIMEOUT) {
			console.warn('扫描超时，已停止扫描');
			return;
		}

		try {
			// 快速检查是否应该排除该文件夹
			if (excludeRegexes.some(regex => regex.test(folderPath))) {
				return;
			}

			const files = fs.readdirSync(folderPath);
			let processed = 0;

			files.forEach(file => {
				// 再次检查超时
				if (Date.now() - this.scanStartTime > this.SCAN_TIMEOUT) {
					return;
				}

				const filePath = path.join(folderPath, file);
				try {
					const stats = fs.statSync(filePath);

					// 检查是否应该排除
					if (excludeRegexes.some(regex => regex.test(filePath))) {
						return;
					}

					if (stats.isDirectory()) {
						// 只扫描合理数量的子目录，避免过深递归
						const depth = filePath.split(path.sep).length - folderPath.split(path.sep).length;
						if (depth < 10) { // 限制最大递归深度
							this.scanFolderWithProgress(filePath, excludeRegexes, patternRegexes, progress);
						}
					} else if (stats.isFile() && stats.size < 1024 * 1024) { // 跳过大于1MB的文件
						// 检查文件模式
						if (patternRegexes.some(regex => regex.test(filePath))) {
							this.scanFile(filePath);
						}
					}
				} catch (error) {
					// 忽略单个文件的错误，继续扫描
				}

				// 更新进度
				processed++;
				if (processed % 100 === 0) {
					progress.report({ message: `扫描中: ${path.basename(filePath)}`, increment: 1 });
				}
			});
		} catch (error) {
			console.error(`扫描文件夹失败: ${folderPath}`, error);
			// 继续扫描其他文件夹
		}
	}

	// 扫描文件夹（保留用于兼容，实际使用scanFolderWithProgress）
	private scanFolder(folderPath: string, excludePaths: string[], filePatterns: string[]): void {
		const excludeRegexes = excludePaths.map(path => this.wildcardToRegex(path));
		const patternRegexes = filePatterns.map(pattern => this.wildcardToRegex(pattern));
		this.scanFolderWithProgress(folderPath, excludeRegexes, patternRegexes, {
			report: () => {}
		});
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
let commentPluginTreeView: vscode.TreeView<ScriptTreeItem>;

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

	console.log('恭喜，您的扩展 "comment-vs" 已激活！');

	// 创建视图提供程序
	commentPluginViewProvider = new CommentPluginViewProvider();

	// 先注册刷新命令
	context.subscriptions.push(vscode.commands.registerCommand('commentPlugin.refresh', () => {
		console.log('刷新命令被调用');
		commentPluginViewProvider.refresh();
	}));

	// 再创建树形视图
	commentPluginTreeView = vscode.window.createTreeView('commentPluginView', {
		treeDataProvider: commentPluginViewProvider,
		showCollapseAll: true
	});

	// 调试：检查视图是否正确创建
	console.log('树形视图已创建:', commentPluginTreeView);

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
}

// This method is called when your extension is deactivated
export function deactivate() {}
