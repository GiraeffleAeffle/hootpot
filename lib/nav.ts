export type NavItem = {
  href: string;
  label: string;
};

export const NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/me", label: "Me" },
  { href: "/scan", label: "Scan" },
  { href: "/pot", label: "Pot" },
  { href: "/dashboard", label: "Dashboard" },
];
