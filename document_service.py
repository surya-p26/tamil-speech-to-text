from __future__ import annotations

import html
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any


def find_chromium() -> str | None:
    """Find Chrome/Edge/Brave/Chromium without assuming a fixed installation path."""
    for name in ("chrome", "chrome.exe", "msedge", "msedge.exe", "brave", "brave.exe", "chromium", "chromium-browser", "google-chrome"):
        found = shutil.which(name)
        if found:
            return found

    candidates: list[Path] = []
    if os.name == "nt":
        for env_name in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"):
            root = os.environ.get(env_name)
            if root:
                candidates.extend([
                    Path(root) / "Google/Chrome/Application/chrome.exe",
                    Path(root) / "Microsoft/Edge/Application/msedge.exe",
                    Path(root) / "BraveSoftware/Brave-Browser/Application/brave.exe",
                ])
        try:
            import winreg  # type: ignore
            for key_path in (
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
            ):
                for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
                    try:
                        with winreg.OpenKey(hive, key_path) as key:
                            value, _ = winreg.QueryValueEx(key, None)
                            candidates.insert(0, Path(value))
                    except OSError:
                        pass
        except ImportError:
            pass
    else:
        for candidate in (
            Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
            Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
            Path("/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"),
        ):
            candidates.append(candidate)

    for path in candidates:
        if path.is_file():
            return str(path)
    return None


def _emblem_svg() -> str:
    # An original state-themed illustration, not a reproduction of an official seal.
    return """<svg xmlns="http://www.w3.org/2000/svg" width="92" height="92" viewBox="0 0 100 100" role="img" aria-label="Tamil Nadu themed emblem">
      <circle cx="50" cy="50" r="46" fill="#fff" stroke="#9f762c" stroke-width="2.5"/>
      <circle cx="50" cy="50" r="39" fill="#fffaf0" stroke="#163f72" stroke-width="1.5"/>
      <path d="M28 69h44M33 64h34M37 59h26M40 54h20" stroke="#163f72" stroke-width="2.5" fill="none"/>
      <path d="M39 53V36l11-12 11 12v17M43 36h14M46 53V40h8v13M34 69V58h32v11" stroke="#a77724" stroke-width="2" fill="none"/>
      <path d="M50 18l3 4h-6z" fill="#a77724"/>
      <text x="50" y="12" text-anchor="middle" font-size="5.6" font-family="sans-serif" fill="#163f72">தமிழ்நாடு அரசு</text>
      <text x="50" y="84" text-anchor="middle" font-size="5.3" font-family="sans-serif" fill="#163f72">வாய்மையே வெல்லும்</text>
    </svg>"""


def _paragraphs(text: str) -> str:
    # Escape each transcript paragraph so user-supplied text cannot inject HTML.
    chunks = [part.strip() for part in (text or "").replace("\r\n", "\n").split("\n") if part.strip()]
    return "".join(f'<p class="body-paragraph">{html.escape(part)}</p>' for part in chunks) or '<p class="body-paragraph">உரை வழங்கப்படவில்லை.</p>'


def build_document_html(data: dict[str, Any]) -> str:
    title = html.escape(str(data.get("document_title") or "அதிகாரப்பூர்வ அரசு அறிக்கை"))
    department = html.escape(str(data.get("department") or "தமிழ்நாடு அரசு"))
    district = html.escape(str(data.get("district") or "—"))
    taluk = html.escape(str(data.get("taluk") or "—"))
    office = html.escape(str(data.get("office_name") or "—"))
    reference = html.escape(str(data.get("reference_number") or "தானியங்கி"))
    date = html.escape(str(data.get("date") or time.strftime("%d-%m-%Y")))
    prepared_by = html.escape(str(data.get("prepared_by") or ""))
    designation = html.escape(str(data.get("designation") or ""))
    subject = html.escape(str(data.get("subject") or title))
    template = str(data.get("template_name") or "official_report").lower()
    meeting = template in {"meeting_minutes", "minutes", "meeting"}
    section_title = "கூட்டக் குறிப்புகள் / MEETING MINUTES" if meeting else "செயல்முறை ஆணை மற்றும் அறிக்கை விவரம் / REPORT DETAILS"
    signature = """
      <section class="signature"><div class="signature-line"></div>
      <strong>கையொப்பம் / Signature</strong><div>{prepared_by}</div><div>{designation}</div>
      <small>வரைவு ஆவணம் · DRAFT DOCUMENT</small></section>
    """.format(prepared_by=prepared_by, designation=designation)
    return f"""<!doctype html><html lang="ta"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{title}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap');
      @page {{ size: A4 portrait; margin: 20mm 18mm 20mm 18mm; }}
      * {{ box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
      body {{ font-family: 'Noto Sans Tamil','Nirmala UI','Latha','Mukta Malar',system-ui,sans-serif; color:#172b45; font-size:11pt; line-height:1.75; }}
      .draft {{ text-align:center; color:#a34d21; font-size:9pt; letter-spacing:1.8px; font-weight:700; border:1px solid #c87b43; display:inline-block; padding:2px 12px; margin:0 auto 8px; }}
      .top {{ display:flex; flex-direction:column; align-items:center; text-align:center; width:100%; border-bottom:2px solid #173f70; padding-bottom:13px; margin-bottom:17px; }}
      .emblem-wrap {{ display:flex; justify-content:center; align-items:center; width:100%; margin:0 auto 7px; }}
      .emblem-wrap svg {{ display:block; width:76px; height:76px; margin:0 auto; flex:none; }}
      .emblem {{ display:block; width:76px; height:76px; margin:0 auto 7px; }}
      h1 {{ font-size:19pt; line-height:1.45; margin:3px 0; color:#173f70; }}
      .english {{ font-family:Arial,sans-serif; letter-spacing:1.1px; font-size:10pt; font-weight:700; }}
      .dept {{ margin-top:8px; font-weight:600; }}
      .office {{ color:#475569; font-size:9.5pt; }}
      .meta {{ width:100%; border-collapse:collapse; margin:17px 0 13px; }}
      .meta td {{ border:1px solid #cbd5e1; padding:8px 10px; width:50%; vertical-align:top; }}
      .meta strong {{ display:block; color:#173f70; font-size:9pt; margin-bottom:2px; }}
      .subject {{ margin:17px 0; border-bottom:1px solid #173f70; padding-bottom:9px; }}
      .subject strong {{ color:#173f70; display:block; font-size:10pt; }}
      .subject div {{ font-weight:700; font-size:13pt; }}
      h2 {{ font-size:12pt; color:#173f70; border-left:3px solid #b18a45; padding-left:10px; margin:18px 0 10px; }}
      .body-paragraph {{ text-align:justify; text-justify:inter-word; text-indent:32px; line-height:2.0; margin:0 0 9px; word-break:break-word; white-space:pre-wrap; }}
      .signature {{ margin:45px 0 0 auto; width:48%; text-align:center; page-break-inside:avoid; }}
      .signature-line {{ border-top:1px solid #64748b; margin:30px 8px 8px; }}
      .signature small {{ display:block; color:#a34d21; font-size:8pt; margin-top:8px; }}
      footer {{ border-top:1px solid #cbd5e1; margin-top:35px; padding-top:8px; font-size:7.5pt; color:#64748b; text-align:center; }}
    </style></head><body>
      <header class="top"><div class="draft">வரைவு · DRAFT</div><div class="emblem-wrap">{_emblem_svg()}</div>
        <h1>தமிழ்நாடு அரசு</h1><div class="english">GOVERNMENT OF TAMIL NADU</div>
        <div class="dept">{department}</div><div class="office">{office}</div>
      </header>
      <table class="meta"><tr><td><strong>நாள் / DATE</strong>{date}</td><td><strong>ந.க.எண் / REFERENCE NO.</strong>{reference}</td></tr>
      <tr><td><strong>மாவட்டம் / DISTRICT</strong>{district}</td><td><strong>வட்டம் / TALUK</strong>{taluk}</td></tr></table>
      <section class="subject"><strong>பொருள் / SUBJECT</strong><div>{subject}</div></section>
      <h2>{section_title}</h2>{_paragraphs(str(data.get("text") or ""))}
      {signature}
      <footer>தமிழ்நாடு அரசு மின்னாளுமை முகமை · Tamil Nadu e-Governance Agency<br>சரிபார்க்கப்பட்ட Unicode உரை · Verified Unicode text | Draft — not an issued government order</footer>
    </body></html>"""


def _generate_pdf_via_chromium(html_content: str, output_path: Path) -> bool:
    browser = find_chromium()
    if not browser:
        return False
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="tamiltranscribe_pdf_") as temp:
        temp_dir = Path(temp)
        html_path = temp_dir / "document.html"
        profile_dir = temp_dir / "profile"
        html_path.write_text(html_content, encoding="utf-8")
        command = [
            browser, "--headless=new", "--no-sandbox", "--disable-gpu",
            "--disable-software-rasterizer", "--run-all-compositor-stages-before-draw",
            "--disable-extensions", "--hide-scrollbars", "--mute-audio",
            f"--user-data-dir={profile_dir}", f"--print-to-pdf={output_path.resolve()}",
            "--no-pdf-header-footer", html_path.as_uri(),
        ]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=90, check=False)
            return result.returncode == 0 and output_path.is_file() and output_path.stat().st_size > 0
        except (OSError, subprocess.SubprocessError):
            return False


def _generate_pdf_via_reportlab(data: dict[str, Any], output_path: Path) -> bool:
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
    except ImportError:
        return False

    font_path = None
    candidates = [
        Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts" / "Nirmala.ttf",
        Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts" / "Nirmala.ttc",
        Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts" / "latha.ttf",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/Windows/Fonts/NotoSansTamil-Regular.ttf",
        Path(__file__).resolve().parent / "fonts" / "NotoSansTamil-Regular.ttf",
    ]
    font_path = next((p for p in candidates if p.is_file() and p.suffix.lower() == ".ttf"), None)
    font_name = "Helvetica"
    if font_path:
        try:
            pdfmetrics.registerFont(TTFont("TamilFallback", str(font_path)))
            font_name = "TamilFallback"
        except Exception:
            pass

    output_path.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TaTitle", parent=styles["Title"], fontName=font_name, fontSize=17, leading=24, alignment=TA_CENTER, textColor=colors.HexColor("#173f70"), spaceAfter=4))
    styles.add(ParagraphStyle(name="TaBody", parent=styles["BodyText"], fontName=font_name, fontSize=10.5, leading=20, alignment=TA_JUSTIFY, spaceAfter=8))
    styles.add(ParagraphStyle(name="TaSmall", parent=styles["BodyText"], fontName=font_name, fontSize=8, leading=12, alignment=TA_CENTER, textColor=colors.HexColor("#64748b")))
    styles.add(ParagraphStyle(name="TaHeading", parent=styles["Heading2"], fontName=font_name, fontSize=11, leading=16, textColor=colors.HexColor("#173f70"), spaceBefore=12, spaceAfter=8))
    def esc(value: Any) -> str:
        return html.escape(str(value or "—")).replace("\n", "<br/>")
    story = [Paragraph("வரைவு · DRAFT", ParagraphStyle(name="Draft", parent=styles["TaSmall"], textColor=colors.HexColor("#a34d21"))), Spacer(1, 3*mm), Paragraph("தமிழ்நாடு அரசு", styles["TaTitle"]), Paragraph("GOVERNMENT OF TAMIL NADU", styles["TaSmall"]), Spacer(1, 2*mm), Paragraph(esc(data.get("department")), styles["TaBody"]), Paragraph(esc(data.get("office_name")), styles["TaSmall"]), Spacer(1, 4*mm), HRFlowable(width="100%", thickness=1.4, color=colors.HexColor("#173f70")), Spacer(1, 4*mm)]
    metadata = [[Paragraph("<b>நாள் / DATE</b><br/>" + esc(data.get("date")), styles["TaBody"]), Paragraph("<b>ந.க.எண் / REF</b><br/>" + esc(data.get("reference_number")), styles["TaBody"])], [Paragraph("<b>மாவட்டம் / DISTRICT</b><br/>" + esc(data.get("district")), styles["TaBody"]), Paragraph("<b>வட்டம் / TALUK</b><br/>" + esc(data.get("taluk")), styles["TaBody"])]]
    table = Table(metadata, colWidths=[85*mm, 85*mm])
    table.setStyle(TableStyle([("GRID", (0,0),(-1,-1),0.5,colors.HexColor("#cbd5e1")),("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7)]))
    story += [table, Spacer(1, 4*mm), Paragraph("பொருள் / SUBJECT: " + esc(data.get("subject") or data.get("document_title")), styles["TaHeading"]), Paragraph("கூட்டக் குறிப்புகள் / MEETING MINUTES" if str(data.get("template_name", "")).lower() in {"meeting_minutes", "minutes", "meeting"} else "செயல்முறை ஆணை மற்றும் அறிக்கை விவரம் / REPORT DETAILS", styles["TaHeading"])]
    for part in str(data.get("text") or "").replace("\r\n", "\n").split("\n"):
        if part.strip(): story.append(Paragraph(esc(part), styles["TaBody"]))
    story += [Spacer(1, 20*mm), Paragraph("____________________________", ParagraphStyle(name="SigLine", parent=styles["TaSmall"], alignment=TA_RIGHT)), Paragraph(esc(data.get("prepared_by")), ParagraphStyle(name="Prepared", parent=styles["TaBody"], alignment=TA_RIGHT)), Paragraph(esc(data.get("designation")), ParagraphStyle(name="Designation", parent=styles["TaSmall"], alignment=TA_RIGHT)), Spacer(1, 8*mm), HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1")), Paragraph("தமிழ்நாடு அரசு மின்னாளுமை முகமை · Tamil Nadu e-Governance Agency | Draft — not an issued government order", styles["TaSmall"])]
    try:
        doc = SimpleDocTemplate(str(output_path), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=20*mm, bottomMargin=20*mm, title=str(data.get("document_title") or "TamilTranscribe Draft"))
        doc.build(story)
        return output_path.is_file() and output_path.stat().st_size > 0
    except Exception:
        return False


def generate_tamil_pdf(data: dict[str, Any], output_path: Path) -> str:
    """Generate a directly rendered Tamil PDF; use Chromium first and ReportLab as fallback."""
    html_content = build_document_html(data)
    if _generate_pdf_via_chromium(html_content, output_path):
        return "chromium"
    if _generate_pdf_via_reportlab(data, output_path):
        return "reportlab"
    raise RuntimeError("PDF generation failed. Install Chrome/Edge for accurate Tamil shaping, or install ReportLab and provide a supported Tamil TTF font for fallback.")
