import { NextRequest, NextResponse } from 'next/server';
import { getRecording } from '@/lib/firestore';
import { google } from 'googleapis';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

// GET - Stream video from Google Drive
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const recording = await getRecording(id);

    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    if (!recording.driveFileId) {
      return NextResponse.json(
        { error: 'Video not yet uploaded' },
        { status: 404 }
      );
    }

    const drive = getDriveClient();

    // Get file metadata to know the size
    const fileInfo = await drive.files.get({
      fileId: recording.driveFileId,
      fields: 'size,mimeType',
      supportsAllDrives: true,
    });

    const fileSize = parseInt(fileInfo.data.size || '0', 10);
    const mimeType = fileInfo.data.mimeType || 'video/webm';

    // Handle range requests for video seeking
    const rangeHeader = request.headers.get('range');

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      // Get the video stream with range
      const response = await drive.files.get(
        {
          fileId: recording.driveFileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        {
          responseType: 'stream',
          headers: {
            Range: `bytes=${start}-${end}`,
          },
        }
      );

      // Convert the stream to a web ReadableStream
      const stream = response.data as unknown as NodeJS.ReadableStream;
      const webStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk));
          });
          stream.on('end', () => {
            controller.close();
          });
          stream.on('error', (err: Error) => {
            controller.error(err);
          });
        },
      });

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': mimeType,
        },
      });
    }

    // Full file request
    const response = await drive.files.get(
      {
        fileId: recording.driveFileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      {
        responseType: 'stream',
      }
    );

    const stream = response.data as unknown as NodeJS.ReadableStream;
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        stream.on('end', () => {
          controller.close();
        });
        stream.on('error', (err: Error) => {
          controller.error(err);
        });
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('Error streaming video:', error);
    return NextResponse.json(
      { error: 'Failed to stream video' },
      { status: 500 }
    );
  }
}
