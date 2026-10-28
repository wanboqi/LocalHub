"""生成 LocalHub 应用图标（ICO，含多尺寸 BMP 条目）。

不依赖 Pillow：纯标准库计算像素，直接写出 32bpp BMP + ICO 容器。
运行：python tools/make_icon.py
"""

import os
import struct

SIZES = (256, 128, 64, 48, 32, 16)
BG_TOP = (0x2F, 0x6B, 0xFF)  # 渐变起
BG_BOTTOM = (0x6F, 0x95, 0xFF)  # 渐变止
FG = (255, 255, 255)
ACCENT = (0x2F, 0x6B, 0xFF)
SS = 3  # 超采样倍数，用于抗锯齿


def inside_rounded(px, py, x0, y0, x1, y1, r):
    cx = min(max(px, x0 + r), x1 - r)
    cy = min(max(py, y0 + r), y1 - r)
    dx = px - cx
    dy = py - cy
    return dx * dx + dy * dy <= r * r


def inside_rect(px, py, x0, y0, x1, y1):
    return x0 <= px <= x1 and y0 <= py <= y1


def inside(px, py):
    """归一化坐标 (0~1) 下的命中测试，返回 (背景命中, 白色文件夹, 蓝色横条)"""
    bg = inside_rounded(px, py, 0.03, 0.03, 0.97, 0.97, 0.22)
    folder = inside_rounded(px, py, 0.20, 0.40, 0.80, 0.82, 0.05) or inside_rounded(
        px, py, 0.20, 0.30, 0.47, 0.44, 0.05
    )
    bar = inside_rect(px, py, 0.29, 0.52, 0.71, 0.58)
    return bg, folder, bar


def render(size):
    """返回 top-down 的 RGBA 像素列表"""
    step = 1.0 / (size * SS)
    out = []
    for y in range(size):
        for x in range(size):
            acc = [0, 0, 0, 0]
            n = 0
            for sy in range(SS):
                for sx in range(SS):
                    px = (x + (sx + 0.5) / SS) / size
                    py = (y + (sy + 0.5) / SS) / size
                    n += 1
                    bg, folder, bar = inside(px, py)
                    if not bg:
                        continue
                    t = (px + py) / 2.0
                    if folder:
                        color = ACCENT if bar else FG
                    else:
                        color = (
                            int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t),
                            int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t),
                            int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t),
                        )
                    acc[0] += color[0]
                    acc[1] += color[1]
                    acc[2] += color[2]
                    acc[3] += 255
            if acc[3] == 0:
                out.append((0, 0, 0, 0))
            else:
                a = acc[3] // n
                out.append((acc[0] // n, acc[1] // n, acc[2] // n, a))
    return out


def bmp_entry(size):
    pixels = render(size)
    rows = bytearray()
    for y in range(size - 1, -1, -1):  # BMP 自下而上
        for x in range(size):
            r, g, b, a = pixels[y * size + x]
            rows += bytes((b, g, r, a))
    img = bytes(rows)
    mask_row = ((size + 31) // 32) * 4  # AND mask 每行字节数（4 字节对齐）
    mask = b"\x00" * (mask_row * size)
    header = struct.pack(
        "<IiiHHIIiiII",
        40,  # biSize
        size,  # biWidth
        size * 2,  # biHeight（含 mask）
        1,  # biPlanes
        32,  # biBitCount
        0,  # BI_RGB
        len(img) + len(mask),
        0,
        0,
        0,
        0,
    )
    return header + img + mask


def main():
    entries = [(s, bmp_entry(s)) for s in SIZES]
    out = bytearray(struct.pack("<HHH", 0, 1, len(entries)))
    offset = 6 + 16 * len(entries)
    for size, blob in entries:
        out += struct.pack(
            "<BBBBHHII",
            size if size < 256 else 0,
            size if size < 256 else 0,
            0,
            0,
            1,
            32,
            len(blob),
            offset,
        )
        offset += len(blob)
    for _, blob in entries:
        out += blob

    target = os.path.join(os.path.dirname(__file__), "..", "public", "icon.ico")
    target = os.path.abspath(target)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, "wb") as f:
        f.write(out)
    print(f"written: {target} ({len(out)} bytes, sizes={list(SIZES)})")


if __name__ == "__main__":
    main()
