import os
from PIL import Image, ImageDraw

def create_icon(size):
    # Create image with RGBA
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background rounded badge
    padding = max(1, int(size * 0.06))
    radius = int(size * 0.22)
    
    draw.rounded_rectangle(
        [(padding, padding), (size - padding, size - padding)],
        radius=radius,
        fill=(14, 116, 144, 255) # Cyan-700
    )
    
    # Inner accent
    inner_pad = max(2, int(size * 0.12))
    inner_rad = max(2, int(size * 0.18))
    draw.rounded_rectangle(
        [(inner_pad, inner_pad), (size - inner_pad, size - inner_pad)],
        radius=inner_rad,
        fill=(3, 105, 161, 255) # Sky-700
    )
    
    cx = size / 2.0
    cy = size / 2.0
    scale = size / 128.0
    
    # Arrow stem
    stem_w = max(2, int(22 * scale))
    stem_top = int(cy - 28 * scale)
    stem_bottom = int(cy + 6 * scale)
    draw.rectangle(
        [(cx - stem_w / 2, stem_top), (cx + stem_w / 2, stem_bottom)],
        fill=(255, 255, 255, 255)
    )
    
    # Arrow head (triangle pointing down)
    head_left = cx - 30 * scale
    head_right = cx + 30 * scale
    head_top = cy + 4 * scale
    head_bottom = cy + 28 * scale
    draw.polygon(
        [(head_left, head_top), (head_right, head_top), (cx, head_bottom)],
        fill=(255, 255, 255, 255)
    )
    
    # Bottom tray / line (indicating download target)
    tray_y = int(cy + 36 * scale)
    tray_h = max(2, int(8 * scale))
    tray_w = int(56 * scale)
    draw.rounded_rectangle(
        [(cx - tray_w / 2, tray_y), (cx + tray_w / 2, tray_y + tray_h)],
        radius=max(1, int(4 * scale)),
        fill=(52, 211, 153, 255) # Emerald-400 accent
    )
    
    return img

def main():
    icons_dir = os.path.join(os.path.dirname(__file__), 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    
    sizes = [16, 32, 48, 128]
    for s in sizes:
        icon = create_icon(s)
        path = os.path.join(icons_dir, f'icon-{s}.png')
        icon.save(path, 'PNG')
        print(f"Generated: {path} ({s}x{s})")

if __name__ == '__main__':
    main()
