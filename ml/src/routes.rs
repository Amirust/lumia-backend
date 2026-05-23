use std::collections::HashMap;
use std::time::SystemTime;
use axum::extract::Multipart;
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
use crate::config::{get_labels_path, get_tagger_model_path, get_thresholds_path};
use crate::images::create_thumbnail;
use crate::preprocess::image_to_nchw;
use crate::tagger::get_tags;

pub struct AppError {
    status: StatusCode,
    message: String,
}

impl AppError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self { status: StatusCode::BAD_REQUEST, message: msg.into() }
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self { status: StatusCode::INTERNAL_SERVER_ERROR, message: msg.into() }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}

pub async fn tagger(
    mut multipart: Multipart,
) -> Result<Json<HashMap<String, Vec<String>>>, AppError> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::bad_request(format!("multipart: {e}")))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name != "image" {
            continue;
        }

        let data = field
            .bytes()
            .await
            .map_err(|e| AppError::bad_request(format!("read field: {e}")))?;

        let orig_image = image::load_from_memory(&data)
            .map_err(|e| AppError::bad_request(format!("not an image: {e}")))?;
        let preprocessed = image_to_nchw(&orig_image);

        let tags = get_tags(
            get_tagger_model_path().as_path(),
            get_labels_path().as_path(),
            get_thresholds_path().as_path(),
            preprocessed,
        )
        .map_err(|e| AppError::internal(format!("tagger: {e}")))?;

        return Ok(Json(tags));
    }

    Err(AppError::bad_request("field `image` is required"))
}

pub async fn thumbnail(
    mut multipart: Multipart,
) -> impl IntoResponse {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::bad_request(format!("multipart: {e}")))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name != "image" {
            continue;
        }

        let data = field
            .bytes()
            .await
            .map_err(|e| AppError::bad_request(format!("read field: {e}")))?;

        let orig_image = image::load_from_memory(&data)
            .map_err(|e| AppError::bad_request(format!("not an image: {e}")))?;

        let thumbnail = create_thumbnail(&orig_image);

        return Ok((
            StatusCode::OK,
            [(header::CONTENT_TYPE, "image/webp")],
            thumbnail
        ));
    }

    Err(AppError::bad_request("field `image` is required"))
}