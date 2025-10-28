# 注释插件使用配置指南

本文档详细介绍注释插件的配置选项、使用方法和默认设置，帮助您充分利用该插件的功能。

## 插件功能概述

该插件可以扫描项目中的JavaScript/TypeScript文件，识别带有特殊注释标记的代码片段，并在侧边栏提供导入路径快速复制功能。特别支持：

- 自动识别注释下的变量名
- 支持生成相对路径导入语句
- 支持扫描和导入node_modules中的模块
- 自动生成正确的包名导入格式

## 默认配置

插件默认配置如下：

### 默认排除路径 (excludePaths)

```javascript
{
  "commentPlugin.excludePaths": ["**/node_modules/**", "**/.git/**"]
}
```

这意味着插件默认不会扫描node_modules和.git目录下的文件，以提高性能。

### 默认文件模式 (filePatterns)

```javascript
{
  "commentPlugin.filePatterns": ["**/*.js", "**/*.ts", "**/*.jsx", "**/*.tsx"]
}
```

插件默认扫描.js、.ts、.jsx和.tsx文件。

### 默认包含路径 (includePaths)

```javascript
{
  "commentPlugin.includePaths": []
}
```

默认不包含额外的路径。

## 配置方法

### 在VS Code设置中配置

1. 打开VS Code设置（使用快捷键 `Cmd+,` 或 `Ctrl+,`）
2. 搜索 `commentPlugin` 配置项
3. 根据需要编辑相应的配置参数

### 在settings.json中手动配置

打开设置文件（`settings.json`），添加以下配置：

```json
{
  "commentPlugin.includePaths": [],
  "commentPlugin.excludePaths": ["**/node_modules/**", "**/.git/**"],
  "commentPlugin.filePatterns": ["**/*.js", "**/*.ts", "**/*.jsx", "**/*.tsx"]
}
```

## 详细配置说明

### 1. commentPlugin.includePaths

- **类型**: 字符串数组
- **默认值**: `[]`
- **说明**: 额外包含的文件路径，支持绝对路径
- **特殊功能**: 即使在默认excludePaths中排除的目录（如node_modules），如果添加到includePaths中也会被扫描

#### 示例 - 包含node_modules中的特定包

```json
{
  "commentPlugin.includePaths": [
    "/absolute/path/to/your/project/node_modules/some-package/src",
    "/absolute/path/to/your/project/node_modules/@scope/some-scoped-package/lib"
  ]
}
```

### 2. commentPlugin.excludePaths

- **类型**: 字符串数组
- **默认值**: `["**/node_modules/**", "**/.git/**"]`
- **说明**: 排除的文件路径，使用glob模式匹配

#### 示例 - 添加额外的排除路径

```json
{
  "commentPlugin.excludePaths": ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"]
}
```

### 3. commentPlugin.filePatterns

- **类型**: 字符串数组
- **默认值**: `["**/*.js", "**/*.ts", "**/*.jsx", "**/*.tsx"]`
- **说明**: 要扫描的文件模式，使用glob模式匹配

#### 示例 - 添加支持Vue文件

```json
{
  "commentPlugin.filePatterns": ["**/*.js", "**/*.ts", "**/*.jsx", "**/*.tsx", "**/*.vue"]
}
```

## 使用方法

### 1. 标记可导入的脚本

在您的代码中，使用注释标记需要被插件识别的脚本片段：

```javascript
// comment_plugin add 测试枚举
export enum testEnum2 {
  Success = 'success',
  Error = 'error'
}
```

或

```javascript
// comment_plugin add 工具函数
export function formatDate(date: Date): string {
  return date.toISOString();
}
```

### 2. 在侧边栏查看和使用

1. 在VS Code侧边栏中找到"注释插件"视图
2. 展开文件列表，找到您标记的代码片段
3. 右键点击列表项，选择"复制导入语句"
4. 插件会自动生成完整的import语句并复制到剪贴板

### 3. 手动刷新

插件支持以下手动刷新方式：
- 点击侧边栏中的"刷新"按钮（位于视图右上角的旋转箭头图标）
- 执行"注释插件: 刷新"命令（可通过命令面板`Cmd+Shift+P`或`Ctrl+Shift+P`搜索该命令）
- 重启VS Code编辑器后会自动重新扫描一次

## node_modules支持特殊说明

### 配置node_modules目录扫描

要扫描node_modules中的特定目录，请按照以下步骤操作：

1. 确定您想要扫描的node_modules包的绝对路径
2. 将该路径添加到`commentPlugin.includePaths`配置中
3. 点击侧边栏的刷新按钮重新扫描

### 自动包名提取

插件会自动从node_modules路径中提取正确的包名：

- 对于标准包：`node_modules/some-package/src/utils.js` → `import { xxx } from "some-package"`
- 对于作用域包：`node_modules/@scope/package/lib/constants.js` → `import { xxx } from "@scope/package"`

## 调试技巧

如果您遇到问题，可以通过以下方式调试：

1. 打开VS Code开发者工具（Help > Toggle Developer Tools）
2. 在控制台中查看扫描日志，确认路径是否被正确扫描
3. 检查配置中的路径是否为绝对路径
4. 确保您的代码注释格式正确

## 性能优化建议

为了保持插件性能，建议：

1. **避免添加整个node_modules目录**：只添加您实际需要的特定包目录
2. **使用具体的子目录**：例如，使用`/path/to/node_modules/package/src`而不是`/path/to/node_modules/package`
3. **适当配置commentPlugin.excludePaths**：根据项目结构排除不必要的目录

## 常见问题解答

**Q: 为什么我的node_modules包没有显示在侧边栏？**

A: 请检查是否正确配置了commentPlugin.includePaths，确保使用绝对路径，并且路径存在。

**Q: 注释格式有什么要求？**

A: 请使用`// comment_plugin add 注释内容`格式，并且确保注释后的下一行是变量、函数、类或枚举的声明。

**Q: 如何查看插件的扫描日志？**
A: 打开VS Code开发者工具的控制台（Help > Toggle Developer Tools），插件会输出扫描的路径信息。

**Q: 我想修改扫描的文件类型，应该如何配置？**

A: 在VS Code设置中修改`commentPlugin.filePatterns`配置项，添加或移除需要的文件类型。

**Q: 导入语句中为什么使用的是变量名而不是注释名称？**
A: 这是插件的设计，为了确保生成的导入语句能够正确工作，使用实际的变量名而不是注释标签。

**Q: 插件更新后，之前使用旧关键词的注释还能识别吗？**

A: 不能，插件已更新为使用`comment_plugin`作为关键词，请将旧的注释格式更新为新格式。

## 版本历史

- 支持从注释下一行提取实际变量名作为导入名称
- 将关键词从`script_plugin`更改为`comment_plugin`，更准确地反映插件功能
- 更新配置项前缀为`commentPlugin`，统一术语体系
- 增强node_modules路径支持，自动提取正确的包名导入格式
- 优化includePaths扫描逻辑，允许扫描默认排除的目录