type Section = 'design' | 'practice' | 'history';
export function FutureSectionTabs({
  section,
  onChange,
}: {
  section: Section;
  onChange: (section: Section) => void;
}) {
  return (
    <div className="future-primary-tabs" role="tablist" aria-label="未来分区">
      {(['design', 'practice', 'history'] as const).map((value) => (
        <button
          type="button"
          role="tab"
          key={value}
          aria-selected={section === value}
          onClick={() => onChange(value)}
        >
          {value === 'design' ? '设计' : value === 'practice' ? '反馈' : '历史'}
        </button>
      ))}
    </div>
  );
}
