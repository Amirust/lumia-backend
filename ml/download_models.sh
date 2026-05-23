#!/usr/bin/env bash
set -euo pipefail

BASE="https://huggingface.co/Camais03/camie-tagger-v2/resolve/main"
DIR="$(cd "$(dirname "$0")" && pwd)/models"
mkdir -p "$DIR"

dl() {
    local url="$1" dest="$DIR/$2"
    if [ -f "$dest" ]; then
        echo "Existing, skip: $2"
        return
    fi
    echo "Downloading: $2"
    curl -fL --retry 3 --retry-delay 2 -o "$dest" "$url"
}

dl "$BASE/camie-tagger-v2.onnx"          "tagger.onnx"
dl "$BASE/camie-tagger-v2-metadata.json" "tagger_meta.json"
dl "$BASE/full_validation_results.json"  "tagger_val_res.json"

echo "Ready -> $DIR"
