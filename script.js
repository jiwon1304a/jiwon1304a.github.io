/*-------------------------------------------------------------------------
07_LineSegments.js

left mouse button을 click하면 선분을 그리기 시작하고, 
button up을 하지 않은 상태로 마우스를 움직이면 임시 선분을 그리고, 
button up을 하면 최종 선분을 저장하고 임시 선분을 삭제함.

임시 선분의 color는 회색이고, 최종 선분의 color는 빨간색임.

이 과정을 반복하여 여러 개의 선분 (line segment)을 그릴 수 있음. 
---------------------------------------------------------------------------*/
import { resizeAspectRatio, setupText, updateText, Axes } from './util/util.js';
import { Shader, readShaderFile } from './util/shader.js';

// Global variables
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let isInitialized = false;  // main이 실행되는 순간 true로 change
let shader;
let vao; // xy만 받는 vao

let positionBuffer; // 2D position을 위한 VBO (Vertex Buffer Object)
let bMouseDown = false; // mouse button을 누르고 있는 동안 true로 change
let mouseStartPos = null;  // mouse button을 누른 위치
let mouseCurrentPos = null; // mouse를 움직이는 동안의 위치

/**
 * colors
 */
const white = [1.0, 1.0, 1.0, 1.0];
const gray = [0.5, 0.5, 0.5, 1.0];
const red = [1.0, 0.0, 0.0, 1.0];
const yellow = [1.0, 1.0, 0.0, 1.0];
const magenta = [1.0, 0.0, 1.0, 1.0];
const green = [0.0, 1.0, 0.0, 1.0];
const blue = [0.0, 0.0, 1.0, 1.0];
const cyan = [0.0, 1.0, 1.0, 1.0];

/**
 * circle
 */
let bCircleDrawing = false; // mouse button 누르고 있는 동안 true
let bCircleDrawn = false; // circle이 그려진 후 true
let gCircleCenter = [0, 0];
let gCircleRadius = 1.0; // temp
const numCircleSegments = 128; // circle을 구성하는 삼각형의 개수
function getCircleVertices(center, radius) {
    const vertices = [];
    for (let i = 0; i < numCircleSegments; i++) {
        const angle = (i / numCircleSegments) * 2 * Math.PI;
        const x = center[0] + radius * Math.cos(angle);
        const y = center[1] + radius * Math.sin(angle);
        vertices.push(x);
        vertices.push(y);
    }
    return vertices;
}
function drawCircle(center, radius, color = magenta)
{
    // circle 그리기
    shader.setVec4("u_color", color); // circle color는 white
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(getCircleVertices(center, radius)),
    // gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 0.3,-0.2]),
                    gl.STATIC_DRAW);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.LINE_LOOP, 0, numCircleSegments);
}

/**
 * line segment
 */
let bLineDrawn = false;
let bLineDrawing = false;
let gLineStart = [0, 0];
let gLineEnd = [0, 0];
function getLineVertices(start, end) {
    return [...start, ...end];
}
function drawLine(start, end, color = cyan) 
{
    shader.setVec4("u_color", color); // 임시 선분의 color는 회색
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...start, ...end]), 
                    gl.STATIC_DRAW);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.LINES, 0, 2);
}

/**
 * intersection points
 */
let intersectionPoints = [];
function computeLineCircleIntersections(lineStart, lineEnd, circleCenter, circleRadius) {
    const dx = lineEnd[0] - lineStart[0];
    const dy = lineEnd[1] - lineStart[1];
    const fx = lineStart[0] - circleCenter[0];
    const fy = lineStart[1] - circleCenter[1];

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - circleRadius * circleRadius;

    const discriminant = b * b - 4 * a * c;
    intersectionPoints = [];

    if (discriminant >= 0) {
        const sqrtDiscriminant = Math.sqrt(discriminant);
        const t1 = (-b - sqrtDiscriminant) / (2 * a);
        const t2 = (-b + sqrtDiscriminant) / (2 * a);

        if (t1 >= 0 && t1 <= 1) {
            intersectionPoints.push([lineStart[0] + t1 * dx, lineStart[1] + t1 * dy]);
        }
        if (t2 >= 0 && t2 <= 1) {
            intersectionPoints.push([lineStart[0] + t2 * dx, lineStart[1] + t2 * dy]);
        }
    }
    return intersectionPoints;
}
function drawPoint(point, color = yellow) {
    shader.setVec4("u_color", color); // intersection point color는 yellow
    const size = 10.0; // point 크기
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(point), gl.STATIC_DRAW);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.POINTS, 0, 1);
}


let lines = []; // 그려진 선분들을 저장하는 array
let text1; // 1st line segment 정보 표시
let text2; // 2nd line segment 정보 표시
let text3;
let axes = new Axes(gl, 0.85); // x, y axes 그려주는 object (see util.js)

// DOMContentLoaded event
// 1) 모든 HTML 문서가 완전히 load되고 parsing된 후 발생
// 2) 모든 resource (images, css, js 등) 가 완전히 load된 후 발생
// 3) 모든 DOM 요소가 생성된 후 발생
// DOM: Document Object Model로 HTML의 tree 구조로 표현되는 object model 
// 모든 code를 이 listener 안에 넣는 것은 mouse click event를 원활하게 처리하기 위해서임
// mouse input을 사용할 때 이와 같이 main을 call 한다. 

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) { // true인 경우는 main이 이미 실행되었다는 뜻이므로 다시 실행하지 않음
        console.log("Already initialized");
        return;
    }

    main().then(success => { // call main function
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
    });
});

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 700;
    canvas.height = 700;

    resizeAspectRatio(gl, canvas);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.2, 0.3, 1.0);

    return true;
}

function setupBuffers() {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    shader.setAttribPointer('a_position', 2, gl.FLOAT, false, 0, 0); // x, y 2D 좌표

    gl.bindVertexArray(null);
}

// 좌표 변환 함수: 캔버스 좌표를 WebGL 좌표로 변환
// 캔버스 좌표: 캔버스 좌측 상단이 (0, 0), 우측 하단이 (canvas.width, canvas.height)
// WebGL 좌표 (NDC): 캔버스 좌측 하단이 (-1, -1), 우측 상단이 (1, 1)
function convertToWebGLCoordinates(x, y) {
    return [
        (x / canvas.width) * 2 - 1,  // x/canvas.width 는 0 ~ 1 사이의 값, 이것을 * 2 - 1 하면 -1 ~ 1 사이의 값
        -((y / canvas.height) * 2 - 1) // y canvas 좌표는 상하를 뒤집어 주어야 하므로 -1을 곱함
    ];
}

/* 
    browser window
    +----------------------------------------+
    | toolbar, address bar, etc.             |
    +----------------------------------------+
    | browser viewport (컨텐츠 표시 영역)       | 
    | +------------------------------------+ |
    | |                                    | |
    | |    canvas                          | |
    | |    +----------------+              | |
    | |    |                |              | |
    | |    |      *         |              | |
    | |    |                |              | |
    | |    +----------------+              | |
    | |                                    | |
    | +------------------------------------+ |
    +----------------------------------------+

    *: mouse click position

    event.clientX = browser viewport 왼쪽 경계에서 마우스 클릭 위치까지의 거리
    event.clientY = browser viewport 상단 경계에서 마우스 클릭 위치까지의 거리
    rect.left = browser viewport 왼쪽 경계에서 canvas 왼쪽 경계까지의 거리
    rect.top = browser viewport 상단 경계에서 canvas 상단 경계까지의 거리

    x = event.clientX - rect.left  // canvas 내에서의 클릭 x 좌표
    y = event.clientY - rect.top   // canvas 내에서의 클릭 y 좌표
*/

function setupMouseEvents() {
    function handleMouseDown(event) {
        event.preventDefault(); // 이미 존재할 수 있는 기본 동작을 방지
        event.stopPropagation(); // event가 상위 요소 (div, body, html 등)으로 전파되지 않도록 방지

        const rect = canvas.getBoundingClientRect(); // canvas를 나타내는 rect 객체를 반환
        const x = event.clientX - rect.left;  // canvas 내 x 좌표
        const y = event.clientY - rect.top;   // canvas 내 y 좌표
        
        // 캔버스 좌표를 WebGL 좌표로 변환하여 선분의 시작점을 설정
        let [glX, glY] = convertToWebGLCoordinates(x, y);
        mouseStartPos = [glX, glY];
        bMouseDown = true; // 이제 mouse button을 놓을 때까지 계속 true로 둠. 즉, mouse down 상태가 됨
    
        if (!bCircleDrawn) {
            bCircleDrawing = true;
        }
        else if (!bLineDrawn) {
            bLineDrawing = true;
        }
    }

    function handleMouseMove(event) {
        if (bMouseDown) { // 1번 또는 2번 선분을 그리고 있는 도중인 경우
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            let [glX, glY] = convertToWebGLCoordinates(x, y);
            mouseCurrentPos = [glX, glY]; // 임시 선분의 끝 point
            render();
        }
    }

    function handleMouseUp() {
        if (bMouseDown && mouseCurrentPos) {

            // lines.push([...startPoint, ...tempEndPoint])
            //   : startPoint와 tempEndPoint를 펼쳐서 하나의 array로 합친 후 lines에 추가
            // ex) lines = [] 이고 startPoint = [1, 2], tempEndPoint = [3, 4] 이면,
            //     lines = [[1, 2, 3, 4]] 이 됨
            // ex) lines = [[1, 2, 3, 4]] 이고 startPoint = [5, 6], tempEndPoint = [7, 8] 이면,
            //     lines = [[1, 2, 3, 4], [5, 6, 7, 8]] 이 됨

            if (bCircleDrawing) {
                bCircleDrawn = true;
                bCircleDrawing = false;
                gCircleCenter = mouseStartPos;
                gCircleRadius = Math.sqrt(
                    (mouseCurrentPos[0] - mouseStartPos[0]) ** 2 +
                    (mouseCurrentPos[1] - mouseStartPos[1]) ** 2
                );
                updateText(text1, `Circle : center (${gCircleCenter[0].toFixed(2)}, ${gCircleCenter[1].toFixed(2)}) radius = ${gCircleRadius.toFixed(2)}`);
            }
            else if (bLineDrawing) {
                bLineDrawn = true;
                bLineDrawing = false;
                gLineStart = mouseStartPos;
                gLineEnd = mouseCurrentPos;
                lines.push([...gLineStart, ...gLineEnd]);
                updateText(text2, `Line segment: (${gLineStart[0].toFixed(2)}, ${gLineStart[1].toFixed(2)}) ~ (${gLineEnd[0].toFixed(2)}, ${gLineEnd[1].toFixed(2)})`);
                
                // compute intersection points
                intersectionPoints = computeLineCircleIntersections(gLineStart, gLineEnd, gCircleCenter, gCircleRadius);
                if (intersectionPoints.length > 0) {
                    let interText = `Intersection Points: ${intersectionPoints.length} `;
                    intersectionPoints.forEach((pt, index) => {
                        interText += `Point ${index + 1}: (${pt[0].toFixed(2)}, ${pt[1].toFixed(2)}) `;
                    });
                    updateText(text3, interText);
                } else {
                    updateText(text3, "No intersection");
                }
            }

            bMouseDown = false;
            mouseStartPos = null;
            mouseCurrentPos = null;
            render();
        }
    }

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    shader.use();
    
    if (bCircleDrawing && mouseStartPos && mouseCurrentPos)
    {
        // 두 점의 차를 벡터로 계산
        let dx = mouseCurrentPos[0] - mouseStartPos[0];
        let dy = mouseCurrentPos[1] - mouseStartPos[1];
        let radius = Math.sqrt(dx * dx + dy * dy);
        drawCircle(mouseStartPos, radius, gray);
    }
    else if (bCircleDrawn)
    {
        drawCircle(gCircleCenter, gCircleRadius, magenta); // circle이 그려진 후에는 magenta color로 표시
    }

    if (bLineDrawing && mouseStartPos && mouseCurrentPos) {
        drawLine(mouseStartPos, mouseCurrentPos, gray); // 임시 선분은 gray color
    }
    else if (bLineDrawn) {
        drawLine(gLineStart, gLineEnd, cyan); // 그려진 선분은 cyan color
    }

    for (let point of intersectionPoints)
    {
        drawPoint(point, yellow);
    }

    // axes 그리기
    axes.draw(mat4.create(), mat4.create()); // 두 개의 identity matrix를 parameter로 전달
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
            return false; 
        }

        // 셰이더 초기화
        await initShader();
        
        // 나머지 초기화
        setupBuffers();
        shader.use();

        // 텍스트 초기화
        text1 = setupText(canvas, "", 1);
        text2 = setupText(canvas, "", 2);
        text3 = setupText(canvas, "", 3);

        // 마우스 이벤트 설정
        setupMouseEvents();
        
        // 초기 렌더링
        render();

        return true;
        
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}
