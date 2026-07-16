# VECTOR Cover 1:1 复刻组件化架构

> 目标：把附件里的 941 x 1672 首屏 UI 拆成可产品化开发的 React / Flutter 双端架构。视觉基准是暗蓝深空、HUD 同心圆、金蓝双螺旋、金属字标、中文副标题、底部接入舱按钮。

## 1. 画面基准

| 项目 | 规格 |
| --- | --- |
| 设计画布 | 941 x 1672，纵向移动端首屏 |
| 推荐逻辑尺寸 | 390 x 844 / 430 x 932 / 393 x 852，自适应居中 |
| 安全区 | 顶部 24px，底部 32px；核心内容垂直居中偏上 |
| 主视觉区域 | 顶部 18%-50%，HUD 圆心约在屏幕高度 34% |
| 标题区域 | 54%-73%，`VECTOR` + `矢量空间` + 标语 |
| CTA 区域 | 84%-92%，胶囊型接入舱 |
| 主题气质 | 深空、仪式感、精密仪表、时间/意识同步 |

## 2. 视觉分层

从后到前分为 8 层，每层独立组件，避免一个超大组件堆叠所有 CSS。

1. `SpaceBackdrop`：深蓝径向背景、细微噪声、边缘暗角。
2. `SignalWall`：背景大字/引文碎片，低透明度、缓慢漂移。
3. `StarField`：稀疏星点和微粒，使用 seeded random 保持截图稳定。
4. `OuterCalibrationRing`：大号外圈刻度，弱发光，覆盖 HUD 外围。
5. `VectorOrbitCore`：中心同心圆、刻度、轨迹、双螺旋、光点。
6. `HudStatusLabels`：上方“认知已同步”、左下“观测系统连接”。
7. `BrandLockup`：`VECTOR`、`矢量空间`、左右分割线、标语。
8. `AccessDockButton`：底部接入按钮，包含圆形节点、箭头、扫描线。

## 3. React 组件树

```tsx
<VectorCoverPage>
  <SpaceBackdrop />
  <SignalWall phrases={phrases} />
  <StarField seed="vector-cover" />
  <CoverMainLayout>
    <HeroOrbitSection>
      <HudStatusLabels status="认知已同步" observer="观测系统连接" />
      <OuterCalibrationRing />
      <VectorOrbitCore progress={0.68} phase="idle" />
    </HeroOrbitSection>
    <BrandLockup
      brand="VECTOR"
      title="矢量空间"
      subtitle="记录 || 过去·此刻 ⇌ 未来"
    />
    <AccessDockButton label="接入矢量空间" onPress={onStart} />
  </CoverMainLayout>
</VectorCoverPage>
```

### 推荐目录

```text
components/cover/
  VectorCoverPage.tsx
  SpaceBackdrop.tsx
  SignalWall.tsx
  StarField.tsx
  HeroOrbitSection.tsx
  OuterCalibrationRing.tsx
  VectorOrbitCore.tsx
  HudStatusLabels.tsx
  BrandLockup.tsx
  AccessDockButton.tsx
  coverTokens.ts
  coverMotion.ts
  index.ts
```

### Props 边界

```ts
export type VectorCoverPhase = 'idle' | 'connecting' | 'warping';

export interface VectorCoverPageProps {
  phase: VectorCoverPhase;
  phrases: string[];
  onStart: () => void;
  reducedMotion?: boolean;
}

export interface VectorOrbitCoreProps {
  phase: VectorCoverPhase;
  progress?: number;
  seed?: string;
}

export interface BrandLockupProps {
  brand: string;
  title: string;
  subtitle: string;
}
```

## 4. Flutter 组件树

```dart
VectorCoverPage
 ├─ Stack
 │  ├─ SpaceBackdrop
 │  ├─ SignalWall
 │  ├─ StarField
 │  └─ SafeArea
 │     └─ Column
 │        ├─ Expanded(flex: 52, child: HeroOrbitSection)
 │        ├─ BrandLockup
 │        ├─ Spacer(flex: 10)
 │        └─ AccessDockButton
```

### 推荐目录

```text
lib/features/cover/
  vector_cover_page.dart
  widgets/space_backdrop.dart
  widgets/signal_wall.dart
  widgets/star_field.dart
  widgets/hero_orbit_section.dart
  widgets/outer_calibration_ring.dart
  widgets/vector_orbit_core.dart
  widgets/hud_status_labels.dart
  widgets/brand_lockup.dart
  widgets/access_dock_button.dart
  painting/vector_orbit_painter.dart
  painting/calibration_ring_painter.dart
  cover_tokens.dart
  cover_motion.dart
```

Flutter 中 `VectorOrbitCore` 和 `OuterCalibrationRing` 应优先使用 `CustomPainter`，不要堆大量 `Container`。React 中则优先 SVG + CSS transform，方便做精确刻度和截图回归。

## 5. Design Tokens

### 色彩

```ts
export const coverColors = {
  spaceBg: '#04172d',
  spaceDeep: '#020b18',
  spaceLayer: '#06254b',
  cyan: '#8fd8ff',
  cyanStrong: '#c2ecff',
  gold: '#ffd79a',
  goldStrong: '#fff0c8',
  silver: '#dbe9f5',
  violetGhost: '#4d5fd6',
  lineWeak: 'rgba(143, 216, 255, 0.22)',
  lineMid: 'rgba(194, 236, 255, 0.52)',
  textSoft: '#bdd7ee',
};
```

### 字体

| 元素 | React | Flutter | 备注 |
| --- | --- | --- | --- |
| VECTOR | Inter / system sans | `FontWeight.w300` | 字距 0.32em，金属渐变 |
| 矢量空间 | system CJK sans | `Noto Sans SC` fallback | 字距 0.26em |
| 标语 | system CJK sans | `Noto Sans SC` fallback | 字距 0.16em |
| HUD 小字 | JetBrains Mono + CJK | monospace fallback | 数字/状态更像仪表 |

### 尺寸

```ts
export const coverSizing = {
  pageMaxWidth: 941,
  orbitSize: 'min(62vw, 420px)',
  orbitMobileSize: 'min(76vw, 352px)',
  brandTopGap: 'clamp(40px, 6vh, 76px)',
  ctaWidth: 'min(68vw, 640px)',
  ctaHeight: 'clamp(64px, 8.4vh, 86px)',
};
```

## 6. 核心组件实现要点

### `SpaceBackdrop`

- 使用 3 层径向渐变：中央微亮、边缘压暗、底部深蓝。
- 叠加 `NOISE_BG_STYLE` 或 Flutter shader/noise asset，透明度控制在 0.04-0.08。
- 右侧可加 1px 分段刻度边线，透明度 0.12，贴合截图右缘。

### `SignalWall`

- 输入 `phrases`，随机散布在背景，但要使用固定 seed，确保可测试。
- 大字透明度 0.06-0.16，最大字号可达 42-72px。
- 中央 HUD 与标题区域要留出低干扰空洞，避免文字压住主视觉。

### `VectorOrbitCore`

- React：一个根 SVG，`viewBox="0 0 512 512"`。
- Flutter：一个 `CustomPainter`，外部传入 animation value。
- 元素顺序：外发光圆、刻度、主环、金色轨迹、蓝色轨迹、无限符号、中心星核、两个端点光球。
- 轨迹颜色左金右蓝，交汇处必须有白金高光。
- `connecting` 状态：光点沿 CTA 方向前进，主环亮度升高 15%-25%。

### `HudStatusLabels`

- 顶部状态居中，图标使用 CPU/芯片形状，文字“认知已同步”。
- 左下状态靠近 HUD 外圈，带小扫描框图标，文字“观测系统连接”。
- 文本不能参与主布局高度计算，应该 absolute 定位在核心组件内部。

### `BrandLockup`

- `VECTOR` 用渐变文字：左金、中央银、右蓝；加 0 0 18px 外发光。
- `O` 内部圆点需单独处理：React 可用 CSS radial-gradient；Flutter 可用 `RichText` 拆字或 CustomPaint 覆盖。
- `矢量空间` 左右线条要与文字中线对齐，线条从金过渡到蓝。
- 标语保持单行优先，窄屏可降字距，不换成多行。

### `AccessDockButton`

- 胶囊外框半透明，内层还有一条 inset 轨道。
- 左侧圆形节点由 3 个同心圆 + 中心金点组成。
- 横向扫描线从左向右，右侧有短竖线作为闸门。
- 点击态：节点前移 18-28px、扫描线变亮、按钮整体轻微放大到 1.015。

## 7. 动画状态机

```ts
type CoverEvent = 'PRESS_START' | 'CONNECT_DONE' | 'WARP_DONE';

const transitions = {
  idle: { PRESS_START: 'connecting' },
  connecting: { CONNECT_DONE: 'warping' },
  warping: { WARP_DONE: 'complete' },
} as const;
```

| 状态 | 时长 | 视觉变化 |
| --- | --- | --- |
| `idle` | 常驻 | 呼吸光、星点漂移、轨迹慢速旋转 |
| `connecting` | 600ms | CTA 扫描线启动，HUD 状态增亮 |
| `warping` | 820ms | 中心核心放大、背景径向拉伸、透明度退出 |

支持 `prefers-reduced-motion`：保留发光和透明度变化，停止旋转、漂移和 warp 拉伸。

## 8. React 落地建议

当前仓库已有 `components/CoverScreen.tsx`，可以分两步做，风险最低：

1. 先新增 `components/cover/*` 叶子组件，不改业务流程。
2. 再让 `CoverScreen.tsx` 只负责状态、语言、原则数据和 `onStart`，视觉全部下沉到 `VectorCoverPage`。

React 复刻优先级：

1. `coverTokens.ts`：把暗蓝、金、蓝、银、尺寸、阴影抽 token。
2. `VectorOrbitCore.tsx`：SVG 复刻核心图形。
3. `BrandLockup.tsx`：保证字标与截图一致。
4. `AccessDockButton.tsx`：打磨 CTA 交互。
5. `SignalWall.tsx`：最后加背景文字，因为它最容易干扰可读性。

## 9. Flutter 落地建议

Flutter 版不要照搬 DOM 层级，应以 `Stack + CustomPainter + LayoutBuilder` 为主：

- `VectorCoverPage` 使用 `LayoutBuilder` 计算 `scale = min(width / 941, height / 1672)`。
- `VectorOrbitPainter` 负责 HUD 圆、刻度、轨迹和无限符号。
- `BrandLockup` 用 `ShaderMask` 做金属渐变文字。
- `AccessDockButton` 用 `GestureDetector + AnimatedContainer + CustomPaint` 做扫描线。
- 背景大字用 `Positioned` 列表渲染，固定 seed，避免热重载时位置抖动。

## 10. 验收标准

- 首屏截图在 390 x 844 与 941 x 1672 比例下都不裁切核心 HUD、标题、CTA。
- `VECTOR`、`矢量空间`、`记录 || 过去·此刻 ⇌ 未来`、`接入矢量空间` 文案与视觉稿一致。
- 中心 HUD 包含同心圆、刻度、金蓝双轨迹、中心星核、端点光球。
- 背景文字低透明，不压过主标题。
- CTA 可键盘/读屏访问：React 使用 `<button>`；Flutter 加 `Semantics(button: true)`。
- 开启 reduced motion 后没有持续旋转或漂移。
- React 版通过 Playwright 截图回归；Flutter 版通过 golden test 锁定主布局。

## 11. 复刻任务切片

| 任务 | 产物 | 验收 |
| --- | --- | --- |
| Token 化 | `coverTokens.ts` / `cover_tokens.dart` | 无裸色值散落组件 |
| 背景层 | `SpaceBackdrop` + `SignalWall` | 深空氛围接近截图 |
| HUD 核心 | `VectorOrbitCore` / painter | 图形结构 1:1 对齐 |
| 字标 | `BrandLockup` | 金属渐变和间距接近截图 |
| CTA | `AccessDockButton` | 胶囊、节点、扫描线完整 |
| 状态机 | `coverMotion` | idle/connecting/warping 可控 |
| 回归 | screenshots/golden | 移动端与设计画布稳定 |

