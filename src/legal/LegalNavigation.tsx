export type LegalNavigationPage = 'terms' | 'privacy' | 'account' | 'deletion';

const links: ReadonlyArray<{
  label: string;
  href: string;
  page?: LegalNavigationPage;
}> = [
  { label: 'Home', href: '/' },
  { label: 'Termini', href: '/termini/', page: 'terms' },
  { label: 'Privacy', href: '/privacy/', page: 'privacy' },
  { label: 'Account e dati', href: '/account-e-dati/', page: 'account' },
  { label: 'Elimina account', href: '/elimina-account/', page: 'deletion' },
];

export function LegalNavigation({ current }: { current: LegalNavigationPage }) {
  return (
    <nav className="legal-navigation" aria-label="Navigazione documenti e account">
      {links.map((link) => (
        <a key={link.href} href={link.href} aria-current={link.page === current ? 'page' : undefined}>
          {link.label}
        </a>
      ))}
    </nav>
  );
}
