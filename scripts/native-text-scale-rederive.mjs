#!/usr/bin/env node
/** iOS Text 캡처에 같은 실제 기기의 tap-probe model/viewport 식별을 투명하게 보충한다. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const normalized = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

export function dominantTapViewport(tap) {
  const frames = [];
  for (const phase of Object.values(tap.frames ?? {})) for (const ancestor of phase.ancestors ?? [])
    if (ancestor.host === 'RNSScreenContentWrapper' && ancestor.frame) frames.push(ancestor.frame);
  const counts = new Map();
  for (const frame of frames) {
    const width = Number(frame?.[2]), height = Number(frame?.[3]);
    if (!(width > 0 && height > 0)) continue;
    const key = `${width}x${height}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const winner = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (!winner) throw new Error('tap probe에서 RNSScreenContentWrapper viewport를 찾지 못했다');
  const [width, height] = winner[0].split('x').map(Number);
  return { width, height };
}

export function supplementTextArtifact(artifact, tap) {
  const viewport = dominantTapViewport(tap);
  if (!tap.device?.model) throw new Error('tap probe의 iOS model이 비어 있다');
  if (artifact.device?.osVersion !== tap.device?.osVersion || artifact.device?.density !== tap.device?.density
    || artifact.device?.screen?.width !== viewport.width)
    throw new Error('Text 증거와 tap probe의 OS·density·화면 width가 다르다');
  artifact.device.model = tap.device.model;
  artifact.manifest.deviceIdentitySupplement = {
    source: 'native-touch-ios-tap-probe.json',
    reason: 'React Native Platform.constants가 iOS 실제 모델을 반환하지 않아 같은 기기의 탭 증거로 보충',
    matched: { osVersion: artifact.device.osVersion, density: artifact.device.density, contentViewportDp: viewport },
  };
  return artifact;
}

export function rederive(paths) {
  const tap = JSON.parse(normalized(resolve(root, 'docs/prototypes/native-touch-ios-tap-probe.json')));
  for (const argument of paths) {
    const path = resolve(argument);
    const artifact = supplementTextArtifact(JSON.parse(normalized(path)), tap);
    writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(`${path}: model ${artifact.device.model}`);
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) rederive(process.argv.slice(2));
