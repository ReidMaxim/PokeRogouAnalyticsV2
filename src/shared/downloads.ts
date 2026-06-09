const DOWNLOAD_REVOCATION_MS = 60_000;

export async function downloadBlob(filename: string, blob: Blob): Promise<number | undefined> {
  const url = URL.createObjectURL(blob);
  try {
    const downloadId = await chrome.downloads.download({
      url,
      filename,
      saveAs: false,
    });
    window.setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_REVOCATION_MS);
    return downloadId;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function downloadTextFile(
  filename: string,
  contents: string,
  mimeType: string,
): Promise<number | undefined> {
  const blob = new Blob([contents], { type: mimeType });
  return downloadBlob(filename, blob);
}
