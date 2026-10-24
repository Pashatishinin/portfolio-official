/**
 * Есть ли у браузера аппаратное ускорение WebGL.
 *
 * Без видеокарты (SwiftShader / llvmpipe — так работают headless-браузеры,
 * Lighthouse/PageSpeed, а также реальные пользователи с отключённым
 * аппаратным ускорением) WebGL считается на CPU, и тяжёлые сцены полностью
 * забивают главный поток: страница перестаёт реагировать на клики и скролл.
 * В этом случае лучше показать статичный фон, чем «зависший» сайт.
 *
 * Для проверки можно принудительно включить сцены: ?webgl=force
 */
let cached: boolean | undefined;

export function hasHardwareWebGL(): boolean {
  if (cached !== undefined) return cached;
  try {
    if (new URLSearchParams(location.search).get("webgl") === "force") {
      return (cached = true);
    }
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ||
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return (cached = false);
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      info
        ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
    );
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    cached = !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(
      renderer,
    );
  } catch {
    cached = true; // не смогли определить — не ломаем сайт
  }
  return cached;
}
