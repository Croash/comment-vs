const fs = require('fs');
const path = require('path');

// 模拟插件的正则表达式
const commentPluginRegex = /\/\/\s*comment_plugin\s+add\s*([^\n]*)/;
const variableDeclarationRegex = /^(?:enum|const|let|var|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/;

// 测试路径
const testPath = '/Users/shaopingguo/cnooc-seller-frontend/node_modules/@terminus/cnooc-bricks';
console.log(`=== 开始诊断注释扫描问题 ===`);
console.log(`测试路径: ${testPath}`);

// 1. 检查路径是否存在
if (!fs.existsSync(testPath)) {
    console.error(`❌ 错误: 路径 ${testPath} 不存在`);
    process.exit(1);
}

console.log(`✅ 路径存在，开始扫描...`);

// 2. 查找所有包含注释的文件
const foundComments = [];
const filesScanned = new Set();

function scanFolder(folderPath) {
    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);
            
            if (entry.isDirectory()) {
                // 跳过node_modules中的node_modules目录
                if (entry.name === 'node_modules') continue;
                // 限制递归深度
                const depth = fullPath.split(path.sep).length - testPath.split(path.sep).length;
                if (depth < 10) {
                    scanFolder(fullPath);
                }
            } else if (entry.isFile() && 
                      ['.js', '.ts', '.jsx', '.tsx'].some(ext => fullPath.endsWith(ext))) {
                
                filesScanned.add(fullPath);
                
                try {
                    const stats = fs.statSync(fullPath);
                    if (stats.size > 1024 * 1024) continue; // 跳过大于1MB的文件
                    
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const lines = content.split('\n');
                    
                    lines.forEach((line, index) => {
                        // 检查多种可能的注释格式变体
                        const variants = [
                            line.match(commentPluginRegex),
                            line.match(/\/\/\s*comment_plugin\s*add\s*([^\n]*)/), // 没有空格
                            line.match(/\/\/\s*comment_plugin\s+ADD\s*([^\n]*)/), // 大写
                            line.match(/\/\*\s*comment_plugin\s+add\s*([^\n\*]*)/) // 多行注释开始
                        ];
                        
                        const match = variants.find(v => v !== null);
                        if (match) {
                            const label = match[1]?.trim() || '未命名脚本';
                            let variableName = label;
                            
                            // 尝试从下一行提取变量名
                            if (index + 1 < lines.length) {
                                const nextLine = lines[index + 1].trim();
                                const varMatch = nextLine.match(variableDeclarationRegex);
                                if (varMatch && varMatch[1]) {
                                    variableName = varMatch[1];
                                }
                            }
                            
                            foundComments.push({
                                filePath: fullPath,
                                lineNumber: index + 1,
                                lineContent: line,
                                label,
                                variableName,
                                match: match[0]
                            });
                        }
                    });
                } catch (err) {
                    // console.error(`读取文件失败: ${fullPath}`, err);
                }
            }
        }
    } catch (err) {
        // console.error(`扫描文件夹失败: ${folderPath}`, err);
    }
}

// 执行扫描
console.time('扫描耗时');
scanFolder(testPath);
console.timeEnd('扫描耗时');

// 输出结果
console.log(`\n=== 扫描结果 ===`);
console.log(`扫描了 ${filesScanned.size} 个文件`);
console.log(`找到 ${foundComments.length} 个注释`);

if (foundComments.length > 0) {
    console.log(`\n找到的注释详情:`);
    foundComments.forEach((comment, index) => {
        console.log(`${index + 1}. 文件: ${path.relative(testPath, comment.filePath)}`);
        console.log(`   行号: ${comment.lineNumber}`);
        console.log(`   内容: ${comment.lineContent}`);
        console.log(`   标签: ${comment.label}`);
        console.log(`   变量名: ${comment.variableName}`);
        console.log(`   匹配文本: ${comment.match}`);
        console.log('---');
    });
    
    // 模拟导入路径生成
    const mockActiveFile = '/Users/shaopingguo/cnooc-seller-frontend/src/App.js'; // 模拟当前活动文件
    console.log(`\n=== 导入路径生成测试 ===`);
    console.log(`模拟当前文件: ${mockActiveFile}`);
    
    foundComments.forEach((comment, index) => {
        const relativePath = path.relative(path.dirname(mockActiveFile), comment.filePath);
        const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
        const importStatement = `import { ${comment.variableName} } from "${importPath}"`;
        console.log(`${index + 1}. ${importStatement}`);
    });
} else {
    console.log('\n❌ 未找到任何注释，请检查注释格式是否正确。');
    console.log('正确格式应为: // comment_plugin add [标签名]');
    
    // 显示一些示例文件的内容进行调试
    const sampleFiles = Array.from(filesScanned).slice(0, 3); // 只检查前3个文件
    console.log('\n=== 示例文件内容检查 ===');
    
    sampleFiles.forEach(filePath => {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            // 查找任何包含"comment"的行
            const commentLines = content.split('\n').filter(line => 
                line.toLowerCase().includes('comment') || line.includes('plugin')
            );
            
            if (commentLines.length > 0) {
                console.log(`文件: ${path.relative(testPath, filePath)}`);
                commentLines.slice(0, 5).forEach(line => {
                    console.log(`  ${line}`);
                });
                console.log('---');
            }
        } catch (err) {
            // 忽略错误
        }
    });
}

// 检查VS Code设置是否正确配置
const vscodeSettingsPath = path.join(__dirname, '.vscode', 'settings.json');
if (fs.existsSync(vscodeSettingsPath)) {
    try {
        const settingsContent = fs.readFileSync(vscodeSettingsPath, 'utf8');
        const settings = JSON.parse(settingsContent);
        console.log('\n=== VS Code设置检查 ===');
        console.log(`includePaths配置: ${JSON.stringify(settings['commentPlugin.includePaths'] || [])}`);
        console.log(`excludePaths配置: ${JSON.stringify(settings['commentPlugin.excludePaths'] || [])}`);
        console.log(`filePatterns配置: ${JSON.stringify(settings['commentPlugin.filePatterns'] || [])}`);
    } catch (err) {
        console.log('\n无法读取VS Code设置文件');
    }
}