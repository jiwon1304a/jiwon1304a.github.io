/*-----------------------------------------------------------------------------
class SquarePyramid

바닥은 xz평면에 존재, (0,0,0)을 한 모서리로 함.
바닥 변의 길이 = 1, 높이(y) = 1.
-----------------------------------------------------------------------------*/

export class SquarePyramid {
	constructor(gl, options = {}) {
		this.gl = gl;
		
		// Creating VAO and buffers
		this.vao = gl.createVertexArray();
		this.vbo = gl.createBuffer();
		this.ebo = gl.createBuffer();

		// Vertices layout:
		// bottom 4 verts (square) + 4 side triangles (3 verts each) = 16 vertices total
		// base center at (0,0,0), base corner at (0.5,0,0.5), edge length 1, apex at (0,1,0)
            this.vertices = new Float32Array([
                // bottom (4 verts) - indices 0..3 (centered at origin)
                -0.5, 0.0, -0.5,   // 0 b0
                0.5, 0.0, -0.5,   // 1 b1
                0.5, 0.0,  0.5,   // 2 b2  <-- this is (0.5,0,0.5) corner
                -0.5, 0.0,  0.5,   // 3 b3

                // side 1: b0, b1, apex  (indices 4,5,6)
                -0.5, 0.0, -0.5,
                0.5, 0.0, -0.5,
                0.0, 1.0,  0.0,

                // side 2: b1, b2, apex (7,8,9)
                0.5, 0.0, -0.5,
                0.5, 0.0,  0.5,
                0.0, 1.0,  0.0,

                // side 3: b2, b3, apex (10,11,12)
                0.5, 0.0,  0.5,
                -0.5, 0.0,  0.5,
                0.0, 1.0,  0.0,

                // side 4: b3, b0, apex (13,14,15)
                -0.5, 0.0,  0.5,
                -0.5, 0.0, -0.5,
                0.0, 1.0,  0.0
            ]);

		// Indices: bottom (2 tris) + 4 side tris = 6 + 12 = 18 indices
		this.indices = new Uint16Array([
			// bottom (two triangles) using bottom verts 0..3
			0, 1, 2,   2, 3, 0,
			// side triangles (each uses its own 3 vertices)
			4, 5, 6,    // side1
			7, 8, 9,    // side2
			10, 11, 12, // side3
			13, 14, 15  // side4
		]);

		// 텍스좌표 (간단 매핑)
		this.texCoords = new Float32Array([
			// bottom (b0..b3)
			0, 0,   1, 0,   1, 1,   0, 1,
			// side1 tri  (b0,b1,apex)
			0, 0,   1, 0,   0.5, 1,
			// side2 tri
			0, 0,   1, 0,   0.5, 1,
			// side3 tri
			0, 0,   1, 0,   0.5, 1,
			// side4 tri
			0, 0,   1, 0,   0.5, 1
		]);

		// Colors: 기본적으로 face별 색 지정. options.color이 있으면 모든 정점에 동일 색
		const vertCount = this.vertices.length / 3; // 16
		if (options.color) {
			this.colors = new Float32Array(vertCount * 4);
			for (let i = 0; i < vertCount; ++i) {
				this.colors[i*4 + 0] = options.color[0];
				this.colors[i*4 + 1] = options.color[1];
				this.colors[i*4 + 2] = options.color[2];
				this.colors[i*4 + 3] = options.color[3];
			}
		} else {
			this.colors = new Float32Array([
				// bottom (blue)
				0,0,1,1,   0,0,1,1,   0,0,1,1,   0,0,1,1,
				// side1 (red)
				1,0,0,1,   1,0,0,1,   1,0,0,1,
				// side2 (yellow)
				1,1,0,1,   1,1,0,1,   1,1,0,1,
				// side3 (green)
				0,1,0,1,   0,1,0,1,   0,1,0,1,
				// side4 (cyan)
				0,1,1,1,   0,1,1,1,   0,1,1,1
			]);
		}

		// 법선: 각 면(바닥/각 삼각형)에 대해 면법선을 계산하여 각 해당 정점에 설정 (flat shading)
		this.normals = new Float32Array(vertCount * 3);

		// helper: get vertex by index
		const getV = (i) => {
			const base = i * 3;
			return [ this.vertices[base], this.vertices[base+1], this.vertices[base+2] ];
		};

		const computeNormal = (p0, p1, p2) => {
			const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
			const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
			let nx = uy * vz - uz * vy;
			let ny = uz * vx - ux * vz;
			let nz = ux * vy - uy * vx;
			const len = Math.hypot(nx, ny, nz) || 1;
			nx /= len; ny /= len; nz /= len;
			return [nx, ny, nz];
		};

		// bottom face normal (pointing down)
		const bottomNormal = [0, -1, 0];
		for (let i = 0; i < 4; ++i) {
			this.normals[i*3 + 0] = bottomNormal[0];
			this.normals[i*3 + 1] = bottomNormal[1];
			this.normals[i*3 + 2] = bottomNormal[2];
		}

		// side normals (triangles)
		for (let tri = 0; tri < 4; ++tri) {
			const a = 4 + tri*3;     // first vertex index of this side in vertex array
			const p0 = getV(a), p1 = getV(a+1), p2 = getV(a+2);
			const n = computeNormal(p0, p1, p2);
			for (let k = 0; k < 3; ++k) {
				const vi = a + k;
				this.normals[vi*3 + 0] = n[0];
				this.normals[vi*3 + 1] = n[1];
				this.normals[vi*3 + 2] = n[2];
			}
		}

		this.initBuffers();
	}

	copyVertexNormalsToNormals() {
		// pyramid implementation uses per-face normals stored in this.normals.
		// vertexNormals is not maintained here — keep this method as a safe no-op for API compatibility.
	}

	copyFaceNormalsToNormals() {
		// already using face normals (this.normals). no-op to avoid accessing undefined arrays.
	}

	initBuffers() {
		const gl = this.gl;

		// 버퍼 크기 계산
		const vSize = this.vertices.byteLength;
		const nSize = this.normals.byteLength;
		const cSize = this.colors.byteLength;
		const tSize = this.texCoords.byteLength;
		const totalSize = vSize + nSize + cSize + tSize;

		gl.bindVertexArray(this.vao);

		// VBO에 데이터 복사
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
		gl.bufferData(gl.ARRAY_BUFFER, totalSize, gl.STATIC_DRAW);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
		gl.bufferSubData(gl.ARRAY_BUFFER, vSize, this.normals);
		gl.bufferSubData(gl.ARRAY_BUFFER, vSize + nSize, this.colors);
		gl.bufferSubData(gl.ARRAY_BUFFER, vSize + nSize + cSize, this.texCoords);

		// EBO에 인덱스 데이터 복사
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

		// vertex attributes 설정 (positions, normals, colors, texCoords)
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);  // position
		gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, vSize);  // normal
		gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, vSize + nSize);  // color
		gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, vSize + nSize + cSize);  // texCoord

		// vertex attributes 활성화
		gl.enableVertexAttribArray(0);
		gl.enableVertexAttribArray(1);
		gl.enableVertexAttribArray(2);
		gl.enableVertexAttribArray(3);

		// 버퍼 바인딩 해제
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.bindVertexArray(null);
	}

	updateNormals() {
		const gl = this.gl;
		const vSize = this.vertices.byteLength;

		gl.bindVertexArray(this.vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
		
		// normals 데이터만 업데이트
		gl.bufferSubData(gl.ARRAY_BUFFER, vSize, this.normals);
		
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.bindVertexArray(null);
	}

	draw(shader) {
		const gl = this.gl;
		shader.use();
		gl.bindVertexArray(this.vao);
		// 인덱스 수를 동적으로 사용
		gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_SHORT, 0);
		gl.bindVertexArray(null);
	}

	delete() {
		const gl = this.gl;
		gl.deleteBuffer(this.vbo);
		gl.deleteBuffer(this.ebo);
		gl.deleteVertexArray(this.vao);
	}
}