// ============================================================
// VOLM Engineering Intelligence — 3D SOLIDWORKS Design Viewer
// Authentic Parametric 3D CAD Viewport with SolidWorks Shaders & Edges
// ============================================================

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  RotateCcw, Eye, Maximize2, Layers, Compass, Sliders, Box,
  Sparkles, Shield, Ruler, CheckCircle, Info, ChevronRight,
  Sun, RefreshCw
} from 'lucide-react';
import { cn } from './shared';

interface SolidWorks3DViewerProps {
  inletDiameter: number;       // 100 or 125 mm
  flangeDiameter: number;      // 220 or 250 mm
  bcd: number;                 // 180 or 210 mm
  boltHolesCount: number;      // 4 or 8
  flangeThickness: number;     // 18 or 20 mm
  material: 'cast_iron' | 'stainless_316';
  isModified: boolean;
  onMaterialChange?: (mat: 'cast_iron' | 'stainless_316') => void;
}

export function SolidWorks3DViewer({
  inletDiameter = 125,
  flangeDiameter = 250,
  bcd = 210,
  boltHolesCount = 8,
  flangeThickness = 20,
  material = 'cast_iron',
  isModified = true,
  onMaterialChange
}: SolidWorks3DViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const sectionPlaneRef = useRef<THREE.Plane | null>(null);

  // Viewport states
  const [displayStyle, setDisplayStyle] = useState<'shadedEdges' | 'shaded' | 'wireframe' | 'section'>('shadedEdges');
  const [showExtrusionSketch, setShowExtrusionSketch] = useState(true);
  const [activeMaterial, setActiveMaterial] = useState<'cast_iron' | 'stainless_316'>(material);
  const [cameraOrientation, setCameraOrientation] = useState<'iso' | 'front' | 'top' | 'right'>('iso');

  // Scale factor: Real mm to Three.js units (1 mm = 0.01 units)
  const S = 0.01;

  // Sync internal material state if prop changes
  useEffect(() => {
    setActiveMaterial(material);
  }, [material]);

  // Helper to notify parent
  const handleSetMaterial = (newMat: 'cast_iron' | 'stainless_316') => {
    setActiveMaterial(newMat);
    onMaterialChange?.(newMat);
  };

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
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(3.8, 2.6, 4.2);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and clipping planes
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 12;
    controls.minDistance = 1.2;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 5. Lighting (Classic SOLIDWORKS Studio lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(5, 8, 6);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xd4e2ef, 0.8);
    fillLight.position.set(-5, 3, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    rimLight.position.set(0, -6, 4);
    scene.add(rimLight);

    // 6. Section Clipping Plane (YZ Plane cutting through X=0)
    const sectionPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    sectionPlaneRef.current = sectionPlane;

    // 7. Base Grid Shadow Plane
    const shadowGeo = new THREE.PlaneGeometry(10, 10);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.25;
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

    // Cleanup
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
  // BUILD SOLIDWORKS 3D PARAMETRIC GEOMETRY
  // -------------------------------------------------------------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove previous model group if exists
    if (modelGroupRef.current) {
      scene.remove(modelGroupRef.current);
      // Clean up child geometries & materials
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

    // Determine Material Properties
    const isStainless = activeMaterial === 'stainless_316';
    const mainColor = isStainless ? 0xd0d8e0 : 0x54626f;
    const roughness = isStainless ? 0.28 : 0.65;
    const metalness = isStainless ? 0.88 : 0.25;

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
    // 1. MAIN VOLUTE SPIRAL CHAMBER (Toroid + Body)
    // -----------------------------------------------------------
    const voluteRadius = 0.95;
    const voluteTubeRadius = 0.42;
    const voluteGeo = new THREE.TorusGeometry(voluteRadius, voluteTubeRadius, 24, 48, Math.PI * 1.85);
    const voluteMesh = createSolidPart(voluteGeo);
    voluteMesh.position.set(0, 0, 0);
    modelGroup.add(voluteMesh);

    // Volute Front & Back Flat Shell Plates
    const backPlateGeo = new THREE.CylinderGeometry(voluteRadius + 0.38, voluteRadius + 0.38, 0.08, 48);
    const backPlate = createSolidPart(backPlateGeo);
    backPlate.rotation.x = Math.PI / 2;
    backPlate.position.set(0, 0, -0.42);
    modelGroup.add(backPlate);

    // -----------------------------------------------------------
    // 2. TANGENTIAL DISCHARGE NOZZLE (Vertical Outlet)
    // -----------------------------------------------------------
    const dischargeOuterRadius = 0.48;
    const dischargeInnerRadius = 0.40;
    const dischargeLength = 1.1;

    // Nozzle Pipe
    const dischargeGeo = new THREE.CylinderGeometry(dischargeOuterRadius, dischargeOuterRadius, dischargeLength, 32);
    const dischargeMesh = createSolidPart(dischargeGeo);
    dischargeMesh.position.set(voluteRadius + 0.12, 0.85, 0);
    modelGroup.add(dischargeMesh);

    // Discharge Flange at top
    const dischargeFlangeGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.14, 32);
    const dischargeFlange = createSolidPart(dischargeFlangeGeo);
    dischargeFlange.position.set(voluteRadius + 0.12, 1.4, 0);
    modelGroup.add(dischargeFlange);

    // -----------------------------------------------------------
    // 3. DRIVE SHAFT HUB (Rear Extension)
    // -----------------------------------------------------------
    const shaftHubGeo = new THREE.CylinderGeometry(0.32, 0.35, 0.6, 28);
    const shaftHub = createSolidPart(shaftHubGeo);
    shaftHub.rotation.x = Math.PI / 2;
    shaftHub.position.set(0, 0, -0.72);
    modelGroup.add(shaftHub);

    // -----------------------------------------------------------
    // 4. MOUNTING FEET & BRACKET (Base)
    // -----------------------------------------------------------
    const basePlateGeo = new THREE.BoxGeometry(2.2, 0.12, 1.4);
    const basePlate = createSolidPart(basePlateGeo, 0x3a4550);
    basePlate.position.set(0.1, -1.2, -0.2);
    modelGroup.add(basePlate);

    const ribGeo1 = new THREE.BoxGeometry(0.12, 0.65, 0.9);
    const rib1 = createSolidPart(ribGeo1);
    rib1.position.set(-0.4, -0.85, -0.2);
    modelGroup.add(rib1);

    const ribGeo2 = new THREE.BoxGeometry(0.12, 0.65, 0.9);
    const rib2 = createSolidPart(ribGeo2);
    rib2.position.set(0.6, -0.85, -0.2);
    modelGroup.add(rib2);

    // -----------------------------------------------------------
    // 5. INLET PORT BOSS & FLANGE (THE ACTIVE PARAMETRIC FEATURE)
    //    Dynamically sized by inletDiameter (100 vs 125 mm)
    // -----------------------------------------------------------
    const inletRadius = (inletDiameter / 2) * S;                // 0.50 or 0.625 units
    const wallThick = 0.12;                                    // 12 mm wall thickness
    const inletOuterRadius = inletRadius + wallThick;          // Outer boss boundary
    const inletExtrusionLength = 1.35;                         // 135 mm blind extrusion depth
    const flangeRadius = (flangeDiameter / 2) * S;             // 1.10 or 1.25 units
    const flangeThickVal = flangeThickness * S;                // 0.18 or 0.20 units
    const bcdRadius = (bcd / 2) * S;                           // 0.90 or 1.05 units

    // Highlight color for modified active feature in CAD
    const featureColor = isModified ? (isStainless ? 0xd5e3ee : 0x506575) : mainColor;

    // Inlet Boss Cylinder (Hollow Pipe)
    const inletBossGeo = new THREE.CylinderGeometry(inletOuterRadius, inletOuterRadius, inletExtrusionLength, 48);
    const inletBoss = createSolidPart(inletBossGeo, featureColor);
    inletBoss.rotation.x = Math.PI / 2;
    inletBoss.position.set(0, 0, inletExtrusionLength / 2);
    modelGroup.add(inletBoss);

    // Inlet Flange Ring at the tip
    const flangeGeo = new THREE.CylinderGeometry(flangeRadius, flangeRadius, flangeThickVal, 48);
    const flangeMesh = createSolidPart(flangeGeo, featureColor);
    flangeMesh.rotation.x = Math.PI / 2;
    flangeMesh.position.set(0, 0, inletExtrusionLength + flangeThickVal / 2);
    modelGroup.add(flangeMesh);

    // Flange Bolt Holes (Through-holes through the flange)
    const holeRadius = 0.085; // M16 clearance hole
    const holeGeo = new THREE.CylinderGeometry(holeRadius, holeRadius, flangeThickVal * 1.05, 16);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x11161b, clippingPlanes });

    for (let i = 0; i < boltHolesCount; i++) {
      const angle = (i * 2 * Math.PI) / boltHolesCount;
      const hx = Math.cos(angle) * bcdRadius;
      const hy = Math.sin(angle) * bcdRadius;

      const holeMesh = new THREE.Mesh(holeGeo, holeMat);
      holeMesh.rotation.x = Math.PI / 2;
      holeMesh.position.set(hx, hy, inletExtrusionLength + flangeThickVal / 2);
      modelGroup.add(holeMesh);
    }

    // -----------------------------------------------------------
    // 6. SOLIDWORKS 2D SKETCH & EXTRUSION VECTORS (Visualizer)
    // -----------------------------------------------------------
    if (showExtrusionSketch) {
      const sketchGroup = new THREE.Group();

      // 2D Sketch Plane Ring at origin of Inlet Boss
      const sketchCircleGeo = new THREE.RingGeometry(inletRadius - 0.005, inletRadius + 0.005, 48);
      const sketchCircleMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, side: THREE.DoubleSide });
      const sketchCircle = new THREE.Mesh(sketchCircleGeo, sketchCircleMat);
      sketchCircle.position.set(0, 0, 0.02);
      sketchGroup.add(sketchCircle);

      // Extrusion Direction Vectors (Yellow dashed centerline + arrowheads)
      const arrowDir = new THREE.Vector3(0, 0, 1);
      const arrowOrigin = new THREE.Vector3(0, 0, 0);
      const arrowHelper = new THREE.ArrowHelper(arrowDir, arrowOrigin, inletExtrusionLength + flangeThickVal + 0.35, 0xf59e0b, 0.2, 0.12);
      sketchGroup.add(arrowHelper);

      // Bolt Circle Guide Line (Dashed BCD on flange face)
      const bcdRingGeo = new THREE.RingGeometry(bcdRadius - 0.004, bcdRadius + 0.004, 64);
      const bcdMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
      const bcdRing = new THREE.Mesh(bcdRingGeo, bcdMat);
      bcdRing.position.set(0, 0, inletExtrusionLength + flangeThickVal + 0.01);
      sketchGroup.add(bcdRing);

      modelGroup.add(sketchGroup);
    }

    // Position entire assembly centered on screen
    modelGroup.position.set(-0.2, 0.15, 0);
    scene.add(modelGroup);

  }, [inletDiameter, flangeDiameter, bcd, boltHolesCount, flangeThickness, activeMaterial, displayStyle, showExtrusionSketch, isModified]);

  // -------------------------------------------------------------
  // CAMERA ORIENTATION CONTROL
  // -------------------------------------------------------------
  const setOrientation = (type: 'iso' | 'front' | 'top' | 'right') => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    setCameraOrientation(type);

    if (type === 'iso') {
      camera.position.set(3.8, 2.6, 4.2);
    } else if (type === 'front') {
      camera.position.set(0, 0, 5.5);
    } else if (type === 'top') {
      camera.position.set(0, 5.8, 0.01);
    } else if (type === 'right') {
      camera.position.set(5.5, 0, 0);
    }
    controls.target.set(0, 0, 0);
    controls.update();
  };

  const handleResetView = () => {
    setOrientation('iso');
  };

  return (
    <div className="w-full flex flex-col bg-[#FDFDFE] rounded border border-[#DDE2E6] overflow-hidden select-none">
      {/* SOLIDWORKS Classic Heads-Up View Toolbar */}
      <div className="px-3 py-1.5 bg-[#F0F3F6] border-b border-[#DDE2E6] flex items-center justify-between flex-wrap gap-2 text-[11px]">
        {/* Left: View Orientation Controls */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-[#68737D] uppercase mr-1">View:</span>
          <div className="flex rounded border border-[#CCD5DD] overflow-hidden bg-white text-[11px]">
            <button
              onClick={() => setOrientation('iso')}
              className={cn(
                'px-2 py-0.5 font-medium transition-colors',
                cameraOrientation === 'iso' ? 'bg-[#315D78] text-white' : 'text-[#475467] hover:bg-[#F4F5F6]'
              )}
              title="Isometric View (Ctrl+7)"
            >
              Isometric
            </button>
            <button
              onClick={() => setOrientation('front')}
              className={cn(
                'px-2 py-0.5 font-medium transition-colors border-l border-[#CCD5DD]',
                cameraOrientation === 'front' ? 'bg-[#315D78] text-white' : 'text-[#475467] hover:bg-[#F4F5F6]'
              )}
              title="Front View (Ctrl+1)"
            >
              Front
            </button>
            <button
              onClick={() => setOrientation('top')}
              className={cn(
                'px-2 py-0.5 font-medium transition-colors border-l border-[#CCD5DD]',
                cameraOrientation === 'top' ? 'bg-[#315D78] text-white' : 'text-[#475467] hover:bg-[#F4F5F6]'
              )}
              title="Top View (Ctrl+5)"
            >
              Top
            </button>
            <button
              onClick={() => setOrientation('right')}
              className={cn(
                'px-2 py-0.5 font-medium transition-colors border-l border-[#CCD5DD]',
                cameraOrientation === 'right' ? 'bg-[#315D78] text-white' : 'text-[#475467] hover:bg-[#F4F5F6]'
              )}
              title="Right View (Ctrl+4)"
            >
              Right
            </button>
          </div>

          <button
            onClick={handleResetView}
            className="p-1 text-[#68737D] hover:text-[#20272E] hover:bg-white rounded border border-transparent hover:border-[#CCD5DD] ml-1"
            title="Reset Camera (Zoom to Fit)"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Center: SolidWorks Display Styles */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-[#68737D] uppercase mr-1">Display:</span>
          <div className="flex rounded border border-[#CCD5DD] overflow-hidden bg-white text-[11px]">
            <button
              onClick={() => setDisplayStyle('shadedEdges')}
              className={cn(
                'px-2 py-0.5 font-medium transition-colors',
                displayStyle === 'shadedEdges' ? 'bg-[#315D78] text-white' : 'text-[#475467] hover:bg-[#F4F5F6]'
              )}
              title="Shaded With Edges (SolidWorks Standard)"
            >
              Shaded + Edges
            </button>
            <button
              onClick={() => setDisplayStyle('shaded')}
              className={cn(
                'px-2 py-0.5 font-medium transition-colors border-l border-[#CCD5DD]',
                displayStyle === 'shaded' ? 'bg-[#315D78] text-white' : 'text-[#475467] hover:bg-[#F4F5F6]'
              )}
              title="Shaded (Smooth Surface)"
            >
              Shaded
            </button>
            <button
              onClick={() => setDisplayStyle('wireframe')}
              className={cn(
                'px-2 py-0.5 font-medium transition-colors border-l border-[#CCD5DD]',
                displayStyle === 'wireframe' ? 'bg-[#315D78] text-white' : 'text-[#475467] hover:bg-[#F4F5F6]'
              )}
              title="Wireframe View"
            >
              Wireframe
            </button>
            <button
              onClick={() => setDisplayStyle('section')}
              className={cn(
                'px-2 py-0.5 font-medium transition-colors border-l border-[#CCD5DD]',
                displayStyle === 'section' ? 'bg-[#B54708] text-white' : 'text-[#475467] hover:bg-[#F4F5F6]'
              )}
              title="Cutaway Section View"
            >
              Cutaway Section
            </button>
          </div>
        </div>

        {/* Right: Feature Extrusion Toggle & Material Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExtrusionSketch(!showExtrusionSketch)}
            className={cn(
              'px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 transition-colors',
              showExtrusionSketch
                ? 'bg-[#EBF2F7] text-[#315D78] border-[#315D78]'
                : 'bg-white text-[#68737D] border-[#CCD5DD] hover:bg-[#F4F5F6]'
            )}
            title="Toggle 2D Sketch Plane & Extrusion Vectors"
          >
            <Sliders size={11} />
            Extrusion Vectors {showExtrusionSketch ? 'ON' : 'OFF'}
          </button>

          <div className="flex items-center gap-1 border-l border-[#DDE2E6] pl-2">
            <span className="text-[10px] text-[#68737D] uppercase font-bold">Mat:</span>
            <select
              value={activeMaterial}
              onChange={(e) => handleSetMaterial(e.target.value as any)}
              className="px-1.5 py-0.5 text-[11px] font-medium bg-white border border-[#CCD5DD] rounded text-[#20272E] focus:outline-none"
            >
              <option value="cast_iron">Cast Iron GG25</option>
              <option value="stainless_316">316L Stainless Steel</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3D WebGL Viewport Container with SolidWorks Radial Gradient */}
      <div className="relative w-full h-[400px] overflow-hidden" style={{
        background: 'radial-gradient(circle at 50% 35%, #F5F8FA 0%, #D8E2EC 55%, #BBC9D6 100%)'
      }}>
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Top-Left Heads-Up Feature Diagnostics Box */}
        <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-xs border border-[#CCD5DD] rounded p-2 text-[11px] shadow-xs pointer-events-none space-y-1">
          <div className="flex items-center gap-1.5 text-[#315D78] font-bold">
            <Box size={13} />
            <span>SOLIDWORKS 3D Model: PUMP_CASING_STD_A.SLDPRT</span>
          </div>
          <div className="text-[#475467] font-mono text-[10px] space-y-0.5">
            <div>Target Feature: <strong className="text-[#20272E]">Inlet_Port_Boss (Boss-Extrude1)</strong></div>
            <div>Inlet Nozzle Bore: <strong className="text-[#315D78] font-bold">Ø {inletDiameter} mm H7</strong></div>
            <div>Flange Dimensions: <strong className="text-[#20272E]">Ø {flangeDiameter} × {flangeThickness} mm (PN16)</strong></div>
            <div>Bolt Circle (BCD): <strong className="text-[#20272E]">Ø {bcd} mm ({boltHolesCount} × M16)</strong></div>
            <div>Material: <strong className="text-[#20272E]">{activeMaterial === 'cast_iron' ? 'Cast Iron GG25 (7.2 g/cm³)' : '316L Stainless Steel (8.0 g/cm³)'}</strong></div>
          </div>
        </div>

        {/* Bottom-Left SolidWorks 3D Coordinate Triad */}
        <div className="absolute bottom-2.5 left-2.5 bg-white/85 backdrop-blur-xs border border-[#CCD5DD] rounded px-2 py-1 text-[10px] font-mono font-bold shadow-xs pointer-events-none flex items-center gap-3">
          <span className="text-[#DC2626]">X: +Horiz</span>
          <span className="text-[#16A34A]">Y: +Vert</span>
          <span className="text-[#2563EB]">Z: +Extrude</span>
        </div>

        {/* Bottom-Right Navigation Instructions */}
        <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white rounded px-2 py-1 text-[10px] font-mono shadow-xs pointer-events-none">
          Left-Click + Drag: Rotate · Scroll: Zoom · Right-Click: Pan
        </div>
      </div>

      {/* 3D & 2D Correlation Callout Bar */}
      <div className="px-4 py-2 bg-[#F8FAFB] border-t border-[#DDE2E6] flex items-center justify-between text-[11.5px]">
        <div className="flex items-center gap-2">
          <CheckCircle size={14} className="text-[#2D7A4F] flex-shrink-0" />
          <span className="text-[#20272E]">
            <strong>2D Section to 3D Extrusion Correlation:</strong> The 3D inlet nozzle directly manifests the Section A-A parametric dimensions (D₁ = {inletDiameter} mm, D₂ = {flangeDiameter} mm, BCD = {bcd} mm).
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10.5px] uppercase font-bold bg-[#EBF5EF] text-[#2D7A4F] border border-[#85C9A1] px-2 py-0.5 rounded font-mono">
            Parasolid Rebuilt Clean
          </span>
        </div>
      </div>
    </div>
  );
}
