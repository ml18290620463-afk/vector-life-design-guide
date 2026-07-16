import React from 'react';
import { Check, RotateCcw, Save, Shapes } from 'lucide-react';
import {
  DEFAULT_AVATAR_APPEARANCE,
  type AvatarAppearance,
  type AvatarAura,
  type AvatarCoreShape,
} from './appearance';

const SHAPES: Array<{ value: AvatarCoreShape; label: string; description: string }> = [
  { value: 'orb', label: '光核', description: '稳定、专注' },
  { value: 'prism', label: '棱镜', description: '多角度、析理' },
  { value: 'orbit', label: '轨迹', description: '连接、演化' },
];

const AURAS: Array<{ value: AvatarAura; label: string }> = [
  { value: 'calm', label: '沉静' },
  { value: 'clear', label: '清晰' },
  { value: 'warm', label: '温暖' },
];

export const AvatarGlyph: React.FC<{
  appearance: AvatarAppearance;
  size?: 'small' | 'large';
}> = ({ appearance, size = 'small' }) => (
  <div
    className={`avatar-glyph avatar-glyph--${size}`}
    data-shape={appearance.shape}
    data-aura={appearance.aura}
    data-motion={appearance.motion}
    role="img"
    aria-label={`${appearance.name}的分身形象`}
  >
    <span className="avatar-glyph__halo" aria-hidden="true" />
    <span className="avatar-glyph__orbit" aria-hidden="true" />
    <span className="avatar-glyph__core" aria-hidden="true" />
  </div>
);

interface AvatarAppearanceStudioProps {
  value: AvatarAppearance;
  onChange: (value: AvatarAppearance) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const AvatarAppearanceStudio: React.FC<AvatarAppearanceStudioProps> = ({
  value,
  onChange,
  onSave,
  onCancel,
}) => (
  <section className="avatar-studio" aria-labelledby="avatar-studio-title">
    <div className="avatar-studio__preview">
      <AvatarGlyph appearance={value} size="large" />
      <div>
        <span>你的专属分身</span>
        <h2 id="avatar-studio-title">{value.name || 'VECTOR'}</h2>
        <p>形象只表达你喜欢的陪伴方式，不会用来推断你的人格。</p>
      </div>
    </div>

    <div className="avatar-studio__field">
      <label htmlFor="avatar-display-name">怎么称呼它</label>
      <input
        id="avatar-display-name"
        value={value.name}
        maxLength={12}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        placeholder="VECTOR"
        aria-describedby="avatar-name-help"
      />
      <small id="avatar-name-help">最多 12 个字符，仅保存在本机</small>
    </div>

    <fieldset className="avatar-studio__choices">
      <legend><Shapes size={16} aria-hidden="true" />核心形态</legend>
      <div className="avatar-studio__shape-grid">
        {SHAPES.map((option) => (
          <label key={option.value} data-selected={value.shape === option.value}>
            <input
              type="radio"
              name="avatar-shape"
              value={option.value}
              checked={value.shape === option.value}
              onChange={() => onChange({ ...value, shape: option.value })}
            />
            <span>{option.label}</span>
            <small>{option.description}</small>
            {value.shape === option.value && <Check size={15} aria-hidden="true" />}
          </label>
        ))}
      </div>
    </fieldset>

    <fieldset className="avatar-studio__choices">
      <legend>气质光场</legend>
      <div className="avatar-studio__aura-grid">
        {AURAS.map((option) => (
          <label key={option.value} data-selected={value.aura === option.value}>
            <input
              type="radio"
              name="avatar-aura"
              value={option.value}
              checked={value.aura === option.value}
              onChange={() => onChange({ ...value, aura: option.value })}
            />
            <span className="avatar-studio__aura-dot" data-aura={option.value} aria-hidden="true" />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>

    <label className="avatar-studio__motion">
      <input
        type="checkbox"
        checked={value.motion === 'alive'}
        onChange={(event) => onChange({ ...value, motion: event.target.checked ? 'alive' : 'still' })}
      />
      <span>
        <strong>使用轻微生命感</strong>
        <small>启用光场呼吸和轨迹移动；系统减少动画时会自动停止</small>
      </span>
    </label>

    <div className="avatar-studio__actions">
      <button type="button" className="avatar-studio__secondary" onClick={() => onChange(DEFAULT_AVATAR_APPEARANCE)}>
        <RotateCcw size={16} aria-hidden="true" />恢复默认
      </button>
      <button type="button" className="avatar-studio__secondary" onClick={onCancel}>取消</button>
      <button type="button" className="avatar-studio__primary" onClick={onSave} disabled={!value.name.trim()}>
        <Save size={16} aria-hidden="true" />保存为我的分身
      </button>
    </div>
  </section>
);
