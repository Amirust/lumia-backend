use std::collections::HashMap;
use std::sync::Arc;
use axum::body::Bytes;
use axum::extract::{Multipart, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use tokio::sync::Semaphore;
use crate::error::AppError;
use crate::images::{create_thumbnail, decode_image};
use crate::preprocess::image_to_nchw;
use crate::tagger::Tagger;

#[derive(Clone)]
pub struct AppState {
    pub tagger: Arc<Tagger>,
    pub permits: Arc<Semaphore>,
}

pub async fn tagger(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<HashMap<String, Vec<String>>>, AppError> {
    check_auth(&headers)?;

    let data = read_image_field(&mut multipart).await?;

    let _permit = state
        .permits
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| AppError::internal("worker pool closed"))?;

    let tagger = state.tagger.clone();
    let tags = tokio::task::spawn_blocking(move || -> Result<_, AppError> {
        let image = decode_image(&data)?;
        let preprocessed = image_to_nchw(&image);
        drop(image); // free the full-size bitmap before inference
        tagger.predict(preprocessed).map_err(AppError::internal)
    })
    .await
    .map_err(|e| AppError::internal(format!("inference task: {e}")))??;

    Ok(Json(tags))
}

pub async fn thumbnail(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    let data = read_image_field(&mut multipart).await?;

    let _permit = state
        .permits
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| AppError::internal("worker pool closed"))?;

    let thumbnail = tokio::task::spawn_blocking(move || -> Result<_, AppError> {
        let image = decode_image(&data)?;
        Ok(create_thumbnail(&image))
    })
    .await
    .map_err(|e| AppError::internal(format!("thumbnail task: {e}")))??;

    Ok((
        StatusCode::OK,
        [(header::CONTENT_TYPE, "image/webp")],
        thumbnail,
    ))
}

fn check_auth(headers: &HeaderMap) -> Result<(), AppError> {
    let env_api_key = std::env::var("ML_API_TOKEN").unwrap_or_default();
    if !env_api_key.is_empty() && !headers.contains_key(header::AUTHORIZATION) {
        return Err(AppError::bad_request("missing `Authorization` header"));
    }
    Ok(())
}

async fn read_image_field(multipart: &mut Multipart) -> Result<Bytes, AppError> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::bad_request(format!("multipart: {e}")))?
    {
        if field.name() == Some("image") {
            return field
                .bytes()
                .await
                .map_err(|e| AppError::bad_request(format!("read field: {e}")));
        }
    }

    Err(AppError::bad_request("field `image` is required"))
}
