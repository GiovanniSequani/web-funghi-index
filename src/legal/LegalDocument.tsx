import React from 'react';
import accountAndDataMarkdown from './documents/account-and-data.md?raw';
import privacyMarkdown from './documents/privacy-policy.md?raw';
import termsMarkdown from './documents/terms-of-use.md?raw';
import './legal.css';

export const BUNDLED_TERMS_VERSION = '0.2';
export const BUNDLED_PRIVACY_VERSION = '0.3';

export type LegalDocumentKind = 'terms' | 'privacy' | 'account';

export const LEGAL_DOCUMENTS: Record<LegalDocumentKind, {
  title: string;
  version: string;
  path: '/termini/' | '/privacy/' | '/account-e-dati/';
  markdown: string;
}> = {
  terms: {
    title: 'Termini di utilizzo',
    version: BUNDLED_TERMS_VERSION,
    path: '/termini/',
    markdown: termsMarkdown,
  },
  privacy: {
    title: 'Informativa privacy',
    version: BUNDLED_PRIVACY_VERSION,
    path: '/privacy/',
    markdown: privacyMarkdown,
  },  account: {
    title: 'Account e dati',
    version: '0.2',
    path: '/account-e-dati/',
    markdown: accountAndDataMarkdown,
  },
};

function renderInline(value: string): React.ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = value.split(pattern);
  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = /^https:\/\//.test(link[2]) ? link[2] : '#';
      return <a key={index} href={href} target="_blank" rel="noreferrer">{link[1]}</a>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; rows: string[][] };

export function parseLegalMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('- ')) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      const rows: string[][] = [];
      while (index < lines.length) {
        const tableLine = lines[index].trim();
        if (!tableLine.startsWith('|') || !tableLine.endsWith('|')) break;
        const cells = tableLine.slice(1, -1).split('|').map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-{3,}:?$/.test(cell))) rows.push(cells);
        index += 1;
      }
      blocks.push({ type: 'table', rows });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || /^(#{1,3})\s+/.test(next) || next.startsWith('- ') || (next.startsWith('|') && next.endsWith('|'))) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

export function LegalDocument(props: {
  kind: LegalDocumentKind;
  compact?: boolean;
  hideTitle?: boolean;
}) {
  const document = LEGAL_DOCUMENTS[props.kind];
  const blocks = React.useMemo(() => parseLegalMarkdown(document.markdown), [document.markdown]);

  return (
    <article className={'legal-document' + (props.compact ? ' compact' : '')}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          if (props.hideTitle && block.level === 1) return null;
          const Tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
          return <Tag key={index}>{renderInline(block.text)}</Tag>;
        }
        if (block.type === 'list') {
          return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>;
        }
        if (block.type === 'table') {
          const [head, ...body] = block.rows;
          return (
            <div className="legal-table-wrap" key={index}>
              <table>
                {head && <thead><tr>{head.map((cell, cellIndex) => <th key={cellIndex}>{renderInline(cell)}</th>)}</tr></thead>}
                <tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{renderInline(cell)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
        return <p key={index}>{renderInline(block.text)}</p>;
      })}
    </article>
  );
}

export function LegalDocumentPage(props: { kind: LegalDocumentKind }) {
  const document = LEGAL_DOCUMENTS[props.kind];
  return (
    <main className="legal-page">
      <nav aria-label="Navigazione documenti">
        <a href="/">Mappa</a>
        <a href="/termini/" aria-current={props.kind === 'terms' ? 'page' : undefined}>Termini</a>
        <a href="/privacy/" aria-current={props.kind === 'privacy' ? 'page' : undefined}>Privacy</a>
        <a href="/account-e-dati/" aria-current={props.kind === 'account' ? 'page' : undefined}>Account e dati</a>
      </nav>
      <div className="legal-page-heading">
        <p>Funghi Tracker</p>
        <span>Versione {document.version}</span>
      </div>
      <LegalDocument kind={props.kind} />
    </main>
  );
}

export function bundledDocumentsMatch(termsVersion: string | null, privacyVersion: string | null): boolean {
  return termsVersion === BUNDLED_TERMS_VERSION && privacyVersion === BUNDLED_PRIVACY_VERSION;
}