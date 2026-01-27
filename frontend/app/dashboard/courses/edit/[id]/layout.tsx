import React, { ReactNode } from "react";

// Required for static export with nested dynamic routes
export async function generateStaticParams() {
  return [];
}

export default function EditCourseLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
