const fs = require('fs');
const path = require('path');

// 模拟插件的通配符转正则功能
function wildcardToRegex(pattern) {
    const regexString = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
    return new RegExp(`^${regexString}$`);
}

// 模拟插件的路径检查逻辑
function checkPathConfiguration() {
    console.log('=== 开始检查路径配置 ===\n');
    
    // 1. 同时检查单数和复数形式的路径
    const pathsToCheck = [
        '/Users/shaopingguo/cnooc-seller-frontend/node_modules/@terminus/cnooc-brick',    // 单数
        '/Users/shaopingguo/cnooc-seller-frontend/node_modules/@terminus/cnooc-bricks'     // 复数
    ];
    
    let validPath = null;
    
    console.log('检查可能的路径:');
    pathsToCheck.forEach((targetPath, index) => {
        const pathExists = fs.existsSync(targetPath);
        const form = index === 0 ? '单数形式' : '复数形式';
        console.log(`[${form}] ${targetPath}`);
        console.log(`  路径是否存在: ${pathExists ? '✓ 存在' : '✗ 不存在'}`);
        
        if (pathExists && validPath === null) {
            validPath = targetPath;
        }
    });
    
    console.log('');
    
    if (!validPath) {
        console.log('❌ 错误: 所有检查的路径都不存在');
        
        // 检查父目录是否存在
        const parentDir = '/Users/shaopingguo/cnooc-seller-frontend/node_modules/@terminus';
        if (fs.existsSync(parentDir)) {
            console.log('\n父目录存在，让我们查看可用的包:');
            try {
                const availablePackages = fs.readdirSync(parentDir);
                console.log('可用的包:');
                availablePackages.forEach(pkg => {
                    console.log(`  - ${pkg}`);
                });
            } catch (error) {
                console.log(`无法读取父目录: ${error.message}`);
            }
        } else {
            console.log('\n父目录也不存在，请检查基本路径是否正确');
        }
        
        return;
    }
    
    console.log(`✅ 找到有效的路径: ${validPath}`);
    
    const targetPath = validPath; // 使用找到的有效路径
    
    // 2. 检查排除路径是否影响
    const excludePaths = ['**/node_modules/**', '**/.git/**'];
    const compiledExcludeRegexes = excludePaths.map(p => wildcardToRegex(p));
    
    console.log('\n=== 排除路径检查 ===');
    console.log(`排除路径配置: ${JSON.stringify(excludePaths)}`);
    
    const isExcluded = compiledExcludeRegexes.some(regex => {
        const matches = regex.test(targetPath);
        console.log(`  - ${regex}: ${matches ? '✓ 匹配 (会被排除)' : '✗ 不匹配'}`);
        return matches;
    });
    
    if (isExcluded) {
        console.log('\n⚠️  警告: 目标路径与排除规则匹配，将被排除扫描');
        console.log('   建议修改配置: "commentPlugin.excludePaths": ["**/.git/**"]');
    }
    
    // 3. 检查文件模式
    const filePatterns = ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'];
    const compiledPatternRegexes = filePatterns.map(p => wildcardToRegex(p));
    
    console.log('\n=== 文件模式检查 ===');
    console.log(`文件模式配置: ${JSON.stringify(filePatterns)}`);
    
    // 4. 测试扫描逻辑（简单实现）
    console.log('\n=== 测试扫描逻辑 ===');
    try {
        // 简单检查目录内容
        const dirContent = fs.readdirSync(targetPath, { withFileTypes: true });
        console.log(`目录包含 ${dirContent.length} 个条目`);
        
        // 显示前5个文件/目录
        console.log('\n前5个条目:');
        dirContent.slice(0, 5).forEach(item => {
            const type = item.isDirectory() ? '目录' : '文件';
            console.log(`  - ${item.name} (${type})`);
        });
        
        if (dirContent.length > 0) {
            console.log('\n✅ 路径访问正常');
        }
    } catch (error) {
        console.log(`\n❌ 访问目录时出错: ${error.message}`);
        console.log('   检查是否有访问权限问题');
    }
    
    // 5. 提供配置建议
    console.log('\n=== 推荐配置 ===');
    console.log('将以下配置添加到工作区 settings.json:');
    console.log(JSON.stringify({
        "commentPlugin.includePaths": [
            targetPath
        ],
        "commentPlugin.excludePaths": [
            "**/.git/**"
        ],
        "commentPlugin.filePatterns": [
            "**/*.js", "**/*.ts", "**/*.jsx", "**/*.tsx"
        ]
    }, null, 2));
}

// 执行检查
checkPathConfiguration();