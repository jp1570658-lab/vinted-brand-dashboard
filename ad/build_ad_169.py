#!/usr/bin/env python3
"""16:9 widescreen (1920x1080) cut of the Vinted Brand Dashboard ad.
Split layout in the stages beat: 4-stage flow on the left, profit figure on the right."""
import os, subprocess

WORK = os.path.join(os.path.dirname(__file__), "work")
os.chdir(WORK)

BG="0x0a0a0a"; GOLD="0xc9a84c"; WHITE="0xf5f5f5"; MUTED="0x9ca3af"
BLUE="0x3b82f6"; AMBER="0xf59e0b"; GREEN="0x22c55e"; GREY="0x9ca3af"
BLACK_F="black.ttf"; BOLD_F="bold.ttf"
W,H = 1920,1080

def fade(a, D, fin=0.4, fout=0.35, hold_end=False):
    if hold_end:
        return f"if(lt(t,{a}),0,if(lt(t,{a+fin}),(t-{a})/{fin},1))"
    return (f"if(lt(t,{a}),0,if(lt(t,{a+fin}),(t-{a})/{fin},"
            f"if(gt(t,{D-fout}),({D}-t)/{fout},1)))")

def dt(text, font, color, size, y, a, D, x="(w-text_w)/2", hold_end=False):
    al = fade(a, D, hold_end=hold_end)
    return (f"drawtext=fontfile={font}:text='{text}':fontcolor={color}:fontsize={size}"
            f":x={x}:y={y}:alpha='{al}':line_spacing=12")

def box(x, y, w, h, color, a, D, hold_end=False):
    en = f"gte(t,{a})" if hold_end else f"between(t,{a},{D})"
    return f"drawbox=x={x}:y={y}:w={w}:h={h}:color={color}:t=fill:enable='{en}'"

def render(name, D, filters):
    vf = ",".join(filters)
    cmd = ["ffmpeg","-y","-f","lavfi","-i",f"color=c={BG}:s={W}x{H}:r=30:d={D}",
           "-vf",vf,"-frames:v",str(int(D*30)),
           "-c:v","libx264","-pix_fmt","yuv420p","-preset","medium","-crf","18", name]
    print("rendering", name)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2000:]); raise SystemExit(f"FAILED {name}")

# SEG1 — hook (3.0s), centred
D1=3.0
seg1=[
    dt("FOR LUXURY RESELLERS", BOLD_F, GOLD, 38, 330, 0.15, D1),
    box((W-220)//2, 400, 220, 5, GOLD, 0.15, D1),
    dt("Reselling bags?", BLACK_F, WHITE, 86, 450, 0.35, D1),
    dt("Stop guessing.",  BLACK_F, GOLD, 100, 585, 0.65, D1),
]
render("s1_169.mp4", D1, seg1)

# SEG2 — split: stages left, profit right (3.6s)
D2=3.6
LX=360
seg2=[
    dt("FROM SOURCED TO SOLD", BOLD_F, GOLD, 44, 210, 0.10, D2),
    dt(u"•  SOURCED",    BOLD_F, BLUE,  62, 400, 0.45, D2, x=str(LX)),
    dt(u"•  IN TRANSIT", BOLD_F, AMBER, 62, 530, 0.85, D2, x=str(LX)),
    dt(u"•  IN STOCK",   BOLD_F, GREEN, 62, 660, 1.25, D2, x=str(LX)),
    dt(u"•  SOLD",       BOLD_F, GREY,  62, 790, 1.65, D2, x=str(LX)),
    # right half: big static profit figure (centred in the right 960px)
    dt(u"€2,847", BLACK_F, GOLD, 130, 470, 1.9, D2, x="1440-text_w/2"),
    dt("net profit this month", BOLD_F, MUTED, 44, 640, 1.9, D2, x="1440-text_w/2"),
]
render("s2_169.mp4", D2, seg2)

# SEG3 — value line (2.0s)
D3=2.0
seg3=[
    dt("Every bag, every euro", BLACK_F, WHITE, 78, 430, 0.15, D3),
    dt("tracked automatically.", BLACK_F, GOLD, 78, 560, 0.40, D3),
]
render("s3_169.mp4", D3, seg3)

# SEG4 — logo / CTA (1.6s, holds)
D4=1.6
seg4=[
    dt("VINTED", BLACK_F, GOLD, 128, 380, 0.10, D4, hold_end=True),
    dt("BRAND DASHBOARD", BOLD_F, WHITE, 64, 540, 0.28, D4, hold_end=True),
    box((W-380)//2, 645, 380, 6, GOLD, 0.40, D4, hold_end=True),
    dt("Run resale like a business.", BOLD_F, MUTED, 48, 705, 0.55, D4, hold_end=True),
]
render("s4_169.mp4", D4, seg4)

# concat
with open("list169.txt","w") as f:
    for s in ["s1_169.mp4","s2_169.mp4","s3_169.mp4","s4_169.mp4"]:
        f.write(f"file '{s}'\n")
subprocess.run(["ffmpeg","-y","-f","concat","-safe","0","-i","list169.txt",
                "-c","copy","silent169.mp4"], check=True, capture_output=True, text=True)

# music bed
TOTAL=D1+D2+D3+D4
abed=(f"sine=frequency=110:duration={TOTAL}[a];sine=frequency=220:duration={TOTAL}[b];"
      f"sine=frequency=277.18:duration={TOTAL}[c];sine=frequency=329.63:duration={TOTAL}[d];"
      f"[a][b][c][d]amix=inputs=4:normalize=0,volume=0.10,lowpass=f=850,"
      f"aecho=0.8:0.7:60:0.25,afade=t=in:st=0:d=0.8,afade=t=out:st={TOTAL-0.8}:d=0.8[m]")
subprocess.run(["ffmpeg","-y","-f","lavfi","-i",f"anullsrc=r=44100:cl=stereo:d={TOTAL}",
                "-filter_complex",abed,"-map","[m]","-c:a","aac","-b:a","192k","bed169.m4a"],
               check=True, capture_output=True, text=True)

subprocess.run(["ffmpeg","-y","-i","silent169.mp4","-i","bed169.m4a",
                "-c:v","copy","-c:a","aac","-shortest","Vinted-Dashboard-Ad-16x9.mp4"],
               check=True, capture_output=True, text=True)
print("DONE -> Vinted-Dashboard-Ad-16x9.mp4", round(TOTAL,1),"s")
