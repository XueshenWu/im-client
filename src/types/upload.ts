// The structure of your JSON Manifest
export interface ImageManifest {
  batchName?: string;
  // A list of absolute file paths on the user's machine
  files: string[]; 
}

// Update the Electron Bridge to support reading a file by path
export interface IElectronAPI {
  getFilePath: (file: File) => string;
  // New method: Takes a path, returns the file buffer/blob
  readLocalFile: (path: string) => Promise<ArrayBuffer | null>; 
}