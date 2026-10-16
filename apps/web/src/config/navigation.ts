export type NavItem = { readonly label: string; readonly href: string };

export const primaryNav: readonly NavItem[] = [
  { label: "Projects", href: "/projects" },
  { label: "About", href: "/about" },
  { label: "Stack", href: "/#stack" },
  { label: "Updates", href: "/#updates" },
];
