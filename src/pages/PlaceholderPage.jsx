import { PAGE_COPY } from '../lib/navigation.js';

export function PlaceholderPage({ page }) {
  const copy = PAGE_COPY[page];

  if (!copy) return null;

  return (
    <section className="placeholder-page">
      <div>
        <div className="card-label">{copy.eyebrow}</div>
        <h2>{copy.title} <em>{copy.accent}</em></h2>
        <p>{copy.body}</p>
      </div>
    </section>
  );
}
