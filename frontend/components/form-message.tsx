type FormMessageProps = {
  kind: "success" | "error" | "info";
  children: React.ReactNode;
};

export function FormMessage({ kind, children }: FormMessageProps) {
  const classes = {
    success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    error: "border-red-400/25 bg-red-400/10 text-red-100",
    info: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
  };

  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${classes[kind]}`}>
      {children}
    </div>
  );
}
