import { defineSpecimens } from '../specimens';
import { CropFrame, type CropFrameProps } from './crop-frame';
import { SpecimenStage } from './specimen-stage';

const handlers: Pick<CropFrameProps, 'onDragStart' | 'onDrag' | 'onHandleKey'> = {
  onDragStart: () => undefined,
  onDrag: () => undefined,
  onHandleKey: () => false,
};

export default defineSpecimens('crop-frame', [
  {
    variant: 'rectangle',
    width: 520,
    render: () => (
      <SpecimenStage tone="light" heightPx={320}>
        <CropFrame
          {...handlers}
          shape="rectangle"
          planeAspectRatio={1.6}
          selection={{ x: 0.2, y: 0.1, width: 0.5, height: 0.8 }}
          dimensionLabel="150 × 150 mm · 80%"
        />
      </SpecimenStage>
    ),
  },
  {
    variant: 'circle',
    width: 520,
    render: () => (
      <SpecimenStage tone="dark" heightPx={320}>
        <CropFrame
          {...handlers}
          shape="circle"
          planeAspectRatio={1.6}
          selection={{ x: 0.3, y: 0.2, width: 0.375, height: 0.6 }}
          dimensionLabel="⌀ 120 mm · 60%"
        />
      </SpecimenStage>
    ),
  },
]);
