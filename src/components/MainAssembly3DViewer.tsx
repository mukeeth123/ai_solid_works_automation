// ============================================================
// VOLM Engineering Intelligence — Main Assembly 3D CAD Viewport
// Coordinates all 10 packaging equipment assemblies in authentic 3D space
// With interactive component picking, exploded view, and CAD shaders
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  RotateCcw, Eye, Compass, Box, Layers, Maximize2, Sliders, CheckCircle,
  AlertTriangle, Info, ZoomIn, ZoomOut, Move3d
} from 'lucide-react';
import type { MainAssemblyItem } from '../types/engineering';
import { cn } from './shared';

interface MainAssembly3DViewerProps {
  items: MainAssemblyItem[];
  selectedItemId?: string;
  onSelectItem: (id: string) => void;
  isWeigherModified?: boolean; // Chute 450 mm vs 300 mm
  isBaggerModified?: boolean;  // Jaw width 600 mm vs 400 mm
  // Backward compatibility aliases
  isPumpModified?: boolean;
  isSkidModified?: boolean;
}

export function MainAssembly3DViewer({
  items,
  selectedItemId,
  onSelectItem,
  isWeigherModified = true,
  isBaggerModified = true,
  isPumpModified,
  isSkidModified,
}: MainAssembly3DViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const componentMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  const [displayStyle, setDisplayStyle] = useState<'shadedEdges' | 'shaded' | 'wireframe'>('shadedEdges');
  const [cameraView, setCameraView] = useState<'iso' | 'front' | 'top' | 'right'>('iso');
  const [explodeFactor, setExplodeFactor] = useState<number>(0); // 0 to 1
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [showAxes, setShowAxes] = useState(true);

  // Resolved modification flags (supports both modern packaging names and legacy props)
  const weigherModified = isPumpModified !== undefined ? isPumpModified : isWeigherModified;
  const baggerModified = isSkidModified !== undefined ? isSkidModified : isBaggerModified;

  // 1 mm in model space = 0.0016 Three.js units (scaled for packaging line layout)
  const S = 0.0016;

  // Setup Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = container.clientHeight || 520;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera positioned for panoramic packaging line view
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(7.8, 5.2, 8.8);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and shadow maps
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 28;
    controls.minDistance = 2.0;
    controls.target.set(1.2, 1.8, 0);
    controlsRef.current = controls;

    // 5. Lighting (Authentic CAD Studio Lighting: Key, Fill, Rim, Ambient)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.78);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
    keyLight.position.set(12, 16, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xddeeff, 0.7);
    fillLight.position.set(-14, 10, -10);
    scene.add(fillLight);

    const bottomReflect = new THREE.DirectionalLight(0x778899, 0.4);
    bottomReflect.position.set(0, -10, 0);
    scene.add(bottomReflect);

    // 6. Ground Workstation Shadow Plane & Grid
    const grid = new THREE.GridHelper(18, 36, 0x3d4a58, 0x242d38);
    grid.position.y = -0.01;
    scene.add(grid);

    const shadowPlaneGeo = new THREE.PlaneGeometry(18, 18);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.28 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.012;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Coordinate Triad
    const axesHelper = new THREE.AxesHelper(1.8);
    axesHelper.position.set(-3.5, 0.01, -2.5);
    scene.add(axesHelper);

    // 7. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Build / Rebuild Assembly Meshes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clean previous components
    componentMeshesRef.current.forEach(group => {
      scene.remove(group);
      group.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    });
    componentMeshesRef.current.clear();

    const isWireframe = displayStyle === 'wireframe';

    // Materials Palette for Industrial Packaging Equipment
    const stainlessBrightMat = new THREE.MeshStandardMaterial({
      color: 0xE2E8F0, // Clean electropolished stainless 316L / 304
      metalness: 0.88,
      roughness: 0.22,
      wireframe: isWireframe,
    });

    const stainlessDimpledMat = new THREE.MeshStandardMaterial({
      color: weigherModified ? 0x2A72A4 : 0xC8D4E0, // Distinct CAD blue if modified chute, satin silver if standard
      metalness: 0.82,
      roughness: 0.32,
      wireframe: isWireframe,
    });

    const machineBodyMat = new THREE.MeshStandardMaterial({
      color: 0x2A3441, // Solid charcoal industrial machine chassis
      metalness: 0.65,
      roughness: 0.38,
      wireframe: isWireframe,
    });

    const conveyorBeltMat = new THREE.MeshStandardMaterial({
      color: 0x1E5F74, // FDA Blue food-grade cleated conveyor belt
      metalness: 0.15,
      roughness: 0.65,
      wireframe: isWireframe,
    });

    const rollerShaftMat = new THREE.MeshStandardMaterial({
      color: 0xA0AEC0, // Turned steel drive rollers
      metalness: 0.92,
      roughness: 0.18,
      wireframe: isWireframe,
    });

    const safetyYellowMat = new THREE.MeshStandardMaterial({
      color: 0xF59E0B, // High-visibility safety interlock yellow
      metalness: 0.25,
      roughness: 0.40,
      wireframe: isWireframe,
    });

    const lexanGlassMat = new THREE.MeshStandardMaterial({
      color: 0xD0E8FA, // Clear transparent polycarbonate Lexan panels
      metalness: 0.1,
      roughness: 0.1,
      transparent: true,
      opacity: 0.38,
      wireframe: isWireframe,
    });

    const motorDriveMat = new THREE.MeshStandardMaterial({
      color: 0x1E3A5F, // Gearmotor casing blue
      metalness: 0.70,
      roughness: 0.35,
      wireframe: isWireframe,
    });

    // Helper: Add black edge lines for authentic CAD workstation Shaded with Edges
    const addEdges = (mesh: THREE.Mesh, group: THREE.Group) => {
      if (displayStyle === 'shadedEdges') {
        const edgeGeo = new THREE.EdgesGeometry(mesh.geometry, 26);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x11161B, linewidth: 1 });
        const line = new THREE.LineSegments(edgeGeo, edgeMat);
        mesh.add(line);
      }
    };

    // -------------------------------------------------------------
    // BUILD EACH OF THE 10 PACKAGING EQUIPMENT ASSEMBLIES
    // -------------------------------------------------------------

    items.forEach(item => {
      const group = new THREE.Group();
      group.name = item.id;
      group.userData = { itemId: item.id, partNumber: item.partNumber };

      // Base translation in world meters
      const baseX = item.position.x * S;
      const baseY = item.position.y * S;
      const baseZ = item.position.z * S;

      // Apply exploded view offset based on packaging line flow
      let explodeX = 0;
      let explodeY = 0;
      let explodeZ = 0;

      if (explodeFactor > 0) {
        if (item.assemblyRefId === 'asm-003') {
          explodeX = -explodeFactor * 2.8;
          explodeY = explodeFactor * 0.5;
        } else if (item.assemblyRefId === 'asm-004') {
          explodeX = -explodeFactor * 1.5;
          explodeY = explodeFactor * 1.6;
        } else if (item.assemblyRefId === 'asm-001') {
          explodeY = explodeFactor * 2.6; // Weigher lifts vertically
        } else if (item.assemblyRefId === 'asm-005') {
          explodeZ = -explodeFactor * 2.2; // Date coder pulls backward
        } else if (item.assemblyRefId === 'asm-006') {
          explodeZ = explodeFactor * 2.0;  // Sealing jaws pull forward
        } else if (item.assemblyRefId === 'asm-007') {
          explodeX = explodeFactor * 1.6;
          explodeY = explodeFactor * 0.8;
        } else if (item.assemblyRefId === 'asm-008') {
          explodeX = explodeFactor * 2.8;
        } else if (item.assemblyRefId === 'asm-009') {
          explodeX = explodeFactor * 4.2;
        } else if (item.assemblyRefId === 'asm-010') {
          explodeY = explodeFactor * 3.2; // Guarding cell elevates overhead
        }
      }

      group.position.set(baseX + explodeX, baseY + explodeY, baseZ + explodeZ);

      // -----------------------------------------------------------
      // 1. INFEED INCLINE CLEATED CONVEYOR (asm-003)
      // -----------------------------------------------------------
      if (item.assemblyRefId === 'asm-003') {
        const convAngle = Math.PI / 6; // 30 degrees incline
        const length = 2800 * S;
        const width = 550 * S;
        const beamH = 120 * S;

        // Slanted main stringer channel 1 & 2
        const s1 = new THREE.Mesh(new THREE.BoxGeometry(length, beamH, 20 * S), machineBodyMat);
        s1.rotation.z = convAngle;
        s1.position.set(length * Math.cos(convAngle) / 2, length * Math.sin(convAngle) / 2 + 100 * S, -width / 2);
        s1.castShadow = true;
        addEdges(s1, group);
        group.add(s1);

        const s2 = new THREE.Mesh(new THREE.BoxGeometry(length, beamH, 20 * S), machineBodyMat);
        s2.rotation.z = convAngle;
        s2.position.set(length * Math.cos(convAngle) / 2, length * Math.sin(convAngle) / 2 + 100 * S, width / 2);
        s2.castShadow = true;
        addEdges(s2, group);
        group.add(s2);

        // Cleated blue belt surface
        const belt = new THREE.Mesh(new THREE.BoxGeometry(length, 12 * S, width - 40 * S), conveyorBeltMat);
        belt.rotation.z = convAngle;
        belt.position.set(length * Math.cos(convAngle) / 2, length * Math.sin(convAngle) / 2 + 100 * S + 10 * S, 0);
        belt.castShadow = true;
        addEdges(belt, group);
        group.add(belt);

        // Cleats on belt (8 flights along slope)
        for (let i = 0; i < 9; i++) {
          const frac = (i + 1) / 10;
          const cx = frac * length * Math.cos(convAngle);
          const cy = frac * length * Math.sin(convAngle) + 100 * S + 25 * S;
          const cleat = new THREE.Mesh(new THREE.BoxGeometry(16 * S, 35 * S, width - 60 * S), conveyorBeltMat);
          cleat.rotation.z = convAngle;
          cleat.position.set(cx, cy, 0);
          addEdges(cleat, group);
          group.add(cleat);
        }

        // Lower product infeed reception hopper (funnel box)
        const hopper = new THREE.Mesh(new THREE.BoxGeometry(600 * S, 400 * S, width + 100 * S), stainlessBrightMat);
        hopper.position.set(100 * S, 250 * S, 0);
        hopper.castShadow = true;
        addEdges(hopper, group);
        group.add(hopper);

        // Top head discharge chute lip
        const topLip = new THREE.Mesh(new THREE.BoxGeometry(350 * S, 200 * S, width), stainlessBrightMat);
        topLip.position.set(length * Math.cos(convAngle) + 120 * S, length * Math.sin(convAngle) + 100 * S - 40 * S, 0);
        addEdges(topLip, group);
        group.add(topLip);

        // Tubular support legs
        const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(25 * S, 25 * S, length * Math.sin(convAngle), 16), machineBodyMat);
        leg1.position.set(length * Math.cos(convAngle) - 150 * S, (length * Math.sin(convAngle)) / 2, -width / 2);
        addEdges(leg1, group);
        group.add(leg1);

        const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(25 * S, 25 * S, length * Math.sin(convAngle), 16), machineBodyMat);
        leg2.position.set(length * Math.cos(convAngle) - 150 * S, (length * Math.sin(convAngle)) / 2, width / 2);
        addEdges(leg2, group);
        group.add(leg2);

        // Gearmotor drive at head
        const drive = new THREE.Mesh(new THREE.CylinderGeometry(70 * S, 70 * S, 180 * S, 16), motorDriveMat);
        drive.rotation.x = Math.PI / 2;
        drive.position.set(length * Math.cos(convAngle), length * Math.sin(convAngle) + 100 * S, width / 2 + 100 * S);
        addEdges(drive, group);
        group.add(drive);
      }

      // -----------------------------------------------------------
      // 2. VIBRATORY PAN CROSS-FEEDER (asm-004)
      // -----------------------------------------------------------
      else if (item.assemblyRefId === 'asm-004') {
        const trayL = 800 * S;
        const trayW = 380 * S;
        const trayH = 160 * S;

        // Vibratory tray pan (stainless channel with open discharge lip)
        const panBottom = new THREE.Mesh(new THREE.BoxGeometry(trayL, 12 * S, trayW), stainlessBrightMat);
        panBottom.position.set(0, 0, 0);
        panBottom.castShadow = true;
        addEdges(panBottom, group);
        group.add(panBottom);

        const sideL = new THREE.Mesh(new THREE.BoxGeometry(trayL, trayH, 10 * S), stainlessBrightMat);
        sideL.position.set(0, trayH / 2, -trayW / 2);
        addEdges(sideL, group);
        group.add(sideL);

        const sideR = new THREE.Mesh(new THREE.BoxGeometry(trayL, trayH, 10 * S), stainlessBrightMat);
        sideR.position.set(0, trayH / 2, trayW / 2);
        addEdges(sideR, group);
        group.add(sideR);

        // Electromagnetic exciter drive housing underneath
        const driveBox = new THREE.Mesh(new THREE.BoxGeometry(320 * S, 180 * S, 260 * S), machineBodyMat);
        driveBox.position.set(-100 * S, -120 * S, 0);
        driveBox.castShadow = true;
        addEdges(driveBox, group);
        group.add(driveBox);

        // Coil isolation spring pods
        for (let sx of [-220 * S, 20 * S]) {
          for (let sz of [-120 * S, 120 * S]) {
            const spring = new THREE.Mesh(new THREE.CylinderGeometry(22 * S, 22 * S, 80 * S, 12), rollerShaftMat);
            spring.position.set(sx, -230 * S, sz);
            addEdges(spring, group);
            group.add(spring);
          }
        }
      }

      // -----------------------------------------------------------
      // 3. 14-HEAD MULTI-HEAD COMBINATION WEIGHER (asm-001) [MODIFIED #1]
      // -----------------------------------------------------------
      else if (item.assemblyRefId === 'asm-001') {
        const towerH = 1450 * S;
        const ringRadius = 580 * S;
        const weigherChuteOutlet = weigherModified ? (450 / 2) * S : (300 / 2) * S;
        const chuteAngleHeight = weigherModified ? 480 * S : 380 * S;

        // Central support column & electronics housing
        const centerCol = new THREE.Mesh(new THREE.CylinderGeometry(220 * S, 260 * S, 400 * S, 24), stainlessBrightMat);
        centerCol.position.set(0, 700 * S, 0);
        addEdges(centerCol, group);
        group.add(centerCol);

        // Top central produce dispersion cone
        const topCone = new THREE.Mesh(new THREE.ConeGeometry(240 * S, 140 * S, 24), stainlessBrightMat);
        topCone.position.set(0, 950 * S, 0);
        addEdges(topCone, group);
        group.add(topCone);

        // 14 Radial Feed Troughs & Weigh Buckets arranged in a circle
        const bucketCount = 14;
        for (let b = 0; b < bucketCount; b++) {
          const angle = (b / bucketCount) * Math.PI * 2;
          const bx = Math.cos(angle) * ringRadius;
          const bz = Math.sin(angle) * ringRadius;

          // Upper pool hopper bucket
          const poolBucket = new THREE.Mesh(new THREE.BoxGeometry(110 * S, 140 * S, 120 * S), stainlessBrightMat);
          poolBucket.position.set(bx * 0.85, 780 * S, bz * 0.85);
          poolBucket.rotation.y = -angle;
          poolBucket.castShadow = true;
          addEdges(poolBucket, group);
          group.add(poolBucket);

          // Lower weigh hopper bucket
          const weighBucket = new THREE.Mesh(new THREE.BoxGeometry(125 * S, 160 * S, 130 * S), stainlessBrightMat);
          weighBucket.position.set(bx, 560 * S, bz);
          weighBucket.rotation.y = -angle;
          weighBucket.castShadow = true;
          addEdges(weighBucket, group);
          group.add(weighBucket);

          // Radial feeder tray connecting center cone to pool bucket
          const feedTray = new THREE.Mesh(new THREE.BoxGeometry(180 * S, 25 * S, 70 * S), stainlessBrightMat);
          feedTray.position.set(bx * 0.5, 870 * S, bz * 0.5);
          feedTray.rotation.y = -angle;
          group.add(feedTray);
        }

        // Underneath: Large Conical Collector Discharge Funnel Chute (Parametric Modification!)
        // Top funnel radius = ringRadius * 0.95; bottom discharge neck = weigherChuteOutlet
        const funnel = new THREE.Mesh(
          new THREE.CylinderGeometry(ringRadius * 0.95, weigherChuteOutlet, chuteAngleHeight, 32, 1, true),
          stainlessDimpledMat
        );
        funnel.position.set(0, 320 * S, 0);
        funnel.castShadow = true;
        addEdges(funnel, group);
        group.add(funnel);

        // Bottom discharge outlet spout (cylindrical collar directly entering bagger forming tube)
        const spout = new THREE.Mesh(
          new THREE.CylinderGeometry(weigherChuteOutlet, weigherChuteOutlet, 100 * S, 32),
          stainlessDimpledMat
        );
        spout.position.set(0, 320 * S - chuteAngleHeight / 2 - 50 * S, 0);
        addEdges(spout, group);
        group.add(spout);

        // Circular mounting flange ring
        const mountRing = new THREE.Mesh(new THREE.TorusGeometry(ringRadius * 0.96, 18 * S, 12, 32), stainlessBrightMat);
        mountRing.rotation.x = Math.PI / 2;
        mountRing.position.set(0, 320 * S + chuteAngleHeight / 2, 0);
        addEdges(mountRing, group);
        group.add(mountRing);
      }

      // -----------------------------------------------------------
      // 4. VERTICAL FORM-FILL-SEAL (VFFS) BAGGING MACHINE TOWER (asm-002) [MODIFIED #2]
      // -----------------------------------------------------------
      else if (item.assemblyRefId === 'asm-002') {
        const collarDiameter = baggerModified ? (192 / 2) * S : (128 / 2) * S; // Extended for 600mm pouches
        const cabinetW = 1050 * S;
        const cabinetD = 1000 * S;
        const cabinetH = 1850 * S;

        // Main stainless enclosure tower
        const cabinet = new THREE.Mesh(new THREE.BoxGeometry(cabinetW, cabinetH, cabinetD), machineBodyMat);
        cabinet.position.set(0, cabinetH / 2, 0);
        cabinet.castShadow = true;
        cabinet.receiveShadow = true;
        addEdges(cabinet, group);
        group.add(cabinet);

        // Front recessed forming chamber
        const chamber = new THREE.Mesh(new THREE.BoxGeometry(cabinetW * 0.8, cabinetH * 0.65, cabinetD * 0.45), stainlessBrightMat);
        chamber.position.set(0, cabinetH * 0.52, cabinetD * 0.35);
        addEdges(chamber, group);
        group.add(chamber);

        // Vertical forming tube (receives product dropped from multi-head weigher chute)
        const formingTube = new THREE.Mesh(
          new THREE.CylinderGeometry(collarDiameter, collarDiameter, 800 * S, 32),
          stainlessBrightMat
        );
        formingTube.position.set(0, 1150 * S, cabinetD * 0.35);
        addEdges(formingTube, group);
        group.add(formingTube);

        // Flared forming collar shoulder at top of tube
        const shoulder = new THREE.Mesh(
          new THREE.ConeGeometry(collarDiameter * 2.2, 180 * S, 24),
          stainlessBrightMat
        );
        shoulder.rotation.x = Math.PI;
        shoulder.position.set(0, 1550 * S, cabinetD * 0.35);
        addEdges(shoulder, group);
        group.add(shoulder);

        // Left & right film pull-down vacuum belts on sides of forming tube
        const pullBeltL = new THREE.Mesh(new THREE.BoxGeometry(22 * S, 320 * S, 40 * S), conveyorBeltMat);
        pullBeltL.position.set(-collarDiameter - 18 * S, 1100 * S, cabinetD * 0.35);
        addEdges(pullBeltL, group);
        group.add(pullBeltL);

        const pullBeltR = new THREE.Mesh(new THREE.BoxGeometry(22 * S, 320 * S, 40 * S), conveyorBeltMat);
        pullBeltR.position.set(collarDiameter + 18 * S, 1100 * S, cabinetD * 0.35);
        addEdges(pullBeltR, group);
        group.add(pullBeltR);

        // Film roll spindle backstand at rear
        const filmRoll = new THREE.Mesh(new THREE.CylinderGeometry(200 * S, 200 * S, 650 * S, 24), rollerShaftMat);
        filmRoll.rotation.x = Math.PI / 2;
        filmRoll.position.set(0, 1100 * S, -cabinetD * 0.55);
        addEdges(filmRoll, group);
        group.add(filmRoll);

        // Operator Touchscreen HMI on articulating arm
        const hmiArm = new THREE.Mesh(new THREE.CylinderGeometry(15 * S, 15 * S, 350 * S, 12), machineBodyMat);
        hmiArm.rotation.z = Math.PI / 3;
        hmiArm.position.set(cabinetW * 0.5 + 120 * S, 1300 * S, cabinetD * 0.3);
        group.add(hmiArm);

        const hmiPanel = new THREE.Mesh(new THREE.BoxGeometry(250 * S, 180 * S, 35 * S), machineBodyMat);
        hmiPanel.position.set(cabinetW * 0.5 + 240 * S, 1420 * S, cabinetD * 0.3);
        addEdges(hmiPanel, group);
        group.add(hmiPanel);

        const hmiScreen = new THREE.Mesh(new THREE.PlaneGeometry(210 * S, 140 * S), conveyorBeltMat);
        hmiScreen.position.set(cabinetW * 0.5 + 240 * S, 1420 * S, cabinetD * 0.3 + 19 * S);
        group.add(hmiScreen);
      }

      // -----------------------------------------------------------
      // 5. THERMAL TRANSFER DATE CODER MOUNT (asm-005)
      // -----------------------------------------------------------
      else if (item.assemblyRefId === 'asm-005') {
        // TTO printer mount arm & precision slide
        const arm = new THREE.Mesh(new THREE.BoxGeometry(280 * S, 30 * S, 30 * S), machineBodyMat);
        arm.position.set(0, 0, 0);
        addEdges(arm, group);
        group.add(arm);

        // TTO Printhead Cassette Box
        const ttoBox = new THREE.Mesh(new THREE.BoxGeometry(160 * S, 140 * S, 110 * S), stainlessBrightMat);
        ttoBox.position.set(80 * S, -40 * S, 0);
        addEdges(ttoBox, group);
        group.add(ttoBox);

        // Ribbon roll cassette
        const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(35 * S, 35 * S, 70 * S, 16), safetyYellowMat);
        ribbon.position.set(80 * S, -40 * S, 60 * S);
        group.add(ribbon);
      }

      // -----------------------------------------------------------
      // 6. ROTARY SERVO SEALING & CUT-OFF JAWS (asm-006)
      // -----------------------------------------------------------
      else if (item.assemblyRefId === 'asm-006') {
        const jawSpan = baggerModified ? 650 * S : 480 * S; // Extended span for 600mm bags

        // Main horizontal servo carriage frame
        const carriage = new THREE.Mesh(new THREE.BoxGeometry(jawSpan + 100 * S, 160 * S, 180 * S), machineBodyMat);
        carriage.position.set(0, 0, 0);
        carriage.castShadow = true;
        addEdges(carriage, group);
        group.add(carriage);

        // Front heated horizontal seal bar
        const jawFront = new THREE.Mesh(new THREE.BoxGeometry(jawSpan, 45 * S, 30 * S), stainlessBrightMat);
        jawFront.position.set(0, 0, 70 * S);
        addEdges(jawFront, group);
        group.add(jawFront);

        // Rear heated horizontal seal bar
        const jawRear = new THREE.Mesh(new THREE.BoxGeometry(jawSpan, 45 * S, 30 * S), stainlessBrightMat);
        jawRear.position.set(0, 0, -70 * S);
        addEdges(jawRear, group);
        group.add(jawRear);

        // Twin brushless servo drive motors on carriage sides
        const sMotor1 = new THREE.Mesh(new THREE.CylinderGeometry(55 * S, 55 * S, 160 * S, 16), motorDriveMat);
        sMotor1.rotation.z = Math.PI / 2;
        sMotor1.position.set(-jawSpan / 2 - 100 * S, 0, 0);
        addEdges(sMotor1, group);
        group.add(sMotor1);

        const sMotor2 = new THREE.Mesh(new THREE.CylinderGeometry(55 * S, 55 * S, 160 * S, 16), motorDriveMat);
        sMotor2.rotation.z = Math.PI / 2;
        sMotor2.position.set(jawSpan / 2 + 100 * S, 0, 0);
        addEdges(sMotor2, group);
        group.add(sMotor2);
      }

      // -----------------------------------------------------------
      // 7. TAKEAWAY BAG INCLINE CONVEYOR (asm-007)
      // -----------------------------------------------------------
      else if (item.assemblyRefId === 'asm-007') {
        const cLen = 1750 * S;
        const cWidth = 460 * S;
        const cAngle = 0.28; // ~16 deg upward incline

        // Low infeed catching finished falling bags under jaw
        const cBed = new THREE.Mesh(new THREE.BoxGeometry(cLen, 80 * S, cWidth), machineBodyMat);
        cBed.rotation.z = cAngle;
        cBed.position.set(cLen * Math.cos(cAngle) / 2, cLen * Math.sin(cAngle) / 2 + 150 * S, 0);
        cBed.castShadow = true;
        addEdges(cBed, group);
        group.add(cBed);

        // Rough-top PVC belt surface
        const cBelt = new THREE.Mesh(new THREE.BoxGeometry(cLen, 12 * S, cWidth - 40 * S), conveyorBeltMat);
        cBelt.rotation.z = cAngle;
        cBelt.position.set(cLen * Math.cos(cAngle) / 2, cLen * Math.sin(cAngle) / 2 + 195 * S, 0);
        addEdges(cBelt, group);
        group.add(cBelt);

        // Stainless side guide rails to keep pouches centered
        const railL = new THREE.Mesh(new THREE.BoxGeometry(cLen, 70 * S, 10 * S), stainlessBrightMat);
        railL.rotation.z = cAngle;
        railL.position.set(cLen * Math.cos(cAngle) / 2, cLen * Math.sin(cAngle) / 2 + 230 * S, -cWidth / 2);
        addEdges(railL, group);
        group.add(railL);

        const railR = new THREE.Mesh(new THREE.BoxGeometry(cLen, 70 * S, 10 * S), stainlessBrightMat);
        railR.rotation.z = cAngle;
        railR.position.set(cLen * Math.cos(cAngle) / 2, cLen * Math.sin(cAngle) / 2 + 230 * S, cWidth / 2);
        addEdges(railR, group);
        group.add(railR);

        // Support tripod legs
        const sLeg = new THREE.Mesh(new THREE.CylinderGeometry(20 * S, 20 * S, 650 * S, 12), stainlessBrightMat);
        sLeg.position.set(cLen * Math.cos(cAngle) - 100 * S, 325 * S, 0);
        addEdges(sLeg, group);
        group.add(sLeg);
      }

      // -----------------------------------------------------------
      // 8. DYNAMIC INLINE CHECKWEIGHER (asm-008)
      // -----------------------------------------------------------
      else if (item.assemblyRefId === 'asm-008') {
        const frameW = 1100 * S;
        const frameD = 580 * S;
        const height = 950 * S;

        // Base stainless tubular table frame
        const tableBase = new THREE.Mesh(new THREE.BoxGeometry(frameW, 60 * S, frameD), machineBodyMat);
        tableBase.position.set(0, height, 0);
        tableBase.castShadow = true;
        addEdges(tableBase, group);
        group.add(tableBase);

        // 4 Support Legs
        for (let lx of [-frameW / 2 + 60 * S, frameW / 2 - 60 * S]) {
          for (let lz of [-frameD / 2 + 60 * S, frameD / 2 - 60 * S]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(25 * S, 25 * S, height, 16), stainlessBrightMat);
            leg.position.set(lx, height / 2, lz);
            addEdges(leg, group);
            group.add(leg);
          }
        }

        // 3 Inline Conveyor Belts: Infeed, Weigh Bed, Outfeed
        const beltW = frameD - 120 * S;
        for (let b = 0; b < 3; b++) {
          const bx = -frameW * 0.32 + b * (frameW * 0.32);
          const seg = new THREE.Mesh(new THREE.BoxGeometry(260 * S, 30 * S, beltW), conveyorBeltMat);
          seg.position.set(bx, height + 45 * S, 0);
          addEdges(seg, group);
          group.add(seg);
        }

        // Pneumatic reject flipper paddle arm on outfeed
        const flipper = new THREE.Mesh(new THREE.BoxGeometry(220 * S, 60 * S, 15 * S), safetyYellowMat);
        flipper.rotation.y = Math.PI / 4;
        flipper.position.set(frameW * 0.28, height + 90 * S, beltW * 0.3);
        addEdges(flipper, group);
        group.add(flipper);

        // Reject slide bin on side
        const rejectBin = new THREE.Mesh(new THREE.BoxGeometry(320 * S, 240 * S, 260 * S), stainlessBrightMat);
        rejectBin.position.set(frameW * 0.25, height - 120 * S, frameD / 2 + 150 * S);
        addEdges(rejectBin, group);
        group.add(rejectBin);

        // Touchscreen Controller Terminal on upright mast
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(18 * S, 18 * S, 450 * S, 12), stainlessBrightMat);
        mast.position.set(-frameW * 0.35, height + 225 * S, -frameD / 2);
        group.add(mast);

        const terminal = new THREE.Mesh(new THREE.BoxGeometry(220 * S, 160 * S, 30 * S), machineBodyMat);
        terminal.position.set(-frameW * 0.35, height + 450 * S, -frameD / 2);
        addEdges(terminal, group);
        group.add(terminal);
      }

      // -----------------------------------------------------------
      // 9. ROTARY PACK-OFF TURNTABLE (asm-009)
      // -----------------------------------------------------------
      else if (item.assemblyRefId === 'asm-009') {
        const discR = 600 * S; // Ø1200 mm Disc
        const discH = 40 * S;
        const tableY = 900 * S;

        // Rotating stainless concave disc turntable
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(discR, discR, discH, 48), stainlessBrightMat);
        disc.position.set(0, tableY, 0);
        disc.castShadow = true;
        addEdges(disc, group);
        group.add(disc);

        // Raised outer rim protective bumper
        const rim = new THREE.Mesh(new THREE.TorusGeometry(discR, 18 * S, 16, 48), machineBodyMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(0, tableY + 20 * S, 0);
        addEdges(rim, group);
        group.add(rim);

        // Central stationary product diverter guide blade
        const guide = new THREE.Mesh(new THREE.BoxGeometry(discR * 1.4, 60 * S, 12 * S), stainlessBrightMat);
        guide.rotation.y = Math.PI / 4;
        guide.position.set(0, tableY + 50 * S, 0);
        addEdges(guide, group);
        group.add(guide);

        // Heavy central pedestal column & motorized base
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(140 * S, 180 * S, tableY, 24), machineBodyMat);
        pedestal.position.set(0, tableY / 2, 0);
        pedestal.castShadow = true;
        addEdges(pedestal, group);
        group.add(pedestal);

        // 4 Flared floor outrigger feet
        const feet = new THREE.Mesh(new THREE.CylinderGeometry(360 * S, 400 * S, 30 * S, 4), machineBodyMat);
        feet.rotation.y = Math.PI / 4;
        feet.position.set(0, 15 * S, 0);
        addEdges(feet, group);
        group.add(feet);
      }

      // -----------------------------------------------------------
      // 10. INTERLOCKED LEXAN SAFETY GUARDING CELL (asm-010)
      // -----------------------------------------------------------
      else if (item.assemblyRefId === 'asm-010') {
        const guardW = 1600 * S;
        const guardD = 1450 * S;
        const guardH = 2100 * S;

        // Aluminum Extrusion Corner Posts (4 corner uprights)
        const postGeo = new THREE.BoxGeometry(45 * S, guardH, 45 * S);
        for (let px of [-guardW / 2, guardW / 2]) {
          for (let pz of [-guardD / 2, guardD / 2]) {
            const post = new THREE.Mesh(postGeo, rollerShaftMat);
            post.position.set(px, guardH / 2, pz);
            addEdges(post, group);
            group.add(post);
          }
        }

        // Top horizontal perimeter header rails
        const railTopX1 = new THREE.Mesh(new THREE.BoxGeometry(guardW, 45 * S, 45 * S), rollerShaftMat);
        railTopX1.position.set(0, guardH, -guardD / 2);
        group.add(railTopX1);

        const railTopX2 = new THREE.Mesh(new THREE.BoxGeometry(guardW, 45 * S, 45 * S), rollerShaftMat);
        railTopX2.position.set(0, guardH, guardD / 2);
        group.add(railTopX2);

        // Transparent Lexan Polycarbonate Panels (Left, Right, Rear)
        const panelLeft = new THREE.Mesh(new THREE.BoxGeometry(10 * S, guardH * 0.8, guardD - 60 * S), lexanGlassMat);
        panelLeft.position.set(-guardW / 2, guardH * 0.5, 0);
        group.add(panelLeft);

        const panelRight = new THREE.Mesh(new THREE.BoxGeometry(10 * S, guardH * 0.8, guardD - 60 * S), lexanGlassMat);
        panelRight.position.set(guardW / 2, guardH * 0.5, 0);
        group.add(panelRight);

        // Front Interlocked Operator Access Door with Safety Handle
        const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(guardW - 80 * S, guardH * 0.78, 12 * S), lexanGlassMat);
        doorPanel.position.set(0, guardH * 0.5, guardD / 2);
        group.add(doorPanel);

        // High-visibility yellow safety interlock RFID switch handle
        const handle = new THREE.Mesh(new THREE.BoxGeometry(30 * S, 140 * S, 50 * S), safetyYellowMat);
        handle.position.set(guardW * 0.35, 1050 * S, guardD / 2 + 35 * S);
        addEdges(handle, group);
        group.add(handle);
      }

      scene.add(group);
      componentMeshesRef.current.set(item.id, group);
    });
  }, [items, displayStyle, explodeFactor, weigherModified, baggerModified]);

  // Handle Selection & Hover Highlights
  useEffect(() => {
    componentMeshesRef.current.forEach((group, id) => {
      const isSelected = id === selectedItemId;
      const isHovered = id === hoveredItemId;

      group.traverse(obj => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
          if (isSelected) {
            obj.material.emissive.setHex(0x315D78); // SolidWorks selection blue highlight
            obj.material.emissiveIntensity = 0.55;
          } else if (isHovered) {
            obj.material.emissive.setHex(0x4A6572);
            obj.material.emissiveIntensity = 0.28;
          } else {
            obj.material.emissive.setHex(0x000000);
            obj.material.emissiveIntensity = 0.0;
          }
        }
      });
    });
  }, [selectedItemId, hoveredItemId]);

  // Raycasting Click / Selection Handler
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = mountRef.current;
    if (!container || !cameraRef.current || !sceneRef.current) return;

    const rect = container.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    const meshes: THREE.Mesh[] = [];
    componentMeshesRef.current.forEach(group => {
      group.traverse(obj => {
        if (obj instanceof THREE.Mesh) meshes.push(obj);
      });
    });

    const intersects = raycasterRef.current.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      let curr: THREE.Object3D | null = intersects[0].object;
      while (curr && curr.parent && curr.parent !== sceneRef.current) {
        if (curr.userData && curr.userData.itemId) {
          onSelectItem(curr.userData.itemId);
          return;
        }
        curr = curr.parent;
      }
      if (curr && curr.userData && curr.userData.itemId) {
        onSelectItem(curr.userData.itemId);
      }
    }
  };

  // Hover detection
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = mountRef.current;
    if (!container || !cameraRef.current || !sceneRef.current) return;

    const rect = container.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    const meshes: THREE.Mesh[] = [];
    componentMeshesRef.current.forEach(group => {
      group.traverse(obj => {
        if (obj instanceof THREE.Mesh) meshes.push(obj);
      });
    });

    const intersects = raycasterRef.current.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      let curr: THREE.Object3D | null = intersects[0].object;
      while (curr && curr.parent && curr.parent !== sceneRef.current) {
        if (curr.userData && curr.userData.itemId) {
          setHoveredItemId(curr.userData.itemId);
          return;
        }
        curr = curr.parent;
      }
      if (curr && curr.userData && curr.userData.itemId) {
        setHoveredItemId(curr.userData.itemId);
      }
    } else {
      setHoveredItemId(null);
    }
  };

  // Preset Views (SolidWorks standard views)
  const setPresetView = (view: 'iso' | 'front' | 'top' | 'right') => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    setCameraView(view);
    if (view === 'iso') {
      camera.position.set(7.8, 5.2, 8.8);
      controls.target.set(1.2, 1.8, 0);
    } else if (view === 'front') {
      camera.position.set(1.2, 2.0, 11);
      controls.target.set(1.2, 1.8, 0);
    } else if (view === 'top') {
      camera.position.set(1.2, 12, 0.01);
      controls.target.set(1.2, 0, 0);
    } else if (view === 'right') {
      camera.position.set(12, 2.0, 0);
      controls.target.set(1.2, 1.8, 0);
    }
    controls.update();
  };

  const selectedItem = items.find(i => i.id === selectedItemId);
  const hoveredItem = items.find(i => i.id === hoveredItemId);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#1C2128] overflow-hidden select-none border border-[#2D3A47] rounded">
      {/* Top Viewport Toolbar */}
      <div className="h-10 px-3 bg-[#242C35] border-b border-[#2D3A47] flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-1 bg-[#1A2027] border border-[#3A4756] rounded text-[11px] text-[#C9D1D9]">
            <Compass size={13} className="text-[#58A6FF]" />
            <span>Orientation:</span>
            <button
              onClick={() => setPresetView('iso')}
              className={cn('px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-colors', cameraView === 'iso' ? 'bg-[#315D78] text-white' : 'hover:bg-[#2D3A47] text-[#8B949E]')}
            >
              Isometric
            </button>
            <button
              onClick={() => setPresetView('front')}
              className={cn('px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-colors', cameraView === 'front' ? 'bg-[#315D78] text-white' : 'hover:bg-[#2D3A47] text-[#8B949E]')}
            >
              Elevation Flow
            </button>
            <button
              onClick={() => setPresetView('top')}
              className={cn('px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-colors', cameraView === 'top' ? 'bg-[#315D78] text-white' : 'hover:bg-[#2D3A47] text-[#8B949E]')}
            >
              Plan Layout
            </button>
            <button
              onClick={() => setPresetView('right')}
              className={cn('px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-colors', cameraView === 'right' ? 'bg-[#315D78] text-white' : 'hover:bg-[#2D3A47] text-[#8B949E]')}
            >
              End View
            </button>
          </div>

          {/* Render Mode Switcher */}
          <div className="flex items-center rounded bg-[#1A2027] border border-[#3A4756] p-0.5 text-[11px]">
            <button
              onClick={() => setDisplayStyle('shadedEdges')}
              className={cn('px-2 py-0.5 rounded font-medium transition-colors', displayStyle === 'shadedEdges' ? 'bg-[#315D78] text-white' : 'text-[#8B949E] hover:text-white')}
              title="Shaded with Edges (SolidWorks Standard)"
            >
              Shaded + Edges
            </button>
            <button
              onClick={() => setDisplayStyle('shaded')}
              className={cn('px-2 py-0.5 rounded font-medium transition-colors', displayStyle === 'shaded' ? 'bg-[#315D78] text-white' : 'text-[#8B949E] hover:text-white')}
              title="Shaded Realistic View"
            >
              Shaded
            </button>
            <button
              onClick={() => setDisplayStyle('wireframe')}
              className={cn('px-2 py-0.5 rounded font-medium transition-colors', displayStyle === 'wireframe' ? 'bg-[#315D78] text-white' : 'text-[#8B949E] hover:text-white')}
              title="Wireframe Mesh"
            >
              Wireframe
            </button>
          </div>
        </div>

        {/* Exploded View Control */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-[#1A2027] border border-[#3A4756] rounded text-[11px] text-[#C9D1D9]">
            <Sliders size={12} className="text-[#58A6FF]" />
            <span>Exploded View:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={explodeFactor}
              onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
              className="w-24 h-1.5 bg-[#2D3A47] rounded-lg appearance-none cursor-pointer accent-[#58A6FF]"
            />
            <span className="font-mono text-[10px] w-7 text-right">{Math.round(explodeFactor * 100)}%</span>
            {explodeFactor > 0 && (
              <button
                onClick={() => setExplodeFactor(0)}
                className="text-[#8B949E] hover:text-white ml-0.5"
                title="Collapse Assembly"
              >
                <RotateCcw size={11} />
              </button>
            )}
          </div>

          <div className="text-[10.5px] font-mono text-[#8B949E] border-l border-[#3A4756] pl-2.5">
            10 Assemblies • 100% Resolved
          </div>
        </div>
      </div>

      {/* Main 3D WebGL Canvas */}
      <div
        ref={mountRef}
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing outline-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      />

      {/* Bottom Floating Info Overlays */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1.5 pointer-events-none z-10">
        {selectedItem ? (
          <div className="p-2.5 bg-[#1C2128]/95 border border-[#315D78] rounded shadow-lg backdrop-blur-xs text-[#E6EDF3] text-[11.5px] flex items-center gap-3 pointer-events-auto">
            <div className="w-2.5 h-2.5 rounded-full bg-[#58A6FF] animate-pulse" />
            <div>
              <div className="font-mono font-bold text-[#58A6FF] flex items-center gap-2">
                <span>{selectedItem.partNumber}</span>
                <span className={cn(
                  'text-[9px] px-1.5 py-0.2 rounded font-sans uppercase font-bold tracking-wider',
                  selectedItem.category === 'modified' ? 'bg-[#92400E] text-[#FEF3C7]' : 'bg-[#14532D] text-[#BBF7D0]'
                )}>
                  {selectedItem.category === 'modified' ? 'Modified Candidate' : 'Standard Reuse'}
                </span>
              </div>
              <div className="text-[11px] text-[#8B949E] mt-0.5">{selectedItem.description}</div>
              <div className="text-[10px] font-mono text-[#7D8590] mt-0.5">
                Pos: [{selectedItem.position.x}, {selectedItem.position.y}, {selectedItem.position.z}] mm • {selectedItem.massKg} kg
              </div>
            </div>
          </div>
        ) : hoveredItem ? (
          <div className="p-2 bg-[#1C2128]/90 border border-[#3A4756] rounded text-[#C9D1D9] text-[11px] flex items-center gap-2 backdrop-blur-xs">
            <Box size={13} className="text-[#8B949E]" />
            <span className="font-mono font-bold text-[#58A6FF]">{hoveredItem.partNumber}</span>
            <span className="text-[#8B949E]">— Click to Inspect Spatial Mates</span>
          </div>
        ) : (
          <div className="p-1.5 px-2.5 bg-[#1C2128]/80 border border-[#2D3A47] rounded text-[#8B949E] text-[10.5px] backdrop-blur-xs flex items-center gap-2">
            <Move3d size={12} className="text-[#58A6FF]" />
            <span>Click any machine in 3D viewport to inspect mates, coordinates and CAD modifications</span>
          </div>
        )}
      </div>

      {/* Legend Card in Top Right */}
      <div className="absolute top-12 right-3 p-2.5 bg-[#161B22]/90 border border-[#30363D] rounded shadow-md text-[10.5px] text-[#8B949E] space-y-1 z-10 backdrop-blur-xs">
        <div className="text-[#C9D1D9] font-bold text-[11px] pb-1 border-b border-[#30363D] flex items-center justify-between gap-3">
          <span>Main Assembly Legend</span>
          <span className="text-[9.5px] font-mono text-[#58A6FF]">10 Candidates</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#238636]" />
          <span>8 Standard Reuse Candidates (100% Matched)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#D29922]" />
          <span>2 Modified Candidates (Parametric Rebuild)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#58A6FF]" />
          <span>Selected Component / Mating Surface</span>
        </div>
      </div>
    </div>
  );
}
