use std::path::{Path, PathBuf};

fn manifest_dir() -> String {
    std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| "/app".to_string())
}

pub fn get_tagger_model_path() -> PathBuf {
    Path::new(&manifest_dir())
        .join("models")
        .join("tagger.onnx")
}

pub fn get_labels_path() -> PathBuf {
    Path::new(&manifest_dir())
        .join("models")
        .join("tagger_meta.json")
}

pub fn get_thresholds_path() -> PathBuf {
    Path::new(&manifest_dir())
        .join("models")
        .join("tagger_val_res.json")
}