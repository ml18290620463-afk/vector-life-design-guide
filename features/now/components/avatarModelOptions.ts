import { presets } from './avatarModelPresets';
export const modelOptionsFor = (
  presetIndex: number,
  liveModels: string[],
  selectedModel: string,
) => {
  const presetModels = presets[presetIndex]?.models || [];
  const options = liveModels.length
    ? presetModels.filter((item) => liveModels.includes(item.id))
    : [...presetModels];
  liveModels.forEach((id) => {
    if (!options.some((item) => item.id === id)) options.push({ id, label: id });
  });
  if (!liveModels.length && selectedModel && !options.some((item) => item.id === selectedModel)) {
    options.push({ id: selectedModel, label: `${selectedModel} · 当前填写` });
  }
  return options;
};
export const preferredModelFor = (available: string[], presetIndex: number, current: string) =>
  available.includes(current)
    ? current
    : presets[presetIndex]?.models.find((item) => available.includes(item.id))?.id ||
      available[0] ||
      current;
