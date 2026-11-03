// ============================================================
// VOLM Engineering Intelligence — 3D SOLIDWORKS Design Viewer
// Authentic Parametric 3D CAD Viewport with SolidWorks Shaders & Edges
// Active Part: WEIGHER_DISCHARGE_CHUTE_450.SLDPRT (Multi-head Weigher Collector Funnel)
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  RotateCcw, Eye, Maximize2, Layers, Compass, Sliders, Box,
  Sparkles, Shield, Ruler, CheckCircle, Info, ChevronRight,
  Sun, RefreshCw
} from 'lucide-react';
import { cn } from './shared';

interface SolidWorks3DViewerProps {
  chuteOutletWidth?: number;       // 300 or 450 mm
  chuteAngleDeg?: number;          // 55 or 62 deg
  topFlangeDiameter?: number;      // 750 mm
  material?: 'cast_iron' | 'stainless_304' | 'stainless_316';
  isModified?: boolean;
  onMaterialChange?: (mat: 'stainless_304' | 'stainless_316') => void;
  // Legacy aliases for backward compatibility
  inletDiameter?: number;
  flangeDiameter?: number;
  bcd?: number;
  boltHolesCount?: number;
  flangeThickness?: number;
}

export function SolidWorks3DViewer({
  chuteOutletWidth,
  chuteAngleDeg = 62,
  topFlangeDiameter = 750,
  material = 'stainless_316',
  isModified = true,
  onMaterialChange,
  inletDiameter,
}: SolidWorks3DViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const sectionPlaneRef = useRef<THREE.Plane | null>(null);

  // Determine active outlet width (handles legacy inletDiameter 125/100 -> 450/300)
  const resolvedOutletWidth = chuteOutletWidth !== undefined
    ? chuteOutletWidth
    : (inletDiameter === 100 ? 300 : 450);

  const isWideOutlet = resolvedOutletWidth >= 400 || isModified;

  // Viewport states
  const [displayStyle, setDisplayStyle] = useState<'shadedEdges' | 'shaded' | 'wireframe' | 'section'>('shadedEdges');
  const [activeMaterial, setActiveMaterial] = useState<'stainless_304' | 'stainless_316'>(
    material === 'stainless_304' ? 'stainless_304' : 'stainless_316'
  );
  const [cameraOrientation, setCameraOrientation] = useState<'iso' | 'front' | 'top' | 'right'>('iso');

  // Scale factor: Real mm to Three.js units (1 mm = 0.005 units)
  const S = 0.005;

  // -------------------------------------------------------------
  // THREE.JS SETUP & ANIMATION LOOP
  // -------------------------------------------------------------
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(3.6, 2.8, 4.2);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and clipping planes
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 14;
    controls.minDistance = 1.2;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 5. Lighting (Classic SOLIDWORKS Studio lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(6, 9, 7);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xd4e2ef, 0.85);
    fillLight.position.set(-6, 4, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.65);
    rimLight.position.set(0, -6, 4);
    scene.add(rimLight);

    // 6. Section Clipping Plane (YZ Plane cutting through X=0)
    const sectionPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    sectionPlaneRef.current = sectionPlane;

    // 7. Base Grid Shadow Plane
    const shadowGeo = new THREE.PlaneGeometry(8, 8);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.18 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.3;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // 8. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Handling
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // -------------------------------------------------------------
  // BUILD SOLIDWORKS 3D PARAMETRIC GEOMETRY (Collector Funnel Chute)
  // -------------------------------------------------------------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (modelGroupRef.current) {
      scene.remove(modelGroupRef.current);
      modelGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    const modelGroup = new THREE.Group();
    modelGroupRef.current = modelGroup;

    // Stainless Steel 316L vs 304 material properties
    const is316L = activeMaterial === 'stainless_316';
    const mainColor = is316L ? 0xdae2eb : 0xc8d2dc;
    const roughness = is316L ? 0.24 : 0.38;
    const metalness = is316L ? 0.88 : 0.75;

    const clippingPlanes = displayStyle === 'section' && sectionPlaneRef.current ? [sectionPlaneRef.current] : [];

    // Helper to create SolidWorks Shaded + Edges mesh
    const createSolidPart = (
      geo: THREE.BufferGeometry,
      customColor?: number,
      wireOnly: boolean = false
    ) => {
      const partGroup = new THREE.Group();

      if (!wireOnly && displayStyle !== 'wireframe') {
        const mat = new THREE.MeshStandardMaterial({
          color: customColor ?? mainColor,
          roughness,
          metalness,
          clippingPlanes,
          clipShadows: true,
          side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        partGroup.add(mesh);
      }

      // Feature Silhouette Edges (SolidWorks crisp black lines)
      if (displayStyle === 'shadedEdges' || displayStyle === 'wireframe') {
        const edges = new THREE.EdgesGeometry(geo, 22);
        const edgeMat = new THREE.LineBasicMaterial({
          color: displayStyle === 'wireframe' ? 0x1f2937 : 0x1a2128,
          linewidth: 1,
          clippingPlanes
        });
        const line = new THREE.LineSegments(edges, edgeMat);
        partGroup.add(line);
      }

      return partGroup;
    };

    // -----------------------------------------------------------
    // DIMENSIONS OF THE MULTI-HEAD WEIGHER DISCHARGE CHUTE
    // -----------------------------------------------------------
    const topOuterRadius = (topFlangeDiameter / 2) * S;      // ~1.875 units (Ø750 mm)
    const topInnerRadius = (topFlangeDiameter / 2 - 25) * S; // Ø700 mm cone intake
    const outletRadius = (resolvedOutletWidth / 2) * S;      // Ø450 mm (1.125 units) vs Ø300 mm (0.75 units)
    const funnelHeight = (isWideOutlet ? 520 : 440) * S;     // Funnel vertical drop
    const neckHeight = 120 * S;                              // Vertical discharge spout collar

    // 1. TOP CIRCULAR MOUNTING FLANGE RING
    const topFlangeGeo = new THREE.CylinderGeometry(topOuterRadius, topOuterRadius, 18 * S, 48);
    const topFlange = createSolidPart(topFlangeGeo);
    topFlange.position.set(0, funnelHeight / 2 + 9 * S, 0);
    modelGroup.add(topFlange);

    // 8 Fastener Bolt Holes on Top Flange BCD (Ø710 mm)
    const boltBcdR = (710 / 2) * S;
    for (let b = 0; b < 8; b++) {
      const bAngle = (b / 8) * Math.PI * 2;
      const hole = new THREE.Mesh(
        new THREE.CylinderGeometry(10 * S, 10 * S, 22 * S, 12),
        new THREE.MeshBasicMaterial({ color: 0x1A2027 })
      );
      hole.position.set(Math.cos(bAngle) * boltBcdR, funnelHeight / 2 + 9 * S, Math.sin(bAngle) * boltBcdR);
      modelGroup.add(hole);
    }

    // 2. MAIN CONICAL COLLECTOR FUNNEL (Inverted Truncated Cone)
    // Tapers from topInnerRadius down to outletRadius
    const coneGeo = new THREE.CylinderGeometry(topInnerRadius, outletRadius, funnelHeight, 48, 1, true);
    const coneMesh = createSolidPart(coneGeo, isWideOutlet ? 0x315D78 : undefined);
    coneMesh.position.set(0, 0, 0);
    modelGroup.add(coneMesh);

    // Inner cone surface (gives sheet metal wall thickness 2.5 mm)
    const innerConeGeo = new THREE.CylinderGeometry(topInnerRadius - 5 * S, outletRadius - 5 * S, funnelHeight, 48, 1, true);
    const innerCone = createSolidPart(innerConeGeo);
    innerCone.position.set(0, 0, 0);
    modelGroup.add(innerCone);

    // 3. BOTTOM DISCHARGE COLLAR SPOUT (Direct connection into VFFS bagger)
    const spoutGeo = new THREE.CylinderGeometry(outletRadius, outletRadius, neckHeight, 48, 1, true);
    const spout = createSolidPart(spoutGeo);
    spout.position.set(0, -funnelHeight / 2 - neckHeight / 2, 0);
    modelGroup.add(spout);

    // 4. SANITARY ROLLED LIP AT BOTTOM OF SPOUT
    const lipGeo = new THREE.TorusGeometry(outletRadius, 7 * S, 12, 36);
    const lip = createSolidPart(lipGeo);
    lip.rotation.x = Math.PI / 2;
    lip.position.set(0, -funnelHeight / 2 - neckHeight, 0);
    modelGroup.add(lip);

    // 5. 4 WELDED MOUNTING GUSSET BRACKETS AROUND UPPER FLANGE
    for (let g = 0; g < 4; g++) {
      const gAngle = (g / 4) * Math.PI * 2 + Math.PI / 4;
      const gussetGeo = new THREE.BoxGeometry(16 * S, 80 * S, 60 * S);
      const gusset = createSolidPart(gussetGeo);
      gusset.rotation.y = -gAngle;
      gusset.position.set(
        Math.cos(gAngle) * (topOuterRadius - 20 * S),
        funnelHeight / 2 - 30 * S,
        Math.sin(gAngle) * (topOuterRadius - 20 * S)
      );
      modelGroup.add(gusset);
    }

    // Centering the model nicely in viewport
    modelGroup.position.set(0, 0.1, 0);
    scene.add(modelGroup);
  }, [resolvedOutletWidth, isWideOutlet, activeMaterial, displayStyle, topFlangeDiameter]);

  // Preset Views (SolidWorks standard views)
  const setPresetView = (view: 'iso' | 'front' | 'top' | 'right') => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    setCameraOrientation(view);
    if (view === 'iso') {
      camera.position.set(3.6, 2.8, 4.2);
      controls.target.set(0, 0, 0);
    } else if (view === 'front') {
      camera.position.set(0, 0.2, 5.0);
      controls.target.set(0, 0, 0);
    } else if (view === 'top') {
      camera.position.set(0, 5.2, 0.01);
      controls.target.set(0, 0, 0);
    } else if (view === 'right') {
      camera.position.set(5.0, 0.2, 0);
      controls.target.set(0, 0, 0);
    }
    controls.update();
  };

  return (
    <div className="relative w-full h-[450px] bg-[#161B22] border border-[#2D3A47] rounded overflow-hidden select-none flex flex-col">
      {/* Top CAD Studio Viewport Bar */}
      <div className="h-9 px-3 bg-[#1F2630] border-b border-[#2D3A47] flex items-center justify-between text-[11px] text-[#C9D1D9] z-10">
        <div className="flex items-center gap-2">
          <Box size={13} className="text-[#58A6FF]" />
          <span className="font-mono font-bold text-white">WEIGHER_DISCHARGE_CHUTE_450.SLDPRT</span>
          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-[#315D78] text-white">
            {isWideOutlet ? 'Cfg: Width_450mm' : 'Cfg: Standard_300mm'}
          </span>
        </div>

        {/* Shading Style Toggles */}
        <div className="flex items-center gap-1 bg-[#161B22] p-0.5 rounded border border-[#2D3A47]">
          <button
            onClick={() => setDisplayStyle('shadedEdges')}
            className={cn('px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors', displayStyle === 'shadedEdges' ? 'bg-[#315D78] text-white' : 'text-[#8B949E] hover:text-white')}
            title="SolidWorks Shaded with Edges"
          >
            Shaded + Edges
          </button>
          <button
            onClick={() => setDisplayStyle('shaded')}
            className={cn('px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors', displayStyle === 'shaded' ? 'bg-[#315D78] text-white' : 'text-[#8B949E] hover:text-white')}
          >
            Shaded
          </button>
          <button
            onClick={() => setDisplayStyle('section')}
            className={cn('px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors', displayStyle === 'section' ? 'bg-[#315D78] text-white' : 'text-[#8B949E] hover:text-white')}
            title="Section View A-A"
          >
            Section A-A
          </button>
          <button
            onClick={() => setDisplayStyle('wireframe')}
            className={cn('px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors', displayStyle === 'wireframe' ? 'bg-[#315D78] text-white' : 'text-[#8B949E] hover:text-white')}
          >
            Wireframe
          </button>
        </div>

        {/* Standard View Orientation */}
        <div className="flex items-center gap-1 text-[10.5px]">
          <span className="text-[#8B949E]">View:</span>
          <button onClick={() => setPresetView('iso')} className={cn('px-1.5 py-0.5 rounded', cameraOrientation === 'iso' ? 'bg-[#315D78] text-white' : 'hover:bg-[#2D3A47] text-[#8B949E]')}>Iso</button>
          <button onClick={() => setPresetView('front')} className={cn('px-1.5 py-0.5 rounded', cameraOrientation === 'front' ? 'bg-[#315D78] text-white' : 'hover:bg-[#2D3A47] text-[#8B949E]')}>Front</button>
          <button onClick={() => setPresetView('top')} className={cn('px-1.5 py-0.5 rounded', cameraOrientation === 'top' ? 'bg-[#315D78] text-white' : 'hover:bg-[#2D3A47] text-[#8B949E]')}>Top</button>
          <button onClick={() => setPresetView('right')} className={cn('px-1.5 py-0.5 rounded', cameraOrientation === 'right' ? 'bg-[#315D78] text-white' : 'hover:bg-[#2D3A47] text-[#8B949E]')}>Right</button>
        </div>
      </div>

      {/* WebGL Canvas */}
      <div ref={mountRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing outline-none" />

      {/* Floating Material & Dimension Badges */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 pointer-events-none z-10">
        <div className="px-2.5 py-1.5 bg-[#1C2128]/95 border border-[#315D78] rounded text-[#E6EDF3] text-[11px] backdrop-blur-xs flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#58A6FF] animate-pulse" />
          <span className="font-mono">Chute Outlet: <strong>Ø{resolvedOutletWidth} mm</strong></span>
          <span className="text-[#8B949E]">|</span>
          <span>Slope: <strong>{isWideOutlet ? '62°' : '55°'}</strong></span>
          <span className="text-[#8B949E]">|</span>
          <span>Top Rim: <strong>Ø{topFlangeDiameter} mm</strong></span>
        </div>

        <div className="px-2.5 py-1.5 bg-[#1C2128]/95 border border-[#30363D] rounded text-[11px] text-[#C9D1D9] backdrop-blur-xs pointer-events-auto flex items-center gap-1.5">
          <span className="text-[#8B949E]">Material:</span>
          <select
            value={activeMaterial}
            onChange={(e) => {
              const val = e.target.value as 'stainless_304' | 'stainless_316';
              setActiveMaterial(val);
              onMaterialChange?.(val);
            }}
            className="bg-[#242C35] text-white rounded px-1.5 py-0.5 text-[10.5px] border border-[#3A4756] outline-none cursor-pointer"
          >
            <option value="stainless_316">316L Stainless (Electropolished)</option>
            <option value="stainless_304">304 Stainless (Standard)</option>
          </select>
        </div>
      </div>

      {/* Status Watermark */}
      <div className="absolute top-11 right-3 px-2 py-1 bg-[#161B22]/85 border border-[#30363D] rounded text-[10px] font-mono text-[#8B949E] pointer-events-none">
        SOLIDWORKS Simulation • MMGS Units
      </div>
    </div>
  );
}
