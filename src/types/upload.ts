export interface ImageManifest {
  batchName?: string;
  // A list of absolute file paths on the user's machine
  files: string[]; 
}

export interface IElectronAPI {
  getFilePath: (file: File) => string;
  readLocalFile: (path: string) => Promise<ArrayBuffer | null>; 
}