from PIL import Image
import os

# Source generated paths from the Brain directory
brain_dir = r"C:\Users\mj\.gemini\antigravity\brain\f2e47261-912f-4025-a15c-1467ab7565e4"
sources = {
    "bg.png": os.path.join(brain_dir, "bg_1778503952171.png"),
    "player1.png": os.path.join(brain_dir, "player1_1778503971293.png"),
    "player2.png": os.path.join(brain_dir, "player2_1778504364642.png"),
    "player3.png": os.path.join(brain_dir, "player3_1778504384264.png"),
    "zombie1.png": os.path.join(brain_dir, "zombie1_1778503989090.png"),
    "zombie2.png": os.path.join(brain_dir, "zombie2_1778504400794.png"),
    "zombie3.png": os.path.join(brain_dir, "zombie3_1778504419650.png")
}

# Target game assets directory
target_dir = r"c:\nas\mj\비즈니스\유튜브-SNS-캐릭터-애니\ai사이트\AI-mj공작실\02-Spark-Game-Studio\gun_zombie\assets"
os.makedirs(target_dir, exist_ok=True)

def process_and_copy():
    print("Starting Premium Background Removal (누끼 따기) & Copying...")
    
    for filename, src_path in sources.items():
        if not os.path.exists(src_path):
            print(f"Warning: Source file not found: {src_path}")
            continue
            
        dest_path = os.path.join(target_dir, filename)
        
        if filename == "bg.png":
            img = Image.open(src_path)
            img.save(dest_path)
            print(f"Successfully copied background to {dest_path}")
        else:
            print(f"Removing white background from {filename}...")
            img = Image.open(src_path).convert("RGBA")
            datas = img.getdata()
            
            newData = []
            for item in datas:
                r, g, b, a = item
                # Threshold for pure/near-pure white backgrounds
                if r > 215 and g > 215 and b > 215:
                    # Antialias edges smoothly based on brightness
                    diff = max(r, g, b) - 215
                    alpha = max(0, int(255 - (diff * 6)))
                    if alpha == 0:
                        newData.append((255, 255, 255, 0))
                    else:
                        newData.append((r, g, b, alpha))
                else:
                    newData.append(item)
                    
            img.putdata(newData)
            img.save(dest_path)
            print(f"Successfully processed and saved transparent {filename} to {dest_path}")

if __name__ == "__main__":
    process_and_copy()
    print("\nAll done! Run the game now!")
