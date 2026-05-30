use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use ndarray::Array4;
use ort::inputs;
use ort::session::Session;
use ort::session::builder::GraphOptimizationLevel;
use ort::value::TensorRef;

// "BALANCED" | "MACRO OPT" | "MICRO OPT"
const PROFILE: &str = "BALANCED";
const FALLBACK_THRESHOLD: f32 = 0.5;
const INTRA_THREADS: usize = 4;

pub struct Labels {
    idx_to_tag: Vec<String>,
    tag_to_category: HashMap<String, String>,
}

pub struct Thresholds {
    per_category: HashMap<String, f32>,
    overall: f32,
}

pub struct Tagger {
    session: Mutex<Session>,
    labels: Labels,
    thresholds: Thresholds,
}

impl Tagger {
    pub fn load(
        model: &Path,
        labels: &Path,
        thresholds: &Path,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let session = Session::builder()?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .with_intra_threads(INTRA_THREADS)?
            .commit_from_file(model)?;

        let labels = load_labels(labels)?;
        let thresholds = load_thresholds(thresholds, PROFILE)?;

        Ok(Self { session: Mutex::new(session), labels, thresholds })
    }

    pub fn predict(
        &self,
        input: Array4<f32>,
    ) -> Result<HashMap<String, Vec<String>>, String> {
        let logits: Vec<f32> = {
            let mut session = self
                .session
                .lock()
                .map_err(|_| "session mutex poisoned".to_string())?;

            let tensor =
                TensorRef::from_array_view(&input).map_err(|e| e.to_string())?;
            let outputs = session.run(inputs![tensor]).map_err(|e| e.to_string())?;
            let (_shape, logits) =
                outputs[1].try_extract_tensor::<f32>().map_err(|e| e.to_string())?;
            logits.to_vec()
        };

        if self.labels.idx_to_tag.len() != logits.len() {
            return Err(format!(
                "The number of labels ({}) does not match the model output ({})",
                self.labels.idx_to_tag.len(),
                logits.len()
            ));
        }

        // Post-processing: sigmoid + category thresholding + grouping by category
        let mut by_category: HashMap<String, Vec<(String, f32)>> = HashMap::new();
        for (i, &logit) in logits.iter().enumerate() {
            let prob = sigmoid(logit);
            let tag = &self.labels.idx_to_tag[i];
            let category = self
                .labels
                .tag_to_category
                .get(tag)
                .map(|s| s.as_str())
                .unwrap_or("general");

            let threshold = self
                .thresholds
                .per_category
                .get(category)
                .copied()
                .unwrap_or(self.thresholds.overall);
            if prob >= threshold {
                by_category
                    .entry(category.to_string())
                    .or_default()
                    .push((tag.clone(), prob));
            }
        }

        let result: HashMap<String, Vec<String>> = by_category
            .into_iter()
            .map(|(cat, tags)| (cat, tags.into_iter().map(|(t, _)| t).collect()))
            .collect();

        Ok(result)
    }
}

fn load_labels(path: &Path) -> Result<Labels, Box<dyn std::error::Error>> {
    let text = std::fs::read_to_string(path)?;
    let v: serde_json::Value = serde_json::from_str(&text)?;

    let tm = &v["dataset_info"]["tag_mapping"];
    let total = v["dataset_info"]["total_tags"]
        .as_u64()
        .ok_or("no dataset_info.total_tags")? as usize;

    let i2t = tm["idx_to_tag"]
        .as_object()
        .ok_or("no tag_mapping.idx_to_tag")?;
    let mut idx_to_tag = vec![String::new(); total];
    for (k, val) in i2t {
        let i: usize = k.parse()?;
        if i < total {
            idx_to_tag[i] = val.as_str().unwrap_or("").to_string();
        }
    }

    let t2c = tm["tag_to_category"]
        .as_object()
        .ok_or("no tag_mapping.tag_to_category")?;
    let mut tag_to_category = HashMap::with_capacity(t2c.len());
    for (k, val) in t2c {
        tag_to_category.insert(k.clone(), val.as_str().unwrap_or("general").to_string());
    }

    Ok(Labels { idx_to_tag, tag_to_category })
}

fn load_thresholds(
    path: &Path,
    profile: &str,
) -> Result<Thresholds, Box<dyn std::error::Error>> {
    let text = std::fs::read_to_string(path)?;
    let v: serde_json::Value = serde_json::from_str(&text)?;

    let mut per_category = HashMap::new();
    let mut overall = FALLBACK_THRESHOLD;

    for r in v["results"].as_array().ok_or("no results[]")? {
        if r["PROFILE"].as_str() != Some(profile) {
            continue;
        }
        let cat = r["CATEGORY"].as_str().unwrap_or("").to_lowercase();
        let th = r["THRESHOLD"].as_f64().unwrap_or(FALLBACK_THRESHOLD as f64) as f32;
        if cat == "overall" {
            overall = th;
        } else {
            per_category.insert(cat, th);
        }
    }

    Ok(Thresholds { per_category, overall })
}

fn sigmoid(x: f32) -> f32 {
    1.0 / (1.0 + (-x).exp())
}
