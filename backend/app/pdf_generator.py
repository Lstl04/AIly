from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER
from reportlab.pdfbase.pdfmetrics import stringWidth
from io import BytesIO
import base64
from typing import Dict, Any
from datetime import datetime


def create_pdf_document(invoice_data: Dict[str, Any], user: Dict[str, Any], client: Dict[str, Any]) -> BytesIO:
    """
    Fix for "smushed/overlapping subtotal/total labels":
    - NEVER place subtotal rows inside the 4-column line-items table.
    - ReportLab does NOT clip overflow text in table cells, so long labels will paint into adjacent cells.
    - Instead, render subtotals/totals as separate right-aligned 2-column mini-tables.
    """
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch
    )

    elements = []
    styles = getSampleStyleSheet()

    # ---------- Colors ----------
    color_primary = colors.HexColor('#667eea')
    color_text = colors.HexColor('#333333')
    color_light = colors.HexColor('#666666')
    color_grid = colors.HexColor('#eeeeee')

    # ---------- Styles ----------
    style_title = ParagraphStyle(
        'Title', parent=styles['Heading1'],
        fontSize=20, textColor=color_text, spaceAfter=2
    )
    style_normal = ParagraphStyle(
        'Normal', parent=styles['Normal'],
        fontSize=10, textColor=color_text, leading=14
    )
    style_right_meta = ParagraphStyle(
        'RightMeta', parent=style_normal,
        alignment=TA_RIGHT, fontSize=10
    )
    style_label_small = ParagraphStyle(
        'LabelSmall', parent=style_normal,
        textColor=color_light, fontSize=9
    )
    style_section = ParagraphStyle(
        'Section', parent=styles['Heading2'],
        fontSize=11, textColor=color_primary,
        spaceBefore=12, spaceAfter=6, fontName='Helvetica-Bold'
    )

    # Money styles
    style_money = ParagraphStyle(
        'Money', parent=style_normal, alignment=TA_RIGHT, fontSize=9, leading=12
    )
    style_money_bold = ParagraphStyle(
        'MoneyBold', parent=style_money, fontName='Helvetica-Bold'
    )

    # Mini-table styles (subtotals / totals)
    style_pair_label = ParagraphStyle(
        'PairLabel', parent=style_normal,
        alignment=TA_RIGHT, fontSize=10, leading=14,
        textColor=color_text, fontName='Helvetica-Bold'
    )
    style_pair_value = ParagraphStyle(
        'PairValue', parent=style_normal,
        alignment=TA_RIGHT, fontSize=10, leading=14,
        textColor=color_text, fontName='Helvetica-Bold'
    )
    style_total_label = ParagraphStyle(
        'TotalLabel', parent=style_normal,
        alignment=TA_RIGHT, fontSize=14, leading=16,
        textColor=color_primary, fontName='Helvetica-Bold'
    )
    style_total_value = ParagraphStyle(
        'TotalValue', parent=style_normal,
        alignment=TA_RIGHT, fontSize=14, leading=16,
        textColor=color_primary, fontName='Helvetica-Bold'
    )

    # ---------- Helpers ----------
    def safe_float(x) -> float:
        try:
            return float(x or 0)
        except Exception:
            return 0.0

    def format_currency(value) -> str:
        try:
            return f"${float(value):,.2f}"
        except (ValueError, TypeError):
            return "$0.00"

    def format_qty(qty) -> str:
        try:
            q = float(qty)
            return str(int(q)) if q.is_integer() else str(q)
        except Exception:
            return "0"

    def format_date(date_val) -> str:
        if not date_val:
            return ""
        if isinstance(date_val, str):
            try:
                dt = datetime.fromisoformat(date_val.replace('Z', '+00:00'))
                # keep your screenshot style: 1/18/2026
                return f"{dt.month}/{dt.day}/{dt.year}"
            except Exception:
                return date_val
        return str(date_val)

    def compute_pair_col_widths(
        max_label_text: str,
        value_strings: list[str],
        font_label: str,
        size_label: float,
        font_value: str,
        size_value: float,
        min_label_w: float = 2.0 * inch,
        min_value_w: float = 1.2 * inch,
        pad_pts: float = 10.0,
        max_total_w: float | None = None
    ):
        """
        Compute (label_w, value_w) for a right-aligned 2-col mini-table.
        We size the value column to the widest currency string + padding,
        and guarantee a minimum label width so labels don't wrap/overlap.
        """
        if max_total_w is None:
            max_total_w = doc.width  # in points

        # width in points - add extra safety margin for bold fonts and rendering
        widest_value = 0.0
        for s in (value_strings or ["$0.00"]):
            # Add 10% safety margin for bold fonts and rendering variations
            text_width = stringWidth(s, font_value, size_value)
            widest_value = max(widest_value, text_width * 1.1)
        
        # Ensure value column has enough space with generous padding
        needed_value_w = widest_value + 2 * pad_pts + 20  # extra 20pt safety margin
        value_w = max(min_value_w, needed_value_w)

        # label needs at least min_label_w; also consider actual label text width
        # Add safety margin for bold fonts
        label_text_w = stringWidth(max_label_text, font_label, size_label) * 1.1 + 2 * pad_pts + 15
        label_w = max(min_label_w, label_text_w)

        total_w = label_w + value_w
        if total_w > max_total_w:
            # if too wide, squeeze label first (keep value width) but never below absolute minimum
            # Use a more conservative absolute minimum to prevent overlap
            absolute_min_label = stringWidth(max_label_text, font_label, size_label) * 1.15 + 15
            overflow = total_w - max_total_w
            label_w = max(max(min_label_w, absolute_min_label), label_w - overflow)
            total_w = label_w + value_w

        # if still too wide, squeeze value (rare unless doc width is tiny)
        # But ensure value never gets too small to display the currency properly
        if total_w > max_total_w:
            overflow = total_w - max_total_w
            # Ensure value column can still fit the widest currency string
            min_value_absolute = widest_value + 15  # minimum to fit text + small margin
            value_w = max(max(min_value_w, min_value_absolute), value_w - overflow)

        return label_w, value_w

    def add_pair_table(rows, label_w, value_w, line_above=False, total_row_index=None):
        """
        rows: list of tuples (label_paragraph, value_paragraph)
        total_row_index: if provided, apply 'TOTAL' styling line/padding to that row
        """
        t = Table(
            [[lbl, val] for (lbl, val) in rows],
            colWidths=[label_w, value_w],
            hAlign='RIGHT'
        )

        ts = [
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            # gutter between label and value - increased to prevent overlap
            ('RIGHTPADDING', (0, 0), (0, -1), 20),
            ('LEFTPADDING', (1, 0), (1, -1), 20),
        ]

        if line_above:
            ts.append(('LINEABOVE', (0, 0), (-1, 0), 1, color_primary))
            ts.append(('TOPPADDING', (0, 0), (-1, 0), 10))

        if total_row_index is not None:
            ts.append(('LINEABOVE', (0, total_row_index), (-1, total_row_index), 1, color_primary))
            ts.append(('TOPPADDING', (0, total_row_index), (-1, total_row_index), 10))

        t.setStyle(TableStyle(ts))
        elements.append(KeepTogether(t))

    # ---------- Normalize invoice ----------
    invoice = invoice_data.get('invoice', invoice_data)
    line_items = invoice.get('lineItems', []) or []

    # Split items (same heuristic as yours)
    services = [
        i for i in line_items
        if any(x in (i.get('description', '') or '').lower() for x in ['labor', 'hour', 'service', 'time'])
    ]
    materials = [i for i in line_items if i not in services]

    def section_sum(items) -> float:
        total = 0.0
        for it in items:
            qty = safe_float(it.get('quantity', 0))
            rate = safe_float(it.get('rate', 0))
            total += qty * rate
        return total

    total_services = section_sum(services)
    total_materials = section_sum(materials)
    subtotal = total_services + total_materials

    manual_total = safe_float(invoice.get('total', 0))
    if manual_total > 0 and abs(manual_total - subtotal) > 1e-6:
        tax = manual_total - subtotal
        final_total = manual_total
    else:
        tax = subtotal * 0.10  # demo tax
        final_total = subtotal + tax

    # ---------- Column widths for items table ----------
    # Keep your original proportions (fits nicely visually)
    col_widths_items = [2.8 * inch, 0.8 * inch, 1.2 * inch, 1.7 * inch]

    # ---------- Header ----------
    biz_info = [Paragraph(user.get('businessName', 'Invoice'), style_title)]
    if user.get('businessAddress'):
        biz_info.append(Paragraph(user['businessAddress'], style_normal))
    if user.get('businessPhone'):
        biz_info.append(Paragraph(user['businessPhone'], style_normal))
    if user.get('businessEmail'):
        biz_info.append(Paragraph(user['businessEmail'], style_normal))

    inv_info = []
    inv_num = invoice.get('invoiceNumber', 'N/A')
    inv_info.append(Paragraph("<b>INVOICE</b>", style_right_meta))
    inv_info.append(Paragraph(f"Invoice #: {inv_num}", style_right_meta))
    inv_info.append(Paragraph(f"Issue Date: {format_date(invoice.get('issueDate'))}", style_right_meta))
    inv_info.append(Paragraph(f"Due Date: {format_date(invoice.get('dueDate'))}", style_right_meta))

    status = (invoice.get('status', 'draft') or 'draft').upper()
    status_color_hex = "#ff0000" if status == "OVERDUE" else "#667eea"
    inv_info.append(Paragraph(f'Status: <font color="{status_color_hex}"><b>{status}</b></font>', style_right_meta))

    header_table = Table([[biz_info, inv_info]], colWidths=[4 * inch, doc.width - 4 * inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.4 * inch))

    # ---------- Client / Project ----------
    elements.append(Paragraph("BILL TO:", style_label_small))
    if client.get('name'):
        elements.append(Paragraph(f"<b>{client['name']}</b>", style_normal))
    if client.get('email'):
        elements.append(Paragraph(client['email'], style_normal))
    if client.get('address'):
        elements.append(Paragraph(client['address'], style_normal))

    elements.append(Spacer(1, 0.2 * inch))

    if invoice.get('invoiceTitle') or invoice.get('invoiceDescription'):
        elements.append(Paragraph("Job/Project:", style_label_small))
        if invoice.get('invoiceTitle'):
            elements.append(Paragraph(f"<b>{invoice['invoiceTitle']}</b>", style_normal))
        if invoice.get('invoiceDescription'):
            elements.append(Paragraph(invoice['invoiceDescription'], style_normal))
        elements.append(Spacer(1, 0.2 * inch))

    # ---------- Items table builder ----------
    def add_items_section(title: str, items: list[Dict[str, Any]], section_total: float):
        if not items:
            return

        elements.append(Paragraph(title, style_section))

        data = [['Description', 'Quantity', 'Rate', 'Amount']]
        for it in items:
            qty = safe_float(it.get('quantity', 0))
            rate = safe_float(it.get('rate', 0))
            amt = qty * rate

            data.append([
                Paragraph(it.get('description', '') or '', style_normal),
                format_qty(qty),
                Paragraph(format_currency(rate), style_money),
                Paragraph(format_currency(amt), style_money),
            ])

        t = Table(data, colWidths=col_widths_items, repeatRows=1)

        t.setStyle(TableStyle([
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), color_primary),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),

            # Body
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('TOPPADDING', (0, 1), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f5f5f5')),

            # Align
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),

            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, color_grid),

            # Inner padding
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ]))

        elements.append(t)
        elements.append(Spacer(1, 0.15 * inch))

        # ---- SECTION SUBTOTAL (separate 2-col table, right-aligned) ----
        label_text = f"{title.title()} Subtotal:"
        value_text = format_currency(section_total)

        label_w, value_w = compute_pair_col_widths(
            max_label_text=label_text,
            value_strings=[value_text],
            font_label='Helvetica-Bold', size_label=10,
            font_value='Helvetica-Bold', size_value=10,
            min_label_w=2.5 * inch,  # Increased to accommodate longer labels
            min_value_w=1.8 * inch,  # Increased to accommodate large currency values
            pad_pts=15.0,  # Increased padding
            # Allow more width for large values while keeping it right-aligned
            max_total_w=min(5.0 * inch, doc.width)
        )

        add_pair_table(
            rows=[(Paragraph(label_text, style_pair_label), Paragraph(value_text, style_pair_value))],
            label_w=label_w,
            value_w=value_w,
            line_above=False
        )

        elements.append(Spacer(1, 0.25 * inch))

    add_items_section("SERVICES", services, total_services)
    add_items_section("MATERIALS", materials, total_materials)

    # ---------- Grand totals (separate 2-col table, right-aligned) ----------
    elements.append(Spacer(1, 0.15 * inch))

    total_rows = [
        ("Subtotal:", format_currency(subtotal), style_pair_label, style_pair_value),
    ]
    if tax > 0:
        total_rows.append(("Tax:", format_currency(tax), style_pair_label, style_pair_value))
    total_rows.append(("TOTAL:", format_currency(final_total), style_total_label, style_total_value))

    # widths based on the widest total currency string, with a compact right-aligned block
    value_strings = [r[1] for r in total_rows]
    label_w, value_w = compute_pair_col_widths(
        max_label_text="TOTAL:",  # Use "TOTAL:" as it's the longest label
        value_strings=value_strings,
        font_label='Helvetica-Bold', size_label=14,  # TOTAL label uses 14pt
        font_value='Helvetica-Bold', size_value=14,  # TOTAL row uses 14
        min_label_w=2.0 * inch,  # Increased to prevent overlap
        min_value_w=2.0 * inch,  # Increased to accommodate large currency values
        pad_pts=15.0,  # Increased padding
        max_total_w=min(5.0 * inch, doc.width)  # Allow more width for large values
    )

    rows_for_table = []
    for (lbl, val, lbl_style, val_style) in total_rows:
        rows_for_table.append((Paragraph(lbl, lbl_style), Paragraph(val, val_style)))

    # line above TOTAL row
    total_row_index = len(rows_for_table) - 1

    add_pair_table(
        rows=rows_for_table,
        label_w=label_w,
        value_w=value_w,
        line_above=True,
        total_row_index=total_row_index
    )

    # ---------- Footer ----------
    elements.append(Spacer(1, 0.5 * inch))
    elements.append(Paragraph(
        "Thank you for your business!",
        ParagraphStyle(
            'Footer', parent=style_normal,
            alignment=TA_CENTER,
            fontName='Helvetica-Oblique',
            textColor=color_light
        )
    ))
    elements.append(Paragraph(
        "Generated by BAb the Builder",
        ParagraphStyle(
            'Footer2', parent=style_normal,
            alignment=TA_CENTER,
            fontSize=9,
            textColor=color_light
        )
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_pdf_base64(invoice_data: Dict[str, Any], user: Dict[str, Any], client: Dict[str, Any]) -> str:
    pdf_buffer = create_pdf_document(invoice_data, user, client)
    return base64.b64encode(pdf_buffer.read()).decode('utf-8')
