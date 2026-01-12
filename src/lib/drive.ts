import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

// Initialize Google Drive API
// In Cloud Run, this uses the default service account
// The service account needs Drive API access and folder permissions
function getDriveClient(): drive_v3.Drive {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

export interface UploadResult {
  fileId: string;
  webViewLink: string;
  webContentLink: string;
}

export async function uploadToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string
): Promise<UploadResult> {
  const drive = getDriveClient();

  // Create a readable stream from the buffer
  const stream = new Readable();
  stream.push(fileBuffer);
  stream.push(null);

  // Upload the file (supports Shared Drives)
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id,webViewLink,webContentLink',
    supportsAllDrives: true,
  });

  const fileId = response.data.id!;

  // Make the file publicly accessible (anyone with link can view)
  await drive.permissions.create({
    fileId,
    supportsAllDrives: true,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  // Get updated file info with sharing links
  const fileInfo = await drive.files.get({
    fileId,
    fields: 'id,webViewLink,webContentLink',
    supportsAllDrives: true,
  });

  return {
    fileId: fileInfo.data.id!,
    webViewLink: fileInfo.data.webViewLink || '',
    webContentLink: fileInfo.data.webContentLink || '',
  };
}

export async function uploadToDriveResumable(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const drive = getDriveClient();

  // For larger files, use resumable upload
  const fileSize = fileBuffer.length;

  // Create a readable stream from the buffer
  const stream = new Readable();
  stream.push(fileBuffer);
  stream.push(null);

  // Upload the file with resumable upload (supports Shared Drives)
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id,webViewLink,webContentLink',
    supportsAllDrives: true,
  }, {
    // Enable resumable uploads for larger files
    onUploadProgress: (evt) => {
      if (onProgress && evt.bytesRead) {
        const progress = Math.round((evt.bytesRead / fileSize) * 100);
        onProgress(progress);
      }
    },
  });

  const fileId = response.data.id!;

  // Make the file publicly accessible
  await drive.permissions.create({
    fileId,
    supportsAllDrives: true,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  // Get updated file info
  const fileInfo = await drive.files.get({
    fileId,
    fields: 'id,webViewLink,webContentLink',
    supportsAllDrives: true,
  });

  return {
    fileId: fileInfo.data.id!,
    webViewLink: fileInfo.data.webViewLink || '',
    webContentLink: fileInfo.data.webContentLink || '',
  };
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

export async function getFileInfo(fileId: string): Promise<drive_v3.Schema$File | null> {
  const drive = getDriveClient();

  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink',
      supportsAllDrives: true,
    });
    return response.data;
  } catch {
    return null;
  }
}

export async function verifyFolderAccess(folderId: string): Promise<boolean> {
  const drive = getDriveClient();

  try {
    await drive.files.get({
      fileId: folderId,
      fields: 'id,name',
      supportsAllDrives: true,
    });
    return true;
  } catch {
    return false;
  }
}

// Get a direct download/stream URL for the video
export function getStreamUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// Get embeddable preview URL
export function getPreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}
