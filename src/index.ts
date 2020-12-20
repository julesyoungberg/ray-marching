import * as dat from 'dat.gui';
import * as twgl from 'twgl.js';

import Pointers from './Pointers';
import createContext from './util/createContext';
import createUnitQuad2D from './util/createUnitQuad2D';

const basicVertShader = require('./shaders/basic.vert');
// const opticalShader = require('./shaders/optical.frag');
const basicCubesShader = require('./shaders/basicCubes.frag');
const mandelbulbShader = require('./shaders/mandelbulb.frag');
const pseudoNoiseShader = require('./shaders/pseudoNoise.frag');
const recursiveShapesShader = require('./shaders/recursiveShapes.frag');
const reflectionShader = require('./shaders/reflection.frag');
const reflections1Shader = require('./shaders/reflections1.frag');
const reflections2Shader = require('./shaders/reflections2.frag');
const spotlightShader = require('./shaders/spotlight.frag');

const gl: WebGLRenderingContext = createContext();
const bufferInfo = createUnitQuad2D(gl);
const programs = {
    basicCubes: twgl.createProgramInfo(gl, [basicVertShader, basicCubesShader]),
    // optical: twgl.createProgramInfo(gl, [basicVertShader, opticalShader]),
    mandelbulb: twgl.createProgramInfo(gl, [basicVertShader, mandelbulbShader]),
    pseudoNoise: twgl.createProgramInfo(gl, [basicVertShader, pseudoNoiseShader]),
    recursiveShapes: twgl.createProgramInfo(gl, [basicVertShader, recursiveShapesShader]),
    reflection: twgl.createProgramInfo(gl, [basicVertShader, reflectionShader]),
    reflections1: twgl.createProgramInfo(gl, [basicVertShader, reflections1Shader]),
    reflections2: twgl.createProgramInfo(gl, [basicVertShader, reflections2Shader]),
    spotlight: twgl.createProgramInfo(gl, [basicVertShader, spotlightShader]),
};

const rsBaseShapes = [
    'cube',
    'mengerSponge',
    'octahedral',
    'octahedralFull',
    'tetrahedron',
    'tetrahedronFull',
];

const state = {
    colorMode: 'solid',
    colorPalette: {
        paletteColor1: [231, 237, 235],
        paletteColor2: [0, 58, 107],
        paletteColor3: [66, 195, 247],
    },
    currentProgram: 'mandelbulb',
    floor: true,
    fogDist: 30,
    quality: 1,
    recursiveShapes: {
        baseShape: 'tetrahedron',
        centerScaleX: 1,
        centerScaleY: 1,
        centerScaleZ: 1,
        rotation1X: 90,
        rotation1Y: 90,
        rotation1Z: 0,
        rotation2X: 30,
        rotation2Y: 0,
        rotation2Z: 0,
    },
    shapeColor: [255, 255, 255],
    shapeRotationX: 35.0,
    shapeRotationY: 0,
    shapeRotationZ: 315.0,
    spin: true,
};

const urlHash = window.location.hash;
if (urlHash) {
    const name = urlHash.substr(1);
    console.log(name);
    const program = programs[name];
    if (program) {
        state.currentProgram = name;
    }
}

const gui = new dat.GUI();
gui.add(state, 'currentProgram', Object.keys(programs));

const general = gui.addFolder('general');
general.add(state, 'quality', 1, 4, 1);
general.add(state, 'floor');
general.add(state, 'fogDist', 15, 100, 1);
general.add(state, 'shapeRotationX', 0, 360);
general.add(state, 'shapeRotationY', 0, 360);
general.add(state, 'shapeRotationZ', 0, 360);
general.add(state, 'spin');

const color = gui.addFolder('color');
color.add(state, 'colorMode', ['palette', 'solid']);
color.addColor(state, 'shapeColor');
color.addColor(state.colorPalette, 'paletteColor1');
color.addColor(state.colorPalette, 'paletteColor2');
color.addColor(state.colorPalette, 'paletteColor3');

const rsCtrl = gui.addFolder('recursiveShapes');
rsCtrl.add(state.recursiveShapes, 'baseShape', rsBaseShapes);
rsCtrl.add(state.recursiveShapes, 'centerScaleX', 0.1, 1.0);
rsCtrl.add(state.recursiveShapes, 'centerScaleY', 0.1, 1.0);
rsCtrl.add(state.recursiveShapes, 'centerScaleZ', 0.1, 1.0);
rsCtrl.add(state.recursiveShapes, 'rotation1X', 0, 360);
rsCtrl.add(state.recursiveShapes, 'rotation1Y', 0, 360);
rsCtrl.add(state.recursiveShapes, 'rotation1Z', 0, 360);
rsCtrl.add(state.recursiveShapes, 'rotation2X', 0, 360);
rsCtrl.add(state.recursiveShapes, 'rotation2Y', 0, 360);
rsCtrl.add(state.recursiveShapes, 'rotation2Z', 0, 360);

const pointers = new Pointers(gl.canvas as HTMLCanvasElement);

function render(time: number) {
    twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const p = pointers.pointers;
    const uniforms = {
        colorMode: state.colorMode === 'solid' ? 0 : 1,
        drawFloor: state.floor,
        fogDist: state.fogDist,
        mousePosition: [p[0].x * 2 - 1, p[0].y * 2 - 1],
        mouseVelocity: [p[0].deltaX * 2, p[0].deltaY * 2],
        paletteColor1: state.colorPalette.paletteColor1.map(c => c / 255),
        paletteColor2: state.colorPalette.paletteColor2.map(c => c / 255),
        paletteColor3: state.colorPalette.paletteColor3.map(c => c / 255),
        quality: state.quality,
        resolution: [gl.canvas.width, gl.canvas.height],
        rsBaseShape: rsBaseShapes.indexOf(state.recursiveShapes.baseShape),
        rsCenterScale: [
            state.recursiveShapes.centerScaleX,
            state.recursiveShapes.centerScaleY,
            state.recursiveShapes.centerScaleZ,
        ],
        rsRotation1: [
            state.recursiveShapes.rotation1X,
            state.recursiveShapes.rotation1Y,
            state.recursiveShapes.rotation1Z,
        ],
        rsRotation2: [
            state.recursiveShapes.rotation2X,
            state.recursiveShapes.rotation2Y,
            state.recursiveShapes.rotation2Z,
        ],
        shapeColor: state.shapeColor.map((c) => c / 255),
        shapeRotation: [state.shapeRotationX, state.shapeRotationY, state.shapeRotationZ],
        spin: state.spin,
        time: time * 0.001,
    };

    const programInfo = programs[state.currentProgram];
    gl.useProgram(programInfo.program);
    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
    twgl.setUniforms(programInfo, uniforms);
    twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_STRIP);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);
