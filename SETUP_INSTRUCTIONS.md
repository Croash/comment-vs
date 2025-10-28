# 注释插件设置指南

## 重要说明

如果您是在 **cnooc-seller-frontend** 项目中使用注释插件，请按照以下步骤进行正确配置：

## 正确的配置步骤

1. **打开您的实际项目**：
   - 打开 VS Code
   - 打开 `cnooc-seller-frontend` 项目文件夹

2. **在实际项目中添加配置**：
   - 打开 VS Code 设置（快捷键 `Cmd+,` 或点击菜单：Code -> Preferences -> Settings）
   - 切换到「工作区」选项卡（而不是「用户」选项卡）
   - 点击右上角的「打开设置(JSON)」图标

3. **添加以下配置到您的项目 `settings.json` 文件**：
   
```json
{
    "commentPlugin.includePaths": [
        "/Users/shaopingguo/cnooc-seller-frontend/node_modules/@terminus/cnooc-bricks"
    ],
    "commentPlugin.excludePaths": [
        "**/.git/**"
    ],
    "commentPlugin.filePatterns": [
        "**/*.js",
        "**/*.ts",
        "**/*.jsx",
        "**/*.tsx"
    ]
}
```

## 为什么之前的配置没有生效？

之前我们错误地在插件开发项目（`comment-plugin/comment-vs`）的 `.vscode/settings.json` 中添加了配置，这只会影响插件的开发环境，而不会影响插件在您实际项目中的运行行为。

VS Code 插件的配置必须添加到：
1. **用户设置**（全局生效）
2. **工作区设置**（仅当前项目生效）- 推荐使用这个

## 验证配置是否正确

添加配置后：
1. 重新启动 VS Code
2. 打开 `cnooc-seller-frontend` 项目
3. 点击插件的刷新按钮
4. 检查树形视图是否显示了 `cnooc-bricks` 中的注释（例如："注释内容ff"）

## 故障排除

如果仍然无法看到注释，请确认：
1. 路径 `/Users/shaopingguo/cnooc-seller-frontend/node_modules/@terminus/cnooc-bricks` 确实存在
2. 目录中有包含 `// comment_plugin add` 格式注释的文件
3. 没有其他排除规则阻止了扫描

需要任何帮助，请随时联系插件开发者。