import * as THREE from 'three';

/**
 * A full-page "constellation" background: drifting points connected by
 * lines when they're close together, with:
 *  - frame-rate independent motion (everything is scaled by delta time,
 *    so it looks the same on a 60Hz or 144Hz display instead of jittering)
 *  - a gentle pointer-driven parallax tilt
 *  - a gentle scroll-driven parallax shift
 *  - a screen-space post-processing pass that adds a subtle motion blur
 *    + RGB chromatic aberration streak in the direction of scroll, which
 *    decays back to nothing when scrolling stops
 *
 * Framework-agnostic — mount it on any <canvas> and call dispose() when
 * you're done. Kept dependency-free (no react-three-fiber, no three/examples
 * postprocessing chain) so the whole effect is readable top-to-bottom here.
 */

export interface ParticleNetworkOptions {
  particleCount?: number;
  connectDistance?: number;
  particleColor?: number;
  lineColor?: number;
  pointerInfluence?: number;
}

const DEFAULTS: Required<ParticleNetworkOptions> = {
  particleCount: 180,
  connectDistance: 2.6,
  particleColor: 0x8be9d6,
  lineColor: 0x4a5a78,
  pointerInfluence: 0.9,
};

interface ParticleState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

/** Exponential smoothing factor that stays consistent regardless of frame rate. */
function frameIndependentLerp(responsiveness: number, deltaSeconds: number): number {
  return 1 - Math.exp(-responsiveness * deltaSeconds);
}

const POST_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const POST_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uVelocity; // scroll/pointer velocity in UV space, decays to ~0 at rest
  varying vec2 vUv;

  void main() {
    float speed = length(uVelocity);

    // Motion blur: average a handful of samples stepped back along the
    // direction of travel. At rest (speed ~ 0) this collapses to a single
    // sample, i.e. no blur at all.
    const int SAMPLES = 6;
    vec3 blurred = vec3(0.0);
    for (int i = 0; i < SAMPLES; i++) {
      float t = float(i) / float(SAMPLES - 1) - 0.5; // -0.5 .. 0.5
      blurred += texture2D(tDiffuse, vUv - uVelocity * t).rgb;
    }
    blurred /= float(SAMPLES);

    // Chromatic aberration: split red/blue apart along the motion axis so
    // fast movement reads as a subtle RGB-fringed streak.
    vec2 dir = speed > 0.0001 ? uVelocity / speed : vec2(0.0);
    vec2 fringe = dir * speed * 1.6;
    float r = texture2D(tDiffuse, vUv + fringe).r;
    float g = blurred.g;
    float b = texture2D(tDiffuse, vUv - fringe).b;
    float a = texture2D(tDiffuse, vUv).a;

    gl_FragColor = vec4(r, g, b, a);
  }
`;

export class ParticleNetwork {
  private readonly canvas: HTMLCanvasElement;
  private readonly options: Required<ParticleNetworkOptions>;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private lastFrameTime = 0;
  private readonly particles: ParticleState[] = [];
  private readonly pointGeometry = new THREE.BufferGeometry();
  private readonly lineGeometry = new THREE.BufferGeometry();
  private points!: THREE.Points;
  private lines!: THREE.LineSegments;
  private readonly bounds = new THREE.Vector3(9, 5.2, 2);
  private pointer = new THREE.Vector2(0, 0);
  private pointerTarget = new THREE.Vector2(0, 0);

  // Render-to-texture plumbing for the post-processing pass.
  private renderTarget: THREE.WebGLRenderTarget;
  private readonly postScene = new THREE.Scene();
  private readonly postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly postMaterial: THREE.ShaderMaterial;

  // Scroll tracking for the motion-blur/chromatic-aberration effect.
  private lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
  private readonly scrollVelocity = new THREE.Vector2(0, 0);
  private cameraTargetY = 0;

  private frameId = 0;
  private lastConnectionRebuild = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, options: ParticleNetworkOptions = {}) {
    this.canvas = canvas;
    this.options = { ...DEFAULTS, ...options };

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    this.camera.position.set(0, 0, 10);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.seedParticles();
    this.buildPoints();
    this.buildLines();
    this.rebuildConnections();

    this.renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      format: THREE.RGBAFormat,
    });

    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: POST_VERTEX_SHADER,
      fragmentShader: POST_FRAGMENT_SHADER,
      uniforms: {
        tDiffuse: { value: this.renderTarget.texture },
        uVelocity: { value: new THREE.Vector2(0, 0) },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    this.postScene.add(quad);

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('pointermove', this.handlePointerMove);
    this.handleResize();
  }

  start(): void {
    if (this.frameId) return;
    this.lastFrameTime = performance.now();
    const tick = (now: number) => {
      if (this.disposed) return;
      const delta = Math.min((now - this.lastFrameTime) / 1000, 1 / 15);
      this.lastFrameTime = now;
      this.update(delta);
      this.renderer.setRenderTarget(this.renderTarget);
      this.renderer.clearColor();
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.postScene, this.postCamera);
      this.frameId = requestAnimationFrame(tick);
    };
    this.frameId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('pointermove', this.handlePointerMove);
    this.pointGeometry.dispose();
    this.lineGeometry.dispose();
    (this.points.material as THREE.Material).dispose();
    (this.lines.material as THREE.Material).dispose();
    this.postMaterial.dispose();
    this.renderTarget.dispose();
    this.renderer.dispose();
  }

  private seedParticles(): void {
    for (let i = 0; i < this.options.particleCount; i += 1) {
      const position = new THREE.Vector3(
        (Math.random() * 2 - 1) * this.bounds.x,
        (Math.random() * 2 - 1) * this.bounds.y,
        (Math.random() * 2 - 1) * this.bounds.z,
      );
      // Velocity is expressed in units/second now (not units/frame), which
      // is what makes the drift frame-rate independent.
      const velocity = new THREE.Vector3(
        (Math.random() * 2 - 1) * 0.5,
        (Math.random() * 2 - 1) * 0.5,
        (Math.random() * 2 - 1) * 0.2,
      );
      this.particles.push({ position, velocity });
    }
  }

  private buildPoints(): void {
    const positions = new Float32Array(this.particles.length * 3);
    this.pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: this.options.particleColor,
      size: 0.065,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.pointGeometry, material);
    this.scene.add(this.points);
  }

  private buildLines(): void {
    const material = new THREE.LineBasicMaterial({
      color: this.options.lineColor,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.lines = new THREE.LineSegments(this.lineGeometry, material);
    this.scene.add(this.lines);
  }

  /** Recomputes which particles are "connected" — cheap enough to run every couple of seconds, not every frame. */
  private rebuildConnections(): void {
    const segmentPositions: number[] = [];
    const maxDistSq = this.options.connectDistance ** 2;

    for (let i = 0; i < this.particles.length; i += 1) {
      for (let j = i + 1; j < this.particles.length; j += 1) {
        const distSq = this.particles[i].position.distanceToSquared(this.particles[j].position);
        if (distSq < maxDistSq) {
          const a = this.particles[i].position;
          const b = this.particles[j].position;
          segmentPositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
    }

    this.lineGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(segmentPositions), 3),
    );
  }

  private update(delta: number): void {
    this.pointer.lerp(this.pointerTarget, frameIndependentLerp(4, delta));

    const positionAttr = this.pointGeometry.getAttribute('position') as THREE.BufferAttribute;

    this.particles.forEach((particle, index) => {
      particle.position.addScaledVector(particle.velocity, delta);

      (['x', 'y', 'z'] as const).forEach((axis) => {
        const limit = this.bounds[axis];
        if (particle.position[axis] > limit || particle.position[axis] < -limit) {
          particle.velocity[axis] *= -1;
        }
      });

      positionAttr.setXYZ(index, particle.position.x, particle.position.y, particle.position.z);
    });
    positionAttr.needsUpdate = true;

    // Gentle parallax: the whole network tilts toward the pointer...
    const influence = this.options.pointerInfluence;
    const targetRotationY = this.pointer.x * 0.12 * influence;
    const targetRotationX = -this.pointer.y * 0.08 * influence;
    const rotationEase = frameIndependentLerp(5, delta);
    this.scene.rotation.y += (targetRotationY - this.scene.rotation.y) * rotationEase;
    this.scene.rotation.x += (targetRotationX - this.scene.rotation.x) * rotationEase;

    // ...and drifts vertically as the page scrolls, so the background feels
    // anchored to the document rather than just sitting behind it.
    const scrollY = window.scrollY;
    this.cameraTargetY = Math.tanh(scrollY * 0.0006) * 1.4;
    this.camera.position.y += (this.cameraTargetY - this.camera.position.y) * frameIndependentLerp(2, delta);

    this.updateScrollVelocity(scrollY, delta);

    const rebuildIntervalSeconds = 2.2;
    this.lastConnectionRebuild += delta;
    if (this.lastConnectionRebuild > rebuildIntervalSeconds) {
      this.lastConnectionRebuild = 0;
      this.rebuildConnections();
    }
  }

  private updateScrollVelocity(scrollY: number, delta: number): void {
    const pixelsPerSecond = delta > 0 ? (scrollY - this.lastScrollY) / delta : 0;
    this.lastScrollY = scrollY;

    // Convert to a small UV-space magnitude and smooth it so the blur
    // eases in on fast scrolls and eases back out to zero at rest, instead
    // of snapping frame to frame.
    const targetUv = THREE.MathUtils.clamp(pixelsPerSecond / 12000, -0.05, 0.05);
    const ease = frameIndependentLerp(6, delta);
    this.scrollVelocity.y += (targetUv - this.scrollVelocity.y) * ease;
    this.postMaterial.uniforms.uVelocity.value.copy(this.scrollVelocity);
  }

  private readonly handleResize = (): void => {
    const { clientWidth, clientHeight } = this.canvas.parentElement ?? this.canvas;
    const width = clientWidth || window.innerWidth;
    const height = clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, 2);

    this.renderer.setSize(width, height, false);
    this.renderTarget.setSize(width * pixelRatio, height * pixelRatio);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    this.pointerTarget.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointerTarget.y = (event.clientY / window.innerHeight) * 2 - 1;
  };
}
