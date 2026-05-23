use image::GenericImageView;
use image::imageops::FilterType;
use ndarray::Array;

const IMG_SIZE: u32 = 512;
const PAD_COLOR: [u8; 3] = [124, 116, 104]; // ~ImageNet mean
const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const STD: [f32; 3] = [0.229, 0.224, 0.225];

pub fn image_to_nchw(orig_img: &image::DynamicImage) -> Array<f32, ndarray::Dim<[usize; 4]>> {
    let rgb = orig_img.to_rgb8();
    let (w, h) = rgb.dimensions();
    let size = w.max(h);

    let mut canvas = image::RgbImage::from_pixel(size, size, image::Rgb(PAD_COLOR));
    image::imageops::overlay(&mut canvas, &rgb, ((size - w) / 2) as i64, ((size - h) / 2) as i64);
    let img = image::DynamicImage::ImageRgb8(canvas).resize_exact(IMG_SIZE, IMG_SIZE, FilterType::CatmullRom);

    // NCHW [1, 3, 512, 512], RGB, normalisation (x/255 - mean) / std
    let mut input = Array::zeros((1, 3, IMG_SIZE as usize, IMG_SIZE as usize));
    for pixel in img.pixels() {
        let x = pixel.0 as usize;
        let y = pixel.1 as usize;
        let [r, g, b, _] = pixel.2.0;
        input[[0, 0, y, x]] = (r as f32 / 255.0 - MEAN[0]) / STD[0];
        input[[0, 1, y, x]] = (g as f32 / 255.0 - MEAN[1]) / STD[1];
        input[[0, 2, y, x]] = (b as f32 / 255.0 - MEAN[2]) / STD[2];
    }

    input
}
