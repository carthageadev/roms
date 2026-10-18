// Presets from the original sticker shader resources.
export const FOIL = {
  'rainbow-prism': { threshold: 1.3, alpha: .9, period: .6, normal: .9, sensitivity: 20, direction: .5, metal: .8, rough: .1, colors: [[1,0,0],[1,1,0],[0,1,0],[0,1,1],[0,0,1],[1,0,1],[1,0,0]], stops: [0,.166,.333,.5,.666,.833,1] },
  'holo-foil': { threshold: 1.3, alpha: .7, period: 1.2, normal: .7, sensitivity: 8, direction: .5, metal: .85, rough: .15, colors: [[1,.36,.36],[.9918333,1,.51],[.63,1,.88283336],[.7,.5,1],[.718,.53,1]], stops: [0,.24010181,.5138575,.77403843,1] },
  'foil-texture': { threshold: 1.3, alpha: .8, period: .8, normal: 1, sensitivity: 8, direction: .7, metal: .85, rough: .13 },
  'golden-ticket': { threshold: .9, alpha: .85, period: 1, normal: .6, sensitivity: 8, direction: .5, metal: .9, rough: .12, alternate: true, colors: [[.4,.28,.05],[1,.84,.2],[1,.98,.85],[1,.7,.15],[.4,.28,.05]], stops: [0,.25,.5,.75,1] },
  'chrome-outline': { threshold: 1.3, alpha: .75, period: 1, normal: .4, sensitivity: 8, direction: .5, metal: 1, rough: .04, alternate: true },
}

const f = (n) => Number(n).toFixed(8)
export function foilShader(style) {
  const p = FOIL[style]
  if (!p) return ''
  const colors = p.colors || [[.6,.62,.65],[1,1,1],[.6,.62,.65]]
  const stops = p.stops || [0,.5,1]
  const vec = (c) => `vec3(${c.map((v) => f(v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4))).join(',')})`
  return `
    vec3 foilInk = diffuseColor.rgb;
    // Artwork is linear here. Build the ink mask in perceptual space so
    // saturated reds and dark lettering still catch the foil.
    vec3 foilPerceptual = pow(max(foilInk, vec3(0.0)), vec3(1.0 / 2.2));
    float foilLuma = dot(foilPerceptual, vec3(0.2126, 0.7152, 0.0722));
    vec2 foilTexel = max(1.0 / vec2(textureSize(map, 0)), fwidth(vMapUv));
    vec3 foilLeft = pow(max(texture2D(map, vMapUv - vec2(foilTexel.x, 0.0)).rgb, vec3(0.0)), vec3(1.0 / 2.2));
    vec3 foilRight = pow(max(texture2D(map, vMapUv + vec2(foilTexel.x, 0.0)).rgb, vec3(0.0)), vec3(1.0 / 2.2));
    vec3 foilUp = pow(max(texture2D(map, vMapUv - vec2(0.0, foilTexel.y)).rgb, vec3(0.0)), vec3(1.0 / 2.2));
    vec3 foilDown = pow(max(texture2D(map, vMapUv + vec2(0.0, foilTexel.y)).rgb, vec3(0.0)), vec3(1.0 / 2.2));
    vec2 foilInkSlope = vec2(dot(foilRight - foilLeft, vec3(0.2126, 0.7152, 0.0722)), dot(foilDown - foilUp, vec3(0.2126, 0.7152, 0.0722)));
    float foilEdge = clamp(max(length(foilRight - foilLeft), length(foilDown - foilUp)) * 2.5, 0.0, 1.0);
    float foilMask = clamp(foilEdge + smoothstep(0.62, 0.92, foilLuma) * ${style === 'chrome-outline' ? '0.45' : '0.85'}, 0.0, 1.0) * diffuseColor.a;
    float foilStrength = foilMask * ${f(p.alpha)};
    vec3 foilN = normalize(vNormal);
    vec3 foilV = normalize(vViewPosition);
    vec3 foilDx = dFdx(-vViewPosition), foilDy = dFdy(-vViewPosition);
    vec2 foilUx = dFdx(vMapUv), foilUy = dFdy(vMapUv);
    float foilDet = foilUx.x * foilUy.y - foilUy.x * foilUx.y;
    vec3 foilRaw = (foilDx * foilUy.y - foilDy * foilUx.y) / (abs(foilDet) < 1e-8 ? 1e-8 : foilDet);
    vec3 foilT = normalize(foilRaw - foilN * dot(foilN, foilRaw));
    vec3 foilB = normalize(cross(foilN, foilT));
    vec2 foilTilt = vec2(dot(foilV, foilT), dot(foilV, foilB));
    vec3 foilPattern = texture2D(panoplyFoilPattern, vPanoplyLabelUv).rgb * 2.0 - 1.0;
    float foilDirection = ${f(p.direction)};
    float foilShift = dot(foilTilt, vec2(foilDirection, 1.0 - foilDirection)) * ${f(p.sensitivity)};
    float foilRelief = (foilPattern.y * foilDirection - foilPattern.x * (1.0 - foilDirection)) * ${f(p.normal)};
    float foilPhase = fract(0.25 + (foilShift + foilRelief + dot(vPanoplyLabelUv - 0.5, vec2(1.0 - foilDirection, foilDirection))) * 0.5 + vPanoplyLabelUv.x * ${f(p.period)});
    vec3 foilGradient = ${vec(colors[0])};
    ${colors.slice(1).map((color, i) => `foilGradient = mix(foilGradient, ${vec(color)}, clamp((foilPhase - ${f(stops[i])}) / ${f(stops[i+1]-stops[i])}, 0.0, 1.0));`).join('\n')}
    vec3 foilBlend = mix(
      foilInk - (1.0 - 2.0 * foilGradient) * foilInk * (1.0 - foilInk),
      foilInk + (2.0 * foilGradient - 1.0) * (sqrt(max(foilInk, vec3(0.0))) - foilInk),
      step(vec3(0.5), foilGradient)
    );
    diffuseColor.rgb = ${style === 'chrome-outline' ? 'mix(foilInk, foilBlend, foilStrength)' : 'foilInk'};
    // A reflective substrate also returns colored light over black ink;
    // soft-light alone cannot do that (black multiplied by any hue is black).
    vec3 foilSheen = foilGradient * (0.16 + 0.44 * pow(1.0 - abs(dot(foilN, foilV)), 0.6));
    ${style === 'foil-texture' ? 'foilSheen *= 0.35 + 1.65 * pow(foilPattern.r * 0.5 + 0.5, 3.0);' : ''}
    ${style === 'chrome-outline' ? 'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.72 + foilSheen, foilStrength);' : ''}
  `
}

export const diffractionShader = `
  #ifdef USE_MAP
    vec2 grooveUv = vPanoplyLabelUv - 0.5;
    grooveUv /= max(length(grooveUv), 0.00001);
    vec3 gratingAxis = normalize(foilT * grooveUv.x + foilB * grooveUv.y);
    vec3 grooveAxis = normalize(-foilT * grooveUv.y + foilB * grooveUv.x);
    vec3 foilLight = normalize(mix(normalize((viewMatrix * vec4(normalize(vec3(0.35, 0.8, 0.5)), 0.0)).xyz), foilV, 0.35));
    vec3 gratingView = normalize(foilN * dot(foilV, foilN) + (foilV - foilN * dot(foilV, foilN)) * 8.0);
    vec3 gratingLight = normalize(foilN * dot(foilLight, foilN) + (foilLight - foilN * dot(foilLight, foilN)) * 8.0);
    float alongGroove = dot(normalize(gratingView + gratingLight), grooveAxis);
    float pathNm = abs(dot(gratingAxis, gratingLight) + dot(gratingAxis, gratingView)) * 1600.0;
    vec3 spectrum = vec3(0.0);
    for (int order = 1; order <= 3; order++) {
      float wavelength = pathNm / float(order);
      vec3 band = (vec3(wavelength) - vec3(605.0, 545.0, 462.0)) / vec3(52.0, 56.0, 48.0);
      vec3 response = exp(-band * band);
      response.r += 0.45 * exp(-pow((wavelength - 432.0) / 26.0, 2.0));
      spectrum += response * smoothstep(370.0, 410.0, wavelength) * (1.0 - smoothstep(680.0, 745.0, wavelength)) / float(order);
    }
    float foilFresnel = mix(0.25, 1.0, pow(1.0 - clamp(dot(foilN, foilV), 0.0, 1.0), 1.5));
    totalEmissiveRadiance += spectrum * exp(-alongGroove * alongGroove * 60.0) * foilFresnel * 1.2 * foilMask;
  #endif
`

export function foilRadiance(style) {
  return style === 'chrome-outline' ? '#ifdef USE_MAP\n totalEmissiveRadiance += foilSheen * foilStrength * 0.18;\n#endif\n' : ''
}

export const foilNormal = `
  #ifdef USE_MAP
    // Emboss the actual ink boundaries, plus the foil's fine surface relief.
    vec2 patternStep = 1.0 / vec2(textureSize(panoplyFoilPattern, 0));
    float patternX = texture2D(panoplyFoilPattern, vPanoplyLabelUv + vec2(patternStep.x, 0.0)).r - texture2D(panoplyFoilPattern, vPanoplyLabelUv - vec2(patternStep.x, 0.0)).r;
    float patternY = texture2D(panoplyFoilPattern, vPanoplyLabelUv + vec2(0.0, patternStep.y)).r - texture2D(panoplyFoilPattern, vPanoplyLabelUv - vec2(0.0, patternStep.y)).r;
    vec2 relief = foilInkSlope * 0.65 + vec2(patternX, patternY) * foilStrength * 0.32;
    normal = normalize(normal - foilT * relief.x - foilB * relief.y);
  #endif
`

export function foilPhysical(style) {
  if (style === 'chrome-outline') return ''
  return `
    #ifdef USE_MAP
      // Color belongs in the reflected light, not an emissive overlay.
      material.specularColor = mix(material.specularColor, mix(vec3(0.65), foilGradient, ${style === 'foil-texture' ? '0.0' : '0.78'}), foilStrength);
      #ifdef USE_IRIDESCENCE
        material.iridescence = foilStrength;
        material.iridescenceThickness = 180.0 + 460.0 * (foilPattern.r * 0.5 + 0.5);
      #endif
    #endif
  `
}
