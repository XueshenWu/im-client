import JSZip from 'jszip';
import { ImageManifest } from "@/types/upload";

// Helper to get correct MIME type based on file extension
const getMimeType = (ext: string): string => {
    const mimeMap: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'svg': 'image/svg+xml',
        'zip': 'application/zip',
        'json': 'application/json',
    };
    return mimeMap[ext] || `application/${ext}`;
};

// --- Helper: Read files from disk using Electron ---
export const readFilesFromPaths = async (paths: string[]): Promise<File[]> => {
    // Guard check
    if (!window.electronAPI) return [];

    const filePromises = paths.map(async (filePath) => {
        try {
            const buffer = await window.electronAPI!.readLocalFile(filePath);
            if (!buffer) return null;

            const fileName = filePath.split(/[\\/]/).pop() || 'unknown-file';
            const ext = fileName.split('.').pop()?.toLowerCase() || 'dat';

            // Get correct MIME type based on extension
            const mimeType = getMimeType(ext);

            const file = new File([buffer], fileName, { type: mimeType });

            // Attach path properties for the HOC
            Object.defineProperty(file, 'path', { value: filePath });
            (file as any).sourcePath = filePath;

            return file;
        } catch (error) {
            console.error(`Failed to load file at ${filePath}`, error);
            return null;
        }
    });

    const results = await Promise.all(filePromises);
    return results.filter((f): f is File => f !== null);
};

// --- Main Batch Processor ---
export const processBatchDrop = async (
    droppedFiles: File[],
    recursive: boolean = false
): Promise<File[]> => {
    let extractedImages: File[] = [];

    // 1. STRICT GUARD: Capture API to a variable for TS type narrowing
    const api = window.electronAPI;

    // Regex for allowed image types (Excluding PDF/TXT)
    const IMAGE_EXT_REGEX = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;

    for (const file of droppedFiles) {

        // --- A. ZIP Handling ---
        if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
            try {
                const zip = await JSZip.loadAsync(file);
                const zipPromises: Promise<File | null>[] = [];

                zip.forEach((relativePath, zipEntry) => {
                    // Skip folders
                    if (zipEntry.dir) return;

                    // Skip non-images
                    if (!relativePath.match(IMAGE_EXT_REGEX)) return;

                    // FIX: Push the Promise directly, do not wrap in a function
                    const promise = zipEntry.async('blob').then((blob) => {
                        const ext = zipEntry.name.split('.').pop() || 'jpg';
                        return new File([blob], zipEntry.name, { type: `image/${ext}` });
                    });

                    zipPromises.push(promise);
                });

                const zipFiles = await Promise.all(zipPromises);
                extractedImages.push(...(zipFiles.filter((f): f is File => f !== null)));
            } catch (err) {
                console.error("Zip processing error:", err);
            }
        }

        // --- B. JSON Manifest Handling ---
        else if (file.type === 'application/json' || file.name.endsWith('.json')) {
            if (!api) continue; // Skip if no Electron API

            try {
                const text = await file.text();
                const manifest: ImageManifest = JSON.parse(text);

                if (Array.isArray(manifest.files)) {
                    // Expand paths (handles directories inside JSON)
                    const expandedPathsArrays = await Promise.all(
                        manifest.files.map(path => api.expandPath(path, recursive))
                    );

                    // Flatten and filter undefineds
                    const allFilePaths = expandedPathsArrays.flat().filter((p): p is string => !!p);

                    const manifestFiles = await readFilesFromPaths(allFilePaths);
                    extractedImages.push(...manifestFiles);
                }
            } catch (err) {
                console.error("Manifest error:", err);
            }
        }

        // --- C. Standard Files & Folders ---
        else {
            const filePath = api?.getFilePath(file);

            // ✅ CHECK 1: Basic Extension Check (Optimization)
            // If it has an extension, and that extension is NOT an image or supported format,
            // we can likely skip it immediately unless it's a folder (which usually has no ext).
            const isLikelyFile = file.name.includes('.');
            const isImage = file.name.match(IMAGE_EXT_REGEX);
            const isValidNonImage = file.name.match(/\.(zip|json)$/i);

            // If it looks like a file (has dot) but isn't an image or supported format, SKIP IT.
            // This catches 'notes.txt', 'manual.pdf' immediately but allows ZIP and JSON through.
            if (isLikelyFile && !isImage && !isValidNonImage) {
                console.warn(`Skipping unsupported file: ${file.name}`);
                continue;
            }

            if (filePath && api) {
                // Ask Electron to check (Electron will now also double-check due to Fix #1)
                const expandedPaths = await api.expandPath(filePath, recursive);

                if (expandedPaths && expandedPaths.length > 0) {
                    const diskFiles = await readFilesFromPaths(expandedPaths);
                    extractedImages.push(...diskFiles);
                }
            } else {
                // Fallback for non-Electron web drag
                if (file.type.match(/^image\//)) {
                    extractedImages.push(file);
                }
            }
        }
    }

    return extractedImages;
};