import type { ReactNode } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

interface Props {
  children: ReactNode;
}

export default function DeskLayout({ children }: Props) {
  return (
    <div className="flex h-screen w-full flex-col wood-grain overflow-hidden">
      {/* SVG-noise texture overlay */}
      <div className="absolute inset-0 grain-overlay pointer-events-none" />

      <Header />

      {/* main desk surface — scrollable */}
      <main className="flex-1 overflow-y-auto relative p-4 sm:p-8 lg:p-12">{children}</main>

      <Footer />
    </div>
  );
}