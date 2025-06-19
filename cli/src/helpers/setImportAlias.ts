import fs from "fs-extra";
import path from "path";

async function replaceTextInFiles(
  directoryPath: string,
  search: string,
  replacement: string
): Promise<void> {
  const files = await fs.readdir(directoryPath);

  await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(directoryPath, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory()) {
        await replaceTextInFiles(filePath, search, replacement);
      } else {
        const data = await fs.readFile(filePath, "utf8");
        const updatedData = data.replace(new RegExp(search, "g"), replacement);
        await fs.writeFile(filePath, updatedData, "utf8");
      }
    })
  );
}

export const setImportAlias = async (projectDir: string, importAlias: string) => {
  const normalizedImportAlias = importAlias
    .replace(/\*/g, "") // remove any wildcards (~/* -> ~/)
    .replace(/[^\/]$/, "$&/"); // ensure trailing slash (@ -> ~/)

  // update import alias in any files if not using the default
  await replaceTextInFiles(projectDir, `~/`, normalizedImportAlias);
};
