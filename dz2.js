
"use strict";

// Vertex shader program
const VSHADER_SOURCE =
    'attribute vec4 a_Position;\n' +
    'attribute float a_select;\n' +
    'uniform mat4 u_projMatrix;\n' +
    'uniform float u_pointSize;\n' +
    'uniform vec4 u_color;\n' +
    'uniform vec4 u_colorSelect;\n' +
    'varying vec4 v_color;\n' +
    'void main() {\n' +
    '  gl_Position = u_projMatrix * a_Position;\n' +
    '  gl_PointSize = u_pointSize;\n' +
    '  if (a_select != 0.0)\n' +
    '    v_color = u_colorSelect;\n' +
    '  else\n' +
    '    v_color = u_color;\n' +
    '}\n';

// Fragment shader program
const FSHADER_SOURCE =
    'precision mediump float;\n' +
    'varying vec4 v_color;\n' +
    'void main() {\n' +
    '  gl_FragColor = v_color;\n' +
    '}\n';

function main() {
    // Retrieve <canvas> element
    const canvas = document.getElementById('webgl');

    // Get the rendering context for WebGL
    const gl = getWebGLContext(canvas);
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    // Initialize shaders
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to intialize shaders.');
        return;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);

    const projMatrix = mat4.ortho(mat4.create(), 0, gl.drawingBufferWidth, 0, gl.drawingBufferHeight, 0, 1);

    // Pass the projection matrix to the vertex shader
    const u_projMatrix = gl.getUniformLocation(gl.program, 'u_projMatrix');
    if (!u_projMatrix) {
        console.log('Failed to get the storage location of u_projMatrix');
        return;
    }
    gl.uniformMatrix4fv(u_projMatrix, false, projMatrix);

    const countSplinePoints = document.getElementById("countSplinePoints");
    const uniform = document.getElementById("uniform");
    const chordal = document.getElementById("chordal");
    const centripetal = document.getElementById("centripetal");

    Data.init(gl, countSplinePoints, uniform, chordal, centripetal);

    // Register function (event handler) to be called on a mouse press
    canvas.onclick = function (ev) { click(ev, canvas); };

    canvas.onmousemove = function (ev) { mousemove(ev, canvas); };

    canvas.onmousedown = function (ev) { mousedown(ev, canvas); };

    canvas.onmouseup = function (ev) { mouseup(ev, canvas); };

    const lineSpline = document.getElementById("chkLineSpline");
    const controlPolygon = document.getElementById("chkControlPolygon");
    const showControlPoints = document.getElementById("chkShowPoints");
    const visualizeSplineWithPoints = document.getElementById("chkVisualizeWithPoints");
    const visualizeSplineWithLines = document.getElementById("chkVisualizeWithLine");

    lineSpline.onclick = function () { Data.plotMode(1); };
    countSplinePoints.onchange = function () { Data.plotMode(2); };
    uniform.onclick = function () { Data.plotMode(2); };
    chordal.onclick = function () { Data.plotMode(2); };
    centripetal.onclick = function () { Data.plotMode(2); };
    controlPolygon.onclick = function () { Data.plotMode(3); };
    visualizeSplineWithPoints.onclick = function () { Data.plotMode(4); };
    visualizeSplineWithLines.onclick = function () { Data.plotMode(5); };
    showControlPoints.onclick = function () { Data.plotMode(6); };

    // Specify the color for clearing <canvas>
    gl.clearColor(0.8, 0.8, 0.8, 1.0);

    // Clear <canvas>
    gl.clear(gl.COLOR_BUFFER_BIT);
}

class Point {
    constructor(x, y) {
        this.select = false;
        this.x = x;
        this.y = y;
		this.t = 0;
        this.setRect();
    }
    setPoint(x, y) {
        this.x = x;
        this.y = y;
        this.setRect();
    }
    setRect() {
        this.left = this.x - 5;
        this.right = this.x + 5;
        this.bottom = this.y - 5;
        this.up = this.y + 5;
    }
    ptInRect(x, y) {
        const inX = this.left <= x && x <= this.right;
        const inY = this.bottom <= y && y <= this.up;
        return inX && inY;
    }
}

const Data = {
    pointsCtr: [],
    pointsSpline: [],
    countAttribData: 3, //x,y,sel
    verticesCtr: {},
    verticesSpline: {},
    FSIZE: 0,
    gl: null,
    vertexBufferCtr: null,
    vertexBufferSpline: null,
    a_Position: -1,
    a_select: -1,
    u_color: null,
    u_colorSelect: null,
    u_pointSize: null,
    movePoint: false,
    iMove: -1,
    leftButtonDown: false,
    drawControlPolygon: false,
    drawLineSpline: false,
    showControlPoints: true,
    visualizeSplineWithPoints: true,
    visualizeSplineWithLine: false,
    countSplinePoints: null,
    uniform: null,
    chordal: null,
    centripetal: null,
    init: function (gl, countSplinePoints, uniform, chordal, centripetal) {
        this.gl = gl;
        // Create a buffer object
        this.vertexBufferCtr = this.gl.createBuffer();
        if (!this.vertexBufferCtr) {
            console.log('Failed to create the buffer object for control points');
            return -1;
        }
        this.vertexBufferSpline = this.gl.createBuffer();
        if (!this.vertexBufferSpline) {
            console.log('Failed to create the buffer object for spline points');
            return -1;
        }

        this.a_Position = this.gl.getAttribLocation(this.gl.program, 'a_Position');
        if (this.a_Position < 0) {
            console.log('Failed to get the storage location of a_Position');
            return -1;
        }

        this.a_select = this.gl.getAttribLocation(this.gl.program, 'a_select');
        if (this.a_select < 0) {
            console.log('Failed to get the storage location of a_select');
            return -1;
        }

        // Get the storage location of u_color
        this.u_color = this.gl.getUniformLocation(this.gl.program, 'u_color');
        if (!this.u_color) {
            console.log('Failed to get u_color variable');
            return;
        }

        // Get the storage location of u_colorSelect
        this.u_colorSelect = gl.getUniformLocation(this.gl.program, 'u_colorSelect');
        if (!this.u_colorSelect) {
            console.log('Failed to get u_colorSelect variable');
            return;
        }

        // Get the storage location of u_pointSize
        this.u_pointSize = gl.getUniformLocation(this.gl.program, 'u_pointSize');
        if (!this.u_pointSize) {
            console.log('Failed to get u_pointSize variable');
            return;
        }

        this.countSplinePoints = countSplinePoints;
        this.uniform = uniform;
        this.chordal = chordal;
        this.centripetal = centripetal;
    },
    setLeftButtonDown: function (value) {
        this.leftButtonDown = value;
    },
    add_coords: function (x, y) {
        const pt = new Point(x, y);
        this.pointsCtr.push(pt);
        this.add_vertices();
    },
    mousemoveHandler: function (x, y) {
        if (this.leftButtonDown) {
            if (this.movePoint) {
                this.pointsCtr[this.iMove].setPoint(x, y);

                this.verticesCtr[this.iMove * this.countAttribData] = this.pointsCtr[this.iMove].x;
                this.verticesCtr[this.iMove * this.countAttribData + 1] = this.pointsCtr[this.iMove].y;

                this.setVertexBuffersAndDraw();

                if (this.drawLineSplines)
                    this.calculateLineSpline();
            }
        }
        else
            for (let i = 0; i < this.pointsCtr.length; i++) {
                this.pointsCtr[i].select = false;

                if (this.pointsCtr[i].ptInRect(x, y))
                    this.pointsCtr[i].select = true;

                this.verticesCtr[i * this.countAttribData + 2] = this.pointsCtr[i].select;

                this.setVertexBuffersAndDraw();
            }
    },
    mousedownHandler: function (button, x, y) {

        if (button == 0) { //left button
            this.movePoint = false;

            for (let i = 0; i < this.pointsCtr.length; i++) {
                if (this.pointsCtr[i].select == true) {
                    this.movePoint = true;
                    this.iMove = i;
                }
            }

            this.setLeftButtonDown(true);
        }



    },
    mouseupHandler: function (button, x, y) {
        if (button == 0) //left button
            this.setLeftButtonDown(false);
    },
    clickHandler: function (x, y) {
        if (!this.movePoint) {
            this.add_coords(x, y);
            if (this.drawLineSplines)
                this.calculateLineSpline();
            this.setVertexBuffersAndDraw();
        }
    },
    add_vertices: function () {
        this.verticesCtr = new Float32Array(this.pointsCtr.length * this.countAttribData);
        for (let i = 0; i < this.pointsCtr.length; i++) {
            this.verticesCtr[i * this.countAttribData] = this.pointsCtr[i].x;
            this.verticesCtr[i * this.countAttribData + 1] = this.pointsCtr[i].y;
            this.verticesCtr[i * this.countAttribData + 2] = this.pointsCtr[i].select;
        }
        this.FSIZE = this.verticesCtr.BYTES_PER_ELEMENT;
    },
    setVertexBuffersAndDraw: function () {
        if (this.pointsCtr.length == 0)
            return;

        // Bind the buffer object to target
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferCtr);
        // Write date into the buffer object
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesCtr, this.gl.DYNAMIC_DRAW);
        // Assign the buffer object to a_Position variable
        this.gl.vertexAttribPointer(this.a_Position, 2, this.gl.FLOAT, false, this.FSIZE * 3, 0);
        // Enable the assignment to a_Position variable
        this.gl.enableVertexAttribArray(this.a_Position);
        // Assign the buffer object to a_select variable
        this.gl.vertexAttribPointer(this.a_select, 1, this.gl.FLOAT, false, this.FSIZE * 3, this.FSIZE * 2);
        // Enable the assignment to a_select variable
        this.gl.enableVertexAttribArray(this.a_select);

        // Clear <canvas>
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);
        this.gl.uniform4f(this.u_colorSelect, 0.5, 0.5, 0.0, 1.0);
        this.gl.uniform1f(this.u_pointSize, 10.0);
        // Draw
        if (this.showControlPoints)
        	this.gl.drawArrays(this.gl.POINTS, 0, this.pointsCtr.length);
        if (this.drawControlPolygon) {
            this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);
            this.gl.uniform4f(this.u_colorSelect, 0.0, 0.0, 0.0, 1.0);

            this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.pointsCtr.length);
        }
        if (this.drawLineSplines) {
            // Bind the buffer object to target
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferSpline);
            // Write date into the buffer object
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesSpline, this.gl.DYNAMIC_DRAW);
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(this.a_Position, 2, this.gl.FLOAT, false, 0, 0);
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position);
            // Disable the assignment to a_select variable
            this.gl.disableVertexAttribArray(this.a_select);

            this.gl.uniform4f(this.u_color, 1.0, 0.0, 0.0, 1.0);
            this.gl.uniform1f(this.u_pointSize, 7.0);

            if (this.visualizeSplineWithPoints)
                this.gl.drawArrays(this.gl.POINTS, 0, this.pointsSpline.length);

            if (this.visualizeSplineWithLine)
                this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.pointsSpline.length);
        }
    },
    plotMode: function (selOption) {
        switch (selOption) {
            case 1:
                this.drawLineSplines = !this.drawLineSplines;
                if (this.drawLineSplines)
                    this.calculateLineSpline();
                break;
            case 2:
                if (this.drawLineSplines)
                    this.calculateLineSpline();
                break;
            case 3:
                this.drawControlPolygon = !this.drawControlPolygon;
                break;
            case 4:
                this.visualizeSplineWithPoints = !this.visualizeSplineWithPoints;
                break;
            case 5:
                this.visualizeSplineWithLine = !this.visualizeSplineWithLine;
                break;
            case 6:
                this.showControlPoints = !this.showControlPoints;
                break;
        }
        this.setVertexBuffersAndDraw();
    },
	
	
    calculateLineSpline: function () {	
		function C(i, n)
	{
		let p_n=1, n0=n,n_i=n-i,p_n_i=1, p_i=1;
		while(n!=0)
		{
			p_n*=n; n--;
		};
		while(n_i!=0)
		{
			p_n_i*=n_i;
			n_i--;
		};
		while(i!=0)
		{
			p_i*=i; i--;
			
		}
		
		return p_n/(p_i*p_n_i);
		
	}
	
        let i, j,k;
        let rt;
        let t, x, y, d, omega;
		d = 0;
		const n = this.pointsCtr.length;
		//const N = this.countSplinePoints.value;
        this.pointsSpline = new Array(1000);
        // РАССЧИТАТЬ ЗНАЧЕНИЕ ПАРАМЕТРИЧЕСКИХ КООРДИНАТ КОНТРОЛЬНЫХ ТОЧЕК
        if (this.uniform.checked){
			for(i = 0;i < n; i++){
				this.pointsCtr[i].t = i/(n-1);
			}
		}
        if (this.chordal.checked)
		{
			for(j = 0; j < n-1; j++){
				d+= Math.sqrt(Math.pow(this.pointsCtr[j+1].x-this.pointsCtr[j].x, 2.0)+Math.pow(this.pointsCtr[j+1].y-this.pointsCtr[j].y, 2.0));
			}
			this.pointsCtr[0].t = 0;
			this.pointsCtr[n-1].t = 1;
			for(i = 1;i < n-1; i++){
				this.pointsCtr[i].t = this.pointsCtr[i-1].t + Math.sqrt(Math.pow(this.pointsCtr[i].x-this.pointsCtr[i-1].x, 2.0)+Math.pow(this.pointsCtr[i].y-this.pointsCtr[i-1].y, 2.0))/d;
			}
		}
        if (this.centripetal.checked)
        {
			for(j = 0; j < n-1; j++){
				d+= Math.pow((Math.pow(this.pointsCtr[j+1].x-this.pointsCtr[j].x, 2.0)+Math.pow(this.pointsCtr[j+1].y-this.pointsCtr[j].y, 2.0)),0.25);
			}
			this.pointsCtr[0].t = 0;
			this.pointsCtr[n-1].t = 1;
			for(i = 1;i < n-1; i++){
				this.pointsCtr[i].t = this.pointsCtr[i-1].t + Math.pow((Math.pow(this.pointsCtr[i].x-this.pointsCtr[i-1].x, 2.0)+Math.pow(this.pointsCtr[i].y-this.pointsCtr[i-1].y, 2.0)),0.25)/d;
			}
		}

        
		
		// РАСЧЕТ КООРДИНАТ ТОЧКИ СПЛАЙНА
		 let B_in,s_x=0,s_y=0;
		 var a_x=[],a_y=[],b_x=[],b_y=[];
		 t=0; j=0;
		while(t<1){
			
			
			for(i=0; i<n; i++){
			B_in=C(i,n-1)*Math.pow(t,i)*Math.pow(1-t, n-1-i);
			s_x+=B_in*this.pointsCtr[i].x;
			s_y+=B_in*this.pointsCtr[i].y;
			}
			rt=new Point(s_x,s_y);
			this.pointsSpline[j]=rt;
			s_x=0; s_y=0;
			
			let s_x0=0,s_x1=0,s_y0=0,s_y1=0;
			
			//производная
			for(i=0; i<n-1; i++){
			B_in=C(i,n-2)*Math.pow(t,i)*Math.pow(1-t, n-2-i);
			a_x[i]=this.pointsCtr[i+1].x-this.pointsCtr[i].x;
			a_y[i]=this.pointsCtr[i+1].y-this.pointsCtr[i].y;
			s_x0+=(n-1)*B_in*a_x[i];
			s_y0+=(n-1)*B_in*a_y[i];
			}
			const rt_diff=vec3.fromValues(s_x0,s_y0,0);
			
			console.log('rt_diff',rt_diff);
			
			
			//вторая производная
			for(i=0; i<n-2; i++){
			B_in=C(i,n-3)*Math.pow(t,i)*Math.pow(1-t, n-3-i);
			b_x[i]=a_x[i+1]-a_x[i];
			b_y[i]=a_y[i+1]-a_y[i];
			s_x1+=(n-1)*(n-2)*B_in*b_x[i];
			s_y1+=(n-1)*(n-2)*B_in*b_y[i];
			}
			const rt_2diff=vec3.fromValues(s_x1,s_y1,0);
			console.log('rt_2diff',rt_2diff);
			
			
			let ro,rt_diff_norm, normal_norm;
			rt_diff_norm=Math.sqrt(Math.pow(s_x0,2)+Math.pow(s_y0,2));
			
			
			const normal = vec3.create();
            vec3.cross(normal,rt_diff,rt_2diff);
			console.log(normal[0], normal[1],normal[2]);
			
			normal_norm=Math.sqrt(Math.pow(normal[0],2)+Math.pow(normal[1],2)+Math.pow(normal[2],2));
			console.log('normal',normal_norm);
			ro=Math.pow(rt_diff_norm,3)/normal_norm;
			
		s_x0=0; s_y0=0;s_x1=0; s_y1=0;
		
		let delta=0.001,delta_t;
		delta_t=2*Math.sqrt(delta*(2*ro-delta))/rt_diff_norm;
		
		console.log('delta_t',delta_t);
		
		
		
        j++;
		t+=delta_t;
		
		}	
        
this.pointsSpline[j]=this.pointsCtr[n-1];
        this.verticesSpline = new Float32Array(this.pointsSpline.length * 2);
        for (k = 0; k < j; k++) {
			console.log(this.pointsSpline[k].x);
            this.verticesSpline[k * 2] = this.pointsSpline[k].x;
            this.verticesSpline[k * 2 + 1] = this.pointsSpline[k].y;
        }
    }
}


function click(ev, canvas) {
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.clickHandler(x - rect.left, canvas.height - (y - rect.top));
}

function mousedown(ev, canvas) {
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.mousedownHandler(EventUtil.getButton(ev), x - rect.left, canvas.height - (y - rect.top));
}

function mouseup(ev, canvas) {
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.mouseupHandler(EventUtil.getButton(ev), x - rect.left, canvas.height - (y - rect.top));
}

function mousemove(ev, canvas) {
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();
    //if (ev.buttons == 1)
    //    alert('with left key');
    Data.mousemoveHandler(x - rect.left, canvas.height - (y - rect.top));
}