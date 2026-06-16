#!/usr/bin/env python3
"""Builds a 10-second vertical (1080x1920) brand ad for the Vinted Brand Dashboard
entirely with ffmpeg. Four seamless segments on an identical dark background +
a soft music bed. No external footage, no AI credits."""
import os, subprocess, shutil

WORK = os.path.join(os.path.dirname(__file__), "work")
os.chdir(WORK)

# ---- brand palette (from the dashboard) ----
BG     = "0x0a0a0a"
GOLD   = "0xc9a84c"
WHITE  = "0xf5f5f5"
MUTED  = "0x9ca3af"
BLUE   = "0x3b82f6"  # SOURCED
AMBER  = "0xf59e0b"  # IN TRANSIT
GREEN  = "0x22c55e"  # IN STOCK
GREY   = "0x9ca3af"  # SOLD

BLACK_F = "black.ttf"
BOLD_F  = "bold.ttf"

def fade(a, D, fin=0.4, fout=0.35, hold_end=False):
    """alpha expression (single-quoted in the filter, so commas/colons are literal)."""
    if hold_end:
        return f"if(lt(t,{a}),0,if(lt(t,{a+fin}),(t-{a})/{fin},1))"
    return (f"if(lt(t,{a}),0,if(lt(t,{a+fin}),(t-{a})/{fin},"
            f"if(gt(t,{D-fout}),({D}-t)/{fout},1)))")

def dt(text, font, color, size, y, a, D, x="(w-text_w)/2", hold_end=False, bold=False):
    """one drawtext filter string with a fade. text/alpha wrapped in single quotes."""
    al = fade(a, D, hold_end=hold_end)
    return (f"drawtext=fontfile={font}:text='{text}':fontcolor={color}:fontsize={size}"
            f":x={x}:y={y}:alpha='{al}':line_spacing=12")

def box(x, y, w, h, color, a, D, hold_end=False):
    en = f"gte(t,{a})" if hold_end else f"between(t,{a},{D})"
    return f"drawbox=x={x}:y={y}:w={w}:h={h}:color={color}:t=fill:enable='{en}'"

def render(name, D, filters):
    vf = ",".join(filters)
    cmd = ["ffmpeg","-y","-f","lavfi","-i",f"color=c={BG}:s=1080x1920:r=30:d={D}",
           "-vf",vf,"-frames:v",str(int(D*30)),
           "-c:v","libx264","-pix_fmt","yuv420p","-preset","medium","-crf","18", name]
    print("rendering", name)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2500:]); raise SystemExit(f"FAILED {name}")

# ---------- SEGMENT 1 — hook (3.0s) ----------
D1 = 3.0
seg1 = [
    box(440, 720, 200, 5, GOLD, 0.15, D1),                                   # gold accent bar
    dt("FOR LUXURY RESELLERS", BOLD_F, GOLD, 38, 640, 0.15, D1),
    dt("Reselling bags?",      BLACK_F, WHITE, 90,  860, 0.35, D1),
    dt("Stop guessing.",       BLACK_F, GOLD,  104, 990, 0.65, D1),
]
render("seg1.mp4", D1, seg1)

# ---------- SEGMENT 2 — the 4-stage flow + profit (3.6s) ----------
D2 = 3.6
LX = 300
seg2 = [
    dt("FROM SOURCED TO SOLD", BOLD_F, GOLD, 42, 470, 0.10, D2),
    # status lines (bullet + label) each in its stage colour, staggered
    dt(u"•  SOURCED",     BOLD_F, BLUE,  70, 700,  0.45, D2, x=str(LX)),
    dt(u"•  IN TRANSIT",  BOLD_F, AMBER, 70, 850,  0.90, D2, x=str(LX)),
    dt(u"•  IN STOCK",    BOLD_F, GREEN, 70, 1000, 1.35, D2, x=str(LX)),
    dt(u"•  SOLD",        BOLD_F, GREY,  70, 1150, 1.80, D2, x=str(LX)),
    # profit count-up
    dt(u"€%{eif\\:clip((t-2.20)*2847,0,2847)\\:d}", BLACK_F, GOLD, 96, 1360, 2.20, D2),
    dt("net profit this month", BOLD_F, MUTED, 44, 1480, 2.20, D2),
]
render("seg2.mp4", D2, seg2)

# ---------- SEGMENT 3 — value line (2.0s) ----------
D3 = 2.0
seg3 = [
    dt("Every bag, every euro", BLACK_F, WHITE, 80, 860, 0.15, D3),
    dt("tracked automatically.", BLACK_F, GOLD, 80, 985, 0.40, D3),
]
render("seg3.mp4", D3, seg3)

# ---------- SEGMENT 4 — logo / CTA (1.6s, holds to end) ----------
D4 = 1.6
seg4 = [
    dt("VINTED", BLACK_F, GOLD, 130, 800, 0.10, D4, hold_end=True),
    dt("BRAND DASHBOARD", BOLD_F, WHITE, 66, 950, 0.28, D4, hold_end=True),
    box(360, 1055, 360, 6, GOLD, 0.40, D4, hold_end=True),
    dt("Run resale like a business.", BOLD_F, MUTED, 48, 1110, 0.55, D4, hold_end=True),
]
render("seg4.mp4", D4, seg4)

# ---------- concat (identical bg → seamless) ----------
with open("list.txt","w") as f:
    for s in ["seg1.mp4","seg2.mp4","seg3.mp4","seg4.mp4"]:
        f.write(f"file '{s}'\n")
subprocess.run(["ffmpeg","-y","-f","concat","-safe","0","-i","list.txt",
                "-c","copy","silent.mp4"], check=True, capture_output=True, text=True)

# ---------- soft music bed (sine chord pad, A major) ----------
TOTAL = D1+D2+D3+D4
abed = (f"sine=frequency=110:duration={TOTAL}[a];"
        f"sine=frequency=220:duration={TOTAL}[b];"
        f"sine=frequency=277.18:duration={TOTAL}[c];"
        f"sine=frequency=329.63:duration={TOTAL}[d];"
        f"[a][b][c][d]amix=inputs=4:normalize=0,volume=0.10,"
        f"lowpass=f=850,aecho=0.8:0.7:60:0.25,"
        f"afade=t=in:st=0:d=0.8,afade=t=out:st={TOTAL-0.8}:d=0.8[m]")
subprocess.run(["ffmpeg","-y","-f","lavfi","-i",f"anullsrc=r=44100:cl=stereo:d={TOTAL}",
                "-filter_complex",abed,"-map","[m]","-c:a","aac","-b:a","192k","bed.m4a"],
               check=True, capture_output=True, text=True)

# ---------- final mux ----------
subprocess.run(["ffmpeg","-y","-i","silent.mp4","-i","bed.m4a",
                "-c:v","copy","-c:a","aac","-shortest",
                "Vinted-Dashboard-Ad.mp4"], check=True, capture_output=True, text=True)

print("DONE -> Vinted-Dashboard-Ad.mp4  total", round(TOTAL,1), "s")
