import { execSync } from "child_process";
import { platform } from "os";

function getDefaultEditor(): string {
  if (platform() === "win32") {
    return "notepad";
  }
  return "vi";
}

function getEditor(): string {
  const editor = process.env["EDITOR"] ?? process.env["VISUAL"];
  if (editor !== undefined && editor !== "") {
    return editor;
  }
  return getDefaultEditor();
}

export function openInEditor(filePath: string): void {
  const editor = getEditor();
  execSync(`${editor} "${filePath}"`, {
    stdio: "inherit",
  });
}
