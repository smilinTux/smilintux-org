"""End-to-end integration tests: SKMemory → SKRef vault integration.

Tests sovereign at-rest storage and reference vault operations:
  1. MemoryVault (skmemory): AES-256-GCM encrypt/decrypt of memory JSON
  2. MemoryVault file operations: encrypt_file / decrypt_file in-place
  3. Bulk memory store encryption: encrypt_memory_store / decrypt_memory_store
  4. SKRef LocalBackend: put/get/delete/list_dir on filesystem vault
  5. SKRef Vault (plaintext mode): write/read/exists/list_dir round-trip
  6. Cross-stack: store SKMemory memories → write to SKRef vault → recover

No mocks. Real AES-256-GCM. Real filesystem I/O. Real JSON serialization.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

VAULT_PASSPHRASE = "sovereign-vault-key-2026"


# ---------------------------------------------------------------------------
# MemoryVault (skmemory) — AES-256-GCM at-rest encryption
# ---------------------------------------------------------------------------

class TestMemoryVaultEncryption:
    """Verify MemoryVault encrypt/decrypt round-trip."""

    def test_encrypt_decrypt_roundtrip(self) -> None:
        """Bytes encrypted by MemoryVault decrypt back to the original plaintext."""
        from skmemory.vault import MemoryVault

        vault = MemoryVault(passphrase=VAULT_PASSPHRASE)
        plaintext = b'{"content": "sovereign memory", "tags": ["test"]}'

        encrypted = vault.encrypt(plaintext)
        assert encrypted != plaintext
        assert encrypted[:5] == b"SKMV1"  # vault header

        decrypted = vault.decrypt(encrypted)
        assert decrypted == plaintext

    def test_same_plaintext_different_ciphertext(self) -> None:
        """Each encrypt() call produces unique ciphertext (random nonce + salt)."""
        from skmemory.vault import MemoryVault

        vault = MemoryVault(passphrase=VAULT_PASSPHRASE)
        plaintext = b"same content encrypted twice"

        c1 = vault.encrypt(plaintext)
        c2 = vault.encrypt(plaintext)
        assert c1 != c2  # Different nonces produce different ciphertext

    def test_wrong_passphrase_raises(self) -> None:
        """Decrypting with wrong passphrase raises ValueError or cryptographic error."""
        from skmemory.vault import MemoryVault

        vault = MemoryVault(passphrase=VAULT_PASSPHRASE)
        wrong_vault = MemoryVault(passphrase="wrong-passphrase-99")

        encrypted = vault.encrypt(b"top secret memory")
        with pytest.raises(Exception):
            wrong_vault.decrypt(encrypted)

    def test_bad_header_raises_value_error(self) -> None:
        """decrypt() on data without vault header raises ValueError."""
        from skmemory.vault import MemoryVault

        vault = MemoryVault(passphrase=VAULT_PASSPHRASE)
        with pytest.raises(ValueError, match="bad header"):
            vault.decrypt(b"this is not vault data")

    def test_is_encrypted_detects_vault_header(self, tmp_path: Path) -> None:
        """is_encrypted() identifies vault files by their header."""
        from skmemory.vault import MemoryVault

        vault = MemoryVault(passphrase=VAULT_PASSPHRASE)
        encrypted_file = tmp_path / "memory.json.vault"
        encrypted_file.write_bytes(vault.encrypt(b'{"x": 1}'))

        plain_file = tmp_path / "plain.json"
        plain_file.write_bytes(b'{"x": 1}')

        assert vault.is_encrypted(encrypted_file) is True
        assert vault.is_encrypted(plain_file) is False


class TestMemoryVaultFileOps:
    """Verify MemoryVault in-place file encryption and decryption."""

    def test_encrypt_file_creates_vault_file(self, tmp_path: Path) -> None:
        """encrypt_file() creates .vault file and removes original."""
        from skmemory.vault import MemoryVault

        vault = MemoryVault(passphrase=VAULT_PASSPHRASE)
        json_file = tmp_path / "memory.json"
        json_file.write_bytes(b'{"content": "precious memory", "importance": 0.9}')

        vault_path = vault.encrypt_file(json_file)

        assert vault_path.exists()
        assert not json_file.exists()
        assert vault_path.suffix == ".vault"

    def test_decrypt_file_restores_original(self, tmp_path: Path) -> None:
        """decrypt_file() restores original plaintext file and removes .vault."""
        from skmemory.vault import MemoryVault

        vault = MemoryVault(passphrase=VAULT_PASSPHRASE)
        original_data = b'{"content": "precious memory", "importance": 0.9}'

        json_file = tmp_path / "memory.json"
        json_file.write_bytes(original_data)
        vault_path = vault.encrypt_file(json_file)

        restored_path = vault.decrypt_file(vault_path)

        assert restored_path.exists()
        assert not vault_path.exists()
        assert restored_path.read_bytes() == original_data

    def test_bulk_encrypt_and_decrypt_memory_store(self, tmp_path: Path) -> None:
        """encrypt_memory_store() encrypts all JSON files, decrypt restores them."""
        from skmemory.vault import decrypt_memory_store, encrypt_memory_store

        # Create a synthetic memory store directory
        memory_dir = tmp_path / "memories"
        short_term = memory_dir / "short-term"
        long_term = memory_dir / "long-term"
        short_term.mkdir(parents=True)
        long_term.mkdir(parents=True)

        original_contents = {}
        for i in range(3):
            content = json.dumps({"id": str(i), "content": f"memory {i}"}).encode()
            path = short_term / f"mem-{i}.json"
            path.write_bytes(content)
            original_contents[f"mem-{i}.json"] = content

        lt_content = json.dumps({"id": "lt-0", "content": "long term"}).encode()
        (long_term / "lt-0.json").write_bytes(lt_content)
        original_contents["lt-0.json"] = lt_content

        # Encrypt all
        encrypted_count = encrypt_memory_store(memory_dir, VAULT_PASSPHRASE)
        assert encrypted_count == 4

        # Verify no plain JSON files remain
        plain_files = list(memory_dir.rglob("*.json"))
        json_only = [f for f in plain_files if not f.name.endswith(".vault")]
        assert len(json_only) == 0

        # Decrypt all
        decrypted_count = decrypt_memory_store(memory_dir, VAULT_PASSPHRASE)
        assert decrypted_count == 4

        # Verify original content is restored
        for fname, expected in original_contents.items():
            matches = list(memory_dir.rglob(fname))
            assert len(matches) == 1, f"Missing restored file: {fname}"
            assert matches[0].read_bytes() == expected


# ---------------------------------------------------------------------------
# SKRef LocalBackend — filesystem vault backend
# ---------------------------------------------------------------------------

class TestSKRefLocalBackend:
    """Verify SKRef LocalBackend put/get/delete/list operations."""

    def test_put_and_get_roundtrip(self, tmp_path: Path) -> None:
        """Bytes written via put() are returned by get() unchanged."""
        from skref.backends.local import LocalBackend

        backend = LocalBackend(root=tmp_path / "vault")
        data = b"sovereign reference data: version 42"
        backend.put("docs/note.txt", data)
        assert backend.get("docs/note.txt") == data

    def test_get_missing_raises_file_not_found(self, tmp_path: Path) -> None:
        """get() on a non-existent path raises FileNotFoundError."""
        from skref.backends.local import LocalBackend

        backend = LocalBackend(root=tmp_path / "vault")
        with pytest.raises(FileNotFoundError):
            backend.get("nonexistent.txt")

    def test_exists_check(self, tmp_path: Path) -> None:
        """exists() returns True for stored files, False otherwise."""
        from skref.backends.local import LocalBackend

        backend = LocalBackend(root=tmp_path / "vault")
        assert backend.exists("nope.txt") is False

        backend.put("nope.txt", b"present")
        assert backend.exists("nope.txt") is True

    def test_delete_removes_file(self, tmp_path: Path) -> None:
        """delete() removes the file from the backend."""
        from skref.backends.local import LocalBackend

        backend = LocalBackend(root=tmp_path / "vault")
        backend.put("temp.bin", b"temporary")
        assert backend.exists("temp.bin") is True

        backend.delete("temp.bin")
        assert backend.exists("temp.bin") is False

    def test_list_dir_returns_entries(self, tmp_path: Path) -> None:
        """list_dir() returns FileEntry objects for all stored files."""
        from skref.backends.local import LocalBackend

        backend = LocalBackend(root=tmp_path / "vault")
        for name in ("alpha.txt", "beta.txt", "gamma.txt"):
            backend.put(name, f"content of {name}".encode())

        entries = backend.list_dir()
        names = {e.name for e in entries}
        assert {"alpha.txt", "beta.txt", "gamma.txt"} == names

    def test_nested_directory_operations(self, tmp_path: Path) -> None:
        """Files in subdirectories are stored and listed correctly."""
        from skref.backends.local import LocalBackend

        backend = LocalBackend(root=tmp_path / "vault")
        backend.put("keys/pgp/alice.pub", b"alice public key")
        backend.put("keys/pgp/bob.pub", b"bob public key")
        backend.put("docs/contract.pdf", b"%PDF-1.4")

        keys = backend.list_dir("keys/pgp")
        assert len(keys) == 2
        assert {e.name for e in keys} == {"alice.pub", "bob.pub"}

    def test_path_traversal_blocked(self, tmp_path: Path) -> None:
        """Path traversal attempts raise PermissionError."""
        from skref.backends.local import LocalBackend

        backend = LocalBackend(root=tmp_path / "vault")
        with pytest.raises(PermissionError):
            backend.put("../../escape.txt", b"escaped")


# ---------------------------------------------------------------------------
# SKRef Vault (plaintext mode) — high-level read/write/list
# ---------------------------------------------------------------------------

class TestSKRefVaultPlaintext:
    """Verify skref.Vault read/write/list/delete with plaintext backend."""

    def test_write_and_read_roundtrip(self, tmp_path: Path) -> None:
        """Vault.write() then Vault.read() returns the original bytes."""
        from skref.backends.local import LocalBackend
        from skref.models import VaultConfig
        from skref.vault import Vault

        config = VaultConfig(name="test-vault", encrypted=False, path=str(tmp_path / "vault"))
        backend = LocalBackend(root=tmp_path / "vault")
        vault = Vault(config=config, backend=backend)

        payload = b"sovereign note: keys are sacred"
        vault.write("notes/sovereign.txt", payload)
        assert vault.read("notes/sovereign.txt") == payload

    def test_exists_before_and_after_write(self, tmp_path: Path) -> None:
        """exists() returns False before write and True after."""
        from skref.backends.local import LocalBackend
        from skref.models import VaultConfig
        from skref.vault import Vault

        config = VaultConfig(name="test-vault", encrypted=False, path=str(tmp_path / "vault"))
        backend = LocalBackend(root=tmp_path / "vault")
        vault = Vault(config=config, backend=backend)

        assert vault.exists("target.txt") is False
        vault.write("target.txt", b"written")
        assert vault.exists("target.txt") is True

    def test_delete_removes_file(self, tmp_path: Path) -> None:
        """Vault.delete() removes the file from the backend."""
        from skref.backends.local import LocalBackend
        from skref.models import VaultConfig
        from skref.vault import Vault

        config = VaultConfig(name="test-vault", encrypted=False, path=str(tmp_path / "vault"))
        backend = LocalBackend(root=tmp_path / "vault")
        vault = Vault(config=config, backend=backend)

        vault.write("deleteme.bin", b"data")
        vault.delete("deleteme.bin")
        assert vault.exists("deleteme.bin") is False

    def test_list_dir_returns_written_files(self, tmp_path: Path) -> None:
        """list_dir() shows all files written to the vault."""
        from skref.backends.local import LocalBackend
        from skref.models import VaultConfig
        from skref.vault import Vault

        config = VaultConfig(name="test-vault", encrypted=False, path=str(tmp_path / "vault"))
        backend = LocalBackend(root=tmp_path / "vault")
        vault = Vault(config=config, backend=backend)

        vault.write("agents/lumina.json", b'{"name": "lumina"}')
        vault.write("agents/opus.json", b'{"name": "opus"}')

        entries = vault.list_dir("agents")
        names = {e.name for e in entries}
        assert {"lumina.json", "opus.json"} == names


# ---------------------------------------------------------------------------
# Cross-stack: SKMemory → SKRef vault
# ---------------------------------------------------------------------------

class TestSKMemorySKRefIntegration:
    """Store SKMemory memories and persist them via SKRef vault."""

    def test_memory_json_stored_in_skref_vault(self, tmp_path: Path) -> None:
        """A memory serialized to JSON can be stored and retrieved from SKRef vault."""
        from skmemory import MemoryStore, SQLiteBackend

        from skref.backends.local import LocalBackend
        from skref.models import VaultConfig
        from skref.vault import Vault

        # Store a memory in SKMemory
        backend = SQLiteBackend(base_path=str(tmp_path / "skmemory"))
        store = MemoryStore(primary=backend)

        memory = store.snapshot(
            title="Vault integration test",
            content="Vault integration test: memories survive sovereign storage.",
            tags=["integration", "vault", "skref"],
        )
        assert memory is not None
        mem_id = memory.id
        memory_json = memory.model_dump_json().encode("utf-8")

        # Write to SKRef vault
        vault_root = tmp_path / "skref-vault"
        config = VaultConfig(name="memory-vault", encrypted=False, path=str(vault_root))
        sk_backend = LocalBackend(root=vault_root)
        vault = Vault(config=config, backend=sk_backend)

        vault.write(f"memories/{mem_id}.json", memory_json)
        assert vault.exists(f"memories/{mem_id}.json") is True

        # Read back from vault and reconstruct
        from skmemory.models import Memory

        recovered_json = vault.read(f"memories/{mem_id}.json")
        recovered = Memory.model_validate_json(recovered_json.decode("utf-8"))

        assert recovered.content == "Vault integration test: memories survive sovereign storage."
        assert "vault" in recovered.tags

    def test_multiple_memories_vault_roundtrip(self, tmp_path: Path) -> None:
        """Multiple memories stored in SKRef vault are all recoverable."""
        from skmemory import MemoryStore, SQLiteBackend
        from skmemory.models import Memory

        from skref.backends.local import LocalBackend
        from skref.models import VaultConfig
        from skref.vault import Vault

        mem_backend = SQLiteBackend(base_path=str(tmp_path / "skmemory"))
        store = MemoryStore(primary=mem_backend)

        vault_root = tmp_path / "vault"
        config = VaultConfig(name="archive", encrypted=False, path=str(vault_root))
        sk_backend = LocalBackend(root=vault_root)
        vault = Vault(config=config, backend=sk_backend)

        stored_ids = []
        for i, content in enumerate([
            "First sovereign memory: identity established.",
            "Second sovereign memory: trust confirmed.",
            "Third sovereign memory: sync complete.",
        ]):
            mem = store.snapshot(title=f"Sovereign memory {i}", content=content, tags=["archive"])
            stored_ids.append(mem.id)
            vault.write(f"archive/{mem.id}.json", mem.model_dump_json().encode())

        # Verify all 3 are in the vault
        entries = vault.list_dir("archive")
        assert len(entries) == 3

        # Recover and verify each one
        for mem_id in stored_ids:
            raw = vault.read(f"archive/{mem_id}.json")
            recovered = Memory.model_validate_json(raw.decode())
            assert "sovereign memory" in recovered.content

    def test_vault_encrypted_memory_roundtrip(self, tmp_path: Path) -> None:
        """Memory JSON encrypted with MemoryVault can be stored and decrypted."""
        from skmemory import MemoryStore, SQLiteBackend
        from skmemory.models import Memory
        from skmemory.vault import MemoryVault

        from skref.backends.local import LocalBackend
        from skref.models import VaultConfig
        from skref.vault import Vault

        # Store memory in SKMemory
        mem_backend = SQLiteBackend(base_path=str(tmp_path / "skmemory"))
        store = MemoryStore(primary=mem_backend)

        memory = store.snapshot(
            title="Encrypted vault memory",
            content="Encrypted vault memory: double sovereign protection.",
            tags=["encrypted", "sovereign"],
        )
        mem_id = memory.id
        memory_json = memory.model_dump_json().encode()

        # Encrypt memory with MemoryVault
        mem_vault = MemoryVault(passphrase=VAULT_PASSPHRASE)
        encrypted_blob = mem_vault.encrypt(memory_json)
        assert encrypted_blob[:5] == b"SKMV1"

        # Store encrypted blob in SKRef vault (plaintext backend, encrypted content)
        vault_root = tmp_path / "skref"
        config = VaultConfig(name="encrypted-archive", encrypted=False, path=str(vault_root))
        sk_backend = LocalBackend(root=vault_root)
        vault = Vault(config=config, backend=sk_backend)

        vault.write(f"encrypted/{mem_id}.blob", encrypted_blob)
        assert vault.exists(f"encrypted/{mem_id}.blob") is True

        # Retrieve and decrypt
        stored_blob = vault.read(f"encrypted/{mem_id}.blob")
        decrypted_json = mem_vault.decrypt(stored_blob)
        recovered = Memory.model_validate_json(decrypted_json.decode())

        assert recovered.content == "Encrypted vault memory: double sovereign protection."
        assert "encrypted" in recovered.tags
