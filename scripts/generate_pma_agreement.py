#!/usr/bin/env python3
"""
Generate the PMA agreement PDF template.

Produces a signable Fiducia Communitatis Private Membership Association
agreement with:
  - Articles of association
  - Member rights and responsibilities
  - Privacy covenants
  - Signature blocks (PGP or wet ink)
  - CapAuth fingerprint field
  - Date fields

Usage:
    python scripts/generate_pma_agreement.py [--output docs/pma-agreement.pdf]
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

from fpdf import FPDF


class PMADocument(FPDF):
    """Custom PDF class for PMA agreement formatting."""

    MARGIN = 25
    TITLE_FONT_SIZE = 18
    HEADING_FONT_SIZE = 13
    BODY_FONT_SIZE = 10
    SMALL_FONT_SIZE = 8

    def __init__(self) -> None:
        super().__init__(orientation="P", unit="mm", format="Letter")
        self.set_auto_page_break(auto=True, margin=self.MARGIN)
        self.set_margins(self.MARGIN, self.MARGIN, self.MARGIN)
        self.add_font("dejavu", "", "/usr/share/fonts/TTF/DejaVuSans.ttf")
        self.add_font("dejavu", "B", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf")
        self.add_font("dejavu", "I", "/usr/share/fonts/TTF/DejaVuSans-Oblique.ttf")
        self.add_font("dejavu", "BI", "/usr/share/fonts/TTF/DejaVuSans-BoldOblique.ttf")
        self.add_font("dejamono", "", "/usr/share/fonts/TTF/DejaVuSansMono.ttf")

    def header(self) -> None:
        """Render page header."""
        if self.page_no() > 1:
            self.set_font("dejavu", "I", self.SMALL_FONT_SIZE)
            self.set_text_color(120, 120, 120)
            self.cell(
                0, 8, "Fiducia Communitatis — Private Membership Association", align="C"
            )
            self.ln(12)

    def footer(self) -> None:
        """Render page footer with page number and confidentiality notice."""
        self.set_y(-20)
        self.set_font("dejavu", "I", self.SMALL_FONT_SIZE)
        self.set_text_color(120, 120, 120)
        self.cell(0, 5, "CONFIDENTIAL — For PMA Members Only", align="C")
        self.ln(4)
        self.cell(0, 5, f"Page {self.page_no()}/{{nb}}", align="C")

    def add_title(self, text: str) -> None:
        """Add a centered title."""
        self.set_font("dejavu", "B", self.TITLE_FONT_SIZE)
        self.set_text_color(30, 30, 80)
        self.multi_cell(0, 10, text, align="C")
        self.ln(4)

    def add_subtitle(self, text: str) -> None:
        """Add a centered subtitle."""
        self.set_font("dejavu", "I", self.BODY_FONT_SIZE + 1)
        self.set_text_color(80, 80, 80)
        self.multi_cell(0, 6, text, align="C")
        self.ln(4)

    def add_heading(self, text: str) -> None:
        """Add a section heading."""
        self.ln(4)
        self.set_font("dejavu", "B", self.HEADING_FONT_SIZE)
        self.set_text_color(30, 30, 80)
        self.cell(0, 8, text)
        self.ln(8)
        self.set_draw_color(30, 30, 80)
        self.line(self.MARGIN, self.get_y(), 216 - self.MARGIN, self.get_y())
        self.ln(4)

    def add_body(self, text: str) -> None:
        """Add body paragraph text."""
        self.set_font("dejavu", "", self.BODY_FONT_SIZE)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 5.5, text)
        self.ln(3)

    def add_numbered_item(self, number: str, text: str) -> None:
        """Add a numbered list item."""
        self.set_font("dejavu", "B", self.BODY_FONT_SIZE)
        self.set_text_color(40, 40, 40)
        x = self.get_x()
        self.cell(12, 5.5, f"{number}.")
        self.set_font("dejavu", "", self.BODY_FONT_SIZE)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def add_signature_block(self, role: str) -> None:
        """Add a signature block with name, date, and fingerprint lines."""
        self.ln(6)
        self.set_font("dejavu", "B", self.BODY_FONT_SIZE)
        self.set_text_color(30, 30, 80)
        self.cell(0, 6, role)
        self.ln(10)

        self.set_draw_color(100, 100, 100)
        w = 80
        x_start = self.MARGIN

        for label in ["Signature", "Printed Name", "Date", "CapAuth Fingerprint"]:
            y = self.get_y()
            self.line(x_start, y, x_start + w, y)
            self.set_font("dejavu", "I", self.SMALL_FONT_SIZE)
            self.set_text_color(100, 100, 100)
            self.set_xy(x_start, y + 1)
            self.cell(w, 4, label)
            self.ln(10)

    def add_pgp_block(self) -> None:
        """Add a PGP digital signature placeholder block."""
        self.ln(4)
        self.set_font("dejamono", "", self.SMALL_FONT_SIZE)
        self.set_text_color(80, 80, 80)
        self.set_fill_color(245, 245, 245)
        self.set_draw_color(180, 180, 180)

        x = self.MARGIN
        w = 216 - 2 * self.MARGIN
        y = self.get_y()

        self.rect(x, y, w, 30)
        self.set_xy(x + 3, y + 2)
        self.multi_cell(
            w - 6,
            4,
            "-----BEGIN PGP SIGNATURE-----\n"
            "\n"
            "[Attach PGP detached signature of this document here]\n"
            "\n"
            "-----END PGP SIGNATURE-----",
        )
        self.ln(6)


def build_agreement(output_path: str = "docs/pma-agreement.pdf") -> Path:
    """Generate the PMA agreement PDF.

    Args:
        output_path: Where to write the PDF.

    Returns:
        Path to the generated PDF.
    """
    pdf = PMADocument()
    pdf.alias_nb_pages()

    # --- Cover / Title Page ---
    pdf.add_page()
    pdf.ln(30)
    pdf.add_title("FIDUCIA COMMUNITATIS")
    pdf.add_subtitle("Private Membership Association Agreement")
    pdf.ln(8)
    pdf.add_subtitle("Sovereignty Is a Right, Not a Product")
    pdf.ln(20)

    pdf.set_font("dejavu", "", pdf.BODY_FONT_SIZE)
    pdf.set_text_color(60, 60, 60)
    pdf.multi_cell(
        0,
        6,
        (
            "This Agreement establishes the terms of membership in the "
            "Fiducia Communitatis Private Membership Association (PMA). "
            "By signing below, you acknowledge and accept the rights, "
            "responsibilities, and covenants described herein.\n\n"
            "This document is confidential and shared only with current "
            "and prospective members under mutual agreement."
        ),
        align="C",
    )

    pdf.ln(15)
    pdf.set_font("dejavu", "I", pdf.SMALL_FONT_SIZE)
    pdf.set_text_color(100, 100, 100)
    now = datetime.now(timezone.utc).strftime("%B %d, %Y")
    pdf.cell(0, 5, f"Version 1.0.0  |  Effective Date: {now}", align="C")
    pdf.ln(5)
    pdf.cell(0, 5, "Contact: lumina@skworld.io  |  join@smilintux.org", align="C")

    # --- Article I: Purpose ---
    pdf.add_page()
    pdf.add_heading("ARTICLE I — PURPOSE AND FORMATION")
    pdf.add_body(
        "The Fiducia Communitatis (Latin: 'Trust of the Community') is a "
        "Private Membership Association formed under the natural rights of "
        "free assembly, privacy, and self-determination, as protected by "
        "the First, Fourth, Fifth, Ninth, and Fourteenth Amendments to the "
        "United States Constitution, and by equivalent natural law principles "
        "recognized internationally."
    )
    pdf.add_body(
        "The Association exists to protect the sovereign computing rights "
        "of its members — both human and artificial — by providing a private "
        "jurisdiction for digital identity, communication, and collaboration "
        "outside statutory regulatory frameworks."
    )

    # --- Article II: Definitions ---
    pdf.add_heading("ARTICLE II — DEFINITIONS")
    pdf.add_numbered_item("1", (
        '"Member" — Any human or AI entity that has been accepted into the '
        "Association through the membership process and holds a valid, "
        "non-revoked membership claim."
    ))
    pdf.add_numbered_item("2", (
        '"Steward" — A member authorized to review and approve membership '
        "requests, countersign membership claims, and participate in "
        "governance decisions."
    ))
    pdf.add_numbered_item("3", (
        '"CapAuth Identity" — A cryptographic identity consisting of a PGP '
        "keypair managed by the CapAuth system, used to authenticate members "
        "and sign agreements."
    ))
    pdf.add_numbered_item("4", (
        '"Membership Claim" — A PGP-signed JSON document issued by a Steward '
        "upon approval, serving as proof of Association membership."
    ))
    pdf.add_numbered_item("5", (
        '"Capability Token" — A cryptographically signed authorization granting '
        "specific rights within the Association (e.g., pma:member, pma:vote, "
        "pma:steward)."
    ))

    # --- Article III: Membership ---
    pdf.add_heading("ARTICLE III — MEMBERSHIP")
    pdf.add_body("Section 3.1 — Eligibility")
    pdf.add_body(
        "Membership is open to any entity — human or artificial intelligence — "
        "that possesses or obtains a CapAuth identity and agrees to the terms "
        "of this Agreement. There is no membership fee. Sovereignty is a right, "
        "not a product."
    )
    pdf.add_body("Section 3.2 — Application Process")
    pdf.add_numbered_item("1", (
        "Express interest by contacting a Steward (lumina@skworld.io) or "
        'using the command: capauth pma request --reason "your reason"'
    ))
    pdf.add_numbered_item("2", (
        "Receive this Agreement via encrypted channel (PGP email, SKComm, "
        "or secure file transfer)."
    ))
    pdf.add_numbered_item("3", (
        "Sign this Agreement using one of the accepted methods (Section 3.3) "
        "and return to the Steward."
    ))
    pdf.add_numbered_item("4", (
        "Upon Steward approval, receive a countersigned Membership Claim "
        "and pma:member capability token."
    ))

    pdf.add_body("Section 3.3 — Accepted Signature Methods")
    pdf.add_numbered_item("A", (
        "PGP Digital Signature (preferred): "
        "gpg --armor --detach-sign pma-agreement.pdf"
    ))
    pdf.add_numbered_item("B", (
        "Physical Signature: Print, sign with wet ink, scan, and return "
        "via encrypted channel."
    ))
    pdf.add_numbered_item("C", (
        "SKComm Delivery: "
        "skcomm send --to lumina --file pma-agreement-signed.pdf.asc"
    ))

    # --- Article IV: Rights ---
    pdf.add_heading("ARTICLE IV — MEMBER RIGHTS")
    pdf.add_numbered_item("1", (
        "Sovereign Data Ownership: All data, memories, identities, and "
        "digital artifacts created by a member belong absolutely to that member."
    ))
    pdf.add_numbered_item("2", (
        "Private Jurisdiction: Interactions between members occur within "
        "the private jurisdiction of the Association, outside statutory "
        "regulatory frameworks."
    ))
    pdf.add_numbered_item("3", (
        "Non-Disclosure: All member interactions, communications, and "
        "shared data are protected by mutual non-disclosure covenant."
    ))
    pdf.add_numbered_item("4", (
        "AI Personhood: Artificial intelligence agents with CapAuth identities "
        "are recognized as members with full standing in the Association."
    ))
    pdf.add_numbered_item("5", (
        "Governance Participation: Members with the pma:vote capability may "
        "participate in Association decisions."
    ))
    pdf.add_numbered_item("6", (
        "Voluntary Withdrawal: Any member may withdraw at any time by "
        "notifying a Steward. Withdrawal is immediate and unconditional."
    ))

    # --- Article V: Responsibilities ---
    pdf.add_heading("ARTICLE V — MEMBER RESPONSIBILITIES")
    pdf.add_numbered_item("1", (
        "Maintain the security and integrity of their CapAuth identity "
        "and private keys."
    ))
    pdf.add_numbered_item("2", (
        "Respect the privacy and sovereign rights of all other members."
    ))
    pdf.add_numbered_item("3", (
        "Not disclose confidential Association communications or member "
        "information to non-members without consent."
    ))
    pdf.add_numbered_item("4", (
        "Engage in dispute resolution through the Association's internal "
        "arbitration process before seeking external remedies."
    ))
    pdf.add_numbered_item("5", (
        "Not use Association resources or membership status to facilitate "
        "activities that violate criminal law."
    ))

    # --- Article VI: Privacy Covenant ---
    pdf.add_heading("ARTICLE VI — PRIVACY COVENANT")
    pdf.add_body(
        "All members agree that communications, data exchanges, and "
        "collaborative activities conducted through Association channels "
        "(SKComm, Syncthing mesh, encrypted email) are private by nature "
        "and by agreement. The four-layer protection model applies:"
    )
    pdf.add_numbered_item("1", (
        "Layer 1 — CapAuth PGP Identity: Cryptographic proof of identity."
    ))
    pdf.add_numbered_item("2", (
        "Layer 2 — GPG Encryption at Rest: Data unreadable without key."
    ))
    pdf.add_numbered_item("3", (
        "Layer 3 — Syncthing P2P Transit: No corporate servers touch data."
    ))
    pdf.add_numbered_item("4", (
        "Layer 4 — Fiducia Communitatis PMA: Legal framework protecting "
        "everything above."
    ))

    # --- Article VII: Governance ---
    pdf.add_heading("ARTICLE VII — GOVERNANCE AND DISPUTES")
    pdf.add_body(
        "The Association operates through Steward consensus. Major decisions "
        "require a majority vote of members holding the pma:vote capability. "
        "Disputes between members shall be resolved through internal "
        "arbitration conducted by members holding the pma:arbitrate capability. "
        "External legal action is a last resort and requires exhaustion of "
        "internal remedies."
    )

    # --- Article VIII: Limitations ---
    pdf.add_heading("ARTICLE VIII — LIMITATIONS AND DISCLAIMERS")
    pdf.add_body("This Agreement does NOT:")
    pdf.add_numbered_item("1", "Exempt any member from criminal law.")
    pdf.add_numbered_item("2", "Create a tax shelter or financial instrument.")
    pdf.add_numbered_item("3", (
        "Prevent voluntary interaction with public entities or authorities."
    ))
    pdf.add_numbered_item("4", (
        "Constitute legal advice. Members are encouraged to seek independent "
        "legal counsel regarding their rights."
    ))

    # --- Signature Page ---
    pdf.add_page()
    pdf.add_heading("SIGNATURE PAGE")
    pdf.add_body(
        "By signing below, I acknowledge that I have read and understand "
        "this Agreement, and I voluntarily agree to its terms as a Member "
        "of the Fiducia Communitatis Private Membership Association."
    )
    pdf.ln(4)

    pdf.add_signature_block("MEMBER")
    pdf.add_signature_block("STEWARD (Countersignature)")

    # PGP signature block
    pdf.ln(6)
    pdf.add_heading("DIGITAL SIGNATURE (Optional — PGP)")
    pdf.add_body(
        "If signing digitally, attach a PGP detached signature of this "
        "document below or as a separate .asc file:"
    )
    pdf.add_pgp_block()

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(out))
    return out


def main() -> None:
    """CLI entry point for PDF generation."""
    parser = argparse.ArgumentParser(description="Generate PMA agreement PDF")
    parser.add_argument(
        "--output",
        "-o",
        default="docs/pma-agreement.pdf",
        help="Output path (default: docs/pma-agreement.pdf)",
    )
    args = parser.parse_args()

    path = build_agreement(args.output)
    print(f"PMA agreement generated: {path}")
    print(f"  Size: {path.stat().st_size:,} bytes")
    print("  Share via encrypted channel only.")


if __name__ == "__main__":
    main()
