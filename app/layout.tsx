import "./globals.css";
export const metadata = { title: "SeeSaw Client Board" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
