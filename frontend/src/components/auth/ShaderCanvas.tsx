"use client";

import { useEffect, useRef } from "react";

interface ShaderCanvasProps {
  variant?: "login" | "register";
  className?: string;
}

export default function ShaderCanvas({ variant = "login", className = "" }: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;
    const gl = canvas.getContext("webgl");

    // If WebGL is not available, draw a 2D subtle glowing neural particle mesh
    if (!gl) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const particles: { x: number; y: number; vx: number; vy: number; radius: number }[] = [];
      const numParticles = 30;

      const resize = () => {
        canvas.width = canvas.clientWidth || 664;
        canvas.height = canvas.clientHeight || 1024;
      };
      resize();
      window.addEventListener("resize", resize);

      for (let i = 0; i < numParticles; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 2 + 1,
        });
      }

      const draw2d = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = variant === "login" ? "rgba(173, 198, 255, 0.4)" : "rgba(208, 188, 255, 0.4)";
        ctx.strokeStyle = variant === "login" ? "rgba(173, 198, 255, 0.08)" : "rgba(208, 188, 255, 0.08)";

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();

          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }
        animationFrameId = requestAnimationFrame(draw2d);
      };
      draw2d();

      return () => {
        window.removeEventListener("resize", resize);
        cancelAnimationFrame(animationFrameId);
      };
    }

    // WebGL Shader for modern high-performance wave & neural glow effect
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_position * 0.5 + 0.5;
      }
    `;

    const isLogin = variant === "login";
    const fsSource = `
      precision mediump float;
      uniform float u_time;
      uniform vec2 u_resolution;
      varying vec2 v_texCoord;

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.35;
        
        // Fluid wave formula
        float w1 = sin(p.x * 2.5 + t) * 0.45;
        float w2 = cos(p.y * 3.0 - t * 0.8) * 0.35;
        float dist = abs(p.y - w1 + w2 * 0.3);
        
        float glow = 0.06 / (dist + 0.08);

        // Second subtle wave
        float w3 = sin(p.x * 4.0 - t * 1.2) * 0.3;
        float dist2 = abs(p.y + 0.2 - w3);
        float glow2 = 0.04 / (dist2 + 0.1);

        ${
          isLogin
            ? `
          // AuraSync Primary blue/cyan neural theme
          vec3 col1 = vec3(0.678, 0.776, 1.0); // #adc6ff
          vec3 col2 = vec3(0.302, 0.557, 1.0); // #4d8eff
          vec3 finalColor = col1 * glow + col2 * glow2 * 0.7;
          gl_FragColor = vec4(finalColor * 0.5, 0.4);
          `
            : `
          // AuraSync Tertiary purple/violet synthesis theme
          vec3 col1 = vec3(0.816, 0.737, 1.0); // #d0bcff
          vec3 col2 = vec3(0.627, 0.471, 1.0); // #a078ff
          vec3 finalColor = col1 * glow + col2 * glow2 * 0.7;
          gl_FragColor = vec4(finalColor * 0.5, 0.4);
          `
        }
      }
    `;

    const createShader = (glCtx: WebGLRenderingContext, type: number, source: string) => {
      const shader = glCtx.createShader(type);
      if (!shader) return null;
      glCtx.shaderSource(shader, source);
      glCtx.compileShader(shader);
      if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
        glCtx.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    const render = (time: number) => {
      if (!canvas) return;
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth || 664;
        canvas.height = canvas.clientHeight || 1024;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      gl.uniform1f(timeLocation, time * 0.001);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none opacity-40 ${className}`}
      width={664}
      height={1024}
    />
  );
}
