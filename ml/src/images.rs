use std::io::Cursor;
use image::{DynamicImage, GenericImageView, ImageReader, Limits};
use fast_image_resize::{PixelType, ResizeAlg, ResizeOptions, Resizer};
use fast_image_resize::FilterType::Lanczos3;
use fast_image_resize::images::Image;
use webp::Encoder;
use crate::error::AppError;

const THUMB_LONG_SIDE: u32 = 640;
const IMAGE_QUALITY: u32 = 75;

// Guard rails against decompression bombs
const MAX_IMAGE_DIMENSION: u32 = 12_000;
const MAX_DECODE_ALLOC: u64 = 256 * 1024 * 1024; // 256 MiB

/// Decodes raw bytes into a DynamicImage with strict resource limits
pub fn decode_image(data: &[u8]) -> Result<DynamicImage, AppError> {
    let mut limits = Limits::no_limits();
    limits.max_image_width = Some(MAX_IMAGE_DIMENSION);
    limits.max_image_height = Some(MAX_IMAGE_DIMENSION);
    limits.max_alloc = Some(MAX_DECODE_ALLOC);

    let mut reader = ImageReader::new(Cursor::new(data))
        .with_guessed_format()
        .map_err(|e| AppError::bad_request(format!("cannot read image header: {e}")))?;
    reader.limits(limits);

    reader
        .decode()
        .map_err(|e| AppError::bad_request(format!("not a valid image: {e}")))
}

pub fn create_thumbnail(orig_img: &DynamicImage) -> Vec<u8> {
    let (w, h) = orig_img.dimensions();
    let scale = THUMB_LONG_SIDE as f32 / w.max(h) as f32;

    let img = orig_img.to_rgba8();

    let src_image = Image::from_vec_u8(
        w,
        h,
        img.into_raw(),
        PixelType::U8x4,
    ).unwrap();

    let mut dst_img = Image::new(
        (w as f32 * scale) as u32,
        (h as f32 * scale) as u32,
        PixelType::U8x4,
    );

    let mut resizer = Resizer::new();
    resizer.resize(
        &src_image,
        &mut dst_img,
        &ResizeOptions::new().resize_alg(ResizeAlg::Convolution(Lanczos3))
    ).unwrap();

    let encoder = Encoder::from_rgba(dst_img.buffer(), dst_img.width(), dst_img.height());

    encoder.encode(IMAGE_QUALITY as f32).to_vec()
}
