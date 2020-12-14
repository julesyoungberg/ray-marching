import * as twgl from 'twgl.js';
import createContext from './util/createContext';
import createUnitQuad2D from './util/createUnitQuad2D';

const basicVertShader = require('./shaders/basic.vert');
const basicFragShader = require('./shaders/basic.frag');

const gl: WebGLRenderingContext = createContext();
const programInfo = twgl.createProgramInfo(gl, [basicVertShader, basicFragShader]);
const bufferInfo = createUnitQuad2D(gl);

function render(time: number) {
    twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const uniforms = {
        time: time * 0.001,
        resolution: [gl.canvas.width, gl.canvas.height],
    };

    gl.useProgram(programInfo.program);
    twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
    twgl.setUniforms(programInfo, uniforms);
    twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_STRIP);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);
