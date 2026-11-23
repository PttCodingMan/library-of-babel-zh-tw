"""產生 src/hanzi.txt（Big5/cp950 全部漢字），並組合出單檔 index.html。"""
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"


def big5_hanzi() -> str:
    chars, seen = [], set()
    for lead in range(0xA4, 0xFA):
        for trail in [*range(0x40, 0x7F), *range(0xA1, 0xFF)]:
            try:
                c = bytes([lead, trail]).decode("cp950")
            except UnicodeDecodeError:
                continue
            o = ord(c) if len(c) == 1 else -1
            if (0x4E00 <= o <= 0x9FFF or 0x3400 <= o <= 0x4DBF or 0xF900 <= o <= 0xFAFF) and c not in seen:
                seen.add(c)
                chars.append(c)
    return "".join(chars)


def main() -> None:
    hanzi = big5_hanzi()
    (SRC / "hanzi.txt").write_text(hanzi, encoding="utf-8")
    html = (SRC / "template.html").read_text(encoding="utf-8")
    html = html.replace("/*HANZI*/", hanzi).replace("/*CORE*/", (SRC / "core.js").read_text(encoding="utf-8"))
    (ROOT / "index.html").write_text(html, encoding="utf-8")
    print(f"{len(hanzi)} 個漢字，index.html 已產生")


if __name__ == "__main__":
    main()
