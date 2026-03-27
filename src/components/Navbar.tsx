import { navItems } from "./data";
import type { NavItem } from "./types";

type NavbarProps = {
  active: NavItem;
  setActive: (value: NavItem) => void;
};

export default function Navbar({ active, setActive }: NavbarProps) {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-slate-100 flex items-center px-6 gap-8"
      style={{ boxShadow: "0 1px 8px 0 rgba(59,130,246,0.06)" }}
    >
      <div className="flex items-center mr-6">
        <img src="/lifeos-logo.svg" alt="LIFEOS" className="h-10 w-auto" />
      </div>
      <div className="flex gap-1 flex-1">
        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => setActive(item)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              active === item
                ? "bg-blue-50 text-blue-700"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
          AJ
        </div>
      </div>
    </nav>
  );
}