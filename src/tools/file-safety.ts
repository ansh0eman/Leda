import { basename, relative, resolve } from "node:path";

const blockedFileNames = ["credentials.json", "secrets.json", "id_rsa"];

export function isSensitiveFileName(fileName: string): boolean {
  return (
    fileName === ".env" ||
    fileName.startsWith(".env.") ||
    fileName.endsWith(".key") ||
    fileName.endsWith(".pem") ||
    blockedFileNames.includes(fileName)
  );
}

export function getSafeProjectPath(requestedPath: string): string | null {
  const projectRoot = process.cwd();
  const projectPath = resolve(projectRoot, requestedPath);
  const pathFromProjectRoot = relative(projectRoot, projectPath);

  if (pathFromProjectRoot.startsWith("..") || isSensitiveFileName(basename(projectPath))) {
    return null;
  }

  return projectPath;
}
