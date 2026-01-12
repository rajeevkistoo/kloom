import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings, Settings } from '@/lib/firestore';
import { verifyFolderAccess } from '@/lib/drive';

// GET - Get current settings
export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({
      settings: settings || {
        driveFolderId: '',
        defaultQuality: '1080p',
        defaultMicEnabled: true,
        defaultWebcamEnabled: false,
      },
    });
  } catch (error) {
    console.error('Error getting settings:', error);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

// POST - Save settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { driveFolderId, defaultQuality, defaultMicEnabled, defaultWebcamEnabled } = body;

    // Validate required fields
    if (!driveFolderId) {
      return NextResponse.json(
        { error: 'Google Drive folder ID is required' },
        { status: 400 }
      );
    }

    // Extract folder ID from various URL formats
    let folderId = driveFolderId;

    // Handle full Google Drive URLs
    // Format: https://drive.google.com/drive/folders/FOLDER_ID
    const folderMatch = driveFolderId.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) {
      folderId = folderMatch[1];
    }

    // Handle sharing URLs
    // Format: https://drive.google.com/drive/u/0/folders/FOLDER_ID
    const shareMatch = driveFolderId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (shareMatch && !folderMatch) {
      folderId = shareMatch[1];
    }

    // Verify the folder is accessible
    const hasAccess = await verifyFolderAccess(folderId);
    if (!hasAccess) {
      return NextResponse.json(
        {
          error: 'Cannot access the specified Google Drive folder. Please ensure the folder exists and the service account has access.',
          details: 'You need to share the folder with the Cloud Run service account email.'
        },
        { status: 400 }
      );
    }

    const settings: Settings = {
      driveFolderId: folderId,
      defaultQuality: defaultQuality || '1080p',
      defaultMicEnabled: defaultMicEnabled ?? true,
      defaultWebcamEnabled: defaultWebcamEnabled ?? false,
    };

    await saveSettings(settings);

    return NextResponse.json({ settings, success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
