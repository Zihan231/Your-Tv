import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YourTv | Premium Live TV Player',
  description: 'YourTv - Your personalized browser-based IPTV player powered by the iptv-org API',
  icons: {
    icon: '/favicon.jpg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}