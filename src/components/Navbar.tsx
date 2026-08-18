const NAV_LINKS = [{ label: "Play", href: "#" }];

export function Navbar() {
  return (
    <nav className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
      <span className="text-lg font-semibold tracking-tight text-white">Nuzlocker</span>
      <ul className="flex gap-6">
        {NAV_LINKS.map((link) => (
          <li key={link.label}>
            <a href={link.href} className="text-sm font-medium text-white">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
