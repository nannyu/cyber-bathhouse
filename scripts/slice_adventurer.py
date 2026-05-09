import os
import sys
from PIL import Image

def make_transparent(im, bg_color=(255, 255, 255), threshold=10):
    im = im.convert("RGBA")
    datas = im.getdata()
    newData = []
    for item in datas:
        # Check if color is close to white
        if all(abs(item[i] - bg_color[i]) < threshold for i in range(3)):
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
    im.putdata(newData)
    return im

def trim(im):
    bbox = im.getbbox()
    if bbox:
        return im.crop(bbox)
    return im

def slice_spritesheet(image_path, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    img = Image.open(image_path).convert('RGBA')
    width, height = img.size
    
    # UI Elements (Frames, Bars, Tags)
    ui_dir = os.path.join(output_dir, "ui")
    for subdir in ["frames", "bars", "tags"]:
        os.makedirs(os.path.join(ui_dir, subdir), exist_ok=True)

    # Avatar Frame (Bottom Left)
    trim(img.crop((15, 1000, 165, 1200))).save(os.path.join(ui_dir, "frames/avatar_frame.png"))
    
    # Bars (HP, MP, Name)
    trim(img.crop((200, 1030, 410, 1075))).save(os.path.join(ui_dir, "bars/hp_bar.png"))
    trim(img.crop((450, 1030, 665, 1075))).save(os.path.join(ui_dir, "bars/mp_bar.png"))
    trim(img.crop((720, 1025, 935, 1075))).save(os.path.join(ui_dir, "bars/name_plate.png"))
    
    # Tags P1-P4
    for i, name in enumerate(["p1", "p2", "p3", "p4"]):
        # Use a very wide window to be safe
        tag = img.crop((205 + i*155, 1100, 350 + i*155, 1250))
        trim(tag).save(os.path.join(ui_dir, f"tags/{name}.png"))

    # Character Actions
    sprite_root = os.path.join(output_dir, "adventurer")
    actions = {
        "idle": {"row": 0, "count": 5},
        "walk": {"row": 1, "count": 5},
        "run":  {"row": 2, "count": 5},
        "heavy_attack": {"row": 3, "count": 5}, # Row 3 in image is row 4 of grid?
        "knockdown": {"row": 5, "count": 5},
    }
    
    # Manual grid based on visual observation
    # Rows: 0-Idle, 1-Walk, 2-Run, 3-(?), 4-Heavy Attack, 5-Knockdown
    # Wait, looking at the image:
    # Row 1 (y~100): Idle
    # Row 2 (y~220): Walk
    # Row 3 (y~340): Run
    # Row 4 (y~460): ? (looks like another attack)
    # Row 5 (y~580): Heavy Attack
    # Row 6 (y~700): Knockdown
    
    action_map = [
        ("idle", 5), ("walk", 5), ("run", 6), ("attack_extra", 5), 
        ("heavy_attack", 5), ("knockdown", 5)
    ]
    
    for row, (action, count) in enumerate(action_map):
        action_dir = os.path.join(sprite_root, action)
        os.makedirs(action_dir, exist_ok=True)
        for col in range(count):
            left = 20 + col * 75
            top = 100 + row * 115
            # Special handling for text offset
            sprite_top = top + 35
            right = left + 80
            bottom = top + 115
            
            if right > width or bottom > height: continue
            sprite = img.crop((left, sprite_top, right, bottom))
            trimmed = trim(sprite)
            if trimmed.size[0] > 2 and trimmed.size[1] > 2:
                trimmed.save(os.path.join(action_dir, f"{col}.png"))

    print(f"Successfully categorized and sliced assets to {output_dir}")

    print(f"Sliced assets to {output_dir}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 slice_adventurer.py <input_image> <output_dir>")
    else:
        slice_spritesheet(sys.argv[1], sys.argv[2])
