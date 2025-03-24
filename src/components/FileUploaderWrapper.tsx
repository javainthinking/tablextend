"use client";

import dynamic from 'next/dynamic';

const FileUploader = dynamic(() => import('./FileUploader'), {
  ssr: false,
});

export default function FileUploaderWrapper() {
  return <FileUploader />;
} 