mod config;
mod error;
mod routes;
mod preprocess;
mod tagger;
mod images;

use std::sync::Arc;
use axum::routing::post;
use axum::Router;
use axum::extract::DefaultBodyLimit;
use tokio::sync::Semaphore;

use crate::config::{get_labels_path, get_tagger_model_path, get_thresholds_path};
use crate::routes::{tagger, thumbnail, AppState};
use crate::tagger::Tagger;

const MAX_BODY_BYTES: usize = 6 * 1024 * 1024; // 6 MB
const MAX_CONCURRENT_JOBS: usize = 2;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // Load the model + labels + thresholds
    let model = Tagger::load(
        get_tagger_model_path().as_path(),
        get_labels_path().as_path(),
        get_thresholds_path().as_path(),
    )
    .expect("failed to load tagger model");

    let state = AppState {
        tagger: Arc::new(model),
        permits: Arc::new(Semaphore::new(MAX_CONCURRENT_JOBS)),
    };

    let app = Router::new()
        .route("/tags", post(tagger))
        .route("/thumbnail", post(thumbnail))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .unwrap();

    println!("listening on 0.0.0.0:3000");
    axum::serve(listener, app)
        .await
        .expect("failed to start server");
}
