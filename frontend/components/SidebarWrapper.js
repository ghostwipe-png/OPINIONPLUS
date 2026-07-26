'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

const VIDEO_ROUTES = ['/videos', '/video', '/subscriptions', '/library', '/playlist', '/upload/video'];

export default function SidebarWrapper() {
  const pathname = usePathname();

  const showSidebar = VIDEO_ROUTES.some((route) => pathname.startsWith(route));

  if (!showSidebar) return null;

  return <Sidebar />;
}