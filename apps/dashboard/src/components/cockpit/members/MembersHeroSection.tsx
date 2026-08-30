type Props = {
  tags: string[];
  description: string | null;
};

export function MembersHeroSection({ tags, description }: Props) {
  if (!tags.length && !description) return null;

  return (
    <section className="family-section">
      <div className="strip-card p-3">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag, i) => (
              <span key={i} className="badge bg-surface-2 text-xs">{tag}</span>
            ))}
          </div>
        )}
        {description && (
          <p className="text-sm text-surface-2 mb-0">{description}</p>
        )}
      </div>
    </section>
  );
}
