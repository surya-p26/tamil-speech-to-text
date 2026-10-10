"""Shared parser for the text payload currently sent by the React UI."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class DocumentContent:
    government: str
    title: str
    department: str
    date: str
    reference_number: str
    prepared_by: str
    transcript: str


def _label_value(value: str, label: str) -> str:
    value = value.strip()
    if value.startswith(label):
        return value[len(label):].strip()
    return value


def parse_document_text(text: str) -> DocumentContent:
    """Parse buildDocumentText() output, while still accepting plain transcript text.

    Expected UI format (sections separated by a blank line):
      தமிழ்நாடு அரசு
      <title>
      துறை: <department>
      தேதி: <date>
      குறிப்பு எண்: <reference>
      தயாரித்தது: <prepared by>
      படியெழுத்தாக்கம்
      <transcript, which may contain multiple paragraphs>
    """
    normalized = (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        raise ValueError("Document text cannot be empty.")

    parts = normalized.split("\n\n", 7)
    has_ui_metadata = (
        len(parts) == 8
        and parts[0].strip() == "தமிழ்நாடு அரசு"
        and parts[6].strip() == "படியெழுத்தாக்கம்"
    )

    if has_ui_metadata:
        return DocumentContent(
            government=parts[0].strip(),
            title=parts[1].strip() or "தமிழ் பேச்சு எழுத்தாக்க அறிக்கை",
            department=_label_value(parts[2], "துறை:"),
            date=_label_value(parts[3], "தேதி:"),
            reference_number=_label_value(parts[4], "குறிப்பு எண்:"),
            prepared_by=_label_value(parts[5], "தயாரித்தது:"),
            transcript=parts[7].strip(),
        )

    # Backward-compatible mode: if the caller sends only transcript text,
    # don't mistake its first lines for government metadata.
    return DocumentContent(
        government="தமிழ்நாடு அரசு",
        title="தமிழ் பேச்சு எழுத்தாக்க அறிக்கை",
        department="",
        date="",
        reference_number="",
        prepared_by="",
        transcript=normalized,
    )
