import { notFound } from 'next/navigation';
import { getRecording, incrementViewCount } from '@/lib/firestore';
import { getPreviewUrl } from '@/lib/drive';
import VideoPlayer from './VideoPlayer';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VideoPage({ params }: PageProps) {
  const { id } = await params;

  const recording = await getRecording(id);

  if (!recording) {
    notFound();
  }

  // Increment view count
  await incrementViewCount(id);

  const videoUrl = recording.driveFileId ? getPreviewUrl(recording.driveFileId) : null;

  return <VideoPlayer recording={recording} videoUrl={videoUrl} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const recording = await getRecording(id);

  if (!recording) {
    return {
      title: 'Video Not Found',
    };
  }

  return {
    title: `${recording.title} | Kloom`,
    description: `Watch this recording on Kloom`,
  };
}
