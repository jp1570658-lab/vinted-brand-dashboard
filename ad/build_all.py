#!/usr/bin/env python3
"""Builds all three aspect ratios of the Vinted Brand Dashboard 10s ad from one
source of truth: 9:16 (1080x1920), 16:9 (1920x1080), 1:1 (1080x1080).
Consistent copy, static €2,847 (comma), gentle vignette, soft music bed."""
import os, subprocess

WORK = os.path.join(os.path.dirname(__file__), "work")
os.chdir(WORK)

BG="0x0a0a0a"; GOLD="0xc9a84c"; WHITE="0xf5f5f5"; MUTED="0x9ca3af"
BLUE="0x3b82f6"; AMBER="0xf59e0b"; GREEN="0x22c55e"; GREY="0x9ca3af"
BLACK_F="black.ttf"; BOLD_F="bold.ttf"
DUR = [3.0, 3.6, 2.0, 1.6]            # seg durations
TOTAL = sum(DUR)

def fade(a, D, fin=0.4, fout=0.35, hold_end=False):
    if hold_end:
        return f"if(lt(t,{a}),0,if(lt(t,{a+fin}),(t-{a})/{fin},1))"
    return (f"if(lt(t,{a}),0,if(lt(t,{a+fin}),(t-{a})/{fin},"
            f"if(gt(t,{D-fout}),({D}-t)/{fout},1)))")

def dt(text, font, color, size, y, a, D, x="(w-text_w)/2", hold_end=False):
    return (f"drawtext=fontfile={font}:text='{text}':fontcolor={color}:fontsize={size}"
            f":x={x}:y={y}:alpha='{fade(a,D,hold_end=hold_end)}':line_spacing=12")

def box(x, y, w, h, color, a, D, hold_end=False):
    en = f"gte(t,{a})" if hold_end else f"between(t,{a},{D})"
    return f"drawbox=x={x}:y={y}:w={w}:h={h}:color={color}:t=fill:enable='{en}'"

def render(name, W, H, D, filters):
    if not name.endswith(".mp4"): name += ".mp4"
    vf = ",".join(filters) + ",vignette=PI/4.7"   # gentle depth
    cmd = ["ffmpeg","-y","-f","lavfi","-i",f"color=c={BG}:s={W}x{H}:r=30:d={D}",
           "-vf",vf,"-frames:v",str(int(D*30)),
           "-c:v","libx264","-pix_fmt","yuv420p","-preset","medium","-crf","18", name]
    print("  ", name)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-1800:]); raise SystemExit(f"FAILED {name}")

def finalize(prefix, out):
    with open(f"{prefix}.txt","w") as f:
        for i in range(4): f.write(f"file '{prefix}{i+1}.mp4'\n")
    subprocess.run(["ffmpeg","-y","-f","concat","-safe","0","-i",f"{prefix}.txt",
                    "-c","copy",f"{prefix}_silent.mp4"], check=True, capture_output=True, text=True)
    abed=(f"sine=frequency=110:duration={TOTAL}[a];sine=frequency=220:duration={TOTAL}[b];"
          f"sine=frequency=277.18:duration={TOTAL}[c];sine=frequency=329.63:duration={TOTAL}[d];"
          f"[a][b][c][d]amix=inputs=4:normalize=0,volume=0.10,lowpass=f=850,"
          f"aecho=0.8:0.7:60:0.25,afade=t=in:st=0:d=0.8,afade=t=out:st={TOTAL-0.8}:d=0.8[m]")
    subprocess.run(["ffmpeg","-y","-f","lavfi","-i",f"anullsrc=r=44100:cl=stereo:d={TOTAL}",
                    "-filter_complex",abed,"-map","[m]","-c:a","aac","-b:a","192k",f"{prefix}_bed.m4a"],
                   check=True, capture_output=True, text=True)
    subprocess.run(["ffmpeg","-y","-i",f"{prefix}_silent.mp4","-i",f"{prefix}_bed.m4a",
                    "-c:v","copy","-c:a","aac","-shortest",out], check=True, capture_output=True, text=True)
    for f in [f"{prefix}{i+1}.mp4" for i in range(4)] + [f"{prefix}.txt",
              f"{prefix}_silent.mp4", f"{prefix}_bed.m4a"]:
        try: os.remove(f)
        except OSError: pass
    print("  ->", out)

# ---------------- 9:16 VERTICAL ----------------
def vertical():
    W,H=1080,1920; p="v"
    render(f"{p}1",W,H,DUR[0],[
        dt("FOR LUXURY RESELLERS",BOLD_F,GOLD,38,640,0.15,DUR[0]),
        box((W-200)//2,720,200,5,GOLD,0.15,DUR[0]),
        dt("Reselling bags?",BLACK_F,WHITE,90,860,0.35,DUR[0]),
        dt("Stop guessing.",BLACK_F,GOLD,104,990,0.65,DUR[0])])
    LX=300
    render(f"{p}2",W,H,DUR[1],[
        dt("FROM SOURCED TO SOLD",BOLD_F,GOLD,42,470,0.10,DUR[1]),
        dt(u"•  SOURCED",BOLD_F,BLUE,70,700,0.45,DUR[1],x=str(LX)),
        dt(u"•  IN TRANSIT",BOLD_F,AMBER,70,850,0.90,DUR[1],x=str(LX)),
        dt(u"•  IN STOCK",BOLD_F,GREEN,70,1000,1.35,DUR[1],x=str(LX)),
        dt(u"•  SOLD",BOLD_F,GREY,70,1150,1.80,DUR[1],x=str(LX)),
        dt(u"€2,847",BLACK_F,GOLD,96,1360,2.10,DUR[1]),
        dt("net profit this month",BOLD_F,MUTED,44,1480,2.10,DUR[1])])
    render(f"{p}3",W,H,DUR[2],[
        dt("Every bag, every euro",BLACK_F,WHITE,80,860,0.15,DUR[2]),
        dt("tracked automatically.",BLACK_F,GOLD,80,985,0.40,DUR[2])])
    render(f"{p}4",W,H,DUR[3],[
        dt("VINTED",BLACK_F,GOLD,130,800,0.10,DUR[3],hold_end=True),
        dt("BRAND DASHBOARD",BOLD_F,WHITE,66,950,0.28,DUR[3],hold_end=True),
        box((W-360)//2,1055,360,6,GOLD,0.40,DUR[3],hold_end=True),
        dt("Run resale like a business.",BOLD_F,MUTED,48,1110,0.55,DUR[3],hold_end=True)])
    finalize(p,"Vinted-Dashboard-Ad.mp4")

# ---------------- 16:9 WIDE ----------------
def wide():
    W,H=1920,1080; p="w"
    render(f"{p}1",W,H,DUR[0],[
        dt("FOR LUXURY RESELLERS",BOLD_F,GOLD,38,330,0.15,DUR[0]),
        box((W-220)//2,400,220,5,GOLD,0.15,DUR[0]),
        dt("Reselling bags?",BLACK_F,WHITE,86,450,0.35,DUR[0]),
        dt("Stop guessing.",BLACK_F,GOLD,100,585,0.65,DUR[0])])
    LX=360
    render(f"{p}2",W,H,DUR[1],[
        dt("FROM SOURCED TO SOLD",BOLD_F,GOLD,44,210,0.10,DUR[1]),
        dt(u"•  SOURCED",BOLD_F,BLUE,62,400,0.45,DUR[1],x=str(LX)),
        dt(u"•  IN TRANSIT",BOLD_F,AMBER,62,530,0.85,DUR[1],x=str(LX)),
        dt(u"•  IN STOCK",BOLD_F,GREEN,62,660,1.25,DUR[1],x=str(LX)),
        dt(u"•  SOLD",BOLD_F,GREY,62,790,1.65,DUR[1],x=str(LX)),
        dt(u"€2,847",BLACK_F,GOLD,130,470,1.9,DUR[1],x="1440-text_w/2"),
        dt("net profit this month",BOLD_F,MUTED,44,640,1.9,DUR[1],x="1440-text_w/2")])
    render(f"{p}3",W,H,DUR[2],[
        dt("Every bag, every euro",BLACK_F,WHITE,78,430,0.15,DUR[2]),
        dt("tracked automatically.",BLACK_F,GOLD,78,560,0.40,DUR[2])])
    render(f"{p}4",W,H,DUR[3],[
        dt("VINTED",BLACK_F,GOLD,128,380,0.10,DUR[3],hold_end=True),
        dt("BRAND DASHBOARD",BOLD_F,WHITE,64,540,0.28,DUR[3],hold_end=True),
        box((W-380)//2,645,380,6,GOLD,0.40,DUR[3],hold_end=True),
        dt("Run resale like a business.",BOLD_F,MUTED,48,705,0.55,DUR[3],hold_end=True)])
    finalize(p,"Vinted-Dashboard-Ad-16x9.mp4")

# ---------------- 1:1 SQUARE ----------------
def square():
    W,H=1080,1080; p="s"
    render(f"{p}1",W,H,DUR[0],[
        dt("FOR LUXURY RESELLERS",BOLD_F,GOLD,34,300,0.15,DUR[0]),
        box((W-190)//2,365,190,5,GOLD,0.15,DUR[0]),
        dt("Reselling bags?",BLACK_F,WHITE,74,420,0.35,DUR[0]),
        dt("Stop guessing.",BLACK_F,GOLD,86,545,0.65,DUR[0])])
    LX=300
    render(f"{p}2",W,H,DUR[1],[
        dt("FROM SOURCED TO SOLD",BOLD_F,GOLD,38,170,0.10,DUR[1]),
        dt(u"•  SOURCED",BOLD_F,BLUE,56,330,0.45,DUR[1],x=str(LX)),
        dt(u"•  IN TRANSIT",BOLD_F,AMBER,56,450,0.85,DUR[1],x=str(LX)),
        dt(u"•  IN STOCK",BOLD_F,GREEN,56,570,1.25,DUR[1],x=str(LX)),
        dt(u"•  SOLD",BOLD_F,GREY,56,690,1.65,DUR[1],x=str(LX)),
        dt(u"€2,847",BLACK_F,GOLD,84,830,2.10,DUR[1]),
        dt("net profit this month",BOLD_F,MUTED,40,940,2.10,DUR[1])])
    render(f"{p}3",W,H,DUR[2],[
        dt("Every bag, every euro",BLACK_F,WHITE,66,440,0.15,DUR[2]),
        dt("tracked automatically.",BLACK_F,GOLD,66,560,0.40,DUR[2])])
    render(f"{p}4",W,H,DUR[3],[
        dt("VINTED",BLACK_F,GOLD,104,370,0.10,DUR[3],hold_end=True),
        dt("BRAND DASHBOARD",BOLD_F,WHITE,54,505,0.28,DUR[3],hold_end=True),
        box((W-320)//2,600,320,6,GOLD,0.40,DUR[3],hold_end=True),
        dt("Run resale like a business.",BOLD_F,MUTED,44,655,0.55,DUR[3],hold_end=True)])
    finalize(p,"Vinted-Dashboard-Ad-1x1.mp4")

print("9:16 ..."); vertical()
print("16:9 ..."); wide()
print("1:1  ..."); square()
print("ALL DONE")
