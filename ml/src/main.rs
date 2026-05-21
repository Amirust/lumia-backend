use ort::session::{Session, SessionOutputs};
use image::imageops::FilterType;
use ndarray::Array;
use std::path::Path;
use image::GenericImageView;
use ort::inputs;
use ort::value::TensorRef;
use std::collections::HashMap;

// --- параметры препроцессинга Camie-Tagger-V2 ---
const IMG_SIZE: u32 = 512;
const PAD_COLOR: [u8; 3] = [124, 116, 104]; // ~ImageNet mean
const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const STD: [f32; 3] = [0.229, 0.224, 0.225];

// Профиль порогов из tagger_new_val_res.json: "BALANCED" | "MACRO OPT" | "MICRO OPT"
const PROFILE: &str = "BALANCED";
const FALLBACK_THRESHOLD: f32 = 0.5;

/// Метки из tagger_new_meta.json -> dataset_info.tag_mapping.
struct Labels {
    idx_to_tag: Vec<String>,                  // индекс выхода -> имя тега
    tag_to_category: HashMap<String, String>, // имя тега -> категория
}

fn load_labels(path: &Path) -> Result<Labels, Box<dyn std::error::Error>> {
    let text = std::fs::read_to_string(path)?;
    let v: serde_json::Value = serde_json::from_str(&text)?;

    let tm = &v["dataset_info"]["tag_mapping"];
    let total = v["dataset_info"]["total_tags"]
        .as_u64()
        .ok_or("нет dataset_info.total_tags")? as usize;

    let i2t = tm["idx_to_tag"]
        .as_object()
        .ok_or("нет tag_mapping.idx_to_tag")?;
    let mut idx_to_tag = vec![String::new(); total];
    for (k, val) in i2t {
        let i: usize = k.parse()?;
        if i < total {
            idx_to_tag[i] = val.as_str().unwrap_or("").to_string();
        }
    }

    let t2c = tm["tag_to_category"]
        .as_object()
        .ok_or("нет tag_mapping.tag_to_category")?;
    let mut tag_to_category = HashMap::with_capacity(t2c.len());
    for (k, val) in t2c {
        tag_to_category.insert(k.clone(), val.as_str().unwrap_or("general").to_string());
    }

    Ok(Labels { idx_to_tag, tag_to_category })
}

/// Пороги для выбранного профиля: (категория(нижний регистр) -> порог, общий fallback).
fn load_thresholds(
    path: &Path,
    profile: &str,
) -> Result<(HashMap<String, f32>, f32), Box<dyn std::error::Error>> {
    let text = std::fs::read_to_string(path)?;
    let v: serde_json::Value = serde_json::from_str(&text)?;

    let mut per_category = HashMap::new();
    let mut overall = FALLBACK_THRESHOLD;

    for r in v["results"].as_array().ok_or("нет results[]")? {
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

    Ok((per_category, overall))
}

fn sigmoid(x: f32) -> f32 {
    1.0 / (1.0 + (-x).exp())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));

    // --- препроцессинг: RGB, square-pad цветом PAD_COLOR, resize 512, NCHW, ImageNet-норма ---
    let original_img = image::open(manifest.join("../").join("dataset").join("test4.png"))?;

    let rgb = original_img.to_rgb8();
    let (w, h) = rgb.dimensions();
    let size = w.max(h);
    let mut canvas = image::RgbImage::from_pixel(size, size, image::Rgb(PAD_COLOR));
    image::imageops::overlay(&mut canvas, &rgb, ((size - w) / 2) as i64, ((size - h) / 2) as i64);
    let img =
        image::DynamicImage::ImageRgb8(canvas).resize_exact(IMG_SIZE, IMG_SIZE, FilterType::CatmullRom);

    // NCHW [1, 3, 512, 512], RGB, нормализация (x/255 - mean) / std
    let mut input = Array::zeros((1, 3, IMG_SIZE as usize, IMG_SIZE as usize));
    for pixel in img.pixels() {
        let x = pixel.0 as usize;
        let y = pixel.1 as usize;
        let [r, g, b, _] = pixel.2.0;
        input[[0, 0, y, x]] = (r as f32 / 255.0 - MEAN[0]) / STD[0];
        input[[0, 1, y, x]] = (g as f32 / 255.0 - MEAN[1]) / STD[1];
        input[[0, 2, y, x]] = (b as f32 / 255.0 - MEAN[2]) / STD[2];
    }

    // --- модель ---
    let mut model = Session::builder()?
        .commit_from_file(manifest.join("models").join("tagger_new.onnx"))?;

    let outputs: SessionOutputs =
        model.run(inputs![TensorRef::from_array_view(&input)?])?;

    // Выходы: 0 = initial_predictions, 1 = refined_predictions, 2 = selected_candidates(int64).
    // Берём refined (логиты) и применяем sigmoid вручную.
    let (_shape, logits) = outputs[1].try_extract_tensor::<f32>()?;

    // --- метки и пороги ---
    let labels = load_labels(&manifest.join("models").join("tagger_new_meta.json"))?;
    let (per_category, overall) =
        load_thresholds(&manifest.join("models").join("tagger_new_val_res.json"), PROFILE)?;

    if labels.idx_to_tag.len() != logits.len() {
        return Err(format!(
            "число меток ({}) не совпадает с выходом модели ({})",
            labels.idx_to_tag.len(),
            logits.len()
        )
        .into());
    }

    // --- постпроцессинг: sigmoid + порог по категории, группировка ---
    let mut by_category: HashMap<String, Vec<(String, f32)>> = HashMap::new();
    for (i, &logit) in logits.iter().enumerate() {
        let prob = sigmoid(logit);
        let tag = &labels.idx_to_tag[i];
        let category = labels
            .tag_to_category
            .get(tag)
            .map(|s| s.as_str())
            .unwrap_or("general");
        let threshold = per_category.get(category).copied().unwrap_or(overall);
        if prob >= threshold {
            by_category
                .entry(category.to_string())
                .or_default()
                .push((tag.clone(), prob));
        }
    }

    // сортировка внутри категории по убыванию вероятности
    for tags in by_category.values_mut() {
        tags.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    }

    // общий список тегов (caption), категории в стабильном порядке
    let category_order = ["rating", "character", "copyright", "artist", "general", "meta", "year"];
    let mut caption_parts: Vec<String> = Vec::new();
    for cat in category_order {
        if let Some(tags) = by_category.get(cat) {
            caption_parts.extend(tags.iter().map(|(t, _)| t.clone()));
        }
    }
    let caption = caption_parts.join(", ");
    let taglist = caption.replace('_', " ").replace('(', "\\(").replace(')', "\\)");

    println!("Профиль порогов: {PROFILE}");
    println!("--------");
    println!("Caption: {caption}");
    println!("--------");
    println!("Tags: {taglist}");

    for cat in category_order {
        if let Some(tags) = by_category.get(cat) {
            let th = per_category.get(cat).copied().unwrap_or(overall);
            println!("--------");
            println!("{} (threshold={th:.3}, {} tags):", cat.to_uppercase(), tags.len());
            for (tag, prob) in tags {
                println!("  {tag}: {prob:.3}");
            }
        }
    }

    println!("--------");
    println!("Done!");
    Ok(())
}
