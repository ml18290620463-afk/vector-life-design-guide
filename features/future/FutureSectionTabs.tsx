import { SilkSegmentedTabs } from '../../components/silk/SilkSegmentedTabs';
type Section = 'design' | 'practice' | 'history';
export function FutureSectionTabs({
  section,
  onChange,
}: {
  section: Section;
  onChange: (section: Section) => void;
}) {
  return <SilkSegmentedTabs
    className="future-primary-tabs"
    label="未来分区"
    tabs={[{ id: 'design', label: '设计' }, { id: 'practice', label: '践行' }, { id: 'history', label: '历史' }]}
    value={section}
    onChange={onChange}
  />;
}
