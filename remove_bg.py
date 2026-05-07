from PIL import Image
import os

folder = r"C:\nas\mj\비즈니스\유튜브-SNS-캐릭터-애니\ai사이트\AI-mj공작실\02-Spark-Game-Studio\gun_zombie\assets"

def make_transparent(img_path):
    if not os.path.exists(img_path): return
    img = Image.open(img_path).convert("RGBA")
    datas = img.getdata()
    newData = []
    for item in datas:
        if item[0] > 230 and item[1] > 230 and item[2] > 230:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
    img.putdata(newData)
    img.save(img_path)

make_transparent(os.path.join(folder, "player1.png"))
make_transparent(os.path.join(folder, "player2.png"))
make_transparent(os.path.join(folder, "zombie1.png"))
make_transparent(os.path.join(folder, "zombie2.png"))
print("Done")
