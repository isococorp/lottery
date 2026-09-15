import { AppShell } from "@/components/AppShell";

// Full-width: the results table carries ~19 วิชา across many columns and would
// otherwise sit inside a 1024px cap and need horizontal scrolling.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell wide>{children}</AppShell>;
}
