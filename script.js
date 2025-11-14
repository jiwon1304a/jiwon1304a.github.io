// directional, spot, point light 이외에도 hemisphere, area light 등이 있음

import * as THREE from 'three';  
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { initStats, initRenderer, initCamera, initOrbitControls, addHouseAndTree } from './util.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();

const stats = initStats();
const renderer = initRenderer();
let camera = initCamera();
// let camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100000);

// let orbitControls = initOrbitControls(camera, renderer);

let orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;

const clock = new THREE.Clock();

// 행성 정보를 담은 클래스
class Planet {
  constructor(name, radius, distance, color, texture, rotationSpeed, orbitSpeed) {
    this.name = name;
    this.radius = radius;
    this.distance = distance;
    this.color = color;
    this.texture = texture;
    this.rotationSpeed = rotationSpeed; // 자전 속도
    this.orbitSpeed = orbitSpeed; // 공전 속도
    this.angle = Math.random() * Math.PI * 2; // 초기 각도 설정

    const geometry = new THREE.SphereGeometry(this.radius, 32, 32);

    const loader = new THREE.TextureLoader();
    let map = null;
    if (this.texture) {
      map = loader.load(this.texture);
      // map.encoding = THREE.sRGBEncoding;
    }

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.color || 0xffffff), // 예: 0x88aaff 또는 "#88aaff"
      map: map
    });

    if (this.name === 'Sun') {
      material.emissive = new THREE.Color(this.color || 0xffffff);
      material.emissiveIntensity = 1.5;
    }

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.x = this.distance;
    scene.add(this.mesh);
  }

  update(deltaTime) {
    // 자전
    this.mesh.rotation.y += this.rotationSpeed * deltaTime;

    // 공전
    this.angle += this.orbitSpeed * deltaTime;
    this.mesh.position.x = this.distance * Math.cos(this.angle);
    this.mesh.position.z = this.distance * Math.sin(this.angle);
  }
}

// 렌더링 변수들


// 행성
let sun = new Planet('Sun', 10, 0, 0xffff00, null, 0.0005, 0);
let mercury = new Planet('Mercury', 1.5, 20, 0xa6a6a6, './Mercury.jpg', 0.02, 0.02);
let venus = new Planet('Venus', 3, 35, 0xe39e1c, './Venus.jpg', 0.015, 0.015);
let earth = new Planet('Earth', 3.5, 50, 0x3498db, './Earth.jpg', 0.01, 0.01);
let mars = new Planet('Mars', 2.5, 65, 0xc0392b, './Mars.jpg', 0.008, 0.008);




// add a simple scene
// addHouseAndTree(scene)

// add subtle ambient lighting
const ambientLight = new THREE.AmbientLight("#FFFFFF");
scene.add(ambientLight);

// add a directional light
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
directionalLight.position.set(10, 20, 20);
scene.add(directionalLight);

// add a point light
const pointColor = "#FFFFFF";
const pointIntensity = 100;
const pointDecay = 200;
const pointLight = new THREE.PointLight(pointColor, pointIntensity, 0, pointDecay);
pointLight.castShadow = true;
scene.add(pointLight);


const controls = setupControls();

render();

function render() {
  stats.update();
  orbitControls.update();

  const delta = clock.getDelta() * 300;

  sun.update(delta);
  mercury.update(delta);
  venus.update(delta);
  earth.update(delta);
  mars.update(delta);

  // render using requestAnimationFrame
  requestAnimationFrame(render);
  renderer.render(scene, camera);
}

function setupControls() {
  const controls = new function () {
    this.perspective = "Perspective";
    this.switchCamera = function () {
        if (camera instanceof THREE.PerspectiveCamera) {
            scene.remove(camera);
            camera = null; // 기존의 camera 제거    
            // OrthographicCamera(left, right, top, bottom, near, far)
            camera = new THREE.OrthographicCamera(window.innerWidth / -16, 
                window.innerWidth / 16, window.innerHeight / 16, window.innerHeight / -16, -200, 500);
            camera.position.x = 120;
            camera.position.y = 60;
            camera.position.z = 180;
            camera.lookAt(scene.position);
            orbitControls.dispose(); // 기존의 orbitControls 제거
            orbitControls = null;
            orbitControls = new OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            this.perspective = "Orthographic";
        } else {
            scene.remove(camera);
            camera = null; 
            camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.x = 120;
            camera.position.y = 60;
            camera.position.z = 180;
            camera.lookAt(scene.position);
            orbitControls.dispose(); // 기존의 orbitControls 제거
            orbitControls = null;
            orbitControls = new OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            this.perspective = "Perspective";
        }
    };

    this.mercuryRotation = mercury.rotationSpeed;
    this.venusRotation = venus.rotationSpeed;
    this.earthRotation = earth.rotationSpeed;
    this.marsRotation = mars.rotationSpeed;

    this.mercuryOrbit = mercury.orbitSpeed;
    this.venusOrbit = venus.orbitSpeed;
    this.earthOrbit = earth.orbitSpeed;
    this.marsOrbit = mars.orbitSpeed;

  };

  const gui = new GUI();

  gui.add(controls, 'switchCamera');
  gui.add(controls, 'perspective').listen();

  function addPlanetFolder(name, planet) {
    const folder = gui.addFolder(name);
    folder.add(planet, 'rotationSpeed', 0, 0.05).name('Rotation Speed');
    folder.add(planet, 'orbitSpeed', 0, 0.05).name('Orbit Speed');
    folder.open();
    return folder;
  }

  addPlanetFolder('Mercury', mercury);
  addPlanetFolder('Venus', venus);
  addPlanetFolder('Earth', earth);
  addPlanetFolder('Mars', mars);

  return controls;
}