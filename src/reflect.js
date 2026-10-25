/** Objects that should not be redrawn into the canal reflection. */
export const hideInReflection = [];

export function guardReflection(reflector) {
  const inner = reflector.onBeforeRender;
  reflector.onBeforeRender = function onBefore(renderer, scene, camera) {
    const hidden = [];
    for (const obj of hideInReflection) {
      if (obj && obj.visible) {
        obj.visible = false;
        hidden.push(obj);
      }
    }
    inner.call(this, renderer, scene, camera);
    for (const obj of hidden) obj.visible = true;
  };
}
