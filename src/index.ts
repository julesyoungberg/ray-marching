import * as twgl from 'twgl.js';

import Pointers from './Pointers';
import createContext from './util/createContext';
import createUnitQuad2D from './util/createUnitQuad2D';

const basicVertShader = require('./shaders/basic.vert');
const basicFragShader = require('./shaders/basic.frag');

const gl: WebGLRenderingContext = createContext();
const programInfo = twgl.createProgramInfo(gl, [basicVertShader, basicFragShader]);
const bufferInfo = createUnitQuad2D(gl);

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

    gl.useProgram(programInfo.program);
    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
    twgl.setUniforms(programInfo, uniforms);
    twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_STRIP);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);
