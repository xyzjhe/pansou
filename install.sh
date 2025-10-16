#!/bin/bash
# Claude Code 一键安装脚本 (macOS & Linux)
# 作者: f_rogers
# 仓库: https://gitee.com/f_rogers/claude-installer

set -Eeuo pipefail
IFS=$'\n\t'

# 全局错误计数器（与Windows版本对齐）
ERROR_COUNT=0

# 颜色输出函数
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${CYAN}"
    cat << "EOF"
    ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗     ██████╗ ██████╗ ██████╗ ███████╗
    ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝    ██╔════╝██╔═══██╗██╔══██╗██╔════╝
    ██║     ██║     ███████║██║   ██║██║  ██║█████╗      ██║     ██║   ██║██║  ██║█████╗
    ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝      ██║     ██║   ██║██║  ██║██╔══╝
    ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗    ╚██████╗╚██████╔╝██████╔╝███████╗
     ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝     ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝

    🚀 Claude Code 一键安装器 v1.0
    📦 将自动安装: 包管理器 + Git + Node.js + Claude Code
    ⏱️  预计耗时: 3-5 分钟
EOF
    echo -e "${NC}"
}

print_info() {
    echo -e "${BLUE}🔵 INFO: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ SUCCESS: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
}

print_error() {
    ((ERROR_COUNT++))
    echo -e "${RED}❌ ERROR: $1${NC}"
}

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        DISTRO="macOS"
    elif [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS="linux"
        DISTRO="$ID"
    elif [[ -f /etc/redhat-release ]]; then
        OS="linux"
        DISTRO="rhel"
    else
        OS="unknown"
        DISTRO="unknown"
    fi

    print_info "检测到操作系统: $DISTRO ($OS)"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 获取命令版本（与Windows版本对齐）
get_command_version() {
    local cmd="$1"

    if ! command_exists "$cmd"; then
        return 1
    fi

    local version
    # 尝试 --version
    version=$($cmd --version 2>/dev/null | head -n 1)

    # 尝试 -v
    if [[ -z "$version" ]]; then
        version=$($cmd -v 2>/dev/null | head -n 1)
    fi

    # 尝试 version 子命令
    if [[ -z "$version" ]]; then
        version=$($cmd version 2>/dev/null | head -n 1)
    fi

    if [[ -n "$version" ]]; then
        echo "$version"
        return 0
    fi

    return 1
}

# 安全的API密钥输入函数 - 支持明文/密文双模式（与Windows版本对齐）
get_safe_api_key() {
    local max_attempts=3
    local attempts=0

    # 检测是否为root用户
    local is_root=false
    [[ $EUID -eq 0 ]] && is_root=true

    while [[ $attempts -lt $max_attempts ]]; do
        ((attempts++))
        echo ""
        echo -e "${CYAN}========================================"
        echo -e "  API 密钥输入 (尝试 $attempts/$max_attempts)"
        echo -e "========================================${NC}"
        echo ""

        # Root用户警告
        if [[ "$is_root" == true ]]; then
            echo -e "${YELLOW}⚠️  检测到root用户运行${NC}"
            echo -e "${YELLOW}💡 提示：建议使用普通用户账户${NC}"
            echo ""
        fi

        # 选择输入方式
        echo -e "${YELLOW}请选择输入方式:${NC}"
        echo -e "${GREEN}  [1] 明文输入 (推荐，支持粘贴，内容可见)${NC}"
        echo -e "  [2] 密文输入 (内容隐藏)"
        echo ""

        local choice
        read -p "选择 (1 或 2，默认=1): " choice
        [[ -z "$choice" ]] && choice="1"

        echo ""

        local api_key_input=""

        if [[ "$choice" == "2" ]]; then
            # 密文输入
            echo -e "${CYAN}🔑 请输入 API 密钥 (输入将被隐藏):${NC}"
            read -s -p "API密钥: " api_key_input
            echo
        else
            # 明文输入
            echo -e "${CYAN}🔑 请输入 API 密钥 (可直接粘贴):${NC}"
            echo -e "${YELLOW}💡 提示: 右键粘贴或 Ctrl+Shift+V${NC}"
            read -p "API密钥: " api_key_input
        fi

        # 验证
        if [[ -z "$api_key_input" ]]; then
            echo ""
            echo -e "${RED}❌ 错误: API 密钥不能为空！${NC}"
            echo -e "${YELLOW}请重新输入...${NC}"
            continue
        fi

        # 显示预览（前10个字符）
        local preview="${api_key_input:0:10}"
        local length="${#api_key_input}"
        echo ""
        echo -e "${GREEN}✅ 已捕获 API 密钥: $preview...${NC}"
        echo -e "${YELLOW}📏 长度: $length 个字符${NC}"
        echo ""

        # 二次确认
        local confirm
        read -p "密钥是否正确? (Y/N): " confirm
        if [[ "$confirm" == "Y" || "$confirm" == "y" ]]; then
            echo "$api_key_input"
            return 0
        else
            echo -e "${YELLOW}让我们重新输入...${NC}"
        fi
    done

    echo -e "${RED}❌ 无法获取有效的API密钥${NC}" >&2
    return 1
}

# 网络连接检查（与Windows版本对齐）
test_network_connection() {
    local test_url="${1:-https://www.google.com}"
    local timeout=5

    # 优先使用curl
    if command_exists curl; then
        if curl -s --max-time $timeout "$test_url" >/dev/null 2>&1; then
            return 0
        fi
    # 备用wget
    elif command_exists wget; then
        if wget -q --timeout=$timeout --spider "$test_url" 2>/dev/null; then
            return 0
        fi
    fi

    return 1
}

# 安全的npm全局安装函数 - 自动适配操作系统权限，增强错误处理
safe_npm_install() {
    local package="$1"
    local max_attempts=3
    local attempt=1

    print_info "正在安装 npm 包: $package"

    while [[ $attempt -le $max_attempts ]]; do
        print_info "尝试安装 $package (第 $attempt 次)"

        local npm_prefix

        # 获取npm全局安装路径
        npm_prefix=$(npm config get prefix 2>/dev/null)

        # 尝试安装
        local install_success=false
        if [[ "$OS" == "linux" ]]; then
            if sudo npm install -g "$package"; then
                install_success=true
            fi
        else
            if npm install -g "$package"; then
                install_success=true
            fi
        fi

        # 检查安装结果
        if [[ "$install_success" == true ]]; then
            print_success "$package 安装完成"
            return 0
        else
            print_warning "$package 安装失败 (尝试 $attempt/$max_attempts)"

            # 如果不是最后一次尝试，进行清理
            if [[ $attempt -lt $max_attempts ]]; then
                print_info "正在清理残留文件并重试..."

                # 清理npm缓存
                npm cache clean --force 2>/dev/null || true

                # 清理可能的残留文件
                if [[ -n "$npm_prefix" && -d "$npm_prefix/lib/node_modules" ]]; then
                    local package_dir="$npm_prefix/lib/node_modules/$package"
                    local package_temp_dir="$npm_prefix/lib/node_modules/.${package}*"

                    if [[ "$OS" == "linux" ]]; then
                        sudo rm -rf "$package_dir" 2>/dev/null || true
                        sudo rm -rf $package_temp_dir 2>/dev/null || true
                    else
                        rm -rf "$package_dir" 2>/dev/null || true
                        rm -rf $package_temp_dir 2>/dev/null || true
                    fi
                fi

                # 等待一秒再重试
                sleep 1
            fi
        fi

        ((attempt++))
    done

    print_error "$package 安装失败 - 已尝试 $max_attempts 次"
    return 1
}

# 安全的配置文件写入函数 - 处理权限和错误
safe_write_config() {
    local config_file="$1"
    local content="$2"
    local temp_file="/tmp/claude_config_$$"

    # 确保目标目录存在
    local config_dir
    config_dir=$(dirname "$config_file")
    if [[ ! -d "$config_dir" ]]; then
        mkdir -p "$config_dir" 2>/dev/null || {
            print_error "无法创建目录: $config_dir"
            return 1
        }
    fi

    # 确保配置文件存在且权限正确
    if [[ ! -f "$config_file" ]]; then
        touch "$config_file" 2>/dev/null || {
            print_error "无法创建文件: $config_file"
            return 1
        }
    fi

    # 检查文件是否可写
    if [[ ! -w "$config_file" ]]; then
        # 尝试修复权限
        chmod 644 "$config_file" 2>/dev/null || {
            print_error "文件权限问题: $config_file"
            return 1
        }
    fi

    # 使用临时文件安全写入
    if echo "$content" > "$temp_file" 2>/dev/null; then
        if cat "$temp_file" >> "$config_file" 2>/dev/null; then
            rm -f "$temp_file"
            return 0
        else
            rm -f "$temp_file"
            print_error "写入失败: $config_file"
            return 1
        fi
    else
        print_error "创建临时文件失败"
        return 1
    fi
}

# 安装 macOS 依赖
install_macos_deps() {
    print_info "步骤 2/6: 在 macOS 上安装依赖..."

    # 安装 Xcode Command Line Tools (如果需要)
    if ! xcode-select --print-path &>/dev/null; then
        print_info "安装 Xcode Command Line Tools..."
        xcode-select --install
        print_warning "请在弹出对话框中点击安装，完成后按回车继续..."
        read -p ""
    fi

    # 安装 Homebrew
    if ! command_exists brew; then
        print_info "正在安装 Homebrew..."
        # 移除 NONINTERACTIVE 以允许密码输入
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

        # 配置 Homebrew PATH
        if [[ -f "/opt/homebrew/bin/brew" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        elif [[ -f "/usr/local/bin/brew" ]]; then
            eval "$(/usr/local/bin/brew shellenv)"
            echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.bash_profile
        fi
        print_success "Homebrew 安装完成"
    else
        print_success "Homebrew 已存在，跳过安装"
    fi

    # 安装 Git
    if ! command_exists git; then
        print_info "正在安装 Git..."
        brew install git
        print_success "Git 安装完成"
    else
        local git_version=$(get_command_version "git")
        if [[ -n "$git_version" ]]; then
            print_success "Git 已存在 ($git_version)，跳过安装"
        else
            print_success "Git 已存在，跳过安装"
        fi
    fi

    # 安装 Node.js
    if ! command_exists node; then
        print_info "正在安装 Node.js..."
        brew install node
        print_success "Node.js 安装完成"
    else
        local node_version=$(get_command_version "node")
        if [[ -n "$node_version" ]]; then
            print_success "Node.js 已存在 ($node_version)，跳过安装"
        else
            print_success "Node.js 已存在，跳过安装"
        fi
    fi
}

# 安装 Linux 依赖
install_linux_deps() {
    print_info "步骤 2/6: 在 Linux ($DISTRO) 上安装依赖..."

    case "$DISTRO" in
        ubuntu|debian)
            # 更新包列表
            sudo apt update

            # 安装基础工具
            if ! command_exists curl; then
                sudo apt install -y curl
            fi

            # 安装 Git
            if ! command_exists git; then
                print_info "正在安装 Git..."
                sudo apt install -y git
                print_success "Git 安装完成"
            else
                local git_version=$(get_command_version "git")
                if [[ -n "$git_version" ]]; then
                    print_success "Git 已存在 ($git_version)，跳过安装"
                else
                    print_success "Git 已存在，跳过安装"
                fi
            fi

            # 安装 Node.js (通过 NodeSource)
            if ! command_exists node; then
                print_info "正在安装 Node.js..."
                curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
                sudo apt install -y nodejs
                print_success "Node.js 安装完成"
            else
                local node_version=$(get_command_version "node")
                if [[ -n "$node_version" ]]; then
                    print_success "Node.js 已存在 ($node_version)，跳过安装"
                else
                    print_success "Node.js 已存在，跳过安装"
                fi
            fi
            ;;

        centos|rhel|fedora)
            # 安装基础工具
            if ! command_exists curl; then
                if command_exists dnf; then
                    sudo dnf install -y curl
                else
                    sudo yum install -y curl
                fi
            fi

            # 安装 Git
            if ! command_exists git; then
                print_info "正在安装 Git..."
                if command_exists dnf; then
                    sudo dnf install -y git
                else
                    sudo yum install -y git
                fi
                print_success "Git 安装完成"
            else
                local git_version=$(get_command_version "git")
                if [[ -n "$git_version" ]]; then
                    print_success "Git 已存在 ($git_version)，跳过安装"
                else
                    print_success "Git 已存在，跳过安装"
                fi
            fi

            # 安装 Node.js
            if ! command_exists node; then
                print_info "正在安装 Node.js..."
                curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
                if command_exists dnf; then
                    sudo dnf install -y nodejs npm
                else
                    sudo yum install -y nodejs npm
                fi
                print_success "Node.js 安装完成"
            else
                local node_version=$(get_command_version "node")
                if [[ -n "$node_version" ]]; then
                    print_success "Node.js 已存在 ($node_version)，跳过安装"
                else
                    print_success "Node.js 已存在，跳过安装"
                fi
            fi
            ;;

        arch|manjaro)
            # 更新包数据库
            sudo pacman -Syu --noconfirm

            # 安装 Git
            if ! command_exists git; then
                print_info "正在安装 Git..."
                sudo pacman -S --noconfirm git
                print_success "Git 安装完成"
            else
                local git_version=$(get_command_version "git")
                if [[ -n "$git_version" ]]; then
                    print_success "Git 已存在 ($git_version)，跳过安装"
                else
                    print_success "Git 已存在，跳过安装"
                fi
            fi

            # 安装 Node.js
            if ! command_exists node; then
                print_info "正在安装 Node.js..."
                sudo pacman -S --noconfirm nodejs npm
                print_success "Node.js 安装完成"
            else
                local node_version=$(get_command_version "node")
                if [[ -n "$node_version" ]]; then
                    print_success "Node.js 已存在 ($node_version)，跳过安装"
                else
                    print_success "Node.js 已存在，跳过安装"
                fi
            fi
            ;;

        *)
            print_warning "不支持的 Linux 发行版: $DISTRO"
            print_info "请手动安装 Git 和 Node.js，然后重新运行此脚本"
            exit 1
            ;;
    esac
}

# 安装 Claude Code
install_claude_code() {
    print_info "步骤 3/6: 安装 Claude Code..."

    # 检查 npm 是否可用
    if ! command_exists npm; then
        print_error "npm 命令未找到！请确保 Node.js 安装正确"
        exit 1
    fi

    # 检查 Claude Code 是否已安装
    claude_installed=false
    if command_exists claude; then
        claude_version=$(claude --version 2>/dev/null)
        if [[ -n "$claude_version" ]]; then
            print_success "Claude Code 已存在 ($claude_version)，跳过安装"
            claude_installed=true
        fi
    fi

    if [[ "$claude_installed" = false ]]; then
        safe_npm_install "@anthropic-ai/claude-code"
    fi

    # 安装 clear-cc 清理工具
    print_info "正在安装 clear-cc 清理工具..."
    safe_npm_install "clear-cc"

    # 仅在检测到 Claude Code 已安装时执行清理（与Windows版本对齐）
    if [[ "$claude_installed" = true ]]; then
        print_info "正在执行 clear-cc 清理..."

        # 重试机制（最多5次）
        local max_retries=5
        local retry_count=0
        local clear_cc_success=false

        while [[ $retry_count -lt $max_retries && "$clear_cc_success" = false ]]; do
            sleep 0.5  # 500ms延迟

            # 刷新环境变量（重新source shell配置）
            if [[ -f "$HOME/.bashrc" ]]; then
                source "$HOME/.bashrc" 2>/dev/null || true
            fi
            if [[ -f "$HOME/.zshrc" ]]; then
                source "$HOME/.zshrc" 2>/dev/null || true
            fi

            # 尝试执行clear-cc
            if command_exists clear-cc; then
                if clear-cc 2>/dev/null; then
                    clear_cc_success=true
                    print_success "Claude Code 配置已清理"
                else
                    print_warning "clear-cc 执行失败 (尝试 $((retry_count + 1))/$max_retries)"
                fi
            fi

            ((retry_count++))
        done

        if [[ "$clear_cc_success" = false ]]; then
            print_warning "clear-cc 未能在 $max_retries 次尝试后成功执行"
        fi
    fi
}

# 配置环境变量
configure_environment() {
    print_info "步骤 4/6: 配置环境变量..."

    # 检查现有环境变量并询问用户是否更新
    local existing_base_url="${ANTHROPIC_BASE_URL:-}"
    local existing_api_key="${ANTHROPIC_AUTH_TOKEN:-}"
    local need_new_key=true

    if [[ "$existing_base_url" == "https://www.crazycode.org/api" && -n "$existing_api_key" ]]; then
        print_info "🔍 检测到现有配置:"
        echo "  - ANTHROPIC_BASE_URL: $existing_base_url"
        echo "  - ANTHROPIC_AUTH_TOKEN: ${existing_api_key:0:20}..."
        echo ""

        local response=""
        while [[ "$response" != "y" && "$response" != "Y" && "$response" != "n" && "$response" != "N" ]]; do
            read -p "是否要输入新的 API 密钥? (y/n): " response
        done

        if [[ "$response" == "n" || "$response" == "N" ]]; then
            need_new_key=false
            API_KEY="$existing_api_key"
            print_success "将继续使用现有 API 密钥"
        fi
    fi

    # 获取用户 API 密钥（如果需要）
    if [[ "$need_new_key" == true ]]; then
        # 优先复用环境变量
        if [[ -z "${API_KEY:-}" && -n "${ANTHROPIC_AUTH_TOKEN:-}" ]]; then
            API_KEY="$ANTHROPIC_AUTH_TOKEN"
        fi

        # 如果环境变量中没有，使用增强的输入函数
        if [[ -z "${API_KEY:-}" ]]; then
            # 兼容curl | bash场景：从/dev/tty读取
            if [[ ! -t 0 && -e /dev/tty ]]; then
                API_KEY=$(get_safe_api_key < /dev/tty) || {
                    print_error "API密钥输入失败"
                    exit 1
                }
            else
                API_KEY=$(get_safe_api_key) || {
                    print_error "API密钥输入失败"
                    exit 1
                }
            fi
        fi
    fi

    # 环境变量配置
    ENV_CONFIG="
# Claude Code 环境变量配置
export ANTHROPIC_BASE_URL=\"https://www.crazycode.org/api\"
export ANTHROPIC_AUTH_TOKEN=\"$API_KEY\"
"

    # 配置到不同的 shell 配置文件
    SHELL_CONFIGS=()

    # 检测并配置 bash
    if [[ -f "$HOME/.bashrc" ]]; then
        SHELL_CONFIGS+=("$HOME/.bashrc")
    fi

    if [[ -f "$HOME/.bash_profile" ]]; then
        SHELL_CONFIGS+=("$HOME/.bash_profile")
    fi

    # 检测并配置 zsh
    if [[ -f "$HOME/.zshrc" ]] || [[ "$SHELL" == *"zsh"* ]]; then
        [[ ! -f "$HOME/.zshrc" ]] && touch "$HOME/.zshrc"
        SHELL_CONFIGS+=("$HOME/.zshrc")
    fi

    # 如果没有找到配置文件，创建 .bashrc
    if [[ ${#SHELL_CONFIGS[@]} -eq 0 ]]; then
        SHELL_CONFIGS+=("$HOME/.bashrc")
        touch "$HOME/.bashrc"
    fi

    # 安全写入环境变量到配置文件
    for config_file in "${SHELL_CONFIGS[@]}"; do
        # 检查是否已经配置过
        if ! grep -q "ANTHROPIC_BASE_URL" "$config_file" 2>/dev/null; then
            # 使用安全写入函数
            if safe_write_config "$config_file" "$ENV_CONFIG"; then
                print_success "环境变量已添加到 $config_file"
            else
                print_warning "无法写入 $config_file，请检查文件权限或稍后手动配置"
                print_info "手动配置命令："
                print_info "echo 'export ANTHROPIC_BASE_URL=\"https://www.crazycode.org/api\"' >> $config_file"
                print_info "echo 'export ANTHROPIC_AUTH_TOKEN=\"your_api_key\"' >> $config_file"
            fi
        else
            print_warning "$config_file 中已存在 Claude Code 配置，跳过"
        fi
    done

    # 创建 Claude Code 配置文件
    print_info "正在创建 Claude Code 配置文件..."
    local claude_config_dir="$HOME/.claude"
    local claude_config_file="$claude_config_dir/config.json"

    # 确保 .claude 目录存在
    if [[ ! -d "$claude_config_dir" ]]; then
        mkdir -p "$claude_config_dir" 2>/dev/null || {
            print_warning "无法创建目录: $claude_config_dir"
        }
    fi

    # 创建配置文件
    if [[ -d "$claude_config_dir" ]]; then
        cat > "$claude_config_file" <<'EOF'
{
  "primaryApiKey": "default"
}
EOF
        if [[ $? -eq 0 ]]; then
            print_success "Claude Code 配置文件已创建: $claude_config_file"
        else
            print_warning "创建配置文件失败，Claude Code 可能仍然可以正常工作"
        fi
    fi

    # 清理敏感信息
    unset API_KEY
    unset ENV_CONFIG
}

# 验证安装
verify_installation() {
    print_info "步骤 5/6: 验证安装..."

    # 重新加载环境变量
    if [[ -f "$HOME/.bashrc" ]]; then
        source "$HOME/.bashrc" 2>/dev/null || true
    fi
    if [[ -f "$HOME/.zshrc" ]]; then
        source "$HOME/.zshrc" 2>/dev/null || true
    fi

    # 检查 Claude Code 是否可执行
    if command_exists claude; then
        claude_version=$(claude --version 2>/dev/null)
        if [[ -n "$claude_version" ]]; then
            print_success "Claude Code 命令验证成功 ($claude_version)"
        else
            print_warning "Claude Code 命令验证失败，可能需要重启终端"
        fi
    else
        print_warning "Claude Code 命令验证失败，可能需要重启终端"
    fi

    # 检查环境变量 - 使用安全的变量引用避免unbound variable错误
    if [[ -n "${ANTHROPIC_BASE_URL:-}" ]]; then
        print_success "环境变量配置验证成功"
    else
        print_warning "环境变量配置可能需要重启终端生效"
    fi
}

# 显示完成信息
show_completion() {
    print_success "步骤 6/6: 安装完成！"

    echo -e "${GREEN}"
    cat << "EOF"

    🎉🎉🎉 Claude Code 安装完成！🎉🎉🎉

    📋 安装清单:
    ✅ 包管理器 (Homebrew/apt/yum/pacman)
    ✅ Git 版本控制
    ✅ Node.js 运行时
    ✅ Claude Code CLI 工具
    ✅ clear-cc 清理工具
    ✅ 环境变量配置
    ✅ 增强错误处理和重试机制

EOF
    echo -e "${NC}"

    echo -e "${CYAN}🚀 开始使用:${NC}"
    echo "1. 重启终端窗口 或 运行: source ~/.bashrc (或 ~/.zshrc)"
    echo "2. 运行命令: claude"
    echo ""

    echo -e "${CYAN}💡 有用的命令:${NC}"
    echo "- claude --help     # 查看帮助"
    echo "- clear-cc              # 清理 Claude Code 配置"
    echo ""

    echo -e "${CYAN}📖 如需帮助，请访问:${NC}"
    echo "https://gitee.com/f_rogers/claude-installer"
    echo ""

    # 错误统计（与Windows版本对齐）
    if [[ $ERROR_COUNT -gt 0 ]]; then
        print_warning "安装过程中遇到 $ERROR_COUNT 个警告，但已成功完成"
    fi
}

# 诊断信息输出（与Windows版本对齐）
show_diagnostic_info() {
    print_info "=== 诊断信息 ==="
    print_info "Bash 版本: $BASH_VERSION"
    print_info "操作系统: $DISTRO ($OS)"
    print_info "错误计数: $ERROR_COUNT"
    print_info "PATH 长度: ${#PATH}"
    print_info "当前用户: $(whoami)"
}

# 主安装函数
main() {
    # 打印标题
    print_header

    # 检查是否为 root 用户 (不推荐)
    if [[ $EUID -eq 0 ]]; then
        print_warning "检测到 root 用户，不推荐使用 root 执行此脚本"
        read -p "是否继续? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "安装已取消"
            exit 0
        fi
    fi

    print_info "步骤 1/6: 检测系统环境..."
    detect_os

    # 网络连接检查（与Windows版本对齐）
    print_info "检查网络连接..."
    if test_network_connection; then
        print_success "网络连接正常"
    else
        print_warning "网络连接可能存在问题，但将继续尝试安装"
    fi

    # Linux系统sudo权限检查
    if [[ "$OS" == "linux" ]]; then
        if ! sudo -n true 2>/dev/null; then
            print_warning "Linux系统需要sudo权限进行全局npm安装"
            print_info "安装过程中可能需要输入管理员密码"
        fi
    fi

    # 根据操作系统安装依赖
    case "$OS" in
        macos)
            install_macos_deps
            ;;
        linux)
            install_linux_deps
            ;;
        *)
            print_error "不支持的操作系统: $OS"
            exit 1
            ;;
    esac

    # 安装 Claude Code
    install_claude_code

    # 配置环境变量
    configure_environment

    # 验证安装
    verify_installation

    # 显示完成信息
    show_completion
}

# 错误处理（与Windows版本对齐）
trap 'print_error "安装过程中发生错误，安装中断"; show_diagnostic_info; exit 1' ERR

# 执行主函数
main "$@"
