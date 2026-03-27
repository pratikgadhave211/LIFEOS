type CardProps = {
  children: React.ReactNode;
  className?: string;
};

type SectionTitleProps = {
  children: React.ReactNode;
  sub?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 p-5 ${className}`}
      style={{ boxShadow: "0 2px 16px 0 rgba(59,130,246,0.05)" }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, sub }: SectionTitleProps) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-slate-700">{children}</h3>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
