"""Well-formatted Tamil PDF generation for the existing FastAPI endpoint.

Function signature is intentionally preserved:
    generate_pdf(text: str, output_file: str) -> bool

For correct Tamil shaping, install ReportLab 4.4+ and uharfbuzz.
"""
from __future__ import annotations

import inspect
import os
from pathlib import Path
from xml.sax.saxutils import escape

import reportlab
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .document_layout import DocumentContent, parse_document_text


NAVY = colors.HexColor("#17365D")
BLUE = colors.HexColor("#234F7E")
LIGHT_BLUE = colors.HexColor("#EAF1F8")
TEXT = colors.HexColor("#202938")
MUTED = colors.HexColor("#586579")
BORDER = colors.HexColor("#C9D5E3")
FONT_NAME = "TamilDocumentFont"
_FONT_READY = False


def _find_tamil_font() -> Path:
    env_path = os.environ.get("TAMIL_FONT_PATH")
    candidates = [
        Path(env_path) if env_path else None,
        Path(r"C:\Windows\Fonts\Nirmala.ttf"),
        Path(r"C:\Windows\Fonts\Nirmala.ttc"),
        Path(r"C:\Windows\Fonts\NirmalaUI.ttf"),
        Path(r"C:\Windows\Fonts\NirmalaUI.ttc"),
        Path("/usr/share/fonts/truetype/noto/NotoSansTamil-Regular.ttf"),
        Path("/usr/share/fonts/truetype/noto/NotoSansTamilUI-Regular.ttf"),
    ]
    for candidate in candidates:
        if candidate and candidate.is_file():
            return candidate
    raise RuntimeError(
        "A Tamil font was not found. On Windows, check that "
        "C:\\Windows\\Fonts\\Nirmala.ttc exists. You can also set "
        "TAMIL_FONT_PATH to a .ttf or .ttc Tamil font file."
    )


def _register_tamil_font() -> str:
    global _FONT_READY
    if _FONT_READY:
        return FONT_NAME

    try:
        import uharfbuzz  # noqa: F401
    except ImportError as exc:
        raise RuntimeError(
            "Correct Tamil shaping for PDF needs uharfbuzz. In your activated "
            "venv run: python -m pip install --upgrade 'reportlab>=4.4.0' uharfbuzz"
        ) from exc

    if tuple(int(part) for part in reportlab.Version.split(".")[:2]) < (4, 4):
        raise RuntimeError(
            f"ReportLab {reportlab.Version} is too old for shaped Tamil text. "
            "Run: python -m pip install --upgrade 'reportlab>=4.4.0' uharfbuzz"
        )

    try:
        parameters = inspect.signature(TTFont).parameters
        if "shapable" not in parameters:
            raise RuntimeError("This ReportLab build does not support shaped TrueType fonts.")
        font_path = _find_tamil_font()
        # Nirmala is commonly supplied as a TTC collection on Windows.
        # ReportLab supports TTC files through subfontIndex.
        pdfmetrics.registerFont(
            TTFont(FONT_NAME, str(font_path), subfontIndex=0, shapable=True)
        )
    except Exception as exc:
        if isinstance(exc, RuntimeError) and "Tamil font" in str(exc):
            raise
        raise RuntimeError(
            "Could not register a shaped Tamil font for PDF output. "
            "Check your ReportLab version, uharfbuzz installation and Nirmala font. "
            f"Details: {exc}"
        ) from exc

    _FONT_READY = True
    return FONT_NAME


def _paragraph_text(value: str) -> str:
    """Escape content for ReportLab Paragraph markup and preserve line breaks."""
    return "<br/>".join(escape(line) for line in (value or "").split("\n"))


def _draw_page_footer(canvas, doc):
    canvas.saveState()
    page_width, _ = A4
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, 16 * mm, page_width - 20 * mm, 16 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(20 * mm, 10 * mm, "TamilTranscribe | Tamil Speech-to-Text")
    canvas.drawRightString(page_width - 20 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def _metadata_table(content: DocumentContent, font_name: str):
    # Department is already shown directly below the document title.
    items = [
        ("தேதி", content.date),
        ("குறிப்பு எண்", content.reference_number),
        ("தயாரித்தது", content.prepared_by),
    ]
    items = [(label, value) for label, value in items if value]
    if not items:
        return None

    label_style = ParagraphStyle(
        "TamilMetaLabel", fontName=font_name, fontSize=9.5, leading=14,
        textColor=NAVY, spaceAfter=0, shaping=1,
    )
    value_style = ParagraphStyle(
        "TamilMetaValue", fontName=font_name, fontSize=9.5, leading=14,
        textColor=TEXT, spaceAfter=0, shaping=1,
    )
    rows = [[Paragraph(escape(label), label_style), Paragraph(_paragraph_text(value), value_style)]
            for label, value in items]
    table = Table(rows, colWidths=[32 * mm, 128 * mm], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_BLUE),
        ("BACKGROUND", (1, 0), (1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return table


def generate_pdf(text: str, output_file: str) -> bool:
    """Generate a paginated PDF with metadata and readable Tamil transcript."""
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Cannot generate a PDF from empty text.")

    font_name = _register_tamil_font()
    content = parse_document_text(text)
    out_path = Path(output_file)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    document = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        rightMargin=22 * mm,
        leftMargin=22 * mm,
        topMargin=20 * mm,
        bottomMargin=23 * mm,
        title=content.title,
        author=content.prepared_by or "TamilTranscribe",
        subject="Tamil speech-to-text transcription",
    )

    styles = getSampleStyleSheet()
    govt_style = ParagraphStyle(
        "TamilGovt", parent=styles["Normal"], fontName=font_name,
        fontSize=15, leading=21, alignment=TA_CENTER, textColor=NAVY,
        spaceAfter=4, shaping=1,
    )
    title_style = ParagraphStyle(
        "TamilDocTitle", parent=styles["Title"], fontName=font_name,
        fontSize=17, leading=24, alignment=TA_CENTER, textColor=NAVY,
        spaceBefore=5, spaceAfter=9, shaping=1,
    )
    dept_style = ParagraphStyle(
        "TamilDept", parent=styles["Normal"], fontName=font_name,
        fontSize=10.5, leading=16, alignment=TA_CENTER, textColor=MUTED,
        spaceAfter=8, shaping=1,
    )
    section_style = ParagraphStyle(
        "TamilSection", parent=styles["Heading2"], fontName=font_name,
        fontSize=12.5, leading=18, textColor=BLUE, spaceBefore=14,
        spaceAfter=8, keepWithNext=True, shaping=1,
    )
    body_style = ParagraphStyle(
        "TamilTranscript", parent=styles["BodyText"], fontName=font_name,
        fontSize=11.5, leading=19, alignment=TA_JUSTIFY, textColor=TEXT,
        spaceAfter=9, allowWidows=0, allowOrphans=0, shaping=1,
    )

    story = [
        Paragraph(escape(content.government), govt_style),
        Paragraph(_paragraph_text(content.title), title_style),
    ]
    if content.department:
        story.append(Paragraph(_paragraph_text(content.department), dept_style))
    story.append(HRFlowable(width="100%", thickness=1.1, color=BLUE,
                            spaceBefore=2, spaceAfter=12))

    metadata = _metadata_table(content, font_name)
    if metadata:
        story.extend([metadata, Spacer(1, 12)])

    story.append(Paragraph("படியெழுத்தாக்கம்", section_style))
    transcript_blocks = [block.strip() for block in content.transcript.split("\n\n") if block.strip()]
    if not transcript_blocks:
        transcript_blocks = ["(எழுத்தாக்க உரை இல்லை)"]
    for block in transcript_blocks:
        story.append(Paragraph(_paragraph_text(block), body_style))

    try:
        document.build(story, onFirstPage=_draw_page_footer, onLaterPages=_draw_page_footer)
    except Exception as exc:
        raise RuntimeError(f"PDF generation failed: {exc}") from exc

    return out_path.exists() and out_path.stat().st_size > 0
