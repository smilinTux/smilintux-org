import * as assert from "assert";
import * as vscode from "vscode";

suite("SKCapstone Cursor Extension", () => {
  test("Extension activates", async () => {
    const ext = vscode.extensions.getExtension("smilintux.skcapstone-ide");
    assert.ok(ext, "Extension should be registered");
    await ext!.activate();
    assert.ok(ext!.isActive, "Extension should be active");
  });

  test("Commands are registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    const expected = [
      "skcapstone.status",
      "skcapstone.memoryStore",
      "skcapstone.memorySearch",
      "skcapstone.coordStatus",
      "skcapstone.coordClaim",
      "skcapstone.syncPush",
      "skcapstone.refresh",
    ];
    for (const cmd of expected) {
      assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
    }
  });
});
