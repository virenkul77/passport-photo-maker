import io, os, base64
import logging

try:
    from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
except Exception as e:
    logging.getLogger(__name__).warning("Flask is not installed. Please install it with 'pip install Flask. %s", e)
    
from PIL import Image, ImageOps, ImageDraw
from werkzeug.utils import secure_filename

# Optional background removal (install with: pip install rembg)
try:
    from rembg import remove
except Exception as e:
    remove = None
    logging.getLogger(__name__).warning("rembg library not available; background removal disabled. %s", e)

app = Flask(__name__)
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# configure logging
logging.basicConfig(level=logging.INFO)
app.logger.setLevel(logging.INFO)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    # Accept either multipart/form-data with a file ("photo")
    # or JSON with {"selected": "<filename>"} referring to an existing uploaded file.
    selected_filename = None
    image_path = None

    if request.is_json:
        data = request.get_json(silent=True) or {}
        selected_filename = data.get("selected")
        if selected_filename:
            image_path = os.path.join(UPLOAD_FOLDER, selected_filename)
            if not os.path.isfile(image_path):
                app.logger.error("Selected file not found: %s", image_path)
                return jsonify({"error": "Selected file not found"}), 400

    file = request.files.get('photo')
    if file and not image_path:
        path = os.path.join(UPLOAD_FOLDER, file.filename)
        try:
            file.save(path)
            image_path = path
        except Exception as e:
            app.logger.exception("Failed to save uploaded file: %s", e)
            return jsonify({'error': 'Failed to save file'}), 500

    if not image_path:
        app.logger.error("No file provided and no selection made")
        return jsonify({'error': 'No file uploaded or selected'}), 400

    try:
        image = Image.open(image_path)
    except Exception as e:
        app.logger.exception("Failed to open image '%s': %s", image_path, e)
        return jsonify({'error': 'Invalid image file'}), 400

    # Respect EXIF orientation
    try:
        image = ImageOps.exif_transpose(image)
        image = image.convert("RGB")
    except Exception as e:
        app.logger.exception("Failed to normalize image orientation/convert: %s", e)
        # continue with original image as fallback

    # If rembg is available, remove detected background and composite onto white
    def remove_background_pil(img):
        if not remove:
            app.logger.error("rembg not available; skipping background removal")
            return img
        try:
            app.logger.info("Removing background from image")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG")
            img_bytes = img_bytes.getvalue()
            result_bytes = remove(img_bytes)
            result_img = Image.open(io.BytesIO(result_bytes)).convert("RGBA")
            # Composite over white background
            white_bg = Image.new("RGBA", result_img.size, (255, 255, 255, 255))
            composed = Image.alpha_composite(white_bg, result_img).convert("RGB")
            return composed
        except Exception as e:
            app.logger.exception("Background removal failed: %s", e)
            return img

    image = remove_background_pil(image)

    # Paper and grid configuration
    DPI = 300
    paper_width_in = 6   # width in inches (landscape: 6in x 4in)
    paper_height_in = 4
    cols = 4             # 4 images per row
    rows = 2             # 2 rows -> total 8 images

    canvas_w = int(paper_width_in * DPI)   # 1800 px
    canvas_h = int(paper_height_in * DPI)  # 1200 px

    # Desired physical size per passport image (mm)
    slot_mm_w = 35.0
    slot_mm_h = 45.0  # height changed to 45 mm

    # Convert desired mm -> pixels using DPI
    desired_slot_w = int(round((slot_mm_w / 25.4) * DPI))
    desired_slot_h = int(round((slot_mm_h / 25.4) * DPI))

    # Minimum separator/gap (px) between photos and at edges
    min_sep = 8

    # Compute separator sizes to place slots on canvas; if slots don't fit, scale slots down
    sep_x = max(min_sep, (canvas_w - cols * desired_slot_w) // (cols + 1))
    sep_y = max(min_sep, (canvas_h - rows * desired_slot_h) // (rows + 1))

    total_needed_w = cols * desired_slot_w + (cols + 1) * sep_x
    total_needed_h = rows * desired_slot_h + (rows + 1) * sep_y

    # If required space exceeds canvas, compute a uniform scale to shrink slots (but keep min_sep)
    if total_needed_w > canvas_w or total_needed_h > canvas_h:
        # compute scale factors
        available_w = max(min_sep * (cols + 1), canvas_w - min_sep * (cols + 1))
        available_h = max(min_sep * (rows + 1), canvas_h - min_sep * (rows + 1))
        scale_w = (canvas_w - (cols + 1) * min_sep) / (cols * desired_slot_w) if (canvas_w - (cols + 1) * min_sep) > 0 else 1.0
        scale_h = (canvas_h - (rows + 1) * min_sep) / (rows * desired_slot_h) if (canvas_h - (rows + 1) * min_sep) > 0 else 1.0
        scale = min(scale_w, scale_h, 1.0)
        if scale <= 0:
            scale = 1.0
        desired_slot_w = max(1, int(round(desired_slot_w * scale)))
        desired_slot_h = max(1, int(round(desired_slot_h * scale)))
        # recompute separators
        sep_x = max(min_sep, (canvas_w - cols * desired_slot_w) // (cols + 1))
        sep_y = max(min_sep, (canvas_h - rows * desired_slot_h) // (rows + 1))

    slot_w = desired_slot_w
    slot_h = desired_slot_h
    passport_size = (slot_w, slot_h)

    border_px = 2  # black border thickness in pixels around each photo
    bg_color = "white"
    border_color = "black"

    # Inner area available for the photo after accounting for border (photo sits inside the black border)
    inner_size = (max(1, slot_w - 2 * border_px),
                  max(1, slot_h - 2 * border_px))

    # Prepare the slot image (white background slot, photo centered/cropped to fill, black border snug around photo)
    def make_slot(src_img):
        slot = Image.new("RGB", passport_size, bg_color)

        # Crop & resize to completely fill the inner area while preserving aspect ratio.
        try:
            img_copy = ImageOps.fit(src_img, inner_size, method=Image.LANCZOS, centering=(0.5, 0.5)).convert("RGB")
        except Exception as e:
            app.logger.exception("Image fit/crop failed, falling back to thumbnail: %s", e)
            img_copy = src_img.copy()
            img_copy.thumbnail(inner_size, Image.LANCZOS)

        # Paste image flush inside the black border area
        paste_x = border_px
        paste_y = border_px
        slot.paste(img_copy, (int(paste_x), int(paste_y)))

        # Draw black border snug around the pasted image
        draw = ImageDraw.Draw(slot)
        left = int(paste_x)
        top = int(paste_y)
        right = int(paste_x + img_copy.width - 1)
        bottom = int(paste_y + img_copy.height - 1)

        # Ensure coords inside slot
        left = max(0, left)
        top = max(0, top)
        right = min(slot_w - 1, right)
        bottom = min(slot_h - 1, bottom)

        try:
            draw.rectangle([left, top, right, bottom], outline=border_color, width=border_px)
        except TypeError:
            # Pillow older versions do not support width param; draw filled rectangles as fallback
            # top
            draw.rectangle([left, top, right, top + border_px - 1], fill=border_color)
            # bottom
            draw.rectangle([left, bottom - border_px + 1, right, bottom], fill=border_color)
            # left
            draw.rectangle([left, top, left + border_px - 1, bottom], fill=border_color)
            # right
            draw.rectangle([right - border_px + 1, top, right, bottom], fill=border_color)

        return slot

    try:
        slot_photo = make_slot(image)
    except Exception as e:
        app.logger.exception("Failed to create slot photo: %s", e)
        return jsonify({'error': 'Processing failed'}), 500

    # Create canvas matching 6x4 inches at DPI (landscape) with white background (serves as separators)
    canvas = Image.new("RGB", (canvas_w, canvas_h), bg_color)

    # Paste grid of passport photos with computed separators (white gaps)
    for row in range(rows):
        for col in range(cols):
            x = sep_x + col * (slot_w + sep_x)
            y = sep_y + row * (slot_h + sep_y)
            canvas.paste(slot_photo, (int(x), int(y)))

    # draw dashed (cut) lines centered in the separator gaps between rows/columns
    draw = ImageDraw.Draw(canvas)
    dash_len = 6   # length of dash segment in pixels (small => dotted)
    gap_len = 6    # gap between dash segments
    line_width = 1
    line_color = (80, 80, 80)  # subtle gray for cut guide

    def draw_dashed_vertical(x, y1, y2, dash=dash_len, gap=gap_len, width=line_width, fill=line_color):
        y = int(y1)
        while y < int(y2):
            y_end = min(int(y2), y + dash)
            draw.line([(int(x), y), (int(x), y_end)], fill=fill, width=width)
            y += dash + gap

    def draw_dashed_horizontal(x1, x2, y, dash=dash_len, gap=gap_len, width=line_width, fill=line_color):
        x = int(x1)
        while x < int(x2):
            x_end = min(int(x2), x + dash)
            draw.line([(x, int(y)), (x_end, int(y))], fill=fill, width=width)
            x += dash + gap

    # vertical cut lines between columns
    for k in range(1, cols):
        x_center = sep_x + k * (slot_w + sep_x) - sep_x / 2.0
        # draw from small margin from top to bottom (leave a little margin)
        y_top = int(sep_y * 0.25)
        y_bottom = int(canvas_h - sep_y * 0.25)
        draw_dashed_vertical(round(x_center), y_top, y_bottom)

    # horizontal cut lines between rows
    for r in range(1, rows):
        y_center = sep_y + r * (slot_h + sep_y) - sep_y / 2.0
        x_left = int(sep_x * 0.25)
        x_right = int(canvas_w - sep_x * 0.25)
        draw_dashed_horizontal(x_left, x_right, round(y_center))

    # Convert to base64 for preview
    buffer = io.BytesIO()
    try:
        canvas.save(buffer, format="JPEG", quality=95)
    except Exception as e:
        app.logger.exception("Failed to encode output image: %s", e)
        return jsonify({'error': 'Failed to generate preview'}), 500

    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

    return jsonify({'preview': f"data:image/jpeg;base64,{img_base64}"})

@app.route('/download', methods=['POST'])
def download():
    data = request.json
    if 'image' not in data:
        app.logger.error("Download failed: missing image data in request")
        return jsonify({'error': 'Missing image data'}), 400

    try:
        # Convert base64 to image
        image_data = base64.b64decode(data['image'].split(',')[1])
    except Exception as e:
        app.logger.exception("Failed to decode base64 image for download: %s", e)
        return jsonify({'error': 'Invalid image data'}), 400

    output = io.BytesIO(image_data)
    output.seek(0)
    return send_file(output, mimetype='image/jpeg', as_attachment=True, download_name='passport_4x6.jpg')

@app.route('/list_uploads', methods=['GET'])
def list_uploads():
    try:
        files = sorted(
            [f for f in os.listdir(UPLOAD_FOLDER)
             if os.path.isfile(os.path.join(UPLOAD_FOLDER, f))],
            reverse=True
        )
        return jsonify({"files": files})
    except Exception as e:
        app.logger.exception("Failed to list uploads: %s", e)
        return jsonify({"files": [], "error": "Failed to list uploads"}), 500

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    try:
        return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=False)
    except Exception as e:
        app.logger.exception("Failed to serve upload '%s': %s", filename, e)
        return "", 404

@app.route('/save_cropped', methods=['POST'])
def save_cropped():
    try:
        data = request.get_json(silent=True) or {}
        filename = data.get("filename", "").strip()
        image_data = data.get("image", "")
        if not filename or not image_data:
            app.logger.error("save_cropped: missing filename or image")
            return jsonify({"error":"Missing filename or image data"}), 400

        # sanitize filename
        filename = secure_filename(os.path.basename(filename))
        # determine extension from data URL mime
        if "," not in image_data:
            return jsonify({"error":"Invalid image data"}), 400
        header, b64 = image_data.split(",",1)
        mime = header.split(";")[0].split(":")[-1]
        ext = ".png" if "png" in mime else ".jpg"
        if not os.path.splitext(filename)[1]:
            filename = filename + ext

        save_path = os.path.join(UPLOAD_FOLDER, filename)
        # decode and save via PIL to normalize
        try:
            img_bytes = base64.b64decode(b64)
        except Exception as e:
            app.logger.exception("Failed to decode base64 in save_cropped: %s", e)
            return jsonify({"error":"Invalid base64 image data"}), 400

        try:
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            img.save(save_path)
        except Exception as e:
            app.logger.exception("Failed to save cropped image: %s", e)
            return jsonify({"error":"Failed to save image"}), 500

        app.logger.info("Saved cropped image: %s", save_path)
        return jsonify({"filename": filename}), 200
    except Exception as e:
        app.logger.exception("Unexpected error in save_cropped: %s", e)
        return jsonify({"error":"Server error"}), 500

if __name__ == '__main__':
    app.run(debug=True)