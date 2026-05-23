use image::GenericImageView;
use fast_image_resize::{PixelType, ResizeAlg, ResizeOptions, Resizer};
use fast_image_resize::FilterType::Lanczos3;
use fast_image_resize::images::Image;
use webp::Encoder;

const THUMB_LONG_SIDE: u32 = 640;
const IMAGE_QUALITY: u32 = 75;

pub fn create_thumbnail(orig_img: &image::DynamicImage) -> Vec<u8> {
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