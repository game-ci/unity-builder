#!/bin/sh
# game-ci CLI installer
# Usage: curl -fsSL https://raw.githubusercontent.com/game-ci/unity-builder/main/install.sh | sh
#
# Environment variables:
#   GAME_CI_VERSION   - Install a specific version (e.g., v2.0.0). Defaults to latest.
#   GAME_CI_INSTALL   - Installation directory. Defaults to ~/.game-ci/bin.

set -e

REPO="game-ci/unity-builder"
INSTALL_DIR="${GAME_CI_INSTALL:-$HOME/.game-ci/bin}"
BINARY_NAME="game-ci"

# Colors (disabled if not a terminal)
if [ -t 1 ]; then
  BOLD='\033[1m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  RED='\033[0;31m'
  RESET='\033[0m'
else
  BOLD=''
  GREEN=''
  YELLOW=''
  RED=''
  RESET=''
fi

info() {
  printf "${GREEN}info${RESET}: %s\n" "$1"
}

warn() {
  printf "${YELLOW}warn${RESET}: %s\n" "$1"
}

error() {
  printf "${RED}error${RESET}: %s\n" "$1" >&2
  exit 1
}

# Detect OS and architecture
detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "$OS" in
    Linux*)  PLATFORM="linux" ;;
    Darwin*) PLATFORM="macos" ;;
    MINGW*|MSYS*|CYGWIN*)
      PLATFORM="windows"
      warn "For Windows, consider using install.ps1 instead:"
      warn "  irm https://raw.githubusercontent.com/game-ci/unity-builder/main/install.ps1 | iex"
      ;;
    *) error "Unsupported operating system: $OS" ;;
  esac

  case "$ARCH" in
    x86_64|amd64)  ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) error "Unsupported architecture: $ARCH" ;;
  esac

  ASSET_NAME="game-ci-${PLATFORM}-${ARCH}"
  if [ "$PLATFORM" = "windows" ]; then
    ASSET_NAME="${ASSET_NAME}.exe"
    BINARY_NAME="game-ci.exe"
  fi
}

# Get latest release tag from GitHub API
get_latest_version() {
  if [ -n "$GAME_CI_VERSION" ]; then
    VERSION="$GAME_CI_VERSION"
    info "Using specified version: $VERSION"
    return
  fi

  info "Fetching latest release..."

  if command -v curl > /dev/null 2>&1; then
    VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
  elif command -v wget > /dev/null 2>&1; then
    VERSION=$(wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
  else
    error "Neither curl nor wget found. Please install one of them."
  fi

  if [ -z "$VERSION" ]; then
    error "Could not determine latest version. Check https://github.com/${REPO}/releases"
  fi
}

# Download and install the binary
install() {
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET_NAME}"

  printf "\n"
  info "Installing game-ci ${VERSION} (${PLATFORM}-${ARCH})"
  info "  from: ${DOWNLOAD_URL}"
  info "  to:   ${INSTALL_DIR}/${BINARY_NAME}"
  printf "\n"

  mkdir -p "$INSTALL_DIR"

  # Download with progress
  if command -v curl > /dev/null 2>&1; then
    HTTP_CODE=$(curl -fSL "$DOWNLOAD_URL" -o "${INSTALL_DIR}/${BINARY_NAME}" -w "%{http_code}" 2>/dev/null) || true
    if [ "$HTTP_CODE" = "404" ]; then
      error "Release asset not found: ${ASSET_NAME} (${VERSION}). Check available assets at https://github.com/${REPO}/releases/tag/${VERSION}"
    elif [ ! -f "${INSTALL_DIR}/${BINARY_NAME}" ]; then
      error "Download failed. URL: ${DOWNLOAD_URL}"
    fi
  elif command -v wget > /dev/null 2>&1; then
    wget -q "$DOWNLOAD_URL" -O "${INSTALL_DIR}/${BINARY_NAME}" || error "Download failed. URL: ${DOWNLOAD_URL}"
  fi

  chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

  # Verify the binary works
  if "${INSTALL_DIR}/${BINARY_NAME}" version > /dev/null 2>&1; then
    INSTALLED_VERSION=$("${INSTALL_DIR}/${BINARY_NAME}" version 2>&1 | head -1)
    info "Verified: ${INSTALLED_VERSION}"
  else
    warn "Binary downloaded but could not verify. It may still work."
  fi

  printf "\n"
  printf "${BOLD}game-ci installed successfully!${RESET}\n"
  printf "\n"

  # Check if install dir is in PATH
  case ":$PATH:" in
    *":${INSTALL_DIR}:"*)
      info "game-ci is already in your PATH. Run: game-ci --help"
      ;;
    *)
      SHELL_NAME=$(basename "$SHELL" 2>/dev/null || echo "sh")
      case "$SHELL_NAME" in
        zsh)  PROFILE="~/.zshrc" ;;
        bash) PROFILE="~/.bashrc" ;;
        fish) PROFILE="~/.config/fish/config.fish" ;;
        *)    PROFILE="~/.profile" ;;
      esac

      printf "${YELLOW}Add game-ci to your PATH by adding this to ${PROFILE}:${RESET}\n"
      printf "\n"
      if [ "$SHELL_NAME" = "fish" ]; then
        printf "  set -gx PATH \"%s\" \$PATH\n" "$INSTALL_DIR"
      else
        printf "  export PATH=\"%s:\$PATH\"\n" "$INSTALL_DIR"
      fi
      printf "\n"
      info "Then restart your shell or run: source ${PROFILE}"
      ;;
  esac
}

# Verify checksum if checksums.txt is available
verify_checksum() {
  if ! command -v sha256sum > /dev/null 2>&1; then
    return 0
  fi

  CHECKSUM_URL="https://github.com/${REPO}/releases/download/${VERSION}/checksums.txt"

  CHECKSUMS=""
  if command -v curl > /dev/null 2>&1; then
    CHECKSUMS=$(curl -fsSL "$CHECKSUM_URL" 2>/dev/null) || return 0
  elif command -v wget > /dev/null 2>&1; then
    CHECKSUMS=$(wget -qO- "$CHECKSUM_URL" 2>/dev/null) || return 0
  fi

  if [ -z "$CHECKSUMS" ]; then
    return 0
  fi

  EXPECTED=$(echo "$CHECKSUMS" | grep "$ASSET_NAME" | awk '{print $1}')
  if [ -z "$EXPECTED" ]; then
    return 0
  fi

  ACTUAL=$(sha256sum "${INSTALL_DIR}/${BINARY_NAME}" | awk '{print $1}')
  if [ "$EXPECTED" != "$ACTUAL" ]; then
    error "Checksum verification failed!\n  Expected: ${EXPECTED}\n  Got:      ${ACTUAL}"
  fi

  info "Checksum verified (SHA256)"
}

# Main
detect_platform
get_latest_version
install
verify_checksum
