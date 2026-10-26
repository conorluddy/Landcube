import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { PNG } from 'pngjs';

// A deliberately tight near plane reproduces the depth precision lost when orbiting/zooming.
const harness = `
import * as THREE from 'three';
import { createTerrainStage } from './src/terrain-stage';
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(640, 480);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.style.margin = '0';
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
const stage = createTerrainStage();
stage.update(2, 2, '#b4b4b4', false);
scene.add(stage.group);
const model = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 2), new THREE.MeshBasicMaterial({ color: '#8c6633' }));
model.position.y = 0.3;
model.castShadow = true;
scene.add(model);
const light = new THREE.DirectionalLight(0xffffff, 2.5);
light.position.set(-3, 4, -3);
light.castShadow = true;
light.shadow.mapSize.set(1024, 1024);
Object.assign(light.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.1, far: 20 });
scene.add(light);
const camera = new THREE.PerspectiveCamera(40, 640 / 480, 0.05, 100);
let angle = 0;
const draw = () => {
  camera.position.set(Math.sin(angle) * 4.5, 2.7, Math.cos(angle) * 4.5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
};
for (const name of ['reference', 'stressed', 'off', 'orbit']) {
  document.addEventListener(name, () => {
    if (name === 'orbit') angle += Math.PI / 3;
    camera.near = name === 'stressed' ? 0.000001 : 0.05;
    stage.setCastShadows(name !== 'off');
    draw();
  });
}
draw();
document.body.dataset.ready = 'true';
`;

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });

test('floor shadows remain continuous when camera depth precision drops at different angles', async ({
  page,
}) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  const bundle = await build({
    stdin: { contents: harness, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true,
    write: false,
    format: 'esm',
  });

  await page.route('https://stage.test/**', (route) =>
    route.fulfill(
      route.request().url().endsWith('stage.js')
        ? { body: bundle.outputFiles[0].text, contentType: 'text/javascript' }
        : { body: '<script type="module" src="/stage.js"></script>', contentType: 'text/html' },
    ),
  );
  await page.goto('https://stage.test/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');

  const capture = async (event: string) => {
    await page.evaluate((name) => document.dispatchEvent(new Event(name)), event);

    return PNG.sync.read(await page.locator('canvas').screenshot());
  };

  for (let angle = 0; angle < 3; angle++) {
    const off = await capture('off');
    const reference = await capture('reference');
    const stressed = await capture('stressed');
    let expected = 0;
    let retained = 0;

    for (let i = 0; i < off.data.length; i += 4) {
      // Restrict the comparison to actual cast shadow on otherwise bare grey floor.
      if (off.data[i] === 180 && reference.data[i] < 150) {
        expected++;

        if (stressed.data[i] < 150) {
          retained++;
        }
      }
    }

    expect(expected).toBeGreaterThan(1000);
    expect(retained / expected).toBeGreaterThan(0.98);
    await page
      .locator('canvas')
      .screenshot({ path: test.info().outputPath(`floor-shadow-${angle}.png`) });
    await capture('orbit');
  }

  expect(errors).toEqual([]);
});
