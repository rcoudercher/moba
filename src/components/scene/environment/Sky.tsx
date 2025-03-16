import * as THREE from 'three';

export interface SkyColors {
  top: THREE.Color;
  middle: THREE.Color;
  bottom: THREE.Color;
}

export const createSky = (scene: THREE.Scene): { sky: THREE.Mesh, sun: THREE.Mesh, sunGlow: THREE.Mesh } => {
  // Create a clear blue daytime sky with gradient
  const skyColors: SkyColors = {
    top: new THREE.Color(0x0078ff),    // Bright blue at the top
    middle: new THREE.Color(0x4d9aff), // Medium blue in the middle
    bottom: new THREE.Color(0x9ec9ff)  // Light blue at the horizon
  };
  
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: skyColors.top },
      middleColor: { value: skyColors.middle },
      bottomColor: { value: skyColors.bottom },
      offset: { value: 33 },
      exponent: { value: 0.6 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 middleColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        float t = max(0.0, min(1.0, (h - 0.2) / 0.4));
        vec3 color = mix(bottomColor, middleColor, pow(t, exponent));
        color = mix(color, topColor, pow(max(0.0, min(1.0, (h - 0.5) / 0.5)), exponent));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide
  });
  
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(450, 32, 15),
    skyMaterial
  );
  scene.add(sky);
  
  // Add a sun to the sky
  const sunGeometry = new THREE.SphereGeometry(20, 32, 32);
  const sunMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffcc,
    transparent: true,
    opacity: 1.0
  });
  
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  
  // Position the sun in the sky
  const sunAngle = Math.PI * 0.25; // Angle above horizon
  const sunElevation = Math.PI * 0.25; // Angle from center
  const sunDistance = 400;
  
  sun.position.set(
    sunDistance * Math.sin(sunElevation) * Math.cos(sunAngle),
    sunDistance * Math.sin(sunAngle),
    sunDistance * Math.sin(sunElevation) * Math.sin(sunAngle)
  );
  
  scene.add(sun);
  
  // Add a subtle glow around the sun
  const sunGlowGeometry = new THREE.SphereGeometry(30, 32, 32);
  const sunGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffee,
    transparent: true,
    opacity: 0.3,
    side: THREE.BackSide
  });
  
  const sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
  sunGlow.position.copy(sun.position);
  scene.add(sunGlow);
  
  // Adjust fog for better distance effect with the new sky
  scene.fog = new THREE.FogExp2(0x9ec9ff, 0.0015);
  
  return { sky, sun, sunGlow };
}; 