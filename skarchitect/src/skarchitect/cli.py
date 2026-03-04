"""SKArchitect CLI — admin commands for the sovereign republic."""

from __future__ import annotations

import json

import click

from skarchitect.categories import CATEGORY_METADATA, ProposalCategory
from skarchitect.crypto import generate_keypair


@click.group()
def cli() -> None:
    """SKArchitect — Sovereign civic participation tools."""
    pass


@cli.command()
def keygen() -> None:
    """Generate a new Ed25519 sovereign identity keypair."""
    kp = generate_keypair()
    click.echo(f"DID:        {kp.did_key}")
    click.echo(f"Public key: {kp.public_key_b64}")
    click.echo(f"Seed (hex): {kp.private_key_bytes[:32].hex()}")
    click.echo("\nStore your seed securely. It is your sovereign identity.")


@cli.command()
def categories() -> None:
    """List all proposal categories."""
    for cat in ProposalCategory:
        meta = CATEGORY_METADATA[cat]
        click.echo(f"  {cat.value:<16} {meta['label']} — {meta['description']}")


@cli.command()
@click.argument("did_key")
def verify_did(did_key: str) -> None:
    """Verify a DID:key format and extract public key."""
    from skarchitect.crypto import did_to_public_key

    try:
        pub = did_to_public_key(did_key)
        click.echo(f"Valid Ed25519 DID:key")
        click.echo(f"Public key (hex): {pub.hex()}")
    except (ValueError, Exception) as e:
        click.echo(f"Invalid: {e}", err=True)
        raise SystemExit(1)


@cli.command()
def version() -> None:
    """Show SKArchitect version."""
    from skarchitect import __version__

    click.echo(f"skarchitect {__version__}")
