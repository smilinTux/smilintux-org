import * as assert from "assert";
import * as vscode from "vscode";

suite("SKCapstone VSCode Extension", () => {
  test("Extension activates", async () => {
    const ext = vscode.extensions.getExtension("smilinTux.skcapstone");
    assert.ok(ext, "Extension should be registered");
    await ext!.activate();
    assert.ok(ext!.isActive, "Extension should be active");
  });

  test("Commands are registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    const expected = [
      "skcapstone.refresh",
      "skcapstone.searchMemory",
      "skcapstone.storeMemory",
      "skcapstone.claimTask",
      "skcapstone.completeTask",
      "skcapstone.showSoul",
    ];
    for (const cmd of expected) {
      assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
    }
  });
});
