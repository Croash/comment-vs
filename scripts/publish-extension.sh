#!/usr/bin/env bash
set -e

# 脚本：用 pnpm 管理依赖，但用 npm 结构打包 VSCode 插件
# 支持安全的发布流程和错误处理
# --------------------------------------------

# 计算项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 切换到项目根目录
cd "$PROJECT_ROOT" || {
    echo "❌ 错误: 无法进入项目根目录: $PROJECT_ROOT"
    exit 1
}

# 检查必要的工具是否安装
check_dependencies() {
    echo "🔍 检查依赖工具..."
    if ! command -v pnpm &> /dev/null; then
        echo "❌ 错误: pnpm 未安装，请先安装 pnpm"
        exit 1
    fi
    
    # 检查 vsce 是否安装，未安装则安装
    if ! command -v vsce &> /dev/null; then
        echo "⚠️ vsce 未安装，正在全局安装..."
        npm install -g vsce
        if [ $? -ne 0 ]; then
            echo "❌ 错误: vsce 安装失败"
            exit 1
        fi
    fi
}

# 获取发布者信息
read_publisher_info() {
    # 尝试从 package.json 获取发布者信息
    if [ -f "package.json" ]; then
        PUBLISHER=$(grep -o '"publisher":\s*"[^"]*"' package.json | grep -o '[^"]*"$' | tr -d '"')
        if [ -n "$PUBLISHER" ]; then
            echo "ℹ️  从 package.json 获取发布者: $PUBLISHER"
            return 0
        fi
    fi
    
    # 如果未找到，从环境变量获取或提示用户输入
    if [ -z "$VSCODE_PUBLISHER" ]; then
        echo -n "请输入 VS Code 发布者 ID: "
        read PUBLISHER
        export VSCODE_PUBLISHER=$PUBLISHER
    else
        PUBLISHER=$VSCODE_PUBLISHER
        echo "ℹ️  从环境变量获取发布者: $PUBLISHER"
    fi
    
    return 0
}

# 清理旧的临时目录并创建新目录
setup_temp_directory() {
    echo "🧹 清理旧打包目录..."
    rm -rf temp-dist
    mkdir -p temp-dist
    if [ $? -ne 0 ]; then
        echo "❌ 错误: 创建临时目录失败"
        exit 1
    fi
}

# 复制必要文件到临时目录
copy_necessary_files() {
    echo "📦 复制必要文件..."
    cp package.json temp-dist/
    cp -r src temp-dist/
    [ -d out ] && cp -r out temp-dist/
    # 重要：复制 dist 目录，因为 main 字段指向 dist/extension.js
    [ -d dist ] && cp -r dist temp-dist/
    [ -f tsconfig.json ] && cp tsconfig.json temp-dist/
    [ -d media ] && cp -r media temp-dist/
    [ -f README.md ] && cp README.md temp-dist/
    [ -f LICENSE ] && cp LICENSE temp-dist/
    [ -f CHANGELOG.md ] && cp CHANGELOG.md temp-dist/
    [ -f .vscodeignore ] && cp .vscodeignore temp-dist/
    # 复制构建脚本
    [ -f esbuild.js ] && cp esbuild.js temp-dist/
}

# 在临时目录中准备 npm 环境
prepare_npm_environment() {
    cd temp-dist
    
    echo "🔧 生成 npm lock 文件（不会影响 pnpm）..."
    pnpm dlx npm install --package-lock-only
    if [ $? -ne 0 ]; then
        echo "❌ 错误: 生成 npm lock 文件失败"
        exit 1
    fi
    
    echo "📥 安装所有依赖（包括开发依赖）..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 错误: 安装 npm 依赖失败"
        exit 1
    fi
    
    echo "🏗️  构建扩展..."
    # 首先检查 dist 目录是否已经存在且包含必要文件
    if [ -d "dist" ] && [ -f "dist/extension.js" ]; then
        echo "✅ dist 目录已存在且包含必要文件，跳过构建"
    else
        # 强制使用 esbuild.js 进行构建，因为这是项目的构建方式
        if [ -f "esbuild.js" ]; then
            echo "🔨 使用 esbuild.js 进行构建..."
            node esbuild.js
        elif grep -q "compile" package.json; then
            echo "🔨 使用 npm run compile 进行构建..."
            npm run compile
        elif grep -q "build" package.json; then
            echo "🔨 使用 npm run build 进行构建..."
            npm run build
        else
            echo "⚠️  未找到明确的构建命令，尝试使用 tsc 直接编译"
            npx tsc
        fi
        
        if [ $? -ne 0 ]; then
            echo "❌ 错误: 构建扩展失败"
            # 检查是否需要特定的 Node.js 版本或其他构建依赖
            echo "🔍 尝试使用 TypeScript 直接编译..."
            mkdir -p dist
            npx tsc -p tsconfig.json
            if [ $? -ne 0 ]; then
                echo "❌ 错误: TypeScript 编译也失败了"
                exit 1
            fi
        fi
        
        # 验证构建结果
        if [ ! -f "dist/extension.js" ]; then
            echo "❌ 错误: 构建后未找到 dist/extension.js 文件"
            echo "📂 检查当前目录结构..."
            find . -type f -name "*.js" | grep -v "node_modules"
            exit 1
        else
            echo "✅ 构建成功，验证到 dist/extension.js 存在"
        fi
    fi
}

# 检查 package.json main 字段是否正确
check_package_json_main() {
    # 保存当前目录
    CURRENT_DIR=$(pwd)
    
    echo "🔍 检查 package.json main 字段..."
    
    # 确保临时目录存在
    if [ ! -d "$PROJECT_ROOT/temp-dist" ]; then
        echo "⚠️  警告: temp-dist 目录不存在，请先运行 setup_temp_directory 和 copy_necessary_files"
        echo "📁 创建临时目录..."
        mkdir -p "$PROJECT_ROOT/temp-dist"
    fi
    
    # 进入临时目录
    cd "$PROJECT_ROOT/temp-dist" || {
        echo "❌ 错误: 无法进入临时目录 temp-dist: $PROJECT_ROOT/temp-dist"
        echo "📂 项目根目录内容:"
        ls -la "$PROJECT_ROOT"
        exit 1
    }
    
    # 确保 package.json 存在
    if [ ! -f "package.json" ]; then
        echo "❌ 错误: 临时目录中找不到 package.json 文件"
        echo "📂 临时目录内容:"
        ls -la
        exit 1
    fi
    
    # 使用 Node.js 获取 main 字段以确保正确性
    MAIN_ENTRY=$(node -e "try { console.log(require('./package.json').main); } catch(e) { console.log(''); }")
    
    if [ -z "$MAIN_ENTRY" ]; then
        echo "⚠️  警告: 无法从 package.json 获取 main 字段，尝试使用默认值"
        MAIN_ENTRY="./dist/extension.js"
        # 设置默认的 main 字段
        sed -i '' 's|"main":\s*"[^"]*"|"main": "./dist/extension.js"|g' package.json
        echo "✅ 已设置默认 main 字段为: ./dist/extension.js"
    fi
    
    echo "📄 当前 main 字段: $MAIN_ENTRY"
    
    # 确保 dist 目录存在
    if [ ! -d "dist" ]; then
        echo "⚠️  警告: dist 目录不存在，创建它..."
        mkdir -p dist
    fi
    
    # 简化逻辑：强制检查 dist/extension.js 文件
    if [ ! -f "dist/extension.js" ]; then
        echo "❌ 错误: 未找到 dist/extension.js 文件"
        echo "📂 检查项目中是否有构建后的 extension.js..."
        find . -type f -name "extension.js" | grep -v "node_modules"
        
        # 尝试找到 extension.js 并复制到正确位置
        EXTENSION_JS_PATH=$(find . -type f -name "extension.js" | grep -v "node_modules" | head -n 1)
        if [ -n "$EXTENSION_JS_PATH" ]; then
            echo "✅ 找到 extension.js: $EXTENSION_JS_PATH"
            echo "🔧 复制到 dist 目录..."
            cp "$EXTENSION_JS_PATH" "dist/"
            echo "✅ 已复制 extension.js 到 dist 目录"
        else
            echo "❌ 错误: 无法找到任何 extension.js 文件"
            echo "   请确保项目已正确构建"
            # 尝试从项目根目录复制
            if [ -f "$PROJECT_ROOT/dist/extension.js" ]; then
                echo "✅ 从项目根目录找到 extension.js"
                cp "$PROJECT_ROOT/dist/extension.js" "dist/"
                echo "✅ 已从项目根目录复制 extension.js 到临时目录"
            else
                exit 1
            fi
        fi
    fi
    
    # 确保 main 字段指向正确的路径
    if [[ "$MAIN_ENTRY" != *"dist/extension.js"* ]]; then
        echo "🔧 更新 package.json 中的 main 字段为 ./dist/extension.js..."
        sed -i '' 's|"main":\s*"[^"]*"|"main": "./dist/extension.js"|g' package.json
        echo "✅ 已更新 main 字段"
    fi
    
    # 最后验证
    if [ -f "dist/extension.js" ]; then
        echo "✅ 验证成功: dist/extension.js 存在"
    else
        echo "❌ 错误: 最终验证失败，dist/extension.js 仍然不存在"
        exit 1
    fi
    
    # 返回之前的工作目录
    cd "$CURRENT_DIR" || echo "⚠️  警告: 无法返回到之前的工作目录"
}

# 打包 VS Code 扩展
package_extension() {
    # 首先执行 main 字段检查和修正（该函数会自动进入临时目录）
    check_package_json_main
    
    # 进入临时目录进行后续操作
    cd "$PROJECT_ROOT/temp-dist" || {
        echo "❌ 错误: 无法进入临时目录: $PROJECT_ROOT/temp-dist"
        echo "📂 项目根目录内容:"
        ls -la "$PROJECT_ROOT"
        exit 1
    }
    
    echo "🪄 打包 VSCode 扩展..."
    
    # 先清理可能存在的 node_modules 目录，避免打包过大
    echo "🧹 清理 node_modules 以减小包体积..."
    rm -rf node_modules
    
    # 重新安装生产依赖
    echo "📥 重新安装生产依赖..."
    npm ci --omit=dev
    if [ $? -ne 0 ]; then
        echo "❌ 错误: 安装生产依赖失败"
        # 尝试使用 npm install 作为备选
        echo "🔄 尝试使用 npm install --omit=dev 作为备选..."
        npm install --omit=dev
        if [ $? -ne 0 ]; then
            echo "❌ 错误: npm install 也失败了"
            exit 1
        fi
    fi
    
    # 再次验证 dist/extension.js 是否存在
    if [ ! -f "dist/extension.js" ]; then
        echo "❌ 错误: 在打包前验证失败，dist/extension.js 不存在"
        echo "📂 检查项目结构..."
        find . -type f -name "*.js" | grep -v "node_modules"
        exit 1
    fi
    
    # 开始打包
    echo "📦 执行 vsce package 命令..."
    vsce package --allow-star-activation
    if [ $? -ne 0 ]; then
        echo "❌ 错误: 打包扩展失败"
        # 尝试使用 --baseImagesUrl 参数再次打包
        echo "🔄 尝试使用替代参数重新打包..."
        vsce package --baseImagesUrl ''
        if [ $? -ne 0 ]; then
            echo "❌ 错误: 重新打包也失败了"
            exit 1
        fi
    fi
    
    VSIX_FILE=$(ls *.vsix 2>/dev/null | head -n 1)
    if [ -n "$VSIX_FILE" ]; then
        echo "✅ 打包完成！VSIX 文件: $VSIX_FILE"
        # 复制 VSIX 文件回根目录
        cp "$VSIX_FILE" "../"
        echo "📤 已将 VSIX 文件复制到项目根目录"
    else
        echo "❌ 错误: 未找到生成的 VSIX 文件"
        exit 1
    fi
}

# 发布扩展（可选）
publish_extension() {
    # 检查命令行参数是否有 --publish
    if [[ "$@" == *"--publish"* ]]; then
        AUTO_PUBLISH=1
        echo "🚀 检测到 --publish 参数，将自动发布扩展..."
    fi
    
    # 确保在项目根目录
    cd "$PROJECT_ROOT" || {
        echo "❌ 错误: 无法回到项目根目录: $PROJECT_ROOT"
        echo "📂 当前目录: $(pwd)"
        exit 1
    }
    echo "📂 发布工作目录: $(pwd)"
    
    # 查找 VSIX 文件
    if [ -z "$VSIX_FILE" ]; then
        # 尝试在根目录查找最新的 VSIX 文件
        VSIX_FILE=$(ls -t *.vsix 2>/dev/null | head -n 1)
        if [ -z "$VSIX_FILE" ]; then
            echo "❌ 错误: 未找到 VSIX 文件，无法发布"
            echo "📂 在项目根目录查找 VSIX 文件..."
            find . -name "*.vsix" | grep -v "node_modules"
            return 1
        fi
        echo "✅ 找到 VSIX 文件: $VSIX_FILE"
    fi
    
    # 确保 VSIX 文件实际存在
    if [ ! -f "$VSIX_FILE" ]; then
        # 尝试在当前目录查找
        VSIX_FILE=$(ls *.vsix 2>/dev/null | head -n 1)
        if [ ! -f "$VSIX_FILE" ]; then
            echo "❌ 错误: VSIX 文件不存在: $VSIX_FILE"
            return 1
        fi
    fi
    
    # 询问是否要发布
    if [ -z "$AUTO_PUBLISH" ]; then
        echo -n "是否要发布扩展到 VS Code Marketplace? (y/n): "
        read -r PUBLISH_ANSWER
        if [ "$PUBLISH_ANSWER" != "y" ] && [ "$PUBLISH_ANSWER" != "Y" ]; then
            echo "ℹ️  跳过发布步骤"
            return 0
        fi
    fi
    
    # 检查 PAT 是否设置
    if [ -z "$VSCE_PAT" ]; then
        echo -n "请输入 Azure DevOps Personal Access Token: "
        read -s VSCE_PAT
        export VSCE_PAT=$VSCE_PAT
        echo ""
    fi
    
    # 获取发布者信息
    read_publisher_info
    
    # 登录并发布
    echo "🔐 登录 VS Code Marketplace..."
    vsce login "$PUBLISHER"
    if [ $? -ne 0 ]; then
        echo "❌ 错误: 登录失败，请检查发布者 ID 和 PAT"
        return 1
    fi
    
    echo "🚀 发布扩展到 VS Code Marketplace..."
    vsce publish
    if [ $? -ne 0 ]; then
        echo "❌ 错误: 发布失败"
        return 1
    fi
    
    echo "🎉 发布成功！扩展已上传到 VS Code Marketplace"
    return 0
}

# 解析命令行参数
parse_arguments() {
    while [[ "$1" != "" ]]; do
        case $1 in
            --publish)
                export AUTO_PUBLISH=1
                echo "🔄 启用自动发布模式"
                ;;
            --skip-build)
                export SKIP_BUILD=1
                echo "⏩ 跳过构建步骤"
                ;;
            *)
                echo "❓ 未知参数: $1"
                echo "📋 可用参数: --publish, --skip-build"
                ;;
        esac
        shift
    done
}

# 主函数
main() {
    # 解析命令行参数
    parse_arguments "$@"
    # 保存初始工作目录
    INITIAL_DIR=$(pwd)
    
    # 在脚本退出时返回初始目录
    trap "cd '$INITIAL_DIR'" EXIT
    
    echo "🚀 开始 VS Code 扩展打包流程..."
    
    echo "📂 项目根目录: $PROJECT_ROOT"
    echo "📂 脚本目录: $SCRIPT_DIR"
    echo "📂 当前工作目录: $(pwd)"
    
    # 检查依赖
    check_dependencies
    
    # 获取发布者信息
    read_publisher_info
    
    # 设置临时目录
    setup_temp_directory
    
    # 复制文件
    copy_necessary_files
    
    # 准备 npm 环境
    prepare_npm_environment
    
    # 打包扩展
    package_extension
    
    # 询问是否发布扩展
echo -n "是否要立即发布扩展到 VS Code Marketplace? (y/n): "
read -r PUBLISH_ANSWER
if [ "$PUBLISH_ANSWER" = "y" ] || [ "$PUBLISH_ANSWER" = "Y" ]; then
    echo "🔄 开始发布流程..."
    publish_extension
else
    echo "ℹ️  扩展已打包但未发布，您可以稍后手动运行发布命令。"
    echo "📝 发布提示："
    echo "   1. 确保您有 Azure DevOps 账号和 Personal Access Token"
    echo "   2. 运行: export VSCE_PAT=您的令牌"
    echo "   3. 运行: cd $PROJECT_ROOT && bash scripts/publish-extension.sh --publish"
fi
    
    # 清理临时目录（可选）
    echo "🧹 清理临时目录..."
    rm -rf "$PROJECT_ROOT/temp-dist"
    
    echo "🎉 扩展打包完成！"
    echo "📦 VSIX 文件已生成在项目根目录"
    
    # 显示生成的 VSIX 文件
    VSIX_FILE=$(ls -t *.vsix 2>/dev/null | head -n 1)
    if [ -n "$VSIX_FILE" ]; then
        echo "📄 生成的 VSIX 文件: $VSIX_FILE"
        echo "📏 文件大小: $(du -h "$VSIX_FILE" | cut -f1)"
    fi
}

# 执行主函数
main