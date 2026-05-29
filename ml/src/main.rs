mod config;
mod routes;
mod preprocess;
mod tagger;
mod images;

use axum::{
    routing::{post},
    Router,
};
use axum::extract::DefaultBodyLimit;

use crate::routes::tagger;
use crate::routes::thumbnail;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let app = Router::new()
        .layer(DefaultBodyLimit::max(6 * 1024 * 1024)) // 6 MB
        .route("/tags", post(tagger))
        .route("/thumbnail", post(thumbnail));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .unwrap();

    axum::serve(listener, app)
        .await
        .expect("failed to start server");
}