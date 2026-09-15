export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="h-[3px] w-full bg-gold-grad" />
      <div className="flex min-h-[calc(100vh-3px)] flex-col items-center justify-center px-4">
        {children}
      </div>
    </>
  );
}
