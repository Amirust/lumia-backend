#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

install_docker() {
    if command -v docker >/dev/null 2>&1; then
        echo "Docker already installed"
        return
    fi
    echo "Installing Docker"
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh
    rm -f /tmp/get-docker.sh
}

add_docker_sudoers() {
    local user="${SUDO_USER:-$USER}"
    sudo groupadd -f docker
    sudo usermod -aG docker "$user"
    local sudoers_file="/etc/sudoers.d/lumia-docker"
    echo "$user ALL=(ALL) NOPASSWD: $(command -v docker)" | sudo tee "$sudoers_file" >/dev/null
    sudo chmod 0440 "$sudoers_file"
}

download_models() {
    echo "Downloading ML models"
    bash "$SCRIPT_DIR/ml/download_models.sh"
}

compose_up() {
    echo "Starting services"
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d --build
}

run_migrations() {
    echo "Running database migrations"
    npm --prefix "$SCRIPT_DIR/backend" install
    npm --prefix "$SCRIPT_DIR/backend" run migrate:migrate
}

install() {
    install_docker
    add_docker_sudoers
    download_models
    compose_up
    run_migrations
    echo "Installation complete"
}

status() {
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps
}

usage() {
    echo "Usage: $0 {install|status}"
    exit 1
}

main() {
    local command="${1:-}"
    case "$command" in
        install)
            install
            ;;
        status)
            status
            ;;
        *)
            usage
            ;;
    esac
}

main "$@"
