/*  meshroom gives out extrinsics and sfm points using opencv convention. I.e., 
 *  origin at top-left. +x goes right, +y goes down. +z looking away from the camera.
 *
 *  We create planes using this convention with POSITIVE z and create intrinsics using the same convention
 *  [f 0 px]
 *  [0 f py]
 *  [0 0 1 ]  with no negation in z.
 *
 *
 *  Now points after left multiplying with inversed intrinsics will be in the true 3d coordinates.
 *  but with x,y,z convention of opencv. This is needed because all the extrinsics are using this
 *  convention.
 *
 *  For converting back to openGL convention, we use a slightly different intrinsics:
 *  [f/(w/2)     0      px/(w/2)-1   0]
 *  [0       -f/(h/2)  -py/(h/2)-1   0]
 *  [0           0          1       -1]
 *  [0           0          1        0]
 *  I.e., this is the same except we flip the sign for y, and scale it back to normalized coordinates
 *  ranging from -1 to 1.
 *  The z-buffer will be (z-1)/z = 1 - 1/z. z is still positive. The farther z, the larger z-buffer value 
 *  which is correct.
 *
 */

class Scene {
  constructor(gl, GETscene, vivew=0, viveh=0) {
    this.gl = gl;
    this.GETscene = GETscene;

    this.nPlanes = planes.length;
    this.nMpis = names.length;

    this.mv = new Array(this.nMpis);
    this.mvi = new Array(this.nMpis);
    this.mvLoaded = 0;
    this.baryLoaded = 0;
    this.ready = 0;
    this.delaunay = false;
    this.lastBesti = [0, 0, 0];
    this.lastTi = [1, 0, 0];

    if (vivew > 0) {
      this.vivew = vivew;
      this.viveh = viveh;
    } else {
      this.vivew = w;
      this.viveh = h;
    }

    this.initSceneContext();
  }

  resize(iw, ih) {
    const gl = this.gl;
    this.vivew = iw;
    this.viveh = ih;

    if (this.itexture) {
      gl.deleteTexture(this.itexture);
    }
    var itexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, itexture);
    {
      const level = 0;
      const internalFormat = gl.RGBA;
      const border = 0;
      const format = gl.RGBA;
      const type = gl.UNSIGNED_BYTE;
      const data = null;
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
        this.vivew, this.viveh, border,
        format, type, data);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    this.itexture = itexture;

    if (this.targetTexture) {
      gl.deleteTexture(this.targetTexture[0]);
      gl.deleteTexture(this.targetTexture[1]);
    }
    this.targetTexture = [gl.createTexture(), gl.createTexture()];
    for (var i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this.targetTexture[i]);
      {
        // define size and format of level 0
        const level = 0;
        const internalFormat = gl.RGBA;
        const border = 0;
        const format = gl.RGBA;
        //const type = gl.FLOAT;
        const type = gl.UNSIGNED_BYTE;
        const data = null;
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
          this.vivew, this.viveh, border, format, type, data);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
    }


  }

  checkReady() {
    if (this.delaunay) {
      if (this.baryLoaded == 2 && this.mvLoaded)
        this.ready = 1;
    } else {
      this.ready = this.mvLoaded;
    }
  }

  initBlend() {
    console.log("initBlend()");
    var self = this;
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      document.getElementById("workspace").appendChild(canvas);
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.setAttribute("style", "margin: 0");
      self.ctxBary = canvas.getContext('2d');
      self.ctxBary.drawImage(img, 0, 0, img.width, img.height);
      self.baryLoaded ++;
      self.checkReady();

      self.pointer = document.createElement('div');
      self.pointer.setAttribute("id", "cursor");
      document.getElementById("workspace").appendChild(self.pointer);
    }
    img.crossOrigin = "anonymous";
    img.src = this.GETscene + "/bary.png";

    var img2 = new Image();
    img2.onload = function() {
      var canvas = document.createElement('canvas');
      //document.getElementById("workspace").appendChild(canvas);
      canvas.width = img2.width;
      canvas.height = img2.height;
      self.ctxIndices = canvas.getContext('2d');
      self.ctxIndices.drawImage(img2, 0, 0, img2.width, img2.height);
      self.baryLoaded ++;
      self.checkReady();
    }
    img2.crossOrigin = "anonymous";
    img2.src = this.GETscene + "/indices.png";


    var rawFile = new XMLHttpRequest();
    var self = this;
    rawFile.open("GET", this.GETscene + "/blend.txt", true);
    rawFile.onreadystatechange = function () {
      if(rawFile.readyState === 4) {
        if(rawFile.status === 200 || rawFile.status == 0) {
          var txt = rawFile.responseText;
          var lines = txt.split("\n");
          var v = lines[0].split(" ");
          self.center = vec3.fromValues(v[0], v[1], v[2]);
          v = lines[1].split(" ");
          self.pole = vec3.fromValues(v[0], v[1], v[2]);
          v = lines[2].split(" ");
          self.up = vec3.fromValues(v[0], v[1], v[2]);
          v = lines[3].split(" ");
          self.u = vec3.fromValues(v[0], v[1], v[2]);
          v = lines[4].split(" ");
          self.v = vec3.fromValues(v[0], v[1], v[2]);

          self.radius = parseFloat(lines[5]);
          self.shifter = parseFloat(lines[6]);
          self.scaler = parseFloat(lines[7]);

          console.log(self.center);
          console.log(self.pole);
          console.log(self.up);
          console.log(self.u);
          console.log(self.v);
          console.log(self.radius);
          console.log(self.shifter);
          console.log(self.scaler);
        }
      }
    }
    rawFile.send(null);
  }

  initSceneContext() {
    console.log("initSceneContext()");
    const gl = this.gl;
    var texture = [];
    var textureAlpha = [];
    for (var i = 0; i < this.nMpis; i++) {
      texture.push(loadTexture(gl, this.GETscene + '/mpi' + names[i] + '.png'));
      if (nSubPlanes > 1)
        textureAlpha.push(loadTexture(gl, this.GETscene + '/sublayer' + names[i] + '.png'));
        var realThis = this;
      readMV(this.mv, this.mvi, this.nMpis, this.GETscene + "/extrinsics" + names[i] + ".txt", i, 
        function() {
          realThis.mvLoaded = 1;
          realThis.checkReady();
        });
    }

    const fb = gl.createFramebuffer();

    this.resize(this.vivew, this.viveh);

    const vsSource = `#version 300 es
    in vec4 aVertexPosition;
    in vec2 aTextureCoord;
    in vec2 aTextureCoordSub;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uSfmProjectionMatrix;
    uniform mat4 uPlaneMV;

    out highp vec2 vTextureCoord;
    out highp vec2 vTextureCoordSub;

    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * uPlaneMV * uSfmProjectionMatrix * aVertexPosition;
      vTextureCoord = aTextureCoord;
      vTextureCoordSub = aTextureCoordSub;
    }
  `;

    var fsSource = "";
    if (nSubPlanes > 1) {
      fsSource = `#version 300 es

      precision mediump float;

      in highp vec2 vTextureCoord;
      in highp vec2 vTextureCoordSub;
      out vec4 fragmentColor;

      uniform sampler2D uimg0;
      uniform sampler2D uimg1;
      uniform sampler2D ulast;


      void main(void) {
        float t = texture(uimg1, vTextureCoordSub).r;
        ivec2 ts = textureSize(ulast, 0);
        vec4 mpi = texture(uimg0, vTextureCoord);

        vec4 old = texture(ulast, vec2(gl_FragCoord.x / float(ts.x), gl_FragCoord.y / float(ts.y)));

        fragmentColor.rgb = mpi.rgb * mpi.a * t + (1.0-t) * old.rgb;
        fragmentColor.a = mpi.a * t + (1.0-t) * old.a;
      }
    `;
    } else {
      fsSource = `#version 300 es

      precision mediump float;

      in highp vec2 vTextureCoord;
      in highp vec2 vTextureCoordSub;

      uniform sampler2D uimg0;
      out vec4 fragmentColor;

      void main(void) {
        fragmentColor = texture(uimg0, vTextureCoord);
      }
    `;
    }

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    const programInfo = {
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
        textureCoordSub: gl.getAttribLocation(shaderProgram, 'aTextureCoordSub'),
      },
      uniformLocations: {
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        sfmProjectionMatrix: gl.getUniformLocation(shaderProgram, 'uSfmProjectionMatrix'),
        planeMV: gl.getUniformLocation(shaderProgram, 'uPlaneMV'),
        translation: gl.getUniformLocation(shaderProgram, 'translation'),
        uimg0: gl.getUniformLocation(shaderProgram, 'uimg0'),
        uimg1: gl.getUniformLocation(shaderProgram, 'uimg1'),
        ulast: gl.getUniformLocation(shaderProgram, 'ulast'),
      },
    };

    const vsSource2 = `
    attribute vec2 aTextureCoord;
    varying highp vec2 vTextureCoord;

    void main(void) {
      gl_Position = vec4(aTextureCoord.s*2.0-1.0, aTextureCoord.t * 2.0-1.0, 0.0, 1.0);
      vTextureCoord = vec2(aTextureCoord.s, aTextureCoord.t);
    }
  `;

    const fsSource2 = `
    precision mediump float;
    varying highp vec2 vTextureCoord;

    uniform sampler2D uimg0;
    uniform float t;
    uniform float sharpen;

    vec4 sharpen2D(in sampler2D tex, in vec2 coords, in vec2 renderSize, in float strength) {
      float dx = 1.0 / renderSize.x;
      float dy = 1.0 / renderSize.y;
      vec4 sum = vec4(0.0);
      sum += -1. * texture2D(tex, coords + vec2( -1.0 * dx , 0.0 * dy)) * strength;
      sum += -1. * texture2D(tex, coords + vec2( 0.0 * dx , -1.0 * dy)) * strength;
      sum += (4.0 * strength + 1.0) * texture2D(tex, coords + vec2( 0.0 * dx , 0.0 * dy));
      sum += -1. * texture2D(tex, coords + vec2( 0.0 * dx , 1.0 * dy)) * strength;
      sum += -1. * texture2D(tex, coords + vec2( 1.0 * dx , 0.0 * dy)) * strength;
      return sum;
    }

    void main(void) {
      if (sharpen == 0.0)
        gl_FragColor = texture2D(uimg0, vTextureCoord);
      else
        gl_FragColor = sharpen2D(uimg0, vTextureCoord, vec2(` + this.vivew + `, ` + this.viveh + `), sharpen);

      if (t >= 0.0) 
        gl_FragColor.a = t;
    }
  `;
    const shaderProgram2 = initShaderProgram(gl, vsSource2, fsSource2);
    const programInfo2 = {
      program: shaderProgram2,
      attribLocations: {
        textureCoord: gl.getAttribLocation(shaderProgram2, 'aTextureCoord'),
      },
      uniformLocations: {
        uimg0: gl.getUniformLocation(shaderProgram2, 'uimg0'),
        t: gl.getUniformLocation(shaderProgram2, 't'),
        sharpen: gl.getUniformLocation(shaderProgram2, 'sharpen'),
      },
    };



    const positionBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    planes.push(planes[this.nPlanes-1]*2 - planes[this.nPlanes-2]);

    const positionsTmp = [
      -1, 1,  1,
      1,  1,  1, 
      1,  -1,  1,
      -1,  -1,  1,
    ];
    var positions = [];

    for (var i = 0; i < this.nPlanes; i++) {
      for (var k = 0; k < nSubPlanes; k++) {
        var kt = k / nSubPlanes;
        var depth;
        if (invz)
          depth = 1/(1/planes[i] * (1 - kt) + 1/planes[i+1] * kt);
        else
          depth = planes[i] * (1 - kt) + planes[i+1] * kt;

        if (k == 0) 
          console.log(depth);
        for (var j = 0 ; j < 4; j++) {
          positions.push(positionsTmp[j*3+0] * depth);
          positions.push(positionsTmp[j*3+1] * depth);
          positions.push(positionsTmp[j*3+2] * depth);
          positions.push(1);
        }
      }
    }

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const textureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

    var textureCoordinates = [];
    for (var i = 0; i < this.nPlanes; i++) {
      var i0 = 1.0 * i / this.nPlanes;
      var i1 = 1.0 * (i+1) / this.nPlanes;
      for (var j = 0; j < nSubPlanes; j++) {
        textureCoordinates = textureCoordinates.concat([
          i0, 1,
          i1, 1,
          i1, 0.0,
          i0, 0.0,
        ]);
      }
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates),
      gl.STATIC_DRAW);


    const textureUnitBuff = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureUnitBuff);
    var tc = [
      0, 1,
      1, 1,
      1, 0,
      0, 0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tc),
      gl.STATIC_DRAW);

    // For correcting tensorflow's tf.image.resize's bug.
    const offsetCorrectionX = 1.0 / (w * this.nPlanes / 8) / 2 - 1.0 / (w * this.nPlanes) / 2;
    const offsetCorrectionY = 1.0 / (h * nSubPlanes / 8) / 2 - 1.0 / (h * nSubPlanes) / 2;


    const textureCoordBufferSub = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBufferSub);

    var textureCoordinatesSub = [];
    for (var j = 0; j < this.nPlanes; j++) {
      for (var i = 0; i < nSubPlanes; i++) {
        var t0 = 1.0 * i / nSubPlanes;
        var t1 = 1.0 * (i+1) / nSubPlanes;

        var j0 = 1.0 * j / this.nPlanes;
        var j1 = 1.0 * (j+1) / this.nPlanes;
        textureCoordinatesSub = textureCoordinatesSub.concat([
          j0 + offsetCorrectionX, t1 - offsetCorrectionY, 
          j1 - offsetCorrectionX, t1 - offsetCorrectionY, 
          j1 - offsetCorrectionX, t0 + offsetCorrectionY, 
          j0 + offsetCorrectionX, t0 + offsetCorrectionY]);
      }
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinatesSub),
      gl.STATIC_DRAW);


    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    const indicesTmp = [
      0, 1, 3, 2 
    ];

    var indices = [];
    for (var i = 0; i < this.nPlanes * nSubPlanes; i++) {
      for (var j = 0; j < 4; j++) {
        indices.push(indicesTmp[j] + 4 * i);
      }
    }

    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices), gl.STATIC_DRAW);

    if (typeof delaunay !== 'undefined' && delaunay) {
      this.delaunay = true;
      this.initBlend();
    } 

    this.gl = gl;
    this.position = positionBuffer;
    this.textureCoord = textureCoordBuffer;
    this.textureCoordSub = textureCoordBufferSub;
    this.textureCoordUnit = textureUnitBuff;
    this.indices = indexBuffer;
    this.programInfo = programInfo;
    this.programInfo2 = programInfo2;
    this.texture = texture;
    this.textureAlpha = textureAlpha;
    this.fb = fb;
  }

  drawSubPlanes(currentPlane, texture, textureAlpha, projectionMatrix, modelViewMatrix, planeMV, sfmProjectionMatrix, cw, ch) {
    const gl = this.gl;
    const programInfo = this.programInfo;
    gl.useProgram(programInfo.program);

    gl.uniformMatrix4fv(
      programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix);
    gl.uniformMatrix4fv(
      programInfo.uniformLocations.modelViewMatrix,
      false,
      modelViewMatrix);
    gl.uniformMatrix4fv(
      programInfo.uniformLocations.sfmProjectionMatrix,
      false,
      sfmProjectionMatrix);
    gl.uniformMatrix4fv(
      programInfo.uniformLocations.planeMV,
      false,
      planeMV);

    gl.uniform1i(programInfo.uniformLocations.uimg0, 0);
    gl.uniform1i(programInfo.uniformLocations.uimg1, 1);
    gl.uniform1i(programInfo.uniformLocations.ulast, 2);

    {
      const numComponents = 4;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.position);
      gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset);
      gl.enableVertexAttribArray(
        programInfo.attribLocations.vertexPosition);
    }

    // Tell WebGL how to pull out the texture coordinates from
    // the texture coordinate buffer into the textureCoord attribute.
    {
      const numComponents = 2;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoord);
      gl.vertexAttribPointer(
        programInfo.attribLocations.textureCoord,
        numComponents,
        type,
        normalize,
        stride,
        offset);
      gl.enableVertexAttribArray(
        programInfo.attribLocations.textureCoord);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordSub);
      gl.vertexAttribPointer(
        programInfo.attribLocations.textureCoordSub,
        numComponents,
        type,
        normalize,
        stride,
        offset);
      gl.enableVertexAttribArray(
        programInfo.attribLocations.textureCoordSub);
    }

    // Tell WebGL which indices to use to index the vertices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.disable(gl.DEPTH_TEST);           

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (nSubPlanes > 1) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, textureAlpha);
    }

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.targetTexture[0], 0);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);  
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.targetTexture[1], 0);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);  
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


    const vertexCount = 4;
    const total = this.nPlanes * nSubPlanes;
    gl.enable( gl.BLEND );
    gl.blendFunc( gl.ONE, gl.ZERO );

    gl.viewport(0, 0, cw, ch);
    for (var j = 0; j < nSubPlanes; j++) {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.targetTexture[(j+1)%2], 0);

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.targetTexture[j%2]);

      gl.drawElements(gl.TRIANGLE_STRIP, vertexCount, gl.UNSIGNED_SHORT,
        2 * vertexCount * (total-1-(nSubPlanes * currentPlane + j)));
    }
  }


  drawScene(postGLMatrix, projectionMatrix, eyeMatrix, cx, cy, cw, ch, clearScene, deltaTime, reuseBesti) {
    const gl = this.gl;
    const texture = this.texture;
    const textureAlpha = this.textureAlpha;
    const itexture = this.itexture;
    const fb = this.fb;
    var modelViewMatrix = mat4.create();

    if (!projectionMatrix) {
      projectionMatrix = mat4.fromValues(
        f * 2 / w, 0, 0, 0,
        0, (f * 2 / h), 0, 0,
        px * 2 / w - 1, (py * 2 / h - 1), -1, -1,
        0, 0, -1, 0
      );
    }

    var sfmProjectionMatrix = mat4.fromValues(
      f * 2 / w, 0, 0, 0,
      0, (f * 2 / h), 0, 0,
      px * 2 / w - 1, (py * 2 / h - 1), 1, 0,
      0, 0, 0, 1
    );
    mat4.invert(sfmProjectionMatrix, sfmProjectionMatrix);
    //console.log(this.mv[0]);

    var toGL = mat4.fromValues(
      1,0,0,0,
      0,-1,0,0,
      0,0,-1,0,
      0,0,0,1);

    mat4.multiply(modelViewMatrix, toGL, this.mv[0]);
    //mat4.multiply(modelViewMatrix, toGL, modelViewMatrix);

    if (postGLMatrix) {
      mat4.multiply(modelViewMatrix, postGLMatrix, modelViewMatrix);
    }

    if (eyeMatrix) {
      mat4.multiply(modelViewMatrix, eyeMatrix, modelViewMatrix);
    }

    var ti = null;
    var besti = [];

    var invMV = mat4.create();
    mat4.invert(invMV, modelViewMatrix);

    if (this.delaunay) {
      var newCameraCenter = vec3.fromValues(invMV[12], invMV[13], invMV[14]);
      var point = vec3.create();
      vec3.sub(point, newCameraCenter, this.center);
      vec3.scale(point, point, this.radius / vec3.len(point));
      vec3.add(point, this.center, point);

      var cp = vec3.create();
      vec3.sub(cp, this.center, this.pole);
      var pp = vec3.create();
      vec3.sub(pp, point, this.pole);

      var dcp = vec3.dot(cp, this.up);
      var dpp = vec3.dot(pp, this.up);

      var t = dcp / dpp;
      var tmp1 = vec3.create();
      vec3.sub(tmp1, point, this.pole);
      vec3.scale(tmp1, tmp1, t);
      vec3.add(tmp1, this.pole, tmp1);
      vec3.sub(tmp1, tmp1, this.center);

      var du = vec3.dot(tmp1, this.u) / this.radius * this.scaler + this.shifter;
      var dv = this.shifter - vec3.dot(tmp1, this.v) / this.radius * this.scaler;

      var bary = this.ctxBary.getImageData(du, dv, 1, 1).data;
      var indices = this.ctxIndices.getImageData(du, dv, 1, 1).data;

      if (indices[0] == 255) bary[0] = 0;
      if (indices[1] == 255) bary[1] = 0;
      if (indices[2] == 255) bary[2] = 0;

      ti = vec3.fromValues(bary[0] / 255.0, bary[1] / 255.0, bary[2] / 255.0);
      var sum = ti[0] + ti[1] + ti[2];
      if (sum > 0) {
        vec3.scale(ti, ti, 1.0 / sum);
      } 

      besti = [indices[0], indices[1], indices[2]];
    } else {
      var best = [1e10, 1e10];
      besti = [0, 0];
      for (var i = 0; i < this.nMpis; i++) {
        var d = 
          Math.pow(invMV[12] - this.mvi[i][12], 2) + 
          Math.pow(invMV[13] - this.mvi[i][13], 2) + 
          Math.pow(invMV[14] - this.mvi[i][14], 2);
        if (d < best[0]) {
          best[1] = best[0];
          besti[1] = besti[0];
          best[0] = d;
          besti[0] = i;
        } else if (d < best[1]) {
          best[1] = d;
          besti[1] = i;
        }
      }
      var sum = (best[0] + best[1]);
      ti = [best[1] / sum, best[0] / sum];
    }
    
    if (reuseBesti || (besti.length == 3 && besti[0] == 0 && besti[1] == 0 && besti[2] == 0)) {
      besti = this.lastBesti;
      ti = this.lastTi;
    } else {
      this.lastBesti = besti;
      this.lastTi = ti;
    }

    if (this.delaunay)
      this.pointer.setAttribute("style", "left: " + du + "px; top:" + dv + "px;");


    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (clearScene) {
      gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    var blendPlanes = this.delaunay ? 3 : Math.min(2, this.nMpis); 

    for (var ii = 0; ii < blendPlanes; ii++) {
      if (besti[ii] == 255) continue; // Special index.
      // Draw to intermediate itexture.
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, itexture, 0);
      gl.clearColor(0.0, 0.0, 0.0, 1.0);  
      //gl.clearColor(67/255.0, 67/255.0, 65/255.0, 1.0);  // Clear to black, fully opaque
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      for (var i = 0; i < this.nPlanes; i++) {
      //for (var i = 1; i < 2; i++) {
        if (nSubPlanes > 1)
          this.drawSubPlanes(i, texture[besti[ii]], textureAlpha[besti[ii]], projectionMatrix, modelViewMatrix, this.mvi[besti[ii]], sfmProjectionMatrix, cw, ch);
        else
          this.drawSubPlanes(i, texture[besti[ii]], 0, projectionMatrix, modelViewMatrix, this.mvi[besti[ii]], sfmProjectionMatrix, cw, ch);
        {
          const numComponents = 2;
          const type = gl.FLOAT;
          const normalize = false;
          const stride = 0;
          const offset = 0;
          gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordUnit);
          gl.vertexAttribPointer(
            this.programInfo2.attribLocations.textureCoord,
            numComponents,
            type,
            normalize,
            stride,
            offset);
          gl.enableVertexAttribArray(
            this.programInfo2.attribLocations.textureCoord);
        }
        gl.useProgram(this.programInfo2.program);
        gl.uniform1i(this.programInfo2.uniformLocations.uimg0, 0);

        gl.enable( gl.BLEND );
        gl.blendFunc( gl.ONE, gl.ONE_MINUS_SRC_ALPHA );

        gl.uniform1f(this.programInfo2.uniformLocations.sharpen, 0);
        gl.uniform1f(this.programInfo2.uniformLocations.t, -1);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, itexture, 0);
        {
          const vertexCount = 4;
          const type = gl.UNSIGNED_SHORT;
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, this.targetTexture[nSubPlanes % 2]);
          gl.drawElements(gl.TRIANGLE_STRIP, vertexCount, type, 0);
        }
        //console.log(i);
        //break;
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.enable( gl.BLEND );
      gl.blendFunc( gl.SRC_ALPHA, gl.ONE);
      gl.uniform1f(this.programInfo2.uniformLocations.sharpen, 0);
      gl.uniform1f(this.programInfo2.uniformLocations.t, ti[ii]);

      gl.viewport(cx, cy, cw, ch);
      {
        const vertexCount = 4;
        const type = gl.UNSIGNED_SHORT;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, itexture);
        gl.drawElements(gl.TRIANGLE_STRIP, vertexCount, type, 0);
      }
    }

  }

  drawSceneNoVR(modelViewMatrix, deltaTime) {
    this.drawScene(modelViewMatrix, null, null, 0, 0, w, h, true, deltaTime, false);
  }

}
