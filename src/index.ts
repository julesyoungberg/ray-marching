import * as dat from 'dat.gui';
import * as twgl from 'twgl.js';

import Pointers from './Pointers';
import createContext from './util/createContext';
import createUnitQuad2D from './util/createUnitQuad2D';

const basicVertShader = require('./shaders/basic.vert');
// const opticalShader = require('./shaders/optical.frag');
const pseudoNoiseShader = require('./shaders/pseudoNoise.frag');
const basicCubesShader = require('./shaders/basicCubes.frag');
const reflectionShader = require('./shaders/reflection.frag');
const reflections1Shader = require('./shaders/reflections1.frag');
const reflections2Shader = require('./shaders/reflections2.frag');
const spotlightShader = require('./shaders/spotlight.frag');
const tetrahedronShader = require('./shaders/tetrahedron.frag');
const twistShader = require('./shaders/twist.frag');

const gl: WebGLRenderingContext = createContext();
const bufferInfo = createUnitQuad2D(gl);
const programs = {
    basicCubes: twgl.createProgramInfo(gl, [basicVertShader, basicCubesShader]),
    // optical: twgl.createProgramInfo(gl, [basicVertShader, opticalShader]),
    pseudoNoise: twgl.createProgramInfo(gl, [basicVertShader, pseudoNoiseShader]),
    reflection: twgl.createProgramInfo(gl, [basicVertShader, reflectionShader]),
    reflections1: twgl.createProgramInfo(gl, [basicVertShader, reflections1Shader]),
    reflections2: twgl.createProgramInfo(gl, [basicVertShader, reflections2Shader]),
    spotlight: twgl.createProgramInfo(gl, [basicVertShader, spotlightShader]),
    tetrahedron: twgl.createProgramInfo(gl, [basicVertShader, tetrahedronShader]),
    twist: twgl.createProgramInfo(gl, [basicVertShader, twistShader]),
};

const state = {
    currentProgram: 'twist',
};

const gui = new dat.GUI();
gui.add(state, 'currentProgram', Object.keys(programs));

const pointers = new Pointers(gl.canvas as HTMLCanvasElement);

function render(time: number) {
    twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const p = pointers.pointers;
    const uniforms = {
        mousePosition: [p[0].x * 2 - 1, p[0].y * 2 - 1],
        mouseVelocity: [p[0].deltaX * 2, p[0].deltaY * 2],
        resolution: [gl.canvas.width, gl.canvas.height],
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
